'use client';

import type { Contact } from '@/lib/types';

// Card minimale (vedi DESIGN.md): card bianca su nero, foto tonda, nome, ruolo,
// score grande (Sora), categoria + badge. Stati che opacizzano/desaturano.
function initials(name: string | null): string {
  if (!name) return '?';
  return name
    .split(' ')
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

const statusStyle: Record<string, React.CSSProperties> = {
  da_valutare: {},
  da_fare: { boxShadow: '0 0 0 1.5px var(--gold), var(--shadow-card)' },
  fatto: { filter: 'grayscale(0.6)', opacity: 0.85 },
  non_fare: { opacity: 0.45 },
};

const REL_EMOJI: Record<string, string> = {
  likato: '👍',
  commentato: '💬',
  invitato: '📨',
  connesso: '🤝',
  messaggiato: '✉️',
  risposto: '🗣️',
  in_conversazione: '🔥',
  freddo: '❄️',
};

// Pronto per invitare: hai scaldato (like/commento) ma non ancora invitato, e sono
// passati almeno `warmupDays` giorni dall'interazione → è il momento del Connetti.
function readyToInvite(contact: Contact, warmupDays: number): boolean {
  if (contact.rel_status !== 'likato' && contact.rel_status !== 'commentato') return false;
  if (!contact.interacted_at) return false;
  const days = Math.floor((Date.now() - new Date(contact.interacted_at).getTime()) / 86_400_000);
  return days >= warmupDays;
}

// Reminder follow-up: relazione "viva" (connesso/messaggiato/risposto) ma senza
// un tocco da più di 4 giorni → è ora di ricontattare. Restituisce i giorni passati.
function followUpDue(contact: Contact): number | null {
  const live = ['connesso', 'messaggiato', 'risposto'];
  if (!live.includes(contact.rel_status)) return null;
  const last = contact.last_touch_at ?? contact.connected_at ?? contact.replied_at;
  if (!last) return null;
  const days = Math.floor((Date.now() - new Date(last).getTime()) / 86_400_000);
  return days >= 4 ? days : null;
}

export function ContactCard({
  contact,
  selected,
  onToggleSelect,
  onOpen,
  warmupDays = 2,
}: {
  contact: Contact;
  selected: boolean;
  onToggleSelect: () => void;
  onOpen: () => void;
  warmupDays?: number;
}) {
  const topMatch = (contact.score ?? 0) >= 80;
  const relEmoji = REL_EMOJI[contact.rel_status];
  const dueDays = followUpDue(contact);
  const inviteReady = readyToInvite(contact, warmupDays);
  // Time machine: delta rispetto allo score precedente alla rivalutazione.
  const delta =
    contact.prev_score != null && contact.score != null
      ? contact.score - contact.prev_score
      : 0;

  return (
    <div
      onClick={onOpen}
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        background: 'var(--bg-elevated)',
        color: 'var(--on-card-high)',
        borderRadius: 'var(--radius-lg)',
        padding: '12px 14px',
        boxShadow: 'var(--shadow-card)',
        cursor: 'pointer',
        border: selected ? '2px solid var(--gold)' : '2px solid transparent',
        ...statusStyle[contact.status],
      }}
    >
      {/* checkbox selezione multipla */}
      <button
        aria-label="Seleziona"
        onClick={(e) => {
          e.stopPropagation();
          onToggleSelect();
        }}
        style={{
          width: 22,
          height: 22,
          flexShrink: 0,
          borderRadius: 6,
          border: '1.5px solid var(--on-card-low)',
          background: selected ? 'var(--on-card-high)' : 'transparent',
          color: '#fff',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 13,
        }}
      >
        {selected ? '✓' : ''}
      </button>

      {/* foto tonda */}
      {contact.photo_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={contact.photo_url}
          alt=""
          style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
        />
      ) : (
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: '50%',
            flexShrink: 0,
            background: 'rgba(0,0,0,0.06)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 600,
            color: 'var(--on-card-mid)',
          }}
        >
          {initials(contact.name)}
        </div>
      )}

      {/* nome + ruolo + badge */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontWeight: 600,
            fontSize: 15,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {contact.name ?? 'Sconosciuto'}
        </div>
        <div
          style={{
            fontSize: 12.5,
            color: 'var(--on-card-mid)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {contact.headline ?? contact.company ?? ''}
        </div>
        <div style={{ display: 'flex', gap: 6, marginTop: 5, flexWrap: 'wrap' }}>
          {relEmoji && <Pill>{relEmoji}</Pill>}
          {inviteReady && <Pill gold>⏰ pronto per invitare</Pill>}
          {dueDays !== null && <Pill gold>⏰ follow-up ({dueDays}g)</Pill>}
          {contact.category && <Pill>{contact.category}</Pill>}
          {(contact.badges ?? []).map((b) => (
            <Pill key={b} gold={topMatch}>
              {b}
            </Pill>
          ))}
        </div>
      </div>

      {/* score */}
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 26,
            lineHeight: 1,
            color: topMatch ? 'var(--gold)' : 'var(--on-card-high)',
          }}
        >
          {contact.score ?? '—'}
        </div>
        {delta !== 0 ? (
          <div style={{ fontSize: 10, color: delta > 0 ? 'var(--gold)' : 'var(--on-card-low)' }}>
            {delta > 0 ? `▲ +${delta}` : `▼ ${delta}`}
          </div>
        ) : (
          <div style={{ fontSize: 10, color: 'var(--on-card-low)' }}>score</div>
        )}
      </div>
    </div>
  );
}

function Pill({ children, gold }: { children: React.ReactNode; gold?: boolean }) {
  return (
    <span
      style={{
        fontSize: 10.5,
        padding: '2px 8px',
        borderRadius: 999,
        border: `1px solid ${gold ? 'var(--gold)' : 'var(--border-card)'}`,
        color: gold ? 'var(--gold)' : 'var(--on-card-mid)',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  );
}
