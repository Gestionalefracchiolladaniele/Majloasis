# Dictra — Specifica di progetto

> Nome del prodotto: **Dictra** (deciso). Cartella di lavoro interna: `xinkedinai`
> (legacy, non usato in alcun testo rivolto all'utente). Il vecchio nome "xinkedinai"
> era solo provvisorio ("X"/"linkedin" sono marchi altrui).

---

## 🎯 Cos'è
Un **Micro-SaaS headless su Telegram** che ogni giorno, all'orario scelto dall'utente,
consegna un **report dei trend** della sua nicchia + **post pronti** per X, LinkedIn e
altri social — scritti, se l'utente vuole, **nella sua voce**.

Non è un generatore di post generico: è un ghostwriter che conosce i **trend di oggi**
e lo **stile dell'utente**.

**Promessa:** *"Il tuo contenuto di domattina è già pronto, sul tema giusto, nella voce
giusta — mentre dormivi."*

## 👥 Per chi
Ghostwriter, agenzie social, indie hacker / solopreneur, professionisti che fanno
personal branding. Mercato **internazionale, in inglese**.
Nicchia di partenza per il marketing: **AI**.

## 🥊 Posizionamento / differenziatore
Il mercato "Reddit → post" è già occupato (Oiti, Letterly, bot Telegram a ~€9.99, ecc.).
Il core "report + post" da solo è una commodity. **Il differenziatore difendibile è la
VOCE**: clonare lo stile dell'utente (o di un guru) e applicarlo ai trend reali di oggi.
Nessun concorrente combina: trend Reddit di oggi + clone di voce da file + consegna Telegram.

---

## 💳 Piani e prezzi
| Piano | Prezzo | Cosa include |
|---|---|---|
| 🆓 **Trial (5 giorni)** | gratis | Solo il report giornaliero dei trend (lead magnet) |
| 🥈 **Creator** | **$49/mo** | Report + post pronti (X / LinkedIn / Other) + post extra on-demand · scrittura Sonnet 4.6 · 1 voce |
| 🥇 **Pro** | **$99/mo** | Tutto Creator + clona la tua voce (da file) + multi-nicchia + scrittura premium (Opus) |
| 🏢 **Agency** | **$199/mo** | Tutto Pro + fino a 10 voci/profili clienti + priorità |

Margini: ~96% a $49 (Sonnet) · ~91% a $99 (Opus). Costo per utente/mese ~$1,85 (Sonnet),
~$8,50 (Opus).

---

## ⚙️ Flusso giornaliero
1. **Cron (GitHub Actions)** parte ogni ora. Query veloce: "c'è qualcuno per cui adesso
   sono le 7 / 13 / 19 nel suo fuso?". Se no → lo script muore in ~10 sec
   (un run vuoto costa ~0,17 min di Actions → praticamente gratis).
2. **Scraping Reddit (Python / PRAW)** sui subreddit dell'utente → top post ultime 24h +
   commenti top.
3. **Pulizia (Python)** → rimuove link/HTML, emoji eccessive, messaggi bot (AutoModerator),
   tronca commenti lunghi. Gratis.
4. **Selezione trend (Claude Haiku 4.5)** → sceglie i temi più *contenibili*, non solo i
   più votati. ~$0,15/mese.
5. **Scrittura (Sonnet 4.6 / Opus su Pro)** → report + post nei formati attivati,
   applicando il manuale di voce dell'utente se presente.
6. **Consegna Telegram** → Markdown pulito + emoji come ancore visive.
   `try-except` per utente: se uno fallisce, il ciclo continua per gli altri.

## 🕐 Orari e fusi
3 fasce: **Morning / Afternoon / Evening** = 07:00 / 13:00 / 19:00 **ora locale dell'utente**.
All'onboarding l'utente sceglie il proprio **timezone** (UTC±N). Il cron gira ogni ora (UTC);
a ogni run il bot calcola, per ogni utente, l'ora locale = ora UTC + offset del suo timezone,
e seleziona chi in quel momento ha localmente le 7/13/19 (Python `zoneinfo`).
Ogni timezone scala di 1 ora → coprendo tutte le 24 offset, ogni utente riceve alle sue
7/13/19 ovunque nel mondo, con un unico cron orario.

## 📝 Formati di output (selezionabili con toggle)
- **X** → frasi brevi, hook forte, ampi spazi, no/pochi hashtag, eventuale thread.
- **LinkedIn** → tono professionale, lezioni/case study, spaziatura pulita, 2-3 hashtag.
- **Other socials** → formato adattabile (Threads, IG caption, newsletter, ecc.).

L'utente attiva solo i formati che vuole → si generano solo quelli → si risparmiano token.

## 🔄 Post extra / "altro angolo"
1 report/giorno con più temi. Per più post: ognuno parte preferibilmente da un **sotto-tema
diverso** per dare varietà. Personalizzazione via **testo libero** ("più provocatorio",
"parti da una mia esperienza") → un **system prompt di raffinazione** interpreta/ottimizza
la richiesta prima di passarla a Claude.

**Anti-ripetizione = morbida, NON un blocco.** Ripetere i propri temi forti è una strategia
social valida. Quindi il bot NON vieta i temi già usati: evita solo il copia-incolla quasi
identico.

**Importante (esperienza utente):** la consegna giornaliera (report + post) è SEMPRE già
pronta quando l'utente apre Telegram — il bot NON chiede nulla e NON fa aspettare. Quindi:
- Nella **consegna automatica** il bot decide da solo (default), preferendo varietà ma senza
  bloccarsi: genera e basta. Nessuna domanda all'orario di consegna.
- L'avviso "ne hai già parlato — angolo nuovo o lo stesso rinforzato?" compare SOLO quando è
  l'utente a chiedere un **post extra on-demand**, dove l'attesa di una scelta è naturale.
- Preferenza configurabile (toggle in Impostazioni): "varietà" (default, evita temi recenti)
  vs "rinforza i miei temi" (ripete volentieri i cavalli di battaglia). Così l'utente imposta
  una volta come vuole che il bot si comporti, senza essere interrogato ogni mattina.

## 🎙️ La voce (cuore del prodotto)
- **Un solo metodo: l'utente invia un FILE** (`.txt`, `.docx`, `.pdf`) con i suoi post o
  materiali di riferimento (es. esporta dalle Note e manda). Niente invio via chat →
  coerenza e affidabilità.
- Il bot legge il file **una volta**, estrae un **"manuale di voce"** sintetico (tono,
  ritmo, frasi tipiche, parole ricorrenti, metafore) e lo salva su Supabase. I file
  originali non si riusano → costo giornaliero minimo.
- Gestione cumulativa: aggiungi/rimuovi file → il manuale si ricompone. Limite 3-5 file.
- **Few-shot**: nel prompt si tengono ~20 post esemplari di altissima qualità come
  riferimento di stile per alzare la qualità base.

## 🛡️ Moat & Anti-churn (perché restano + difesa dai concorrenti)
Principio: i dati accumulati su un utente diventano costo di abbandono. Giorno 1 = pari a un
concorrente; giorno 90 = vali di più *per quell'utente* (conosce voce, storia, cosa funziona).
- **Voce che migliora** (priorità #1): ogni correzione/"altro angolo"/riscrittura dell'utente
  viene registrata e affina il manuale di voce → più usi, più ti capisce. Lock-in più forte.
- **Loop dei risultati**: i preferiti (⭐) e i feedback "questo è andato bene" insegnano al
  bot cosa performa per QUEL utente → genera più simile.
- **Anti-ripetizione morbida** (vedi sopra): memoria dell'archivio come *avviso*, non blocco.
- **Recap periodico**: riepilogo mensile dall'archivio ("24 post, temi caldi X/Y, top 3").
- **Riusa i vincenti**: "un post simile andò bene 2 mesi fa — rielaboro sul trend di oggi?".
- **Voce come asset (Agency)**: la voce affinata per ogni cliente vive nel sistema → cambiare
  tool = perdere mesi di lavoro accumulato.
Roadmap: MVP predispone solo le **fondamenta dati** (archivio + feedback voce). Le funzioni
intelligenti (loop risultati, recap, riuso) sono post-lancio (mese 2-3).

## 🤖 Architettura AI (modello giusto per ogni compito)
| Compito | Strumento | Costo |
|---|---|---|
| Scraping + pulizia + ordinamento | Python puro (PRAW, regex) | $0 |
| Selezione trend "contenibili" | Claude Haiku 4.5 | ~$0,15/mese |
| Scrittura report / post | Claude Sonnet 4.6 (Opus su Pro) | ~$1,70/mese |
| Estrazione manuale di voce (una tantum) | Claude Sonnet 4.6 | costo una tantum |

NB: niente fine-tuning, niente provider multipli all'inizio (un solo SDK Anthropic).
Opus è un argomento di vendita del piano Pro, non un costo subìto.

## 🛠️ Stack tecnico
Python · Supabase (DB) · PRAW (Reddit) · Anthropic SDK (Claude) · python-telegram-bot ·
GitHub Actions (cron orario) · **Stripe** (pagamenti, webhook diretto → Supabase Edge
Function, NO Make/Zapier) · python-docx / pypdf (lettura file voce).
Modelli: `claude-haiku-4-5`, `claude-sonnet-4-6`, `claude-opus-4-8`.
(Aggiornare: NON usare il vecchio `claude-3-5-sonnet-20241022` del prompt originale.)

## 🗄️ Dati (Supabase)
**Tabella `utenti`**: `id_telegram` (PK), `email` (per follow-up post-trial),
`codice_attivazione`, `stato_abbonamento` (pending_activation / trial / active / canceled),
`piano` (creator / pro / agency), `fascia_oraria` (morning / afternoon / evening),
`timezone`, `subreddit_selezionati` (TEXT[]), `canali_youtube` (TEXT[], solo Pro/Agency),
`formati_attivi` (X / LinkedIn / other), `modo_temi` (varieta / rinforza, default 'varieta'),
`trial_start_date`, `created_at`.

**Tabella `voci`**: `id`, `id_utente`, `nome_profilo` (per Agency multi-cliente),
`nome_file`, `manuale_voce` (TEXT, mini-manuale del singolo file), `file_count`.
Il "manuale master" si ricompone unendo i mini-manuali dei file attivi.

**Tabella `archivio`**: `id`, `id_utente`, `data`, `tipo` (report / post_x / post_linkedin /
post_other), `contenuto` (TEXT), `preferito` (BOOL, default false), `tema` (TEXT, per
l'anti-ripetizione morbida), `created_at`.
Alimenta l'Archivio Telegram (rivedere / cancellare / preferiti / reset) e il Moat.

**Tabella `feedback_voce`** (fondamenta del Moat — popolata dall'MVP, sfruttata dopo):
`id`, `id_utente`, `nome_profilo`, `contenuto_originale` (TEXT), `richiesta_utente` (TEXT,
es. "più provocatorio"), `contenuto_corretto` (TEXT), `created_at`. Registra ogni
"altro angolo"/riscrittura → in futuro affina il manuale di voce.

## 🐘 Supabase (essenziale)
- 4 tabelle: `utenti`, `voci`, `archivio`, `feedback_voce` (campi nei paragrafi "Dati"
  sopra). FK con `on delete cascade` verso `utenti`. RLS abilitato, nessuna policy
  pubblica: il backend accede con la **service role key** (bypassa RLS).
- 1 **Edge Function** `stripe-webhook`: verifica firma Stripe → genera `codice_attivazione`
  → inserisce utente `pending_activation` (piano dedotto dal price ID). Deploy con
  `--no-verify-jwt`; collegare l'URL in Stripe Dashboard → Webhooks.
- Lo SQL completo e il codice della function si generano al passo 2/5 (non inline qui).

## 📐 Specifiche di formato (precise)
- **Post X**: hook forte in apertura, frasi brevi (~<10 parole), ampi spazi bianchi;
  singolo post sotto i ~280 caratteri; thread se il tema richiede profondità.
- **Post LinkedIn**: tono professionale/personal branding, focus su lezioni apprese e
  case study, spaziatura pulita, 2-3 hashtag alla fine.
- **YouTube (Pro/Agency)**: l'utente invia il link del canale → Python estrae l'ID →
  si recupera la **trascrizione automatica** dei video recenti come fonte extra.
  NB: le trascrizioni consumano molti token → motivo per cui è solo Pro/Agency.

## 📲 Onboarding (zero frontend, solo Stripe — NO Make/Zapier)
Stripe Payment Link → **webhook Stripe diretto** verso una **Supabase Edge Function**
(intercetta `checkout.session.completed` / `customer.subscription.created`) → la function
genera il codice, salva l'utente su Supabase (`pending_activation`), e la pagina di successo
Stripe mostra `t.me/TuoBot?start=CODICE` → il bot (deep linking) attiva l'account, associa
`id_telegram`, imposta `active`. Nessun middleman no-code: tutto dentro Stripe + Supabase.

## 📲 UI Telegram — menu a livelli (deve sembrare una web app)
Principio: l'utente deve poter fare TUTTO, sentirsi libero, mai bloccato. UI ordinata,
mai un muro di bottoni. Struttura gerarchica con un menu principale fisso e sotto-menu;
ogni schermata ha sempre `[⬅️ Indietro]` e `[🏠 Menu]`.

```
🏠 MENU PRINCIPALE
[📬 Oggi]            → report + post di oggi
[🗂 Archivio]        → storico contenuti
[⚙️ Impostazioni]   → tutte le configurazioni

  ⚙️ IMPOSTAZIONI
  [🎙 Voce]          → gestisci file/voci (lista, aggiungi, elimina)
  [📡 Nicchia]       → subreddit + (Pro) canali YouTube
  [⏰ Orario]        → Morning/Afternoon/Evening + timezone
  [📝 Formati]       → toggle X / LinkedIn / Other
  [🔁 Temi]          → varietà (evita temi recenti) / rinforza (ripeti i tuoi)
  [💳 Abbonamento]   → link Stripe gestione/disdetta
  [⬅️ Indietro] [🏠 Menu]
```
Comandi rapidi opzionali come scorciatoie: `/oggi`, `/archivio`, `/menu`.

## 🗂 Archivio (esperienza completa, come una web app)
L'utente può:
- **Rivedere** i report/post passati (storico navigabile, es. ultimi 30-90 giorni).
- **Cancellare singoli** elementi.
- **Cancellare tutto / reset** + cancellare account e dati (privacy / GDPR).
- **Preferiti**: marcare i post migliori (⭐) e filtrarli.
Usa la tabella `archivio` (vedi sezione Dati sopra). Navigazione a pagine (bottoni ◀ ▶) per
non intasare la chat.

## 📣 Acquisizione (metodo dal file `sistemax`)
Account X faceless nella nicchia AI → post con hook + CTA ("comment RADAR"/"PROVA") →
auto-DM (tipo Tweet Hunter) con link `t.me/TuoBot?start=FREE_TRIAL` → trial 5 giorni.
"Build in public". NB: i numeri del video `sistemax` sono marketing — prendere il
meccanismo, ignorare le promesse.

## 🔒 Conversione fine trial (4 pilastri)
1. **Report oscurato (FOMO)**: a trial scaduto mostra che il report di oggi esiste ed è
   bloccato ("oggi su r/X è esploso un trend… 🔒 sblocca"), non solo "scaduto".
2. **Sconto lampo 24h**: offerta a tempo (es. primo mese scontato, codice `LASTCHANCE`).
3. **Barriera abitudine**: dopo 5 giorni l'utente è abituato alla comodità mattutina →
   il foglio bianco al 6° giorno spinge all'acquisto.
4. **Email di follow-up**: ~12h dopo la scadenza, mail automatica (serve `email` nel DB).

---

## ✅ Decisioni prese
- 3 fasce orarie fisse + timezone per utente (no orari liberi → cron sostenibile).
- Pricing: Trial gratis 5 giorni · Creator $49 · Pro $99 · Agency $199.
- Lead magnet = il **report** gratis (non i post pronti) per 5 giorni.
- Differenziatore = **voce** ("clona te stesso"); guru-mode come bonus.
- Voce SOLO via file (no chat, no auto-import API) → coerenza/affidabilità.
- Formati: X / LinkedIn / **Other socials** (rinominato da "Generic"), selezionabili.
- Instagram **escluso** (visivo, non testuale; coperto da "Other").
- WhatsApp / OpenWA **escluso** (ToS/ban + niente deep link).
- Tier report-only a pagamento **eliminato** (è il trial gratuito).
- AI: Python (gratis) + Haiku (filtro) + Sonnet 4.6 (scrittura) + Opus (premium Pro).
- Few-shot con ~20 post esemplari nel prompt.
- Pagamenti: **solo Stripe** (webhook → Supabase Edge Function), NO Make/Zapier.
- Canale: **Telegram ora** (consegna). Eventuale web app dopo, solo come pannello di
  gestione per Agency, mantenendo Telegram come canale di consegna (codice consegna
  disaccoppiato per renderlo facile). NON è una decisione bloccante ora.
- UI: menu a livelli con Indietro/Menu sempre presenti. Archivio completo (rivedere,
  cancellare singoli, reset/cancella account, preferiti) → esperienza "web app".

## 🔁 Cosa è CAMBIATO rispetto al brainstorming originale (`leggi solo 1 volta`)
Queste decisioni SOVRASCRIVONO l'originale — in caso di conflitto, vale CLAUDE.md:
- Pricing: era €19/€39/€79 → ora $49/$99/$199 (+ trial gratis). Il tier €19 report-only è
  eliminato come piano a pagamento (diventa il trial gratuito).
- Orario: era libero/ora esatta → ora 3 fasce fisse (Morning/Afternoon/Evening) + timezone.
- Trial: era 3 giorni → ora 5 giorni.
- Voce: era "incolla testo" o PDF caricati liberamente → ora SOLO file (txt/docx/pdf),
  niente invio via chat, niente auto-import da API.
- Differenziatore: era "clona il guru" → ora "clona TE STESSO" come claim principale,
  guru come bonus.
- Formati: erano X+LinkedIn fissi → ora X / LinkedIn / Other socials selezionabili (toggle).
- Modello AI: era `claude-3-5-sonnet-20241022` → ora Haiku 4.5 (filtro) + Sonnet 4.6
  (scrittura) + Opus 4.8 (premium Pro).
- Output: erano 2 post fissi → 1 report + post nei formati attivi + post extra on-demand
  su sotto-temi diversi (mai stesso topic).

## 📌 Stato attuale
**Codice completo, non ancora testato** (eseguito BUILD.md). Tutti i file generati;
nessun segreto reale hardcoded (placeholder `__TODO_*__` tracciati in `SETUP_TODO.md`).
Restano: inserire le credenziali, riempire il few-shot, ospitare il bot, e i test
in `SETUP_TODO.md` → "Da testare insieme".

File presenti:
- `sistemax` — trascrizione video acquisizione (input originale).
- `CLAUDE.md` — questa specifica (fonte di verità).
- `BUILD.md` — istruzioni di costruzione (eseguite).
- `schema.sql` — tabelle `utenti`/`voci`/`archivio`/`feedback_voce` + `attivazioni_pending`,
  FK cascade, RLS senza policy pubbliche, indici.
- `config.py` — lettura env var (placeholder `__TODO_*__`) + costanti (fasce 07/13/19, modelli, limiti).
- `reddit_scraper.py` — PRAW (top 3 post 24h + top 3 commenti) + pulizia, zero AI.
- `ai_engine.py` — Haiku (trend), Sonnet/Opus (scrittura+voce), raffinazione → `feedback_voce`,
  anti-ripetizione morbida; few-shot da riempire.
- `db.py` — helper accesso Supabase (service role).
- `file_voce.py` — lettura file voce `.txt`/`.docx`/`.pdf`.
- `telegram_delivery.py` — `send()` disaccoppiata + scrittura archivio + report oscurato (FOMO).
- `main.py` — orchestratore cron (ora UTC → timezone → pipeline → try-except per utente).
- `bot_handler.py` — bot interattivo: deep linking, menu a livelli, archivio paginato,
  voce, toggle Temi, post extra on-demand (avviso angolo SOLO qui).
- `supabase/functions/stripe-webhook/index.ts` — Edge Function webhook Stripe.
- `.github/workflows/cron_runner.yml` — cron orario `0 * * * *`.
- `README.md` — guida non-tecnica al setup. `.env.example`, `.gitignore`.
- `SETUP_TODO.md` — azioni umane residue, "DA CONFERMARE", "Da testare insieme".

## 🔜 Prossimi passi suggeriti
Il codice MVP è scritto. I prossimi passi sono di setup/validazione e roadmap:
1. Inserire credenziali e segreti (README + checklist in `SETUP_TODO.md`).
2. Eseguire i test in `SETUP_TODO.md` → "Da testare insieme" (schema, webhook,
   deep link, consegna, cron, archivio, post extra, anti-ripetizione, resilienza).
3. Riempire `ai_engine.FEW_SHOT_POSTS` con ~20 post esemplari (in inglese).
4. Scegliere l'hosting always-on per `bot_handler.py` (VPS/PaaS).
5. (Validazione marketing) generare 2-3 esempi reali di report+post e mostrarli su X.
6. Post-MVP: email follow-up post-trial, pipeline YouTube (Pro/Agency),
   UI multi-profilo Agency (vedi "DA CONFERMARE" in `SETUP_TODO.md`).
