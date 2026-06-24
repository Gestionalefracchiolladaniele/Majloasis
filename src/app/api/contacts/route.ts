import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import type { ContactStatus, RelStatus } from '@/lib/types';

export const dynamic = 'force-dynamic';

// GET — lista contatti, ordinati per score desc. Filtri opzionali: ?status= &category=
export async function GET(req: NextRequest) {
  const db = supabaseAdmin();
  const sp = new URL(req.url).searchParams;
  let q = db.from('contacts').select('*');
  const status = sp.get('status');
  const category = sp.get('category');
  if (status) q = q.eq('status', status);
  if (category) q = q.eq('category', category);
  q = q.order('score', { ascending: false, nullsFirst: false }).order('created_at', {
    ascending: false,
  });
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Regola genere (CLAUDE.md): le donne vanno in fondo. Ordino in modo stabile
  // mettendo prima uomini/ambigui (già per score desc dal DB), poi le donne.
  const rows = data ?? [];
  const sorted = [
    ...rows.filter((c) => c.gender_guess !== 'female'),
    ...rows.filter((c) => c.gender_guess === 'female'),
  ];
  return NextResponse.json({ contacts: sorted });
}

// PATCH — aggiorna in blocco status/category/rel_status/notes di N contatti.
// Body: { ids: string[], status?, category?, rel_status?, notes? }
export async function PATCH(req: NextRequest) {
  const db = supabaseAdmin();
  let body: {
    ids?: string[];
    status?: ContactStatus;
    category?: string | null;
    rel_status?: RelStatus;
    notes?: string | null;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }
  if (!body.ids?.length) {
    return NextResponse.json({ error: 'ids required' }, { status: 400 });
  }
  const patch: Record<string, unknown> = {};
  if (body.status !== undefined) patch.status = body.status;
  if (body.category !== undefined) patch.category = body.category;
  if (body.notes !== undefined) patch.notes = body.notes;
  if (body.rel_status !== undefined) {
    patch.rel_status = body.rel_status;
    // Timestamp automatici sulle tappe della relazione → alimentano i reminder
    // (follow-up e "pronto per invitare") senza che l'utente li inserisca a mano.
    const now = new Date().toISOString();
    patch.last_touch_at = now;
    // like/commento = fasi pre-invito → segnano interacted_at (timer per l'invito).
    if (body.rel_status === 'likato' || body.rel_status === 'commentato') patch.interacted_at = now;
    if (body.rel_status === 'invitato') patch.invited_at = now;
    if (body.rel_status === 'connesso') patch.connected_at = now;
    if (body.rel_status === 'risposto') patch.replied_at = now;
  }
  if (!Object.keys(patch).length) {
    return NextResponse.json({ error: 'nothing to update' }, { status: 400 });
  }
  const { data, error } = await db
    .from('contacts')
    .update(patch)
    .in('id', body.ids)
    .select('id');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ updated: data?.length ?? 0 });
}
