'use client';

import { useEffect, useRef, useState } from 'react';
import { api, type CopilotMessage } from '@/lib/api';

// #6 — Copilota del pool. Bottone flottante in basso a destra che apre una piccola
// chat. Lo storico è PERSISTENTE (tabella copilot_messages). Può rispondere ad
// analisi ("qual è il mio tasso di accettazione?") e proporre/eseguire azioni in
// blocco ("sposta i top 5 founder in Da fare").
const SUGGESTIONS = [
  'Chi dovrei contattare oggi e perché?',
  'Quanti founder a Dubai non ho ancora contattato?',
  "Qual è il mio tasso di accettazione?",
  'Trova possibili doppioni nel pool',
];

export function Copilot({ onActed }: { onActed: () => void }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<CopilotMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && messages.length === 0) {
      api.copilot.history().then((r) => setMessages(r.messages)).catch(() => {});
    }
  }, [open, messages.length]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  async function send(text: string) {
    const q = text.trim();
    if (!q || loading) return;
    setInput('');
    // ottimistico: mostro subito la domanda
    setMessages((m) => [
      ...m,
      { id: `tmp-${Date.now()}`, role: 'user', content: q, created_at: new Date().toISOString() },
    ]);
    setLoading(true);
    try {
      const { answer, didAction } = await api.copilot.ask(q);
      setMessages((m) => [
        ...m,
        { id: `a-${Date.now()}`, role: 'assistant', content: answer, created_at: new Date().toISOString() },
      ]);
      if (didAction) onActed(); // ricarica i contatti se il copilota li ha modificati
    } catch (e) {
      setMessages((m) => [
        ...m,
        {
          id: `e-${Date.now()}`,
          role: 'assistant',
          content: `Errore: ${e instanceof Error ? e.message : e}`,
          created_at: new Date().toISOString(),
        },
      ]);
    }
    setLoading(false);
  }

  async function clear() {
    await api.copilot.clear();
    setMessages([]);
  }

  return (
    <>
      {/* bottone flottante */}
      {!open && (
        <button onClick={() => setOpen(true)} style={fab} aria-label="Apri copilota">
          ✨
        </button>
      )}

      {open && (
        <div style={panel}>
          <div style={header}>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 15 }}>✨ Copilota</span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={clear} style={headerBtn} title="Pulisci storico">
                🗑️
              </button>
              <button onClick={() => setOpen(false)} style={headerBtn} title="Chiudi">
                ✕
              </button>
            </div>
          </div>

          <div className="scroll-thin" style={body}>
            {messages.length === 0 && !loading && (
              <div style={{ color: 'var(--text-low)', fontSize: 13 }}>
                <p style={{ marginTop: 0 }}>Chiedimi qualcosa sul tuo pool:</p>
                {SUGGESTIONS.map((s) => (
                  <button key={s} onClick={() => send(s)} style={suggestion}>
                    {s}
                  </button>
                ))}
              </div>
            )}
            {messages.map((m) => (
              <div
                key={m.id}
                style={{
                  alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                  maxWidth: '85%',
                  padding: '8px 11px',
                  borderRadius: 12,
                  fontSize: 13,
                  whiteSpace: 'pre-wrap',
                  background: m.role === 'user' ? 'var(--on-card-high)' : 'var(--bg-glass)',
                  color: m.role === 'user' ? '#fff' : 'var(--text-high)',
                  border: m.role === 'user' ? 'none' : '1px solid var(--border)',
                }}
              >
                {m.content}
              </div>
            ))}
            {loading && (
              <div style={{ alignSelf: 'flex-start', fontSize: 13, color: 'var(--text-low)' }}>
                sto pensando…
              </div>
            )}
            <div ref={endRef} />
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            style={inputRow}
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Scrivi una domanda…"
              style={chatInput}
            />
            <button type="submit" disabled={loading || !input.trim()} style={sendBtn}>
              ➤
            </button>
          </form>
        </div>
      )}
    </>
  );
}

const fab: React.CSSProperties = {
  position: 'fixed',
  bottom: 20,
  right: 20,
  width: 54,
  height: 54,
  borderRadius: '50%',
  border: '1px solid var(--gold)',
  background: 'var(--bg-elevated)',
  color: 'var(--gold)',
  fontSize: 22,
  cursor: 'pointer',
  zIndex: 40,
  boxShadow: 'var(--shadow-card)',
};
const panel: React.CSSProperties = {
  position: 'fixed',
  bottom: 16,
  right: 16,
  width: 'min(380px, calc(100vw - 32px))',
  height: 'min(560px, calc(100vh - 32px))',
  background: 'var(--bg-base)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-lg)',
  boxShadow: 'var(--shadow-card)',
  display: 'flex',
  flexDirection: 'column',
  zIndex: 41,
  overflow: 'hidden',
};
const header: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '12px 14px',
  borderBottom: '1px solid var(--border)',
};
const headerBtn: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  color: 'var(--text-mid)',
  cursor: 'pointer',
  fontSize: 14,
};
const body: React.CSSProperties = {
  flex: 1,
  overflowY: 'auto',
  padding: 14,
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
};
const suggestion: React.CSSProperties = {
  display: 'block',
  width: '100%',
  textAlign: 'left',
  marginTop: 6,
  padding: '8px 10px',
  borderRadius: 8,
  border: '1px solid var(--border)',
  background: 'transparent',
  color: 'var(--text-mid)',
  fontSize: 12.5,
  cursor: 'pointer',
};
const inputRow: React.CSSProperties = {
  display: 'flex',
  gap: 8,
  padding: 12,
  borderTop: '1px solid var(--border)',
};
const chatInput: React.CSSProperties = {
  flex: 1,
  padding: '10px 12px',
  borderRadius: 'var(--radius-md)',
  border: '1px solid var(--border)',
  background: 'rgba(255,255,255,0.03)',
  color: 'var(--text-high)',
  fontSize: 13,
};
const sendBtn: React.CSSProperties = {
  padding: '0 14px',
  borderRadius: 'var(--radius-md)',
  border: 'none',
  background: 'var(--on-card-high)',
  color: '#fff',
  cursor: 'pointer',
};
