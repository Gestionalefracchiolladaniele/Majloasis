import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import type { ContactStatus } from '@/lib/types';

export const dynamic = 'force-dynamic';

// GET — lista offerte, ordinate per score desc. Filtro opzionale ?status=
export async function GET(req: NextRequest) {
  const db = supabaseAdmin();
  const sp = new URL(req.url).searchParams;
  let q = db.from('jobs').select('*');
  const status = sp.get('status');
  if (status) q = q.eq('status', status);
  q = q.order('score', { ascending: false, nullsFirst: false }).order('created_at', {
    ascending: false,
  });
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ jobs: data ?? [] });
}

// PATCH — aggiorna status di N offerte. Body: { ids: string[], status }
export async function PATCH(req: NextRequest) {
  const db = supabaseAdmin();
  let body: { ids?: string[]; status?: ContactStatus };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }
  if (!body.ids?.length || !body.status) {
    return NextResponse.json({ error: 'ids and status required' }, { status: 400 });
  }
  const { data, error } = await db
    .from('jobs')
    .update({ status: body.status })
    .in('id', body.ids)
    .select('id');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ updated: data?.length ?? 0 });
}
