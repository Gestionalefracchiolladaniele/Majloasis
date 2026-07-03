import { NextRequest, NextResponse } from 'next/server';
import { runBackfillScores } from '@/lib/collect';

// POST — valuta i contatti SENZA score. Body opzionale { ids?: string[] }: se
// presente valuta solo quelli selezionati dall'utente (meno chiamate Gemini),
// altrimenti tutti i null. Non ri-scrapa Apify: riusa i dati già in DB.
export const maxDuration = 300;
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    let ids: string[] | undefined;
    try {
      const body = await req.json();
      if (Array.isArray(body?.ids) && body.ids.length) ids = body.ids as string[];
    } catch {
      // nessun body → backfill di tutti i null (comportamento originale)
    }
    const result = await runBackfillScores(60, ids);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
