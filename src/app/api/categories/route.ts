import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// GET — tutte le categorie.
export async function GET() {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from('categories')
    .select('*')
    .order('created_at', { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ categories: data ?? [] });
}

// POST — crea categoria custom. Body: { name, emoji?, color? }
export async function POST(req: NextRequest) {
  const db = supabaseAdmin();
  let body: { name?: string; emoji?: string; color?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }
  if (!body.name?.trim()) {
    return NextResponse.json({ error: 'name required' }, { status: 400 });
  }
  const { data, error } = await db
    .from('categories')
    .insert({ name: body.name.trim(), emoji: body.emoji ?? null, color: body.color ?? null })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ category: data });
}

// DELETE — rimuove categoria. Body: { id }
export async function DELETE(req: NextRequest) {
  const db = supabaseAdmin();
  let body: { id?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }
  if (!body.id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  const { error } = await db.from('categories').delete().eq('id', body.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
