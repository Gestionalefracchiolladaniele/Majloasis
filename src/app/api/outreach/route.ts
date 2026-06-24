import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const WEEKLY_LIMIT = 100;
const WARN_AT = 80;

// Conteggio rolling 7 giorni + stato per il tracker anti-ban.
async function weeklyStats() {
  const db = supabaseAdmin();
  const since = new Date(Date.now() - WEEK_MS).toISOString();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const { count: week } = await db
    .from('outreach_log')
    .select('*', { count: 'exact', head: true })
    .gte('sent_at', since);

  const { count: day } = await db
    .from('outreach_log')
    .select('*', { count: 'exact', head: true })
    .gte('sent_at', today.toISOString());

  const weekCount = week ?? 0;
  const todayCount = day ?? 0;
  return {
    week: weekCount,
    today: todayCount,
    limit: WEEKLY_LIMIT,
    warn: weekCount >= WARN_AT,
    over: weekCount >= WEEKLY_LIMIT,
    dailySuggestion: pacingSuggestion(weekCount, todayCount),
    remainingToday: remainingTodayCount(weekCount, todayCount),
  };
}

// Quanti inviti restano OGGI secondo il pacing (per dimensionare la sessione #3).
function remainingTodayCount(weekCount: number, todayCount: number): number {
  const remaining = Math.max(0, WEEKLY_LIMIT - weekCount);
  if (remaining === 0) return 0;
  const dow = new Date().getDay();
  let weekdaysLeft = 0;
  for (let d = dow; d <= 5; d++) if (d >= 1) weekdaysLeft++;
  const perDay = weekdaysLeft > 0 ? Math.floor(remaining / weekdaysLeft) : remaining;
  return Math.max(0, perDay - todayCount);
}

// Suggerimento di pacing PREDITTIVO (non un testo fisso): quanti inviti restano
// nel budget settimanale, spalmati sui giorni feriali ancora disponibili da qui
// a fine settimana, tenendo conto di quanti ne hai già fatti oggi.
function pacingSuggestion(weekCount: number, todayCount: number): string {
  const remaining = Math.max(0, WEEKLY_LIMIT - weekCount);
  if (remaining === 0) return 'budget settimanale esaurito — fermati';

  const dow = new Date().getDay(); // 0=dom … 6=sab
  // Giorni feriali (lun–ven) da oggi a fine settimana, oggi incluso se feriale.
  let weekdaysLeft = 0;
  for (let d = dow; d <= 5; d++) if (d >= 1) weekdaysLeft++;
  if (weekdaysLeft === 0) return `${remaining} rimasti — riprendi lunedì`;

  const perDay = Math.floor(remaining / weekdaysLeft);
  const leftToday = Math.max(0, perDay - todayCount);
  const dayWord = weekdaysLeft === 1 ? 'giorno' : 'giorni';
  return `~${perDay}/giorno (${remaining} in ${weekdaysLeft} ${dayWord}) · oggi ancora ${leftToday}`;
}

// GET — stato del tracker.
export async function GET() {
  return NextResponse.json(await weeklyStats());
}

// POST — segna un invito inviato. Body: { contactId? }
export async function POST(req: NextRequest) {
  const db = supabaseAdmin();
  let body: { contactId?: string } = {};
  try {
    body = await req.json();
  } catch {
    /* body opzionale */
  }
  const { error } = await db
    .from('outreach_log')
    .insert({ contact_id: body.contactId ?? null });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(await weeklyStats());
}
