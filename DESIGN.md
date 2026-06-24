# Design System — Majloasis 🌴 (Luxury / Premium)

Look **black & white, luxury/premium**: sfondo nero, card bianche, particelle bianche.
Riusa la STRUTTURA e le animazioni di `../polso-mano` (sfondo aurora con blob + particelle che
salgono, font, media query responsive), ma **NON i colori viola** — quelli sono sostituiti dalla
palette monocromatica qui sotto. Differenze ammesse solo se funzionali.

## Palette (monocromatica luxury)

```css
/* Sfondi — nero profondo */
--bg-deep:     #000000;   /* sfondo pagina */
--bg-base:     #050505;
--bg-elevated: #ffffff;   /* CARD bianche */
--bg-glass:    rgba(255, 255, 255, 0.04);

/* Testo */
--text-high:   #ffffff;   /* testo su sfondo nero */
--text-mid:    rgba(255,255,255,0.65);
--text-low:    rgba(255,255,255,0.40);

/* Testo SU card bianche (invertito) */
--on-card-high: #0a0a0a;
--on-card-mid:  rgba(0,0,0,0.60);
--on-card-low:  rgba(0,0,0,0.40);

/* Accento — bianco/grigio + un tocco oro opzionale per il premium */
--accent:      #ffffff;
--gold:        #c9a227;   /* usare con parsimonia: badge top match, dettagli premium */

/* Bordi / separatori */
--border:        rgba(255,255,255,0.10);   /* su nero */
--border-card:   rgba(0,0,0,0.08);         /* dentro le card bianche */

/* Radius */
--radius-sm: 8px; --radius-md: 12px; --radius-lg: 16px; --radius-xl: 24px; --radius-full: 9999px;

/* Font (come polso-mano) */
--font-ui:      'Inter', system-ui, sans-serif;
--font-display: 'Sora', 'Inter', system-ui, sans-serif;

/* Ombre / glow — luce bianca soffusa, niente viola */
--glow-white:  0 0 24px rgba(255,255,255,0.18);
--shadow-card: 0 8px 32px rgba(0,0,0,0.55);   /* card bianche staccate dal nero */
```

## Sfondo aurora + particelle (versione B/N)
Riusa il componente `AuroraBackground` di polso-mano
(`../polso-mano/web/src/components/AuroraBackground.tsx`) e le keyframes `su-aurora1/2/3` +
`su-particle` di `globals.css`, **MA cambia i colori**:
- I blob aurora: da viola → **grigi/bianchi tenui** (es. `rgba(255,255,255,0.06)` con blur), così danno
  profondità senza colore.
- Le particelle: **bianche** (`rgba(255,255,255, opacity)`) con leggero glow bianco, che salgono su
  sfondo nero. Effetto "polvere di stelle" premium.
- Resta dietro al contenuto (`zIndex: 0`), decorativo, si disattiva con `prefers-reduced-motion`.

## Card (il cuore del look luxury)
- Card **bianche** (`--bg-elevated`) su sfondo nero, radius `--radius-lg`, `--shadow-card` per
  staccarle dal nero. Testo dentro la card usa `--on-card-*` (nero su bianco).
- Hover/selezione: leggero `--glow-white` o bordo più marcato. Niente colori accesi.

## Mappatura colori → significato
- **Score / match forte:** numero in `--on-card-high` grande (font Sora); top match può avere bordo
  o badge in `--gold`.
- **Badge contestuali:** 🎯 Tech/Founder, 🇦🇪 UAE — pill piccola, bordo sottile, testo nero su bianco
  (o oro per i top). Devono restare eleganti, non colorate.
- **Stati contatto** (sobri, monocromatici + 1 segnale):
  - `📥 Da valutare` → grigio neutro (`--on-card-mid`)
  - `⭐ Da fare` → accento (bordo/punto `--gold`)
  - `✅ Fatto` → check pieno nero, card leggermente desaturata/spenta
  - `❌ Non fare` → card opacizzata (`opacity ~0.5`), testo `--on-card-low`
- **Tracker anti-ban:** barra bianca che si riempie; quando si avvicina al limite vira verso `--gold`
  (poi un rosso sobrio solo se sfora — unico colore "caldo" ammesso, usato come allerta).

## Layout dashboard (mobile-first)
- Sfondo pagina nero, particelle bianche dietro, card bianche davanti.
- Barra categorie raggruppata in alto a destra (azioni multiple su selezione).
- Pop-up profilo: card bianca grande con `--shadow-card`, scroll interno per le esperienze, testo nero.
- Font display **Sora** per titoli/numeri (score, tracker), **Inter** per il resto.
- Media query responsive come polso-mano (collasso a colonna singola sotto 720-900px).

## Regola di stile
Massimo due "non-colori" (nero + bianco) + **oro come unico accento premium**, usato con parsimonia.
Niente viola, niente teal. L'eleganza viene dal contrasto netto e dallo spazio bianco, non dal colore.
