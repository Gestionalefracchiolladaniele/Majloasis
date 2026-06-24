'use client';

import { useState } from 'react';
import type { UserProfile, UserPreferences } from '@/lib/types';
import { api } from '@/lib/api';

// Sezione "Il mio profilo": incolla link + 5 domande (pre-compilate con le
// risposte note dell'utente da CLAUDE.md) + preferenze ricerca.
const DEFAULTS: UserPreferences = {
  keywords: ['founder', 'CEO', 'investor', 'tech leader', 'entrepreneur', 'AI'],
  cities: ['Dubai', 'UAE'],
  exclusions: ['profili umili/operativi (camerieri, chef, staff base)', 'junior/entry-level'],
  gender_rule:
    'uomini → passa; nome ambiguo → passa; donne → escludi o in fondo (target ~90% uomini)',
  goal: 'Networking a Dubai in vista di un trasferimento (vacanza 1 settimana a ottobre 2026).',
  ideal_contact: 'Networking ampio, senza settore specifico — solo alto calibro.',
  target_sectors: 'Nessuno specifico.',
  offer: 'AI-native Full-Stack Engineer.',
  reach_preset: 'modesto',
  min_followers: 500,
  max_followers: 3000,
  warmup_days: 2,
};

// Preset fascia follower. "Modesto" è consigliato a chi parte da zero: profili
// attivi ma alla portata. Funziona sia in Full (filtro numerico) che in Short
// (istruzione semantica a Gemini).
const REACH_PRESETS: {
  value: NonNullable<UserPreferences['reach_preset']>;
  label: string;
  min: number;
  max: number;
  hint: string;
}[] = [
  { value: 'modesto', label: '🌱 Modesto', min: 500, max: 3000, hint: 'Parti da 0 — alla tua portata' },
  { value: 'bilanciato', label: '⚖️ Bilanciato', min: 1000, max: 6000, hint: 'Profilo già credibile' },
  { value: 'ambizioso', label: '🦈 Ambizioso', min: 2000, max: 10000, hint: 'Hai social proof' },
];

