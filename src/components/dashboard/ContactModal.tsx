'use client';

import { useState } from 'react';
import type { Contact, Category, ContactStatus, RelStatus } from '@/lib/types';
import { api } from '@/lib/api';

// Avatar iniziali (khadinakbar non dà la foto). Stesse regole della ContactCard.
function initials(name: string | null): string {
  if (!name) return '?';
  return name.split(' ').map((s) => s[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
}
function avatarColor(name: string | null): string {
  if (!name) return 'hsl(0 0% 20%)';
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  return `hsl(${h} 32% 24%)`;
}

// Pop-up al tap su una card: tutte le info scrapate + azioni.
const STATUSES: { value: ContactStatus; label: string }[] = [
  { value: 'da_valutare', label: '📥 Da valutare' },
  { value: 'da_fare', label: '⭐ Da fare' },
  { value: 'fatto', label: '✅ Fatto' },
  { value: 'non_fare', label: '❌ Non fare' },
];

// Warm-up: tappe della relazione (l'utente le avanza a mano).
// likato/commentato = PRIMA dell'invito, per scaldare il contatto.
const REL_STATUSES: { value: RelStatus; label: string }[] = [
  { value: 'nessuno', label: '○ Nessuno' },
  { value: 'likato', label: '👍 Likato' },
  { value: 'commentato', label: '💬 Commentato' },
  { value: 'invitato', label: '📨 Invitato' },
  { value: 'connesso', label: '🤝 Connesso' },
  { value: 'messaggiato', label: '✉️ Messaggiato' },
  { value: 'risposto', label: '🗣️ Ha risposto' },
  { value: 'in_conversazione', label: '🔥 In conversazione' },
  { value: 'freddo', label: '❄️ Freddo' },
];

function experiences(raw: Record<string, unknown> | null): string[] {
  if (!raw) return [];
  const exp = (raw.experiences ?? raw.experience) as unknown;
  if (!Array.isArray(exp)) return [];
  return exp.slice(0, 6).map((e) => {
    if (e && typeof e === 'object') {
      const o = e as Record<string, unknown>;
      const title = o.title ?? o.position ?? '';
      const company = o.companyName ?? o.company ?? '';
      return [title, company].filter(Boolean).join(' · ');
    }
    return String(e);
  });
}

export function ContactModal({
  contact,
  categories,
  onClose,
  onUpdated,
}: {
  contact: Contact;
  categories: Category[];
  onClose: () => void;
  onUpdated: () => void;
}) {
  const [message, setMessage] = useState<string | null>(contact.message ?? null);
  const [genLoading, setGenLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notes, setNotes] = useState(contact.notes ?? '');
  const [notesSaved, setNotesSaved] = useState(false);

  async function setStatus(status: ContactStatus) {
    setBusy(true);
    await api.contacts.update([contact.id], { status });
    setBusy(false);
    onUpdated();
  }
  async function setCategory(category: string) {
    setBusy(true);
    await api.contacts.update([contact.id], { category });
    setBusy(false);
    onUpdated();
  }
  async function setRelStatus(rel_status: RelStatus) {
    setBusy(true);
    await api.contacts.update([contact.id], { rel_status });
    setBusy(false);
    onUpdated();
  }
  async function saveNotes() {
    setBusy(true);
    await api.contacts.update([contact.id], { notes: notes.trim() || null });
    setBusy(false);
    setNotesSaved(true);
    setTimeout(() => setNotesSaved(false), 1500);
    onUpdated();
  }
  async function genMessage(regenerate = false) {
    setGenLoading(true);
    try {
      const { message } = await api.message.generate(contact.id, regenerate);
      setMessage(message);
      onUpdated(); // persiste anche su contact.message
    } catch (e) {
      setMessage(`Errore: ${e instanceof Error ? e.message : e}`);
    }
    setGenLoading(false);
  }
  async function openLinkedIn() {
    window.open(contact.linkedin_url, '_blank');
    await api.outreach.log(contact.id); // tracker anti-ban
    onUpdated();
  }

  const exps = experiences(contact.raw);

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.7)',
        zIndex: 50,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        padding: 12,
      }}
    >
      <div
        className="scroll-thin"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 560,
          maxHeight: '88vh',
          overflowY: 'auto',
          background: 'var(--bg-elevated)',
          color: 'var(--on-card-high)',
          borderRadius: 'var(--radius-xl)',
          boxShadow: 'var(--shadow-card)',
          padding: 20,
        }}
      >
        <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
          {contact.photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={contact.photo_url}
              alt=""
              style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover' }}
            />
          ) : (
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: '50%',
                flexShrink: 0,
                background: avatarColor(contact.name),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: 22,
                color: '#fff',
              }}
            >
              {initials(contact.name)}
            </div>
          )}
          <div style={{ flex: 1 }}>
            <h2 style={{ margin: 0, fontSize: 20, fontFamily: 'var(--font-display)' }}>
              {contact.name ?? 'Sconosciuto'}
            </h2>
            <div style={{ color: 'var(--on-card-mid)', fontSize: 13 }}>{contact.headline}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 30, lineHeight: 1 }}>
              {contact.score ?? '—'}
            </div>
            <div style={{ fontSize: 10, color: 'var(--on-card-low)' }}>score</div>
          </div>
        </div>

        {contact.reason && (
          <p style={{ marginTop: 14, fontSize: 13.5, color: 'var(--on-card-mid)' }}>
            💡 {contact.reason}
          </p>
        )}

        <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
          {(contact.badges ?? []).map((b) => (
            <span
              key={b}
              style={{
                fontSize: 11,
                padding: '3px 9px',
                borderRadius: 999,
                border: '1px solid var(--gold)',
                color: 'var(--gold)',
              }}
            >
              {b}
            </span>
          ))}
        </div>

        <Info label="Azienda" value={contact.company} />
        <Info label="Località" value={contact.location} />

        {/* DIAGNOSTICA: mostra i dati grezzi così vediamo se c'è il numero di
            follower/collegamenti. Da rimuovere una volta deciso il filtro. */}
        {contact.raw && (
          <details style={{ marginTop: 12 }}>
            <summary
              style={{ fontSize: 11, color: 'var(--on-card-low)', cursor: 'pointer' }}
            >
              🔎 Dati grezzi (debug)
            </summary>
            <pre
              style={{
                fontSize: 10.5,
                marginTop: 6,
                padding: 8,
                background: 'rgba(0,0,0,0.05)',
                borderRadius: 8,
                overflowX: 'auto',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                maxHeight: 260,
                overflowY: 'auto',
              }}
            >
              {JSON.stringify(contact.raw, null, 2)}
            </pre>
          </details>
        )}
        {exps.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 11, color: 'var(--on-card-low)', marginBottom: 4 }}>
              Esperienze
            </div>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
              {exps.map((e, i) => (
                <li key={i} style={{ marginBottom: 2 }}>
                  {e}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* azioni */}
        <div style={{ display: 'flex', gap: 8, marginTop: 18, flexWrap: 'wrap' }}>
          <ActionBtn onClick={openLinkedIn} primary>
            🔗 Apri LinkedIn
          </ActionBtn>
          <ActionBtn onClick={() => genMessage(false)} disabled={genLoading}>
            {genLoading ? '…' : message ? '✍️ Mostra messaggio' : '✍️ Genera messaggio'}
          </ActionBtn>
          {message && (
            <ActionBtn onClick={() => genMessage(true)} disabled={genLoading}>
              ♻️ Rigenera
            </ActionBtn>
          )}
        </div>

        {/* selettore stato */}
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 11, color: 'var(--on-card-low)', marginBottom: 6 }}>Stato</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {STATUSES.map((s) => (
              <Chip
                key={s.value}
                active={contact.status === s.value}
                onClick={() => setStatus(s.value)}
                disabled={busy}
              >
                {s.label}
              </Chip>
            ))}
          </div>
        </div>

        {/* selettore categoria */}
        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: 11, color: 'var(--on-card-low)', marginBottom: 6 }}>
            Categoria
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {categories.map((c) => (
              <Chip
                key={c.id}
                active={contact.category === c.name}
                onClick={() => setCategory(c.name)}
                disabled={busy}
              >
                {c.emoji ? `${c.emoji} ` : ''}
                {c.name}
              </Chip>
            ))}
          </div>
        </div>

        {/* warm-up: stato relazione post-accettazione */}
        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: 11, color: 'var(--on-card-low)', marginBottom: 6 }}>
            Relazione (warm-up)
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {REL_STATUSES.map((s) => (
              <Chip
                key={s.value}
                active={(contact.rel_status ?? 'nessuno') === s.value}
                onClick={() => setRelStatus(s.value)}
                disabled={busy}
              >
                {s.label}
              </Chip>
            ))}
          </div>
        </div>

        {/* note personali (#6) */}
        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: 11, color: 'var(--on-card-low)', marginBottom: 6 }}>
            Note personali
          </div>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Es. amico di Marco · conosciuto a evento X · interessato a real estate"
            rows={2}
            style={{
              width: '100%',
              resize: 'vertical',
              padding: 10,
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-card)',
              background: 'rgba(0,0,0,0.04)',
              color: 'var(--on-card-high)',
              fontSize: 13,
              fontFamily: 'inherit',
            }}
          />
          {notes !== (contact.notes ?? '') && (
            <ActionBtn onClick={saveNotes} disabled={busy}>
              {notesSaved ? '✓ Salvato' : '💾 Salva note'}
            </ActionBtn>
          )}
        </div>

        {/* messaggio generato */}
        {message !== null && (
          <div
            style={{
              marginTop: 16,
              padding: 12,
              borderRadius: 'var(--radius-md)',
              background: 'rgba(0,0,0,0.04)',
              border: '1px solid var(--border-card)',
            }}
          >
            <div style={{ fontSize: 11, color: 'var(--on-card-low)', marginBottom: 6 }}>
              Messaggio (DM post-accettazione — NON la nota dell&apos;invito)
            </div>
            <p style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: 14 }}>{message}</p>
            <ActionBtn
              onClick={() => {
                navigator.clipboard.writeText(message);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
            >
              {copied ? '✓ Copiato' : '📋 Copia'}
            </ActionBtn>
          </div>
        )}

        <button
          onClick={onClose}
          style={{
            marginTop: 18,
            width: '100%',
            padding: 12,
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-card)',
            background: 'transparent',
            color: 'var(--on-card-mid)',
            cursor: 'pointer',
          }}
        >
          Chiudi
        </button>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div style={{ marginTop: 10 }}>
      <span style={{ fontSize: 11, color: 'var(--on-card-low)' }}>{label}: </span>
      <span style={{ fontSize: 13.5 }}>{value}</span>
    </div>
  );
}

function ActionBtn({
  children,
  onClick,
  primary,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  primary?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: '10px 14px',
        borderRadius: 'var(--radius-md)',
        border: primary ? 'none' : '1px solid var(--border-card)',
        background: primary ? 'var(--on-card-high)' : 'transparent',
        color: primary ? '#fff' : 'var(--on-card-high)',
        fontWeight: 600,
        fontSize: 13,
        cursor: disabled ? 'wait' : 'pointer',
        marginTop: 8,
      }}
    >
      {children}
    </button>
  );
}

function Chip({
  children,
  active,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  active?: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: '6px 11px',
        borderRadius: 999,
        border: `1px solid ${active ? 'var(--on-card-high)' : 'var(--border-card)'}`,
        background: active ? 'var(--on-card-high)' : 'transparent',
        color: active ? '#fff' : 'var(--on-card-mid)',
        fontSize: 12.5,
        cursor: disabled ? 'wait' : 'pointer',
      }}
    >
      {children}
    </button>
  );
}
