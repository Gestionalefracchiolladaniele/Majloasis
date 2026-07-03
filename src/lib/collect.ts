import { supabaseAdmin } from './supabase';
import { searchProfiles, searchJobs, searchPosts } from './apify';
import { evaluateContacts, evaluateJobs, evaluatePosts } from './gemini';
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

// Un profilo è "in zona" se cita Dubai/dintorni UAE in un qualsiasi campo testuale
// (location, headline, azienda, o lo snippet grezzo dell'Actor). Serve perché
// khadinakbar spesso lascia `location` vuota → senza questo, entrerebbero anche
// eventuali profili non-UAE che Google infila nei risultati. Città entro ~10 min da
// Dubai + termini UAE generici (l'esclusione dei profili altrove è più importante che
// distinguere fra le città vicine).
const UAE_SIGNAL = /dubai|sharjah|ajman|\buae\b|united arab emirates|emirat/i;
function hasUaeSignal(p: RawProfile): boolean {
  const rawText = (() => {
    try {
      return JSON.stringify(p.raw ?? {});
    } catch {
      return '';
    }
  })();
  const haystack = [p.location, p.headline, p.company, rawText].filter(Boolean).join(' ');
  return UAE_SIGNAL.test(haystack);
}

// Orchestratore del giro giornaliero: Apify → dedup → Gemini batch → Supabase.
// Usato dalla route cron e da un eventuale trigger manuale.

