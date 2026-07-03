// Client-side fetch helpers for the dashboard. Thin wrappers over the API routes.
import type { Contact, Job, Category, ContactStatus, RelStatus, UserProfile, CommentPost } from './types';

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  contacts: {
    list: (params?: { status?: string; category?: string }) => {
      const sp = new URLSearchParams(params as Record<string, string>);
      return fetch(`/api/contacts?${sp}`).then((r) => json<{ contacts: Contact[] }>(r));
    },
    update: (
      ids: string[],
      patch: {
        status?: ContactStatus;
        category?: string | null;
        rel_status?: RelStatus;
        notes?: string | null;
      },
    ) =>
      fetch('/api/contacts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids, ...patch }),
      }).then((r) => json<{ updated: number }>(r)),
  },
  jobs: {
    list: () => fetch('/api/jobs').then((r) => json<{ jobs: Job[] }>(r)),
    update: (ids: string[], status: ContactStatus) =>
      fetch('/api/jobs', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids, status }),
      }).then((r) => json<{ updated: number }>(r)),
  },
  categories: {
    list: () => fetch('/api/categories').then((r) => json<{ categories: Category[] }>(r)),
    create: (name: string, emoji?: string) =>
      fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, emoji }),
      }).then((r) => json<{ category: Category }>(r)),
    remove: (id: string) =>
      fetch('/api/categories', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      }).then((r) => json<{ ok: boolean }>(r)),
  },
  message: {
    generate: (contactId: string, regenerate = false) =>
      fetch('/api/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contactId, regenerate }),
      }).then((r) => json<{ message: string; cached?: boolean }>(r)),
  },
  outreach: {
    stats: () => fetch('/api/outreach').then((r) => json<OutreachStats>(r)),
    log: (contactId?: string) =>
      fetch('/api/outreach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contactId }),
      }).then((r) => json<OutreachStats>(r)),
  },
  profile: {
    get: () => fetch('/api/profile').then((r) => json<{ profile: UserProfile | null }>(r)),
    save: (body: { linkedin_url?: string; preferences?: unknown; rescrape?: boolean }) =>
      fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then((r) => json<{ profile: UserProfile }>(r)),
  },
  collect: (what: 'all' | 'people' | 'jobs' = 'all') => {
    // Timeout di sicurezza: se la funzione serverless viene troncata (Vercel hobby
    // tronca a 60s) la fetch resterebbe appesa → spinner infinito. Con l'abort dopo
    // 70s la promise fallisce con un errore leggibile invece di girare per sempre.
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 70_000);
    return fetch(`/api/collect?what=${what}`, { method: 'POST', signal: ctrl.signal })
      .then((r) =>
        json<{
          ok: boolean;
          profilesFound: number;
          profilesNew: number;
          profilesSaved: number;
          jobsFound: number;
          jobsNew: number;
          jobsSaved: number;
          note?: string;
          error?: string;
        }>(r),
      )
      .catch((e) => {
        if (e?.name === 'AbortError') {
          throw new Error(
            'La raccolta sta impiegando troppo (timeout). Riprova o ricarica: alcuni lead potrebbero essere già stati salvati.',
          );
        }
        throw e;
      })
      .finally(() => clearTimeout(t));
  },
  // Valuta i contatti senza score. Con ids → solo i selezionati (meno chiamate Gemini);
  // senza ids → tutti quelli null. No Apify (riusa i dati in DB).
  backfill: (ids?: string[]) =>
    fetch('/api/backfill', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ids?.length ? { ids } : {}),
    }).then((r) => json<{ ok: boolean; missing: number; fixed: number; error?: string }>(r)),
  // Time machine: ri-valuta i contatti col profilo utente aggiornato. No Apify.
  revalue: () =>
    fetch('/api/revalue', { method: 'POST' }).then((r) =>
      json<{ ok: boolean; considered: number; rescored: number; improved: number; error?: string }>(r),
    ),
  stats: () => fetch('/api/stats').then((r) => json<InsightStats>(r)),
  network: () => fetch('/api/network').then((r) => json<{ clusters: NetworkCluster[] }>(r)),
  // Tab "Commenta": post recenti su cui commentare a mano.
  comments: {
    list: (pendingOnly = false) =>
      fetch(`/api/comments${pendingOnly ? '?pending=1' : ''}`).then((r) =>
        json<{ posts: CommentPost[] }>(r),
      ),
    // "Trova 10 post": scrape on-demand. Abort a 70s → niente spinner infinito
    // (Vercel hobby tronca a 60s), come per collect.
    find: (postedLimit?: string) => {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 70_000);
      return fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(postedLimit ? { postedLimit } : {}),
        signal: ctrl.signal,
      })
        .then((r) =>
          json<{ ok: boolean; found: number; fresh: number; saved: number; note?: string; error?: string }>(r),
        )
        .catch((e) => {
          if (e?.name === 'AbortError') {
            throw new Error('La ricerca post sta impiegando troppo (timeout). Riprova.');
          }
          throw e;
        })
        .finally(() => clearTimeout(t));
    },
    generate: (id: string, regenerate = false) =>
      fetch(`/api/comments/${id}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ regenerate }),
      }).then((r) => json<{ comment: string; cached?: boolean }>(r)),
    markCommented: (id: string, undo = false) =>
      fetch(`/api/comments/${id}/commented`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ undo }),
      }).then((r) => json<{ ok: boolean; commented_at: string | null }>(r)),
    toMajloasis: (id: string) =>
      fetch(`/api/comments/${id}/to-majloasis`, { method: 'POST' }).then((r) =>
        json<{ ok: boolean; already: boolean; contactId: string | null; error?: string }>(r),
      ),
  },
  copilot: {
    history: () =>
      fetch('/api/copilot').then((r) => json<{ messages: CopilotMessage[] }>(r)),
    ask: (question: string) =>
      fetch('/api/copilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question }),
      }).then((r) => json<{ answer: string; didAction: boolean }>(r)),
    clear: () => fetch('/api/copilot', { method: 'DELETE' }).then((r) => json<{ ok: boolean }>(r)),
  },
};

export interface NetworkCluster {
  company: string;
  warm: boolean;
  members: { id: string; name: string; score: number | null; rel_status: string }[];
}

export interface CopilotMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

export interface InsightStats {
  total: number;
  avgScore: number;
  missingScore: number;
  highCalibre: number;
  highCalibrePct: number;
  malePct: number;
  funnel: {
    invited: number;
    invitedPct: number;
    connected: number;
    acceptRate: number;
    replied: number;
    replyRate: number;
  };
  byStatus: Record<string, number>;
  byRel: Record<string, number>;
  byGender: Record<string, number>;
  byCategory: Record<string, number>;
}

export interface OutreachStats {
  week: number;
  today: number;
  limit: number;
  warn: boolean;
  over: boolean;
  dailySuggestion: string;
  remainingToday: number;
}