export function ProfileSetup({
  initial,
  onSaved,
}: {
  initial: UserProfile | null;
  onSaved: () => void;
}) {
  const p = initial?.preferences ?? DEFAULTS;
  const [linkedinUrl, setLinkedinUrl] = useState(initial?.linkedin_url ?? '');
  const [prefs, setPrefs] = useState<UserPreferences>(p);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [revaluing, setRevaluing] = useState(false);

  function set<K extends keyof UserPreferences>(k: K, v: UserPreferences[K]) {
    setPrefs((prev) => ({ ...prev, [k]: v }));
  }
  function setList<K extends 'keywords' | 'cities' | 'exclusions'>(k: K, v: string) {
    set(k, v.split(',').map((s) => s.trim()).filter(Boolean));
  }
  function applyPreset(preset: (typeof REACH_PRESETS)[number]) {
    setPrefs((prev) => ({
      ...prev,
      reach_preset: preset.value,
      min_followers: preset.min,
      max_followers: preset.max,
    }));
  }

  async function revalueAll() {
    setRevaluing(true);
    setMsg(null);
    try {
      const r = await api.revalue();
      if (!r.ok) setMsg(`Errore: ${r.error}`);
      else if (r.considered === 0) setMsg('Nessun contatto da rivalutare.');
      else setMsg(`✓ Rivalutati ${r.rescored} contatti col profilo aggiornato · ${r.improved} sono saliti.`);
      onSaved();
    } catch (e) {
      setMsg(`Errore: ${e instanceof Error ? e.message : e}`);
    }
    setRevaluing(false);
  }

  async function save(rescrape: boolean) {
    setSaving(true);
    setMsg(null);
    try {
      await api.profile.save({ linkedin_url: linkedinUrl, preferences: prefs, rescrape });
      setMsg(rescrape ? '✓ Profilo scrapato e riassunto.' : '✓ Preferenze salvate.');
      onSaved();
    } catch (e) {
      setMsg(`Errore: ${e instanceof Error ? e.message : e}`);
    }
    setSaving(false);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <section style={card}>
        <h3 style={h3}>Il mio profilo LinkedIn</h3>
        <p style={hint}>
          Incolla il link del tuo profilo: Apify lo scrapa, Gemini lo riassume e diventa il metro
          di valutazione. Si ri-genera solo quando premi &quot;Scrapa e riassumi&quot;.
        </p>
        <input
          value={linkedinUrl}
          onChange={(e) => setLinkedinUrl(e.target.value)}
          placeholder="https://www.linkedin.com/in/tuo-profilo/"
          style={input}
        />
        {initial?.summary && (
          <div
            style={{
              marginTop: 10,
              padding: 10,
              borderRadius: 'var(--radius-md)',
              background: 'var(--bg-glass)',
              border: '1px solid var(--border)',
              fontSize: 13,
              color: 'var(--text-mid)',
              whiteSpace: 'pre-wrap',
            }}
          >
            {initial.summary}
          </div>
        )}
      </section>

      <section style={card}>
        <h3 style={h3}>Le 5 domande chiave</h3>
        <Field label="1. Obiettivo a Dubai">
          <textarea style={input} rows={2} value={prefs.goal} onChange={(e) => set('goal', e.target.value)} />
        </Field>
        <Field label="2. Contatto ideale">
          <textarea style={input} rows={2} value={prefs.ideal_contact} onChange={(e) => set('ideal_contact', e.target.value)} />
        </Field>
        <Field label="3. Settori target">
          <input style={input} value={prefs.target_sectors} onChange={(e) => set('target_sectors', e.target.value)} />
        </Field>
        <Field label="4. Cosa offri">
          <input style={input} value={prefs.offer} onChange={(e) => set('offer', e.target.value)} />
        </Field>
        <Field label="5. Esclusioni (separate da virgola)">
          <input style={input} value={prefs.exclusions.join(', ')} onChange={(e) => setList('exclusions', e.target.value)} />
        </Field>
      </section>

      <section style={card}>
        <h3 style={h3}>Preferenze di ricerca</h3>
        <Field label="Parole chiave (virgola)">
          <input style={input} value={prefs.keywords.join(', ')} onChange={(e) => setList('keywords', e.target.value)} />
        </Field>
        <Field label="Città (virgola)">
          <input style={input} value={prefs.cities.join(', ')} onChange={(e) => setList('cities', e.target.value)} />
        </Field>
        <Field label="Regola genere">
          <textarea style={input} rows={2} value={prefs.gender_rule} onChange={(e) => set('gender_rule', e.target.value)} />
        </Field>

        <Field label="Fascia profili (visibilità / follower)">
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {REACH_PRESETS.map((preset) => {
              const active = (prefs.reach_preset ?? 'modesto') === preset.value;
              return (
                <button
                  key={preset.value}
                  type="button"
                  onClick={() => applyPreset(preset)}
                  style={{
                    flex: '1 1 30%',
                    minWidth: 120,
                    padding: '10px 12px',
                    borderRadius: 'var(--radius-md)',
                    border: `1px solid ${active ? 'var(--gold)' : 'var(--border)'}`,
                    background: active ? 'rgba(201,162,39,0.12)' : 'transparent',
                    color: 'var(--text-high)',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{preset.label}</div>
                  <div style={{ fontSize: 10.5, color: 'var(--text-low)', marginTop: 2 }}>
                    {preset.min}–{preset.max}
                  </div>
                  <div style={{ fontSize: 10.5, color: 'var(--text-low)' }}>{preset.hint}</div>
                </button>
              );
            })}
          </div>
          <p style={{ ...hint, marginTop: 8 }}>
            In modalità Apify <b>Full</b> filtra per numero di follower; in <b>Short</b> (default,
            più economica) orienta Gemini a preferire profili con quella visibilità. Funziona in
            entrambe.
          </p>
        </Field>

        <div style={{ display: 'flex', gap: 10 }}>
          <Field label="Min follower">
            <input
              style={input}
              type="number"
              value={prefs.min_followers ?? ''}
              onChange={(e) =>
                setPrefs((prev) => ({
                  ...prev,
                  reach_preset: 'custom',
                  min_followers: e.target.value === '' ? null : Number(e.target.value),
                }))
              }
            />
          </Field>
          <Field label="Max follower">
            <input
              style={input}
              type="number"
              value={prefs.max_followers ?? ''}
              onChange={(e) =>
                setPrefs((prev) => ({
                  ...prev,
                  reach_preset: 'custom',
                  max_followers: e.target.value === '' ? null : Number(e.target.value),
                }))
              }
            />
          </Field>
        </div>

        <Field label="Giorni di scaldata prima dell'invito">
          <input
            style={input}
            type="number"
            min={0}
            value={prefs.warmup_days ?? 2}
            onChange={(e) => set('warmup_days', e.target.value === '' ? undefined : Number(e.target.value))}
          />
          <p style={{ ...hint, marginTop: 6 }}>
            Dopo che hai 👍 likato o 💬 commentato un suo post, quanti giorni aspettare prima che la
            card ti suggerisca <b>⏰ pronto per invitare</b>. Consigliato <b>2</b> (sweet spot: ti
            ricorda ma non sei invadente).
          </p>
        </Field>
      </section>

      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={() => save(false)} disabled={saving} style={btnSecondary}>
          {saving ? '…' : 'Salva preferenze'}
        </button>
        <button onClick={() => save(true)} disabled={saving || !linkedinUrl} style={btnPrimary}>
          {saving ? '…' : 'Scrapa e riassumi profilo'}
        </button>
      </div>
      {initial?.summary && (
        <section style={{ ...card, borderColor: 'var(--gold)' }}>
          <h3 style={h3}>🕰️ Time machine</h3>
          <p style={hint}>
            Il tuo profilo migliora nel tempo: chi prima non era un match ora può esserlo.
            Ri-valuta i contatti ancora in gioco col tuo profilo <b>aggiornato</b> (non ri-scrapa
            Apify, costo zero). Lancialo dopo aver premuto &quot;Scrapa e riassumi&quot;.
          </p>
          <button onClick={revalueAll} disabled={revaluing} style={btnSecondary}>
            {revaluing ? 'Rivaluto…' : '🕰️ Rivaluta il pool col profilo aggiornato'}
          </button>
        </section>
      )}

      {msg && <p style={{ fontSize: 13, color: 'var(--text-mid)' }}>{msg}</p>}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'block', marginBottom: 12 }}>
      <span style={{ display: 'block', fontSize: 12, color: 'var(--text-mid)', marginBottom: 4 }}>
        {label}
      </span>
      {children}
    </label>
  );
}

const card: React.CSSProperties = {
  background: 'var(--bg-glass)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-lg)',
  padding: 16,
};
const h3: React.CSSProperties = { margin: '0 0 6px', fontFamily: 'var(--font-display)', fontSize: 17 };
const hint: React.CSSProperties = { fontSize: 13, color: 'var(--text-low)', marginTop: 0 };
const input: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: 'var(--radius-md)',
  border: '1px solid var(--border)',
  background: 'rgba(255,255,255,0.03)',
  color: 'var(--text-high)',
  fontSize: 14,
  fontFamily: 'var(--font-ui)',
  resize: 'vertical',
};
const btnPrimary: React.CSSProperties = {
  flex: 1,
  padding: 12,
  borderRadius: 'var(--radius-md)',
  border: 'none',
  background: 'var(--bg-elevated)',
  color: 'var(--on-card-high)',
  fontWeight: 600,
  cursor: 'pointer',
};
const btnSecondary: React.CSSProperties = {
  flex: 1,
  padding: 12,
  borderRadius: 'var(--radius-md)',
  border: '1px solid var(--border)',
  background: 'transparent',
  color: 'var(--text-high)',
  cursor: 'pointer',
};
