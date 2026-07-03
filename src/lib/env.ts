// Centralised env access. Server-only secrets are read lazily so that the app
// can be built/imported without the keys present (real runs require them).

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing environment variable: ${name}`);
  return v;
}

export const env = {
  // public (safe in the browser)
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',

  // server-only — call the getters, which throw if missing at use time
  get supabaseServiceRole() {
    return required('SUPABASE_SERVICE_ROLE_KEY');
  },
  get apifyToken() {
    return required('APIFY_TOKEN');
  },
  get geminiApiKey() {
    return required('GEMINI_API_KEY');
  },
  get cronSecret() {
    return required('CRON_SECRET');
  },
  // Ricerca profili (query → lista profili). khadinakbar: no-cookie, PAY_PER_EVENT senza
  // il cap "10 run/mese" che bloccava harvestapi~linkedin-profile-search sul piano free.
  // Testato dal vivo: restituisce founder/CEO reali (input keywords+location+maxResults).
  // Per tornare a harvestapi: APIFY_PROFILE_ACTOR=harvestapi~linkedin-profile-search.
  apifyProfileActor: process.env.APIFY_PROFILE_ACTOR || 'khadinakbar~linkedin-profile-search-scraper',
  // Scrape di UN profilo da URL (per "Il mio profilo"). Actor diverso dalla ricerca.
  apifyProfileDetailActor:
    process.env.APIFY_PROFILE_DETAIL_ACTOR || 'harvestapi~linkedin-profile-scraper',
  apifyJobActor: process.env.APIFY_JOB_ACTOR || 'harvestapi~linkedin-job-search',
  // Ricerca POST recenti per keyword (tab "Commenta"). harvestapi~linkedin-post-search:
  // no-cookie, PAY_PER_EVENT. Testato dal vivo: input searchQueries[]+postedLimit+maxPosts,
  // output con content, author.*, postedAt.date (timestamp reale → freschezza) ed engagement.
  apifyPostActor: process.env.APIFY_POST_ACTOR || 'harvestapi~linkedin-post-search',
  dashboardPassword: process.env.DASHBOARD_PASSWORD ?? '',
};

export const isSupabaseConfigured = () => Boolean(env.supabaseUrl && env.supabaseAnonKey);
