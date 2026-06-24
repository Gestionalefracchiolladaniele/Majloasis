import { supabaseAdmin } from './supabase';
import { searchProfiles, searchJobs } from './apify';
import { evaluateContacts, evaluateJobs } from './gemini';
import type { UserPreferences } from './types';
import type { RawProfile } from './apify';

// Chiave d'identità per la dedup semantica: nome + azienda normalizzati (lowercase,
// spazi/accenti compattati). Restituisce null se manca il nome (non deduplicabile).
function identityKey(name: string | null | undefined, company: string | null | undefined): string | null {
  const n = (name ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
  if (!n) return null;
  const c = (company ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
  return `${n}|${c}`;
}

function isDuplicateIdentity(p: RawProfile, knownKeys: Set<string>): boolean {
  const k = identityKey(p.name, p.company);
  return k !== null && knownKeys.has(k);
}

// Orchestratore del giro giornaliero: Apify → dedup → Gemini batch → Supabase.
// Usato dalla route cron e da un eventuale trigger manuale.

// Default tarati per stare nei limiti di tempo del piano Vercel hobby (~60s per
// funzione). 100 profili = ~10 batch Gemini con sleep ⇒ rischio timeout su hobby.
// Su Vercel Pro (300s) puoi alzarli via env COLLECT_PROFILE_LIMIT / COLLECT_JOB_LIMIT.
// 15 (non 25/50): meno profili per giro = Apify costa meno per giro, e soprattutto
// Gemini valuta lotti più piccoli con meno score saltati (JSON meno lungo da generare).
// Allineato al ritmo invii dell'utente (~15-20/giorno). Override via env se serve di più.
const DEFAULT_PROFILE_LIMIT = Number(process.env.COLLECT_PROFILE_LIMIT ?? 15);
const DEFAULT_JOB_LIMIT = Number(process.env.COLLECT_JOB_LIMIT ?? 15);

export interface CollectResult {
  profilesFound: number;
  profilesNew: number;
  profilesSaved: number;
  jobsFound: number;
  jobsNew: number;
  jobsSaved: number;
  note?: string;
}

export async function runCollect(
  opts: { profileLimit?: number; jobLimit?: number; what?: 'all' | 'people' | 'jobs' } = {},
): Promise<CollectResult> {
  const what = opts.what ?? 'all';
  const doPeople = what === 'all' || what === 'people';
  const doJobs = what === 'all' || what === 'jobs';
  const db = supabaseAdmin();

  // 1. Carica profilo utente (metro di valutazione)
  const { data: userRows } = await db
    .from('user_profile')
    .select('id, summary, preferences')
    .order('updated_at', { ascending: false })
    .limit(1);

  const userId: string | null = userRows?.[0]?.id ?? null;
  const summary: string | null = userRows?.[0]?.summary ?? null;
  const prefs: UserPreferences | null = userRows?.[0]?.preferences ?? null;

  const keywords = prefs?.keywords?.length
    ? prefs.keywords
    : ['founder', 'CEO', 'investor', 'tech', 'AI'];
  const cities = prefs?.cities?.length ? prefs.cities : ['Dubai', 'UAE'];
  // Fascia follower target. Default "Modesto" (parti da 0): 500–3000. Sotto il min =
  // profili inattivi/poco utili; sopra il max = "pesci troppo grossi" irraggiungibili.
  const minFollowers = prefs?.min_followers ?? 500;
  const maxFollowers = prefs?.max_followers ?? 3000;

  const result: CollectResult = {
    profilesFound: 0,
    profilesNew: 0,
    profilesSaved: 0,
    jobsFound: 0,
    jobsNew: 0,
    jobsSaved: 0,
  };

  // 2. PROFILI: scrape → dedup → valutazione → insert
  // Paginazione: ogni giro avanza di una pagina così prende profili NUOVI.
  const page = (prefs?._lastProfilePage ?? 0) + 1;
  const profiles = doPeople
    ? await searchProfiles(keywords, cities, opts.profileLimit ?? DEFAULT_PROFILE_LIMIT, page)
    : [];
  result.profilesFound = profiles.length;

  // Salva la pagina per il prossimo giro (torna a 1 se questa è vuota → riparte).
  if (doPeople && userId && prefs) {
    const nextPage = profiles.length === 0 ? 1 : page;
    await db
      .from('user_profile')
      .update({ preferences: { ...prefs, _lastProfilePage: nextPage } })
      .eq('id', userId);
  }

  // Filtro fascia follower: se il follower count è disponibile (modalità Full),
  // scarta chi è FUORI dalla fascia [min, max] prima di spendere Gemini su di lui.
  // In Short followers è null → il filtro numerico non si applica: a orientare
  // verso la fascia ci pensa Gemini (la fascia è passata nel prompt, vedi gemini.ts).
  const filtered = profiles.filter(
    (p) => p.followers == null || (p.followers >= minFollowers && p.followers <= maxFollowers),
  );

  if (filtered.length) {
    const urls = filtered.map((p) => p.linkedin_url);
    const { data: existing } = await db
      .from('contacts')
      .select('linkedin_url')
      .in('linkedin_url', urls);
    const seen = new Set((existing ?? []).map((r) => r.linkedin_url));

    // Dedup SEMANTICA: la stessa persona può ricomparire con un URL diverso
    // (vanity URL cambiato, profilo re-indicizzato). Confronto anche (nome+azienda)
    // normalizzati contro quelli già in DB così non ri-valuto/ri-mostro lo stesso umano.
    const { data: known } = await db.from('contacts').select('name, company');
    const knownKeys = new Set(
      (known ?? [])
        .map((r) => identityKey(r.name, r.company))
        .filter((k): k is string => k !== null),
    );
    // knownKeys accumula anche i duplicati interni a questo stesso giro.
    const fresh = filtered.filter((p) => {
      if (seen.has(p.linkedin_url) || isDuplicateIdentity(p, knownKeys)) return false;
      const k = identityKey(p.name, p.company);
      if (k) knownKeys.add(k);
      return true;
    });
    result.profilesNew = fresh.length;

    if (fresh.length) {
      const evals = await evaluateContacts(fresh, summary, prefs);
      const rows = fresh.map((p) => {
        const ev = evals.get(p.linkedin_url);
        return {
          linkedin_url: p.linkedin_url,
          name: p.name,
          headline: p.headline,
          company: p.company,
          location: p.location,
          photo_url: p.photo_url,
          raw: p.raw,
          score: ev?.score ?? null,
          gender_guess: ev?.gender_guess ?? null,
          reason: ev?.reason ?? null,
          badges: ev?.badges ?? [],
          category: ev?.category ?? null,
          status: 'da_valutare' as const,
        };
      });
      // upsert con ignore-duplicates per sicurezza sulle race
      const { data, error } = await db
        .from('contacts')
        .upsert(rows, { onConflict: 'linkedin_url', ignoreDuplicates: true })
        .select('id');
      if (error) result.note = `contacts insert: ${error.message}`;
      result.profilesSaved = data?.length ?? 0;
    }
  }

  // 3. LAVORI: scrape → dedup → valutazione → insert
  const jobs = doJobs
    ? await searchJobs(keywords, cities, opts.jobLimit ?? DEFAULT_JOB_LIMIT)
    : [];
  result.jobsFound = jobs.length;

  if (jobs.length) {
    const urls = jobs.map((j) => j.linkedin_url);
    const { data: existing } = await db
      .from('jobs')
      .select('linkedin_url')
      .in('linkedin_url', urls);
    const seen = new Set((existing ?? []).map((r) => r.linkedin_url));
    const fresh = jobs.filter((j) => !seen.has(j.linkedin_url));
    result.jobsNew = fresh.length;

    if (fresh.length) {
      const evals = await evaluateJobs(fresh, summary, prefs);
      const rows = fresh.map((j) => {
        const ev = evals.get(j.linkedin_url);
        return {
          linkedin_url: j.linkedin_url,
          title: j.title,
          company: j.company,
          location: j.location,
          description: j.description,
          raw: j.raw,
          score: ev?.score ?? null,
          reason: ev?.reason ?? null,
          status: 'da_valutare' as const,
        };
      });
      const { data, error } = await db
        .from('jobs')
        .upsert(rows, { onConflict: 'linkedin_url', ignoreDuplicates: true })
        .select('id');
      if (error) result.note = `${result.note ?? ''} jobs insert: ${error.message}`;
      result.jobsSaved = data?.length ?? 0;
    }
  }

  return result;
}

// ─────────────────────────────────────────────────────────────
// Backfill score mancanti: ri-valuta i contatti che Gemini ha SALTATO
// (score IS NULL) — capita su 429/timeout o JSON troncato in un batch grande.
// Non ri-scrapa Apify (nessun costo extra): riusa i dati già salvati in DB.
// ─────────────────────────────────────────────────────────────
export interface BackfillResult {
  missing: number; // contatti senza score trovati
  fixed: number; // contatti a cui abbiamo assegnato uno score
}

export async function runBackfillScores(limit = 60): Promise<BackfillResult> {
  const db = supabaseAdmin();

  const { data: userRows } = await db
    .from('user_profile')
    .select('summary, preferences')
    .order('updated_at', { ascending: false })
    .limit(1);
  const summary: string | null = userRows?.[0]?.summary ?? null;
  const prefs: UserPreferences | null = userRows?.[0]?.preferences ?? null;

  const { data: rows } = await db
    .from('contacts')
    .select('id, linkedin_url, name, headline, company, location, raw')
    .is('score', null)
    .limit(limit);

  const pending = rows ?? [];
  if (!pending.length) return { missing: 0, fixed: 0 };

  // Ricostruisco dei RawProfile minimi dai dati già in DB (niente Apify).
  const profiles: RawProfile[] = pending.map((c) => {
    const raw = (c.raw ?? {}) as Record<string, unknown>;
    const first = c.name ? c.name.trim().split(/\s+/)[0] : null;
    return {
      linkedin_url: c.linkedin_url,
      name: c.name,
      first_name: (raw.first_name as string) ?? first,
      headline: c.headline,
      company: c.company,
      location: c.location,
      photo_url: null,
      followers: typeof raw.followers === 'number' ? raw.followers : null,
      tenure_years: typeof raw.tenure_years === 'number' ? raw.tenure_years : null,
      premium: raw.premium === true,
      raw,
    };
  });

  const evals = await evaluateContacts(profiles, summary, prefs);

  let fixed = 0;
  for (const c of pending) {
    const ev = evals.get(c.linkedin_url);
    if (!ev) continue;
    const { error } = await db
      .from('contacts')
      .update({
        score: ev.score,
        gender_guess: ev.gender_guess,
        reason: ev.reason,
        badges: ev.badges ?? [],
        category: ev.category,
      })
      .eq('id', c.id);
    if (!error) fixed++;
  }

  return { missing: pending.length, fixed };
}

// ─────────────────────────────────────────────────────────────
// Time machine (A): ri-valuta contatti GIÀ valutati col profilo utente AGGIORNATO.
// Il tuo profilo LinkedIn migliora nel tempo → chi prima non era un match ora può
// esserlo. Non ri-scrapa Apify (riusa il raw in DB) → costo 0.
// Si limita ai contatti ancora "in gioco" (non già invitati/scartati) e ai più
// vecchi/mai-rivalutati. Salva prev_score per evidenziare chi è salito.
// ─────────────────────────────────────────────────────────────
export interface RevalueResult {
  considered: number;
  rescored: number;
  improved: number; // quanti hanno guadagnato punteggio
}

export async function runRevalue(limit = 45): Promise<RevalueResult> {
  const db = supabaseAdmin();

  const { data: userRows } = await db
    .from('user_profile')
    .select('summary, preferences')
    .order('updated_at', { ascending: false })
    .limit(1);
  const summary: string | null = userRows?.[0]?.summary ?? null;
  const prefs: UserPreferences | null = userRows?.[0]?.preferences ?? null;

  // Solo contatti ancora "in gioco" e già con uno score; i meno freschi prima.
  const { data: rows } = await db
    .from('contacts')
    .select('id, linkedin_url, name, headline, company, location, score, raw, revalued_at')
    .in('status', ['da_valutare', 'da_fare'])
    .eq('rel_status', 'nessuno')
    .not('score', 'is', null)
    .order('revalued_at', { ascending: true, nullsFirst: true })
    .limit(limit);

  const pending = rows ?? [];
  if (!pending.length) return { considered: 0, rescored: 0, improved: 0 };

  const profiles: RawProfile[] = pending.map((c) => {
    const raw = (c.raw ?? {}) as Record<string, unknown>;
    const first = c.name ? c.name.trim().split(/\s+/)[0] : null;
    return {
      linkedin_url: c.linkedin_url,
      name: c.name,
      first_name: (raw.first_name as string) ?? first,
      headline: c.headline,
      company: c.company,
      location: c.location,
      photo_url: null,
      followers: typeof raw.followers === 'number' ? raw.followers : null,
      tenure_years: typeof raw.tenure_years === 'number' ? raw.tenure_years : null,
      premium: raw.premium === true,
      raw,
    };
  });

  const evals = await evaluateContacts(profiles, summary, prefs);
  const now = new Date().toISOString();

  let rescored = 0;
  let improved = 0;
  for (const c of pending) {
    const ev = evals.get(c.linkedin_url);
    if (!ev) continue;
    const old = c.score ?? 0;
    const { error } = await db
      .from('contacts')
      .update({
        prev_score: old,
        score: ev.score,
        gender_guess: ev.gender_guess,
        reason: ev.reason,
        badges: ev.badges ?? [],
        category: ev.category,
        revalued_at: now,
      })
      .eq('id', c.id);
    if (!error) {
      rescored++;
      if (ev.score > old) improved++;
    }
  }

  return { considered: pending.length, rescored, improved };
}
