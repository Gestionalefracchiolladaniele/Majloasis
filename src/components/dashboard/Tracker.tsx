'use client';

import type { OutreachStats } from '@/lib/api';

// Tracker anti-ban: barra bianca che si riempie; vira verso oro vicino al limite,
// rosso sobrio se sfora (vedi DESIGN.md).
export function Tracker({ stats }: { stats: OutreachStats | null }) {
  if (!stats) return null;
  const pct = Math.min(100, Math.round((stats.week / stats.limit) * 100));
  const color = stats.over ? 'var(--alert)' : stats.warn ? 'var(--gold)' : 'var(--accent)';

  return (
    <div
      style={{
        background: 'var(--bg-glass)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        padding: '12px 14px',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          marginBottom: 8,
          fontSize: 13,
        }}
      >
        <span style={{ color: 'var(--text-mid)' }}>Inviti questa settimana</span>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: 16, color }}>
          {stats.week} / {stats.limit}
        </span>
      </div>
      <div
        style={{
          height: 8,
          borderRadius: 999,
          background: 'rgba(255,255,255,0.08)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: '100%',
            background: color,
            transition: 'width 0.4s ease',
            boxShadow: pct > 0 ? '0 0 8px rgba(255,255,255,0.3)' : 'none',
          }}
        />
      </div>
      <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-low)' }}>
        Oggi: {stats.today} · consigliato {stats.dailySuggestion}
        {stats.over && (
          <span style={{ color: 'var(--alert)', marginLeft: 8 }}>
            ⚠️ Sopra il limite settimanale — fermati.
          </span>
        )}
        {!stats.over && stats.warn && (
          <span style={{ color: 'var(--gold)', marginLeft: 8 }}>
            Vicino al limite — rallenta.
          </span>
        )}
      </div>
    </div>
  );
}
