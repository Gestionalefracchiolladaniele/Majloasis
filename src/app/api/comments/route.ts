import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { runFindPosts } from '@/lib/collect';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

// GET — lista i post "da commentare", i più recenti prima. Filtro opzionale:
// ?pending=1 → solo quelli non ancora commentati.
export async function GET(req: NextRequest) {
  const db = supabaseAdmin();
  const sp = new URL(req.url).searchParams;
  let q = db.from('comment_posts').select('*');
  if (sp.get('pending')) q = q.is('commented_at', null);
  q = q
    .order('posted_at', { ascending: false, nullsFirst: false })
    .order('score', { ascending: false, nullsFirst: false });
  const { data, error } = await q.limit(60);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ posts: data ?? [] });
}

// POST — "Trova 10 post": scrape on-demand di post recenti Dubai + dedup + Gemini
// valuta → salva i migliori (senza commento). Body opzionale: { postedLimit }.
export async function POST(req: NextRequest) {
  let body: { postedLimit?: string } = {};
  try {
    body = await req.json();
  } catch {
    // body vuoto ok
  }
  try {
    const r = await runFindPosts({ postedLimit: body.postedLimit });
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 502 });
  }
}
