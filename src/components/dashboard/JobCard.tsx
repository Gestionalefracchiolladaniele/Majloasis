'use client';

import type { Job, ContactStatus } from '@/lib/types';
import { api } from '@/lib/api';

const NEXT: Record<string, { status: ContactStatus; label: string }> = {
  da_valutare: { status: 'da_fare', label: '⭐ Da fare' },
  da_fare: { status: 'fatto', label: '✅ Fatto' },
  fatto: { status: 'da_valutare', label: '↩︎ Riapri' },
  non_fare: { status: 'da_valutare', label: '↩︎ Riapri' },
};

export function JobCard({ job, onUpdated }: { job: Job; onUpdated: () => void }) {
  const top = (job.score ?? 0) >= 80;
  const next = NEXT[job.status];

  async function cycle() {
    await api.jobs.update([job.id], next.status);
    onUpdated();
  }
  async function dismiss() {
    await api.jobs.update([job.id], 'non_fare');
    onUpdated();
  }

  return (
    <div
      style={{
        background: 'var(--bg-elevated)',
        color: 'var(--on-card-high)',
        borderRadius: 'var(--radius-lg)',
        padding: 14,
        boxShadow: 'var(--shadow-card)',
        opacity: job.status === 'non_fare' ? 0.45 : 1,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 15 }}>{job.title ?? '—'}</div>
          <div style={{ fontSize: 13, color: 'var(--on-card-mid)' }}>
            {[job.company, job.location].filter(Boolean).join(' · ')}
          </div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 24,
              color: top ? 'var(--gold)' : 'var(--on-card-high)',
            }}
          >
            {job.score ?? '—'}
          </div>
        </div>
      </div>
      {job.reason && (
        <p style={{ fontSize: 12.5, color: 'var(--on-card-mid)', margin: '8px 0 0' }}>
          💡 {job.reason}
        </p>
      )}
      <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
        <a
          href={job.linkedin_url}
          target="_blank"
          rel="noreferrer"
          style={{
            padding: '8px 12px',
            borderRadius: 'var(--radius-md)',
            background: 'var(--on-card-high)',
            color: '#fff',
            fontSize: 12.5,
            fontWeight: 600,
            textDecoration: 'none',
          }}
        >
          🔗 Apri
        </a>
        <button onClick={cycle} style={cardBtn}>
          {next.label}
        </button>
        {job.status !== 'non_fare' && (
          <button onClick={dismiss} style={cardBtn}>
            ❌ Non fare
          </button>
        )}
      </div>
    </div>
  );
}

const cardBtn: React.CSSProperties = {
  padding: '8px 12px',
  borderRadius: 'var(--radius-md)',
  border: '1px solid var(--border-card)',
  background: 'transparent',
  color: 'var(--on-card-high)',
  fontSize: 12.5,
  cursor: 'pointer',
};
