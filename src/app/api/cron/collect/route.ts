import { NextRequest, NextResponse } from 'next/server';
import { env } from '@/lib/env';
import { runCollect } from '@/lib/collect';

// Endpoint del giro giornaliero, protetto da CRON_SECRET.
// GitHub Actions lo chiama con header `Authorization: Bearer <CRON_SECRET>`.
// Vercel Cron lo chiama con lo stesso header (vedi vercel.json).
export const maxDuration = 300; // secondi (giro completo Apify+Gemini)
export const dynamic = 'force-dynamic';

function authorized(req: NextRequest): boolean {
  const auth = req.headers.get('authorization') ?? '';
  const token = auth.replace(/^Bearer\s+/i, '');
  const qp = new URL(req.url).searchParams.get('secret');
  try {
    return token === env.cronSecret || qp === env.cronSecret;
  } catch {
    return false;
  }
}

async function handle(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  try {
    const result = await runCollect();
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
