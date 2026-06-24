'use client';

import { useEffect, useState } from 'react';
import { api, type InsightStats, type NetworkCluster } from '@/lib/api';

// Vista statistiche (#5) + mappa relazionale (C): numeri + percentuali + cluster.
export function Insights({ stats }: { stats: InsightStats | null }) {
  const [clusters, setClusters] = useState<NetworkCluster[] | null>(null);
  const [warmOnly, setWarmOnly] = useState(false);

  useEffect(() => {
    api.network().then((r) => setClusters(r.clusters)).catch(() => setClusters([]));
  }, []);

  if (!stats) return null;
  const { funnel } = stats;

  // Caldi (dove hai già un connesso) sempre in cima; toggle per nasconderne il resto.
  const shownClusters = (clusters ?? [])
    .filter((c) => !warmOnly || c.warm)
    .sort((a, b) => Number(b.warm) - Number(a.warm) || b.members.length - a.members.length);
  const warmCount = (clusters ?? []).filter((c) => c.warm).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
      {/* riga metriche chiave */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
        <Metric label="Contatti totali" value={stats.total} />
        <Metric label="Score medio" value={stats.avgScore} suffix="/100" />
        <Metric label="Alto calibro (≥70)" value={stats.highCalibre} suffix={`· ${stats.highCalibrePct}%`} />
        <Metric label="Uomini" value={`${stats.malePct}%`} accent={stats.malePct >= 80} />
      </div>

      {/* funnel di outreach */}
      <div style={card}>
        <div style={cardTitle}>Funnel networking</div>
        <FunnelRow label="Invitati" n={funnel.invited} pct={funnel.invitedPct} of="del pool" />
        <FunnelRow label="Connessi" n={funnel.connected} pct={funnel.acceptRate} of="accettazione" />
        <FunnelRow label="Hanno risposto" n={funnel.replied} pct={funnel.replyRate} of="risposta" />
      </div>

      {/* qualità: score mancanti */}
      {stats.missingScore > 0 && (
        <div style={{ ...card, borderColor: 'var(--gold)' }}>
          <div style={{ fontSize: 13, color: 'var(--gold)' }}>
            ⚠️ {stats.missingScore} contatti senza score — usa &quot;Completa score&quot; per valutarli.
          </div>
        </div>
      )}

      {/* breakdown categorie */}
      <div style={card}>
        <div style={cardTitle}>Per categoria</div>
        <Breakdown data={stats.byCategory} total={stats.total} />
      </div>

      {/* mappa relazionale (C): aziende dove conosci già più persone */}
      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={cardTitle}>🕸️ Agganci (stessa azienda)</span>
          {warmCount > 0 && (
            <button
              onClick={() => setWarmOnly((v) => !v)}
              style={{
                fontSize: 11,
                padding: '4px 10px',
                borderRadius: 999,
                border: `1px solid ${warmOnly ? 'var(--gold)' : 'var(--border)'}`,
                background: warmOnly ? 'rgba(201,162,39,0.12)' : 'transparent',
                color: warmOnly ? 'var(--gold)' : 'var(--text-mid)',
                cursor: 'pointer',
              }}
            >
              🔥 Solo caldi ({warmCount})
            </button>
          )}
        </div>
        {clusters === null ? (
          <div style={{ fontSize: 12, color: 'var(--text-low)', marginTop: 6 }}>Carico…</div>
        ) : shownClusters.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--text-low)', marginTop: 6 }}>
            {warmOnly
              ? 'Nessun aggancio caldo ancora: marca qualche contatto come 🤝 Connesso quando ricambia.'
              : 'Nessun cluster: nessuna azienda con 2+ contatti (per ora).'}
          </div>
        ) : (
          <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {shownClusters.slice(0, 12).map((cl) => (
              <div key={cl.company}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span style={{ color: 'var(--text-high)' }}>
                    {cl.warm && '🔥 '}
                    {cl.company}
                  </span>
                  <span style={{ color: 'var(--text-low)', fontSize: 11 }}>
                    {cl.members.length} contatti
                  </span>
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--text-mid)', marginTop: 2 }}>
                  {cl.members
                    .slice(0, 5)
                    .map((m) => m.name)
                    .join(', ')}
                  {cl.members.length > 5 ? '…' : ''}
                </div>
              </div>
            ))}
            <div style={{ fontSize: 11, color: 'var(--text-low)', marginTop: 2 }}>
              🔥 = hai già un contatto connesso lì → la prossima è un&apos;intro calda.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  suffix,
  accent,
}: {
  label: string;
  value: number | string;
  suffix?: string;
  accent?: boolean;
}) {
  return (
    <div style={card}>
      <div style={{ fontSize: 11, color: 'var(--text-low)' }}>{label}</div>
      <div
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 24,
          color: accent ? 'var(--gold)' : 'var(--text-high)',
          marginTop: 2,
        }}
      >
        {value}
        {suffix && <span style={{ fontSize: 12, color: 'var(--text-low)', marginLeft: 4 }}>{suffix}</span>}
      </div>
    </div>
  );
}

function FunnelRow({ label, n, pct, of }: { label: string; n: number; pct: number; of: string }) {
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
        <span style={{ color: 'var(--text-mid)' }}>{label}</span>
        <span style={{ color: 'var(--text-high)' }}>
          {n} <span style={{ color: 'var(--text-low)', fontSize: 11 }}>({pct}% {of})</span>
        </span>
      </div>
      <Bar pct={pct} />
    </div>
  );
}

function Bar({ pct }: { pct: number }) {
  return (
    <div style={{ height: 6, borderRadius: 999, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
      <div
        style={{
          width: `${Math.min(100, pct)}%`,
          height: '100%',
          background: 'var(--accent)',
          transition: 'width 0.4s ease',
        }}
      />
    </div>
  );
}

function Breakdown({ data, total }: { data: Record<string, number>; total: number }) {
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);
  if (!entries.length) return <div style={{ fontSize: 12, color: 'var(--text-low)' }}>—</div>;
  return (
    <div style={{ marginTop: 6 }}>
      {entries.map(([name, n]) => {
        const pct = total ? Math.round((n / total) * 100) : 0;
        return (
          <div key={name} style={{ marginTop: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 3 }}>
              <span style={{ color: 'var(--text-mid)' }}>{name}</span>
              <span style={{ color: 'var(--text-low)' }}>
                {n} · {pct}%
              </span>
            </div>
            <Bar pct={pct} />
          </div>
        );
      })}
    </div>
  );
}

const card: React.CSSProperties = {
  background: 'var(--bg-glass)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md)',
  padding: '12px 14px',
};
const cardTitle: React.CSSProperties = {
  fontSize: 11,
  color: 'var(--text-low)',
  textTransform: 'uppercase',
  letterSpacing: 0.5,
};
