import { NextResponse } from 'next/server';
import { runBackfillScores } from '@/lib/collect';

// POST — ri-valuta i contatti rimasti SENZA score (Gemini li ha saltati per
// 429/timeout/JSON troncato). Non ri-scrapa Apify: riusa i dati già in DB,
// quindi nessun costo extra di scraping. Bottone "Completa score" in dashboard.
export const maxDuration = 300;
export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const result = await runBackfillScores();
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
