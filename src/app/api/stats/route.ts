import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import type { Contact } from '@/lib/types';

export const dynamic = 'force-dynamic';

// GET — statistiche aggregate per la vista Insights (#5).
// Tutto in numeri + percentuali, calcolato server-side in una sola lettura.
export async function GET() {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from('contacts')
    .select('score, status, rel_status, gender_guess, category, badges');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (data ?? []) as Pick<
    Contact,
    'score' | 'status' | 'rel_status' | 'gender_guess' | 'category' | 'badges'
  >[];
  const total = rows.length;
  const pct = (n: number) => (total ? Math.round((n / total) * 100) : 0);

  // Conteggi per stato
  const byStatus = countBy(rows, (r) => r.status);
  const byRel = countBy(rows, (r) => r.rel_status);
  const byGender = countBy(rows, (r) => r.gender_guess ?? 'unknown');
  const byCategory = countBy(rows, (r) => r.category ?? '—');

  // Funnel di outreach: quanti contatti hanno superato ogni tappa.
  const invited = rows.filter((r) => r.rel_status !== 'nessuno').length;
  const connected = rows.filter((r) =>
    ['connesso', 'messaggiato', 'risposto', 'in_conversazione'].includes(r.rel_status),
  ).length;
  const replied = rows.filter((r) =>
    ['risposto', 'in_conversazione'].includes(r.rel_status),
  ).length;

  // Qualità del pool
  const scored = rows.filter((r) => typeof r.score === 'number');
  const missingScore = total - scored.length;
  const avgScore = scored.length
    ? Math.round(scored.reduce((s, r) => s + (r.score as number), 0) / scored.length)
    : 0;
  const highCalibre = rows.filter((r) => (r.score ?? 0) >= 70).length;
  const malePct = pct(byGender['male'] ?? 0);

  return NextResponse.json({
    total,
    avgScore,
    missingScore,
    highCalibre,
    highCalibrePct: pct(highCalibre),
    malePct,
    funnel: {
      invited,
      invitedPct: pct(invited),
      connected,
      // tasso accettazione = connessi / invitati
      acceptRate: invited ? Math.round((connected / invited) * 100) : 0,
      replied,
      // tasso risposta = risposte / connessi
      replyRate: connected ? Math.round((replied / connected) * 100) : 0,
    },
    byStatus,
    byRel,
    byGender,
    byCategory,
  });
}

function countBy<T>(rows: T[], key: (r: T) => string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of rows) {
    const k = key(r);
    out[k] = (out[k] ?? 0) + 1;
  }
  return out;
}
