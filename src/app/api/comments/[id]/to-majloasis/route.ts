import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// POST — promuove l'autore del post nel pool Majloasis (contacts).
// È il ponte a un tap tra "Commenta" e Majloasis: entra già con rel_status
// 'commentato' (warm-up iniziato) e status 'da_fare'. Score/valutazione restano
// null → si completano con "Completa score" nella tab Persone. Niente Apify qui.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const db = supabaseAdmin();

  const { data: post, error } = await db
    .from('comment_posts')
    .select('author_url, author_name, author_headline, author_photo')
    .eq('id', id)
    .single();
  if (error || !post) {
    return NextResponse.json({ error: 'post not found' }, { status: 404 });
  }
  if (!post.author_url) {
    return NextResponse.json({ error: 'autore senza URL LinkedIn' }, { status: 400 });
  }

  // Già nel pool? Non duplicare: segnala che c'è già.
  const { data: existing } = await db
    .from('contacts')
    .select('id')
    .eq('linkedin_url', post.author_url)
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ ok: true, already: true, contactId: existing.id });
  }

  const now = new Date().toISOString();
  const { data, error: insErr } = await db
    .from('contacts')
    .upsert(
      {
        linkedin_url: post.author_url,
        name: post.author_name,
        headline: post.author_headline,
        photo_url: post.author_photo,
        status: 'da_fare' as const,
        rel_status: 'commentato' as const,
        interacted_at: now,
        last_touch_at: now,
      },
      { onConflict: 'linkedin_url', ignoreDuplicates: true },
    )
    .select('id')
    .maybeSingle();
  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, already: false, contactId: data?.id ?? null });
}