// Default tarati per stare nei limiti di tempo del piano Vercel hobby (~60s per
// funzione). 100 profili = ~10 batch Gemini con sleep ⇒ rischio timeout su hobby.
// Su Vercel Pro (300s) puoi alzarli via env COLLECT_PROFILE_LIMIT / COLLECT_JOB_LIMIT.
// 15 (non 25/50): meno profili per giro = Apify costa meno per giro, e soprattutto
// Gemini valuta lotti più piccoli con meno score saltati (JSON meno lungo da generare).
// Allineato al ritmo invii dell'utente (~15-20/giorno). Override via env se serve di più.
// 10 (non 15): khadinakbar cerca via Google e il tempo cresce col n. di risultati da
// estrarre; con 10 sta più comodamente sotto i 60s di Vercel hobby. Con la rotazione
// keyword+città bastano comunque a portare lead nuovi ogni giro. Override via env.
const DEFAULT_PROFILE_LIMIT = Number(process.env.COLLECT_PROFILE_LIMIT ?? 10);
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
  opts: {
    profileLimit?: number;
    jobLimit?: number;
    what?: 'all' | 'people' | 'jobs';
    // Se true: salta la valutazione Gemini e salva i profili con score/eval null
    // (veloce → sta sotto i 60s di Vercel hobby). Lo score si completa poi con
    // /api/backfill ("Completa score"). Evita il timeout → niente spinner infinito.
    skipEval?: boolean;
  } = {},
): Promise<CollectResult> {
  const what = opts.what ?? 'all';
  const skipEval = opts.skipEval ?? false;
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

  // ── Rotazione ricerca (per khadinakbar) ──────────────────────────────────
  // khadinakbar cerca via Google e IGNORA la paginazione: con la stessa query
  // ritorna sempre i top profili → tutti duplicati → 0 lead nuovi. Per avere
  // profili NUOVI ad ogni giro variamo la COMBINAZIONE keyword+città. Usiamo
  // _lastProfilePage come indice di rotazione (riuso del campo esistente, no schema).
  //
  // Città: solo Dubai e dintorni entro ~10 min d'auto (Sharjah confina; Ajman è
  // subito oltre Sharjah). Abu Dhabi (~1h30) è escluso di proposito.
  const CITY_ROTATION = ['Dubai', 'Sharjah', 'Ajman'];
  // Combinazioni di keyword: sottoinsiemi diversi delle keyword utente, così ogni
  // giro Google vede una query diversa. Se l'utente ha poche keyword, degradano bene.
  const kwPool = keywords.length ? keywords : ['founder', 'CEO', 'investor', 'tech', 'AI'];
  const KEYWORD_ROTATION: string[][] = [
    kwPool.slice(0, 3),
    kwPool.slice(1, 4).length ? kwPool.slice(1, 4) : kwPool.slice(0, 3),
    kwPool.slice(2, 5).length ? kwPool.slice(2, 5) : kwPool.slice(0, 3),
    kwPool.slice(0, 2).length ? kwPool.slice(0, 2) : kwPool.slice(0, 3),
  ].filter((s) => s.length);
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
  // Rotazione: ogni giro usa una combinazione keyword+città diversa (vedi sopra),
  // così khadinakbar (che ignora la paginazione) restituisce profili NUOVI.
  const rot = prefs?._lastProfilePage ?? 0; // riuso il campo come indice di rotazione
  const rotKeywords = KEYWORD_ROTATION[rot % KEYWORD_ROTATION.length];
  // Città: quella della rotazione, ma ristretta a quelle scelte dall'utente se le ha.
  const allowedCities = cities.filter((c) => CITY_ROTATION.includes(c));
  const cityPool = allowedCities.length ? allowedCities : CITY_ROTATION;
  const rotCity = cityPool[rot % cityPool.length];

  const profiles = doPeople
    ? await searchProfiles(
        rotKeywords,
        [rotCity],
        opts.profileLimit ?? DEFAULT_PROFILE_LIMIT,
        1,
      )
    : [];
  result.profilesFound = profiles.length;

  // Avanza l'indice di rotazione per il prossimo giro (combinazione diversa).
  if (doPeople && userId && prefs) {
    await db
      .from('user_profile')
      .update({ preferences: { ...prefs, _lastProfilePage: rot + 1 } })
      .eq('id', userId);
  }

  // Filtro GEOGRAFICO: khadinakbar (Google) a volte non restituisce `location`, e Google
  // può infilare qualche profilo non-UAE. Teniamo solo chi ha ALMENO UN segnale "Dubai/UAE"
  // in location / headline / company / testo grezzo (snippet). Chi non ha NESSUN segnale
  // geografico viene scartato → alza la precisione "profilo davvero in zona" a ~90%+.
  const geoProfiles = doPeople ? profiles.filter(hasUaeSignal) : profiles;
  if (doPeople) {
    result.profilesFound = geoProfiles.length; // conteggio dopo il filtro geo
    console.log(`[collect] geo-filter: ${profiles.length} → ${geoProfiles.length} con segnale UAE`);
  }

  // Filtro fascia follower: se il follower count è disponibile (modalità Full),
  // scarta chi è FUORI dalla fascia [min, max] prima di spendere Gemini su di lui.
  // In Short followers è null → il filtro numerico non si applica: a orientare
  // verso la fascia ci pensa Gemini (la fascia è passata nel prompt, vedi gemini.ts).
  const filtered = geoProfiles.filter(
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
      // skipEval: nessuna chiamata Gemini ora (i lead compaiono subito, score dopo
      // con "Completa score"/backfill). Altrimenti valuta in batch come sempre.
      const evals = skipEval ? null : await evaluateContacts(fresh, summary, prefs);
      const rows = fresh.map((p) => {
        const ev = evals?.get(p.linkedin_url);
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
      const evals = skipEval ? null : await evaluateJobs(fresh, summary, prefs);
      const rows = fresh.map((j) => {
        const ev = evals?.get(j.linkedin_url);
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

export async function runBackfillScores(
  limit = 60,
  ids?: string[],
): Promise<BackfillResult> {
  const db = supabaseAdmin();

  const { data: userRows } = await db
    .from('user_profile')
    .select('summary, preferences')
    .order('updated_at', { ascending: false })
    .limit(1);
  const summary: string | null = userRows?.[0]?.summary ?? null;
  const prefs: UserPreferences | null = userRows?.[0]?.preferences ?? null;

  // Se arriva una lista di id (selezione dell'utente in dashboard), valuta SOLO quelli
  // (comunque solo i loro senza score) → meno chiamate Gemini. Altrimenti tutti i null.
  let q = db
    .from('contacts')
    .select('id, linkedin_url, name, headline, company, location, raw')
    .is('score', null);
  if (ids?.length) q = q.in('id', ids);
  const { data: rows } = await q.limit(limit);

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

// ─────────────────────────────────────────────────────────────
// Tab "Commenta": trova post RECENTI su cui commentare (top-of-funnel).
// On-demand (bottone), NON cron. Flusso: Apify post-search (ultime ore) →
// dedup (fuori chi è già in contacts + post/persone già viste) → Gemini valuta
// come i lead → tiene i migliori → salva in comment_posts SENZA commento
// (il commento si genera dopo, a comando). Restituisce quanti nuovi ne restano.
// ─────────────────────────────────────────────────────────────
export interface FindPostsResult {
  found: number; // post tornati da Apify
  fresh: number; // nuovi dopo il dedup
  saved: number; // salvati (i migliori valutati)
  note?: string;
}

// Non ripescare la stessa persona per N giorni (default 14): dopo un po' va bene
// ricommentarla, ma non nella stessa settimana. Override via env.
const POST_AUTHOR_COOLDOWN_DAYS = Number(process.env.COMMENT_AUTHOR_COOLDOWN_DAYS ?? 14);
// Quanti post mostrare per click (i migliori dopo la valutazione).
const FIND_POSTS_KEEP = Number(process.env.COMMENT_POSTS_KEEP ?? 10);

export async function runFindPosts(
  opts: { postedLimit?: string; scrapeLimit?: number; keep?: number } = {},
): Promise<FindPostsResult> {
  const db = supabaseAdmin();
  const postedLimit = opts.postedLimit ?? '24h';
  const scrapeLimit = opts.scrapeLimit ?? 40; // ne prendo più di 10: filtro poi
  const keep = opts.keep ?? FIND_POSTS_KEEP;

  const result: FindPostsResult = { found: 0, fresh: 0, saved: 0 };

  // 1. Profilo utente (metro + query)
  const { data: userRows } = await db
    .from('user_profile')
    .select('summary, preferences')
    .order('updated_at', { ascending: false })
    .limit(1);
  const summary: string | null = userRows?.[0]?.summary ?? null;
  const prefs: UserPreferences | null = userRows?.[0]?.preferences ?? null;

  const keywords = prefs?.keywords?.length ? prefs.keywords : ['AI', 'founder', 'tech', 'startup'];
  const city = prefs?.cities?.[0] ?? 'Dubai';
  // Città DENTRO la query (l'Actor non ha filtro geografico) + un paio di angoli tuoi.
  const queries = [
    `${keywords.slice(0, 2).join(' ')} ${city}`,
    `${city} ${keywords.slice(2, 4).join(' ') || 'startup founder'}`,
  ].filter((q) => q.trim());

  // 2. Scrape post recenti
  const posts = await searchPosts(queries, postedLimit, scrapeLimit);
  result.found = posts.length;
  if (!posts.length) {
    result.note = 'Nessun post trovato in questa finestra. Riprova o allarga il periodo.';
    return result;
  }

  // 3. Dedup
  const postUrls = posts.map((p) => p.post_url);
  const authorUrls = posts.map((p) => p.author_url).filter((u): u is string => !!u);

  // 3a. post già visti
  const { data: seenPosts } = await db
    .from('comment_posts')
    .select('post_url')
    .in('post_url', postUrls);
  const seenPostSet = new Set((seenPosts ?? []).map((r) => r.post_url));

  // 3b. persona già in Majloasis (contacts) → NON è "gente nuova"
  const { data: inContacts } = authorUrls.length
    ? await db.from('contacts').select('linkedin_url').in('linkedin_url', authorUrls)
    : { data: [] as { linkedin_url: string }[] };
  const contactSet = new Set((inContacts ?? []).map((r) => r.linkedin_url));

  // 3c. persona già proposta di recente (cooldown) → gente sempre diversa
  const cutoff = new Date(Date.now() - POST_AUTHOR_COOLDOWN_DAYS * 86400_000).toISOString();
  const { data: recentAuthors } = authorUrls.length
    ? await db
        .from('comment_posts')
        .select('author_url')
        .in('author_url', authorUrls)
        .gte('created_at', cutoff)
    : { data: [] as { author_url: string | null }[] };
  const recentAuthorSet = new Set(
    (recentAuthors ?? []).map((r) => r.author_url).filter((u): u is string => !!u),
  );

  const seenAuthorsThisRun = new Set<string>();
  const fresh = posts.filter((p) => {
    if (seenPostSet.has(p.post_url)) return false;
    if (p.author_url && contactSet.has(p.author_url)) return false;
    if (p.author_url && recentAuthorSet.has(p.author_url)) return false;
    // un solo post per autore in questo stesso giro
    if (p.author_url) {
      if (seenAuthorsThisRun.has(p.author_url)) return false;
      seenAuthorsThisRun.add(p.author_url);
    }
    return true;
  });
  result.fresh = fresh.length;
  if (!fresh.length) {
    result.note = 'Tutti i post trovati erano già visti o di persone già nel pool. Riprova più tardi.';
    return result;
  }

  // 4. Gemini valuta (come i lead) → tieni i migliori
  const evals = await evaluatePosts(fresh, summary, prefs);
  const ranked = fresh
    .map((p) => ({ p, ev: evals.get(p.post_url) }))
    .filter((x) => (x.ev?.score ?? 0) >= 25) // sotto 25 = spam/off-topic, scartati
    .sort((a, b) => (b.ev?.score ?? 0) - (a.ev?.score ?? 0))
    .slice(0, keep);

  if (!ranked.length) {
    result.note = 'Nessun post abbastanza pertinente da valere un commento. Riprova più tardi.';
    return result;
  }

  const rows = ranked.map(({ p, ev }) => ({
    post_url: p.post_url,
    author_url: p.author_url,
    author_name: p.author_name,
    author_headline: p.author_headline,
    author_photo: p.author_photo,
    content: p.content,
    posted_at: p.posted_at,
    likes: p.likes ?? 0,
    comments: p.comments ?? 0,
    raw: p.raw,
    score: ev?.score ?? null,
    reason: ev?.reason ?? null,
  }));

  const { data, error } = await db
    .from('comment_posts')
    .upsert(rows, { onConflict: 'post_url', ignoreDuplicates: true })
    .select('id');
  if (error) result.note = `comment_posts insert: ${error.message}`;
  result.saved = data?.length ?? 0;

  return result;
}
