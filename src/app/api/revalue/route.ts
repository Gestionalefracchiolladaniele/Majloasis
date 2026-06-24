import { NextResponse } from 'next/server';
import { runRevalue } from '@/lib/collect';

// POST — Time machine (A): ri-valuta i contatti già valutati col profilo utente
// AGGIORNATO. Non ri-scrapa Apify → costo 0. Da lanciare dopo aver migliorato il
// proprio profilo LinkedIn (tab Profilo → "Scrapa e riassumi").
export const maxDuration = 300;
export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const result = await runRevalue();
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
