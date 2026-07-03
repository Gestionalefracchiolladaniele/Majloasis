import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// POST — segna (o de-segna) che l'utente ha commentato QUESTO post a mano.
// Alimenta il tracker "commentati questa settimana". Body: { undo? }.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const db = supabaseAdmin();

  let body: { undo?: boolean } = {};
  try {
    body = await req.json();
  } catch {
    // body vuoto ok
  }

  const { data, error } = await db
    .from('comment_posts')
    .update({ commented_at: body.undo ? null : new Date().toISOString() })
    .eq('id', id)
    .select('id, commented_at');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data?.length) return NextResponse.json({ error: 'post not found' }, { status: 404 });
  return NextResponse.json({ ok: true, commented_at: data[0].commented_at });
}
