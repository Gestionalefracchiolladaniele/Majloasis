import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { generateComment } from '@/lib/gemini';
import type { UserPreferences } from '@/lib/types';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

// POST — genera UN commento per il post, on-demand. Body: { regenerate? }.
// Se esiste già un draft e regenerate non è true → lo ritorna dalla cache
// (niente chiamata Gemini sprecata), come per il messaggio dei contatti.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const db = supabaseAdmin();

  let body: { regenerate?: boolean } = {};
  try {
    body = await req.json();
  } catch {
    // body vuoto ok
  }

  const { data: post, error } = await db
    .from('comment_posts')
    .select('author_name, author_headline, content, draft_comment')
    .eq('id', id)
    .single();
  if (error || !post) {
    return NextResponse.json({ error: 'post not found' }, { status: 404 });
  }

  if (post.draft_comment && !body.regenerate) {
    return NextResponse.json({ comment: post.draft_comment, cached: true });
  }

  const { data: userRows } = await db
    .from('user_profile')
    .select('summary, preferences')
    .order('updated_at', { ascending: false })
    .limit(1);
  const summary: string | null = userRows?.[0]?.summary ?? null;
  const prefs: UserPreferences | null = userRows?.[0]?.preferences ?? null;

  try {
    const comment = await generateComment(post, summary, prefs);
    await db.from('comment_posts').update({ draft_comment: comment }).eq('id', id);
    return NextResponse.json({ comment });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
