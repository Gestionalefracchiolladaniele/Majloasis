import { env } from './env';

// ─────────────────────────────────────────────────────────────
// Apify integration.
//
// IMPORTANT (vedi CLAUDE.md): lo scraping passa SOLO da Apify, che usa proxy/
// account propri. Non si usano MAI le credenziali LinkedIn dell'utente. Gli
// Actor scelti sono "no cookie".
//
// Actor di default (override via env APIFY_PROFILE_ACTOR / APIFY_JOB_ACTOR):
//  - profili: khadinakbar~linkedin-profile-search-scraper (no cookie, PAY_PER_EVENT,
//    nessun cap "10 run/mese" — a differenza di harvestapi. Testato dal vivo: torna
//    founder/CEO reali. Input: keywords + location + maxResults).
//  - lavori:  harvestapi~linkedin-job-search
// Se un Actor non fosse disponibile sul tuo account, cambialo via env: usa lo
// slug nel formato "username~actor-name".
// ─────────────────────────────────────────────────────────────

const APIFY_BASE = 'https://api.apify.com/v2';

/** Lancia un Actor in modalità sincrona e ritorna gli item del dataset. */
async function runActor<T = Record<string, unknown>>(
  actorId: string,
  input: Record<string, unknown>,
  { timeoutSecs = 240 }: { timeoutSecs?: number } = {},
): Promise<T[]> {
  const url =
    `${APIFY_BASE}/acts/${actorId}/run-sync-get-dataset-items` +
    `?token=${encodeURIComponent(env.apifyToken)}&timeout=${timeoutSecs}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Apify actor ${actorId} failed: ${res.status} ${text.slice(0, 300)}`);
  }
  return (await res.json()) as T[];
}

// ── Normalised shapes used by the rest of the app ──
export interface RawProfile {
  linkedin_url: string;
  name: string | null;
  first_name: string | null; // nome di battesimo → genere più preciso
  headline: string | null;
  company: string | null;
  location: string | null;
  photo_url: string | null;
  followers: number | null; // presente solo in modalità Full
  tenure_years: number | null; // anni nel ruolo attuale (solidità)
  premium: boolean; // segnale di profilo serio
  raw: Record<string, unknown>;
}

export interface RawJob {
  linkedin_url: string;
  title: string | null;
  company: string | null;
  location: string | null;
  description: string | null;
  raw: Record<string, unknown>;
}

// Rimuove i marcatori di direzione bidirezionale (RTL/LRM, es. da profili arabi)
// e gli zero-width, che sporcano nome/first_name e sballano il guess del genere.
function cleanText(s: string): string {
  return s.replace(/[‎‏‪-‮⁦-⁩​-‍﻿]/g, '').trim();
}

function pick(o: Record<string, unknown>, keys: string[]): string | null {
  for (const k of keys) {
    const v = o[k];
    if (typeof v === 'string' && cleanText(v)) return cleanText(v);
  }
  return null;
}

function pickNum(o: Record<string, unknown>, keys: string[]): number | null {
  for (const k of keys) {
    const v = o[k];
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    if (typeof v === 'string' && v.trim() && !Number.isNaN(Number(v))) return Number(v);
  }
  return null;
}

/** Normalises an arbitrary profile item from any LinkedIn profile Actor.
 *  Gestisce sia formati piatti sia la struttura annidata di harvestapi
 *  (location.linkedinText, currentPositions[], firstName/lastName, summary). */
function normalizeProfile(item: Record<string, unknown>): RawProfile | null {
  // URL pieno, oppure ricostruito dal publicIdentifier (khadinakbar-search lo espone).
  const publicId = pick(item, ['publicIdentifier', 'public_identifier']);
  const url =
    pick(item, ['linkedinUrl', 'url', 'profileUrl', 'publicProfileUrl', 'inputUrl']) ??
    (publicId ? `https://www.linkedin.com/in/${publicId}` : null);
  if (!url) return null;

  const first = pick(item, ['firstName']);
  const last = pick(item, ['lastName']);
  const composedName = [first, last].filter(Boolean).join(' ') || null;
  const name = pick(item, ['fullName', 'name']) ?? composedName;

  // posizione attuale: array currentPositions (harvestapi) o experiences
  const positions = (item.currentPositions ?? item.experiences ?? item.experience) as unknown;
  const firstPos =
    Array.isArray(positions) && positions[0] && typeof positions[0] === 'object'
      ? (positions[0] as Record<string, unknown>)
      : null;

  const company =
    pick(item, ['companyName', 'company', 'currentCompany']) ??
    (firstPos ? pick(firstPos, ['companyName', 'company']) : null);

  // headline: campo esplicito, oppure "Ruolo @ Azienda", oppure il summary.
  // khadinakbar espone il ruolo come `jobTitle` a livello item.
  const role =
    pick(item, ['title', 'currentTitle', 'jobTitle']) ??
    (firstPos ? pick(firstPos, ['title', 'position']) : null);
  const headline =
    pick(item, ['headline', 'occupation', 'subTitle']) ??
    (role && company ? `${role} @ ${company}` : role) ??
    pick(item, ['summary', 'snippet']);

  // località: stringa piatta o annidata location.linkedinText
  let location = pick(item, ['location', 'addressWithCountry', 'geoLocationName', 'locationName']);
  if (!location && item.location && typeof item.location === 'object') {
    location = pick(item.location as Record<string, unknown>, ['linkedinText', 'text', 'name']);
  }

  // anni nel ruolo attuale (solidità del profilo)
  let tenureYears: number | null = null;
  if (firstPos && firstPos.tenureAtCompany && typeof firstPos.tenureAtCompany === 'object') {
    tenureYears = pickNum(firstPos.tenureAtCompany as Record<string, unknown>, ['numYears']);
  }

  return {
    linkedin_url: url.split('?')[0].replace(/\/$/, ''),
    name,
    first_name: first,
    headline,
    company,
    location,
    photo_url: pick(item, ['profilePic', 'profilePicture', 'photoUrl', 'pictureUrl', 'avatar']),
    followers: pickNum(item, ['followers', 'followerCount', 'followersCount', 'numFollowers']),
    tenure_years: tenureYears,
    premium: item.premium === true,
    raw: item,
  };
}

