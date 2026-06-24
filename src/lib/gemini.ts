import { GoogleGenAI } from '@google/genai';
import { env } from './env';
import type {
  ContactEvaluation,
  JobEvaluation,
  UserPreferences,
} from './types';
import type { RawProfile, RawJob } from './apify';

// ─────────────────────────────────────────────────────────────
// Gemini integration — modello gemini-2.5-flash-lite.
//
// Vincolo critico (vedi CLAUDE.md): poche chiamate. Si valutano i profili in
// BATCH (~10 per chiamata) → 100 profili = ~10 chiamate, non 100. Tra un batch
// e l'altro un piccolo sleep per restare sotto ~20 req/min.
// ─────────────────────────────────────────────────────────────

const MODEL = 'gemini-2.5-flash-lite';
// Batch da 15: compromesso tra "poche chiamate" e ACCURATEZZA. Lotti troppo grandi
// (20+) fanno talvolta troncare/saltare lo score di qualche profilo nel JSON di
// risposta; con 15 il modello sbaglia meno. Resta sotto il free tier (~20 req/min).
const BATCH_SIZE = 15;
const SLEEP_MS = 4000; // tra un batch e l'altro

let _client: GoogleGenAI | null = null;
function client(): GoogleGenAI {
  if (!_client) _client = new GoogleGenAI({ apiKey: env.geminiApiKey });
  return _client;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Estrae il primo array/oggetto JSON dal testo del modello (robusto a ```json). */
function parseJsonArray<T>(text: string): T[] {
  const cleaned = text
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .trim();
  const start = cleaned.indexOf('[');
  const end = cleaned.lastIndexOf(']');
  if (start === -1 || end === -1) return [];
  try {
    return JSON.parse(cleaned.slice(start, end + 1)) as T[];
  } catch {
    return [];
  }
}

async function generate(
  prompt: string,
  opts: { json?: boolean; temperature?: number } = {},
): Promise<string> {
  const { json = true, temperature = 0.3 } = opts;
  // Retry robusto: su 429 (quota) Gemini suggerisce un retryDelay (es. "23s").
  // Lo leggiamo e aspettiamo quel tempo invece di tirare a indovinare.
  let lastErr: unknown;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await client().models.generateContent({
        model: MODEL,
        contents: prompt,
        config: {
          temperature,
          ...(json ? { responseMimeType: 'application/json' } : {}),
        },
      });
      return res.text ?? '';
    } catch (e) {
      lastErr = e;
      const wait = retryDelayMs(e) ?? SLEEP_MS * (attempt + 1);
      // cap a 30s per non bloccare troppo a lungo la richiesta serverless
      await sleep(Math.min(wait, 30_000));
    }
  }
  throw lastErr;
}

/** Estrae il retryDelay suggerito da Gemini su errore 429 (in ms). */
function retryDelayMs(err: unknown): number | null {
  const msg = err instanceof Error ? err.message : String(err);
  // Gemini mette es. "retryDelay":"23s" oppure "retry in 23.8s"
  const m = msg.match(/"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/) ?? msg.match(/retry in (\d+(?:\.\d+)?)s/);
  if (m) return Math.ceil(parseFloat(m[1]) * 1000) + 500; // + margine
  return null;
}

function prefsBlock(summary: string | null, prefs: UserPreferences | null): string {
  const lines = [
    `PROFILO UTENTE (il metro di valutazione):`,
    summary || '(nessun riassunto disponibile)',
    '',
    `PREFERENZE:`,
    `- Obiettivo: ${prefs?.goal ?? 'networking a Dubai in vista di un trasferimento'}`,
    `- Contatto ideale: ${prefs?.ideal_contact ?? 'networking ampio, alto calibro'}`,
    `- Settori target: ${prefs?.target_sectors ?? 'nessuno specifico'}`,
    `- Cosa offre: ${prefs?.offer ?? 'AI-native Full-Stack Engineer'}`,
    `- Esclusioni: ${prefs?.exclusions?.join(', ') || 'profili umili/operativi e junior/entry-level'}`,
    `- Città target: ${prefs?.cities?.join(', ') || 'Dubai, UAE'}`,
    `- Parole chiave: ${prefs?.keywords?.join(', ') || 'founder, CEO, investor, tech leader'}`,
    `- Regola genere: ${prefs?.gender_rule ?? 'uomini → passa; nome ambiguo → passa; donne → escludi o in fondo (target ~90% uomini)'}`,
    `- Fascia di visibilità target (follower): ${reachBand(prefs)}`,
  ];
  return lines.join('\n');
}

// Descrive a parole la fascia follower desiderata. Serve soprattutto in modalità
// Short, dove il follower count non è disponibile e il filtro numerico non scatta:
// qui Gemini stima la visibilità dal profilo e penalizza chi è fuori fascia.
function reachBand(prefs: UserPreferences | null): string {
  const min = prefs?.min_followers ?? 500;
  const max = prefs?.max_followers ?? 3000;
  return `preferisci profili con visibilità indicativa tra ~${min} e ~${max} follower. ` +
    `Chi sembra ben sotto (profilo inattivo/poco seguito) o ben sopra (mega-influencer/celebrità irraggiungibile) riceve score più basso. ` +
    `Se non conosci il numero esatto, stimalo da headline, seniority e tono del profilo.`;
}

// ── Valutazione profili in batch ──────────────────────────────
function buildContactPrompt(
  profiles: RawProfile[],
  summary: string | null,
  prefs: UserPreferences | null,
): string {
  // Passo solo i campi utili (non tutto il raw) → meno token, meno costo/latenza.
  const list = profiles
    .map((p, i) => {
      const parts = [
        `#${i}`,
        `nome di battesimo: ${p.first_name ?? p.name ?? '?'}`,
        `nome completo: ${p.name ?? '?'}`,
        `headline: ${p.headline ?? '?'}`,
        `azienda: ${p.company ?? '?'}`,
        `località: ${p.location ?? '?'}`,
      ];
      if (p.followers != null) parts.push(`follower: ${p.followers}`);
      if (p.tenure_years != null) parts.push(`anni nel ruolo attuale: ${p.tenure_years}`);
      if (p.premium) parts.push(`account premium: sì`);
      return parts.join('\n');
    })
    .join('\n\n');

  return `Sei un assistente che valuta profili LinkedIn per il networking dell'utente.

${prefsBlock(summary, prefs)}

REGOLE DI VALUTAZIONE:
1. score 0-100: quanto il profilo è un buon contatto di networking per l'utente — alto calibro MA realisticamente raggiungibile.
2. ALTO CALIBRO: founder, CEO, manager, imprenditori, investitori, tech leader, senior. Profili umili/operativi (camerieri, chef, staff base) e junior/entry-level → score basso (<30).
3. PESCE TROPPO GROSSO (penalizza, score più basso ~40-60): personaggi troppo in vista che difficilmente ricambiano — es. "Forbes", "Keynote Speaker", "Featured", influencer con decine di migliaia di follower, CEO di multinazionali note. Preferisci chi è solido ma alla portata: founder di startup piccole/medie, manager, professionisti senior, founder con qualche anno di attività (usa "anni nel ruolo attuale" come segnale di serietà).
4. GENERE (gender_guess): basati sul NOME DI BATTESIMO. "male" se chiaramente maschile, "female" se chiaramente femminile, "unknown" se ambiguo. Le donne ricevono score più basso (in fondo); uomini e ambigui passano normalmente. Target ~90% uomini.
5. BADGE (badges): assegna quando pertinente, scegli tra: "🎯 Tech/Founder" (founder/tech/investitore), "🇦🇪 UAE" (a Dubai/UAE). Boost leggero allo score se entrambi presenti + azienda tech/AI.
6. category: scegli la più adatta tra: "Founder", "Tech Leader", "Investitori", "Real Estate Dubai", "Finance", "Crypto/Web3", "Marketing", "Consulenza", "Imprenditori", "Networking".
7. reason: UNA riga in italiano che spiega il perché dello score (cita se è un pesce troppo grosso o un buon target raggiungibile).

Rispondi SOLO con un array JSON, un oggetto per profilo, nello stesso ordine, con questo schema esatto:
[{"index": <numero #>, "score": <0-100>, "gender_guess": "male|female|unknown", "reason": "<una riga>", "badges": ["..."], "category": "<categoria>"}]

PROFILI DA VALUTARE:
${list}`;
}

