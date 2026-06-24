'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Contact } from '@/lib/types';
import { api } from '@/lib/api';

// #3 — Sessione invii guidata. Pesca i top contatti "da_fare" non ancora invitati,
// li mostra UNO ALLA VOLTA, e con un tap: apre il LinkedIn + segna "invitato" +
// logga sul tracker anti-ban + avanza. Riduce a 1 tap il balletto manuale.
//
// Principio non-negoziabile rispettato: NON invia nulla. Apre solo il profilo;
// l'azione "Connetti" la fa l'utente a mano su LinkedIn.
export function OutreachSession({
  contacts,
  remainingToday,
  onClose,
  onDone,
}: {
  contacts: Contact[];
  remainingToday: number; // quanti inviti restano oggi secondo il tracker
  onClose: () => void;
  onDone: () => void;
}) {
  // Coda: "da_fare" non ancora invitati. Include chi è ancora a freddo (nessuno) e
  // chi è già stato "scaldato" (likato/commentato) e aspetta l'invito. Top score,
  // uomini/ambigui prima. Tagliata al numero consigliato dal tracker (pacing).
  const PRE_INVITE = ['nessuno', 'likato', 'commentato'];
  const queue = useMemo(() => {
    const cap = Math.max(1, remainingToday || 15);
    return contacts
      .filter((c) => c.status === 'da_fare' && PRE_INVITE.includes(c.rel_status))
      .filter((c) => c.gender_guess !== 'female')
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
      .slice(0, cap);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contacts, remainingToday]);

  const [i, setI] = useState(0);
  const [busy, setBusy] = useState(false);
  const [invitedCount, setInvitedCount] = useState(0);
  const [dm, setDm] = useState<string | null>(null);
  const [dmLoading, setDmLoading] = useState(false);
  const total = queue.length;
  const current = queue[i];

  function finish() {
    onDone();
    onClose();
  }

  const next = useCallback(() => {
    setDm(null);
    if (i + 1 >= total) finish();
    else setI((n) => n + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i, total]);

  const invite = useCallback(async () => {
    if (!current || busy) return;
    setBusy(true);
    // apre PRIMA della parte async così non viene bloccato dal popup-blocker
    window.open(current.linkedin_url, '_blank');
    await Promise.all([
      api.contacts.update([current.id], { rel_status: 'invitato', status: 'fatto' }),
      api.outreach.log(current.id),
    ]);
    setInvitedCount((n) => n + 1);
    setBusy(false);
    next();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, busy, next]);

  async function markAlreadyDone() {
    if (!current) return;
    setBusy(true);
    await api.contacts.update([current.id], { rel_status: 'invitato', status: 'fatto' });
    setBusy(false);
    next();
  }

  // Genera il DM post-accettazione AL VOLO (così quando accettano è già pronto in cache).
  async function genDm() {
    if (!current) return;
    setDmLoading(true);
    try {
      const { message } = await api.message.generate(current.id);
      setDm(message);
    } catch (e) {
      setDm(`Errore: ${e instanceof Error ? e.message : e}`);
    }
    setDmLoading(false);
  }

  // Scorciatoie da tastiera (desktop): Enter/I = invita, S/→ = salta, Esc = esci.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Enter' || e.key.toLowerCase() === 'i') {
        e.preventDefault();
        invite();
      } else if (e.key.toLowerCase() === 's' || e.key === 'ArrowRight') {
        e.preventDefault();
        next();
      } else if (e.key === 'Escape') {
        onClose();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [invite, next, onClose]);

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.82)',
        zIndex: 60,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 440,
          background: 'var(--bg-elevated)',
          color: 'var(--on-card-high)',
          borderRadius: 'var(--radius-xl)',
          boxShadow: 'var(--shadow-card)',
          padding: 24,
          textAlign: 'center',
        }}
      >
        {total === 0 || !current ? (
          <Empty onClose={onClose} done={total > 0} />
        ) : (
          <>
            <div style={{ fontSize: 12, color: 'var(--on-card-low)', marginBottom: 16 }}>
              Sessione invii · {i + 1} di {total}
            </div>

            {current.photo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={current.photo_url}
                alt=""
                style={{ width: 84, height: 84, borderRadius: '50%', objectFit: 'cover', margin: '0 auto' }}
              />
            ) : (
              <div
                style={{
                  width: 84,
                  height: 84,
                  borderRadius: '50%',
                  background: 'rgba(0,0,0,0.06)',
                  margin: '0 auto',
                }}
              />
            )}

            <h2 style={{ margin: '14px 0 2px', fontFamily: 'var(--font-display)', fontSize: 22 }}>
              {current.name ?? 'Sconosciuto'}
            </h2>
            <div style={{ fontSize: 13, color: 'var(--on-card-mid)' }}>
              {current.headline ?? current.company ?? ''}
            </div>
            <div style={{ fontSize: 12, color: 'var(--on-card-low)', marginTop: 2 }}>
              {current.location}
            </div>

            <div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap', margin: '10px 0' }}>
              {(current.badges ?? []).map((b) => (
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
              <span
                style={{
                  fontSize: 11,
                  padding: '3px 9px',
                  borderRadius: 999,
                  border: '1px solid var(--border-card)',
                  color: 'var(--on-card-mid)',
                }}
              >
                score {current.score ?? '—'}
              </span>
            </div>

            {current.reason && (
              <p style={{ fontSize: 13, color: 'var(--on-card-mid)', margin: '6px 0 18px' }}>
                💡 {current.reason}
              </p>
            )}

            <button onClick={invite} disabled={busy} style={primaryBtn}>
              {busy ? '…' : '🔗 Apri e segna invitato'}
            </button>

            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button onClick={next} disabled={busy} style={ghostBtn}>
                Salta →
              </button>
              <button onClick={markAlreadyDone} disabled={busy} style={ghostBtn}>
                Già fatto ✓
              </button>
              <button onClick={genDm} disabled={dmLoading} style={ghostBtn}>
                {dmLoading ? '…' : dm ? '✍️ Rigenera' : '✍️ DM'}
              </button>
            </div>

            {/* DM pre-generato: pronto in cache per quando accettano */}
            {dm && (
              <div
                style={{
                  marginTop: 12,
                  padding: 10,
                  borderRadius: 'var(--radius-md)',
                  background: 'rgba(0,0,0,0.05)',
                  border: '1px solid var(--border-card)',
                  textAlign: 'left',
                }}
              >
                <div style={{ fontSize: 10.5, color: 'var(--on-card-low)', marginBottom: 4 }}>
                  DM post-accettazione (salvato — pronto per dopo)
                </div>
                <p style={{ margin: 0, fontSize: 13, whiteSpace: 'pre-wrap' }}>{dm}</p>
                <button
                  onClick={() => navigator.clipboard.writeText(dm)}
                  style={{ ...ghostBtn, marginTop: 8, width: 'auto', padding: '6px 12px' }}
                >
                  📋 Copia
                </button>
              </div>
            )}

            <div style={{ fontSize: 10.5, color: 'var(--on-card-low)', marginTop: 12 }}>
              ⌨️ Invio = invita · S = salta · Esc = esci · ✓ inviati: {invitedCount}
            </div>

            {/* progress dots / barra */}
            <div
              style={{
                marginTop: 18,
                height: 6,
                borderRadius: 999,
                background: 'rgba(0,0,0,0.08)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${Math.round(((i) / total) * 100)}%`,
                  height: '100%',
                  background: 'var(--gold)',
                  transition: 'width 0.3s ease',
                }}
              />
            </div>

            <button onClick={onClose} style={{ ...ghostBtn, marginTop: 14, width: '100%' }}>
              Esci dalla sessione
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function Empty({ onClose, done }: { onClose: () => void; done: boolean }) {
  return (
    <div>
      <div style={{ fontSize: 40 }}>{done ? '🎉' : '🗂️'}</div>
      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, margin: '10px 0' }}>
        {done ? 'Sessione completata!' : 'Niente in coda'}
      </h2>
      <p style={{ fontSize: 13, color: 'var(--on-card-mid)' }}>
        {done
          ? 'Hai scorso tutti i contatti pronti per oggi.'
          : 'Sposta qualche contatto in "⭐ Da fare" per iniziare una sessione.'}
      </p>
      <button onClick={onClose} style={{ ...primaryBtn, marginTop: 12 }}>
        Chiudi
      </button>
    </div>
  );
}

const primaryBtn: React.CSSProperties = {
  width: '100%',
  padding: 14,
  borderRadius: 'var(--radius-md)',
  border: 'none',
  background: 'var(--on-card-high)',
  color: '#fff',
  fontWeight: 700,
  fontSize: 15,
  cursor: 'pointer',
};
const ghostBtn: React.CSSProperties = {
  flex: 1,
  padding: 11,
  borderRadius: 'var(--radius-md)',
  border: '1px solid var(--border-card)',
  background: 'transparent',
  color: 'var(--on-card-mid)',
  fontSize: 13,
  cursor: 'pointer',
};