function normalizeJob(item: Record<string, unknown>): RawJob | null {
  const url = pick(item, ['jobUrl', 'url', 'link', 'jobPostingUrl']);
  if (!url) return null;
  return {
    linkedin_url: url.split('?')[0].replace(/\/$/, ''),
    title: pick(item, ['title', 'jobTitle', 'positionName']),
    company: pick(item, ['companyName', 'company']),
    location: pick(item, ['location', 'jobLocation']),
    description: pick(item, ['description', 'descriptionText', 'jobDescription']),
    raw: item,
  };
}

/**
 * Cerca profili LinkedIn per parole chiave + città.
 * @param keywords  termini di ricerca (es. ["founder","CEO","tech"])
 * @param cities    città target (es. ["Dubai","UAE"])
 * @param limit     numero massimo di profili da raccogliere
 */
export async function searchProfiles(
  keywords: string[],
  cities: string[],
  limit = 100,
  page = 1,
): Promise<RawProfile[]> {
  // searchQuery va tenuta SEMPLICE (niente OR/parentesi). "UAE" → nome esteso.
  const query = keywords.slice(0, 4).join(' ');
  const locations = cities.map((c) => (c.toUpperCase() === 'UAE' ? 'United Arab Emirates' : c));

  // L'input contiene i campi degli schemi supportati, così la funzione resta valida
  // qualunque sia l'Actor scelto via env (ognuno legge solo i campi che conosce):
  //  - khadinakbar~linkedin-profile-search-scraper (default): keywords + location (stringa) + maxResults
  //  - harvestapi~linkedin-profile-search (fallback): profileScraperMode + locations[] + maxItems + startPage
  const input: Record<string, unknown> = {
    // khadinakbar: ricerca profili da keyword+località (no cookie, PAY_PER_EVENT).
    keywords: query,
    location: locations[0] ?? '',
    maxResults: limit,
    // harvestapi (se ripristinato via env): profileScraperMode è OBBLIGATORIO per lui.
    profileScraperMode: process.env.APIFY_PROFILE_MODE || 'Short',
    locations,
    maxItems: limit,
    // comune / altri schemi
    searchQuery: query,
    // Paginazione: ogni giro parte da una pagina diversa → profili NUOVI (harvestapi).
    startPage: page,
    searchPage: page,
    page,
  };

  const items = await runActor(env.apifyProfileActor, input);
  console.log(
    `[apify] searchProfiles query="${query}" page=${page} locations=${JSON.stringify(locations)} → ${items.length} item`,
  );
  const out: RawProfile[] = [];
  const seen = new Set<string>();
  for (const it of items) {
    const p = normalizeProfile(it);
    if (p && !seen.has(p.linkedin_url)) {
      seen.add(p.linkedin_url);
      out.push(p);
    }
  }
  return out.slice(0, limit);
}

/** Cerca offerte di lavoro inerenti alle parole chiave / città del profilo utente. */
export async function searchJobs(
  keywords: string[],
  cities: string[],
  limit = 50,
): Promise<RawJob[]> {
  const input: Record<string, unknown> = {
    title: keywords.join(' '),
    searchQuery: keywords.join(' '),
    keywords,
    location: cities[0] ?? '',
    locations: cities,
    maxItems: limit,
    maxResults: limit,
    rows: limit,
  };

  const items = await runActor(env.apifyJobActor, input);
  const out: RawJob[] = [];
  const seen = new Set<string>();
  for (const it of items) {
    const j = normalizeJob(it);
    if (j && !seen.has(j.linkedin_url)) {
      seen.add(j.linkedin_url);
      out.push(j);
    }
  }
  return out.slice(0, limit);
}

/** Scrapa UN singolo profilo (per il setup "Il mio profilo"). */
export async function scrapeSingleProfile(profileUrl: string): Promise<RawProfile | null> {
  // harvestapi/linkedin-profile-scraper usa `urls`; profileScraperMode opzionale.
  const input: Record<string, unknown> = {
    urls: [profileUrl],
    profileUrls: [profileUrl],
    startUrls: [{ url: profileUrl }],
    // harvestapi-scraper: valore esatto richiesto dall'Actor (no email = più economico)
    profileScraperMode: 'Profile details no email ($4 per 1k)',
    maxItems: 1,
  };
  const items = await runActor(env.apifyProfileDetailActor, input);
  for (const it of items) {
    const p = normalizeProfile(it);
    if (p) return p;
  }
  return null;
}