export async function evaluateContacts(
  profiles: RawProfile[],
  summary: string | null,
  prefs: UserPreferences | null,
): Promise<Map<string, ContactEvaluation>> {
  const out = new Map<string, ContactEvaluation>(); // keyed by linkedin_url

  for (let i = 0; i < profiles.length; i += BATCH_SIZE) {
    const batch = profiles.slice(i, i + BATCH_SIZE);
    const prompt = buildContactPrompt(batch, summary, prefs);
    let evals: ContactEvaluation[] = [];
    try {
      const text = await generate(prompt);
      evals = parseJsonArray<ContactEvaluation>(text);
    } catch (e) {
      console.error('Gemini batch error (contacts):', e);
    }

    for (const ev of evals) {
      const profile = batch[ev.index];
      if (profile) out.set(profile.linkedin_url, ev);
    }

    if (i + BATCH_SIZE < profiles.length) await sleep(SLEEP_MS);
  }

  return out;
}

// ── Valutazione offerte di lavoro in batch ────────────────────
function buildJobPrompt(
  jobs: RawJob[],
  summary: string | null,
  prefs: UserPreferences | null,
): string {
  const list = jobs
    .map((j, i) => {
      return `#${i}
titolo: ${j.title ?? '?'}
azienda: ${j.company ?? '?'}
località: ${j.location ?? '?'}
descrizione (troncata): ${(j.description ?? '').slice(0, 800)}`;
    })
    .join('\n\n');

  return `Sei un assistente che valuta offerte di lavoro per l'utente.

${prefsBlock(summary, prefs)}

REGOLE:
1. score 0-100: quanto l'offerta è coerente col profilo dell'utente (AI-native Full-Stack Engineer) e con l'obiettivo Dubai/UAE.
2. reason: UNA riga in italiano sul perché dello score.

Rispondi SOLO con un array JSON nello stesso ordine:
[{"index": <numero #>, "score": <0-100>, "reason": "<una riga>"}]

OFFERTE DA VALUTARE:
${list}`;
}

