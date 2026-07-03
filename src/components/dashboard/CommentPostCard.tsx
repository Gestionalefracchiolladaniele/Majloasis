'use client';

import { useState } from 'react';
import type { CommentPost } from '@/lib/types';
import { api } from '@/lib/api';

// Card della tab "Commenta": post recente su cui lasciare un commento a mano.
// Il commento si GENERA on-demand (bottone), poi resta in cache. L'azione finale
// (commentare su LinkedIn) è manuale: qui si apre il post e si copia il testo.

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

// "3h", "2g", "poco fa" — età del post dalla data reale.
function ago(iso: string | null): string {
  if (!iso) return '';
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'ora';
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}g`;
}

export function CommentPostCard({
  post,
  onChanged,
}: {
  post: CommentPost;
  onChanged: () => void;
}) {
  const [comment, setComment] = useState<string | null>(post.draft_comment);
  const [gen, setGen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const commented = !!post.commented_at;
  const topMatch = (post.score ?? 0) >= 75;
  const body = post.content ?? '';
  const short = body.length > 260 && !expanded ? body.slice(0, 260) + '…' : body;

  async function generate(regenerate = false) {
    setGen(true);
    setNote(null);
    try {
      const r = await api.comments.generate(post.id, regenerate);
      setComment(r.comment);
    } catch (e) {
      setNote(`Errore: ${e instanceof Error ? e.message : e}`);
    }
    setGen(false);
  }

  async function copy() {
    if (!comment) return;
    try {
      await navigator.clipboard.writeText(comment);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setNote('Copia non riuscita: selezionalo a mano.');
    }
  }

  async function toggleCommented() {
    setBusy(true);
    try {
      await api.comments.markCommented(post.id, commented);
      onChanged();
    } catch (e) {
      setNote(`Errore: ${e instanceof Error ? e.message : e}`);
    }
    setBusy(false);
  }

  async function toMajloasis() {
    setBusy(true);
    setNote(null);
    try {
      const r = await api.comments.toMajloasis(post.id);
      setNote(r.already ? 'Già nel pool Majloasis.' : '✓ Aggiunto a Majloasis (💬 commentato).');
    } catch (e) {
      setNote(`Errore: ${e instanceof Error ? e.message : e}`);
    }
    setBusy(false);
  }

  return (
    <div
      style={{
        background: 'var(--bg-elevated)',
        color: 'var(--on-card-high)',
        borderRadius: 'var(--radius-lg)',
        padding: '12px 14px',
        boxShadow: 'var(--shadow-card)',
        border: '2px solid transparent',
        opacity: commented ? 0.6 : 1,
      }}
    >
      {/* header autore */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {post.author_photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={post.author_photo}
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
              background: avatarColor(post.author_name),
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: 15,
              color: '#fff',
            }}
          >
            {initials(post.author_name)}
          </div>
        )}
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
            {post.author_name ?? 'Sconosciuto'}
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
            {post.author_headline ?? ''}
          </div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 22,
              lineHeight: 1,
              color: topMatch ? 'var(--gold)' : 'var(--on-card-high)',
            }}
          >
            {post.score ?? '—'}
          </div>
          <div style={{ fontSize: 10, color: 'var(--on-card-low)' }}>{ago(post.posted_at) || 'score'}</div>
        </div>
      </div>

      {/* meta */}
      <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
        <Pill>👍 {post.likes ?? 0}</Pill>
        <Pill>💬 {post.comments ?? 0}</Pill>
        {post.posted_at && <Pill>🕒 {ago(post.posted_at)} fa</Pill>}
        {commented && <Pill gold>✅ commentato</Pill>}
      </div>

      {/* testo post */}
      {body && (
        <p
          onClick={() => body.length > 260 && setExpanded((v) => !v)}
          style={{
            fontSize: 13.5,
            lineHeight: 1.5,
            color: 'var(--on-card-mid)',
            marginTop: 10,
            marginBottom: 0,
            whiteSpace: 'pre-wrap',
            cursor: body.length > 260 ? 'pointer' : 'default',
          }}
        >
          {short}
        </p>
      )}

      {/* perché vale */}
      {post.reason && (
        <div style={{ fontSize: 12, color: 'var(--on-card-low)', marginTop: 8, fontStyle: 'italic' }}>
          💡 {post.reason}
        </div>
      )}

      {/* commento generato (on-demand) */}
      {comment && (
        <div
          style={{
            marginTop: 10,
            padding: 10,
            borderRadius: 'var(--radius-md)',
            background: 'rgba(0,0,0,0.18)',
            border: '1px solid var(--border-card)',
            fontSize: 13.5,
            lineHeight: 1.5,
            whiteSpace: 'pre-wrap',
          }}
        >
          {comment}
        </div>
      )}

      {note && (
        <div style={{ fontSize: 12, color: 'var(--on-card-mid)', marginTop: 8 }}>{note}</div>
      )}

      {/* azioni */}
      <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
        <a href={post.post_url} target="_blank" rel="noopener noreferrer" style={btnLink}>
          🔗 Apri post
        </a>
        {!comment ? (
          <button onClick={() => generate(false)} disabled={gen} style={btn}>
            {gen ? 'Scrivo…' : '✍️ Genera commento'}
          </button>
        ) : (
          <>
            <button onClick={copy} style={{ ...btn, borderColor: 'var(--gold)', color: 'var(--gold)' }}>
              {copied ? '✓ Copiato' : '📋 Copia'}
            </button>
            <button onClick={() => generate(true)} disabled={gen} style={btn}>
              {gen ? '…' : '🔄 Rigenera'}
            </button>
          </>
        )}
        <button onClick={toggleCommented} disabled={busy} style={btn}>
          {commented ? '↩︎ Non commentato' : '✅ Segna commentato'}
        </button>
        {post.author_url && (
          <button onClick={toMajloasis} disabled={busy} style={btn}>
            ➕ Majloasis
          </button>
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

const btn: React.CSSProperties = {
  padding: '7px 11px',
  borderRadius: 999,
  border: '1px solid var(--border-card)',
  background: 'rgba(255,255,255,0.05)',
  color: 'var(--on-card-high)',
  fontSize: 12.5,
  cursor: 'pointer',
};
const btnLink: React.CSSProperties = {
  ...btn,
  textDecoration: 'none',
  display: 'inline-flex',
  alignItems: 'center',
};
