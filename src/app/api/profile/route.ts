import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { scrapeSingleProfile } from '@/lib/apify';
import { summarizeUserProfile } from '@/lib/gemini';
import type { UserPreferences } from '@/lib/types';

export const maxDuration = 120;
export const dynamic = 'force-dynamic';

// GET — restituisce il profilo utente corrente (per pre-compilare il form).
export async function GET() {
  const db = supabaseAdmin();
  const { data } = await db
    .from('user_profile')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(1);
  return NextResponse.json({ profile: data?.[0] ?? null });
}

// POST — salva profilo: scrapa il link (se fornito), riassume con Gemini, salva
// summary + preferences. Body: { linkedin_url?, preferences, rescrape? }
export async function POST(req: NextRequest) {
  const db = supabaseAdmin();
  let body: {
    linkedin_url?: string;
    preferences?: UserPreferences;
    summary?: string;
    rescrape?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  const { data: existingRows } = await db
    .from('user_profile')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(1);
  const existing = existingRows?.[0];

  let summary = body.summary ?? existing?.summary ?? null;
  let raw_scrape = existing?.raw_scrape ?? null;
  const linkedin_url = body.linkedin_url ?? existing?.linkedin_url ?? null;

  // Ri-scrape + riassunto solo se richiesto esplicitamente o se non c'è ancora un summary.
  const needsScrape = Boolean(linkedin_url) && (body.rescrape || !summary);
  if (needsScrape && linkedin_url) {
    try {
      const profile = await scrapeSingleProfile(linkedin_url);
      if (profile) {
        raw_scrape = profile.raw;
        summary = await summarizeUserProfile(profile);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return NextResponse.json(
        { error: `scrape/summary failed: ${msg}` },
        { status: 502 },
      );
    }
  }

  const payload = {
    linkedin_url,
    raw_scrape,
    summary,
    preferences: body.preferences ?? existing?.preferences ?? null,
    updated_at: new Date().toISOString(),
  };

  let saved;
  if (existing) {
    const { data, error } = await db
      .from('user_profile')
      .update(payload)
      .eq('id', existing.id)
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    saved = data;
  } else {
    const { data, error } = await db
      .from('user_profile')
      .insert(payload)
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    saved = data;
  }

  return NextResponse.json({ profile: saved });
}