export async function evaluateJobs(
  jobs: RawJob[],
  summary: string | null,
  prefs: UserPreferences | null,
): Promise<Map<string, JobEvaluation>> {
  const out = new Map<string, JobEvaluation>();

  for (let i = 0; i < jobs.length; i += BATCH_SIZE) {
    const batch = jobs.slice(i, i + BATCH_SIZE);
    const prompt = buildJobPrompt(batch, summary, prefs);
    let evals: JobEvaluation[] = [];
    try {
      const text = await generate(prompt);
      evals = parseJsonArray<JobEvaluation>(text);
    } catch (e) {
      console.error('Gemini batch error (jobs):', e);
    }
    for (const ev of evals) {
      const job = batch[ev.index];
      if (job) out.set(job.linkedin_url, ev);
    }
    if (i + BATCH_SIZE < jobs.length) await sleep(SLEEP_MS);
  }

  return out;
}

// ── Riassunto del profilo utente (una volta sola) ─────────────
export async function summarizeUserProfile(raw: RawProfile): Promise<string> {
  const prompt = `Riassumi questo profilo LinkedIn in un "profilo sintetico" in italiano (max 8 righe):
chi è, seniority, competenze chiave, settori, e cosa può offrire in un networking. Sarà usato come metro per valutare altri profili.

DATI PROFILO:
nome: ${raw.name}
headline: ${raw.headline}
azienda: ${raw.company}
località: ${raw.location}
dati grezzi: ${JSON.stringify(raw.raw).slice(0, 4000)}`;

  return generate(prompt, { json: false });
}

// ── Copilota del pool (#6): risponde a domande in linguaggio naturale ─────────
// Riceve un CONTESTO COMPATTO (non tutte le righe → pochi token) e risponde in
// italiano. Può anche proporre un'azione in blocco (spostare contatti) che la
// route esegue riusando le API esistenti.
export interface CopilotReply {
  answer: string; // testo da mostrare in chat
  action?: {
    type: 'update_status' | 'update_category';
    contact_ids: string[];
    value: string; // nuovo status o categoria
  } | null;
}

export async function askCopilot(
  question: string,
  context: string,
  history: { role: 'user' | 'assistant'; content: string }[] = [],
): Promise<CopilotReply> {
  const hist = history
    .slice(-6)
    .map((m) => `${m.role === 'user' ? 'UTENTE' : 'TU'}: ${m.content}`)
    .join('\n');

  const prompt = `Sei il copilota di "Majloasis", un sistema di networking mirato verso Dubai. Rispondi in italiano,
breve e concreto. Hai accesso a un riassunto del pool di contatti dell'utente.
Se l'utente chiede un'AZIONE in blocco (spostare contatti in uno stato/categoria), proponila
nel campo "action" usando gli ID forniti nel contesto. Altrimenti lascia action a null.
NON inventare ID: usa solo quelli presenti nel CONTESTO.

CONTESTO (pool):
${context}

${hist ? `CONVERSAZIONE PRECEDENTE:\n${hist}\n` : ''}
DOMANDA UTENTE: ${question}

Rispondi SOLO con questo JSON:
{"answer": "<testo per la chat>", "action": null oppure {"type":"update_status|update_category","contact_ids":["..."],"value":"<da_fare|fatto|non_fare|da_valutare oppure nome categoria>"}}`;

  const text = await generate(prompt, { json: true, temperature: 0.4 });
  const cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1) return { answer: text.trim() || 'Non ho capito, riprova.' };
  try {
    return JSON.parse(cleaned.slice(start, end + 1)) as CopilotReply;
  } catch {
    return { answer: cleaned };
  }
}

// ── Genera messaggio DM post-accettazione (on-demand) ─────────
export async function generateMessage(
  contact: { name: string | null; headline: string | null; company: string | null; location: string | null },
  summary: string | null,
  prefs: UserPreferences | null,
): Promise<string> {
  const prompt = `Scrivi un MESSAGGIO breve (3-5 frasi), caldo e professionale, in italiano o inglese a seconda del profilo, da inviare DOPO che il contatto ha accettato la richiesta di collegamento su LinkedIn.
NON è la nota dell'invito: è il primo DM dopo l'accettazione. Niente vendita aggressiva, tono umano, aggancio personale.

CHI SCRIVE (utente):
${summary || 'AI-native Full-Stack Engineer, networking a Dubai'}
Cosa offre: ${prefs?.offer ?? 'AI-native Full-Stack Engineer'}

DESTINATARIO:
nome: ${contact.name ?? ''}
ruolo: ${contact.headline ?? ''}
azienda: ${contact.company ?? ''}
città: ${contact.location ?? ''}

Restituisci solo il testo del messaggio, senza virgolette.`;

  return generate(prompt, { json: false, temperature: 0.7 });
}
