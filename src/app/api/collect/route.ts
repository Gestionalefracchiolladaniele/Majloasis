import { NextRequest, NextResponse } from 'next/server';
import { runCollect } from '@/lib/collect';

// Trigger manuale del giro (bottoni "Aggiorna" nella dashboard).
// ?what=people → solo contatti, ?what=jobs → solo lavori, default → entrambi.
// Non richiede CRON_SECRET perché la dashboard è già protetta dal middleware.
export const maxDuration = 300;
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const what = new URL(req.url).searchParams.get('what');
  const valid = what === 'people' || what === 'jobs' ? what : 'all';
  try {
    const result = await runCollect({ what: valid });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
