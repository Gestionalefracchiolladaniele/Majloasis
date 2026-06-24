import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from './env';

// Browser/anon client — safe to use in client components and public reads.
let _browser: SupabaseClient | null = null;
export function supabaseBrowser(): SupabaseClient {
  if (!_browser) {
    _browser = createClient(env.supabaseUrl, env.supabaseAnonKey, {
      auth: { persistSession: false },
    });
  }
  return _browser;
}

// Service-role client — server only (API routes, cron). Bypasses RLS; never
// import this from a client component.
let _admin: SupabaseClient | null = null;
export function supabaseAdmin(): SupabaseClient {
  if (!_admin) {
    _admin = createClient(env.supabaseUrl, env.supabaseServiceRole, {
      auth: { persistSession: false },
    });
  }
  return _admin;
}
