# seguire.md — Guida di costruzione (esegui con `/goal`)

> ✅ **STATO: COSTRUZIONE COMPLETATA.** STEP 0→11 implementati, build pulita. Questo file resta come
> piano di riferimento. L'unica cosa rimasta è l'azione manuale dell'utente: chiavi/API in
> `.env.local`, eseguire `supabase/schema.sql`, collegare Vercel/GitHub (vedi [README.md](README.md)).
> La checklist aggiornata è in [CLAUDE.md](CLAUDE.md) → "Stato implementazione".

Questo file è il piano operativo completo e **auto-sufficiente**. Una chat nuova che non sa nulla
di questo progetto deve poter fare TUTTO leggendo solo questo file + [CLAUDE.md](CLAUDE.md) +
[DESIGN.md](DESIGN.md). Esegui gli step **in ordine, dal STEP 0 al STEP 11**, completando e
verificando ciascuno prima del successivo. Non saltare step.

> ⚠️ Regola d'oro: niente automazione dell'invio, niente credenziali LinkedIn nel sistema.
> Lo scraping passa solo da Apify. L'invio lo fa l'utente a mano. (Vedi CLAUDE.md.)

## Convenzioni d'ambiente (importanti)
- **Package manager: `pnpm`** (NON npm/yarn). Usa sempre `pnpm install`, `pnpm dev`, `pnpm add ...`.
- Node 24+, pnpm 10+ già installati.
- Sistema operativo: **Windows**. Shell primaria PowerShell (è disponibile anche bash). Usa percorsi
  con virgolette se contengono spazi.
- Working directory del progetto: la cartella `linkedingoat` (questa).

---

## STEP 0 — Preparazione (PRIMA di scrivere codice)

1. **Verifica strumenti:** `node --version` (≥24), `pnpm --version` (≥10). Se mancano, fermati e dillo.
2. **Verifica la dipendenza di design** — i file di stile da riusare sono in `../polso-mano`:
   - `../polso-mano/web/src/components/AuroraBackground.tsx`
   - `../polso-mano/web/src/app/globals.css` (keyframes `su-*`)
   - `../polso-mano/shared/src/design/theme.css` (token colore)
   Percorso assoluto: `C:\Users\danie\OneDrive\Documenti\CLAUDE CODE SPACE\WEB APP\polso-mano`.
   Se NON esistono, non bloccarti: replica i token e l'AuroraBackground da [DESIGN.md](DESIGN.md),
   che contiene tutto il necessario (colori + descrizione blob/particelle).
3. **Chiavi/API — chiedi all'utente di procurarle ORA** (sono gratis) prima di costruire le integrazioni.
   Crea subito un file **`.env.example`** con queste variabili (vuote) e un `.env.local` che l'utente compila:
   - `APIFY_TOKEN` — da apify.com (Free $0, $5 crediti/mese)
   - `GEMINI_API_KEY` — da Google AI Studio (free tier)
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `CRON_SECRET` — stringa casuale per proteggere l'endpoint cron
   - `DASHBOARD_PASSWORD` — (opzionale) password unica per la dashboard (no login vero, uso personale)
   Il codice può essere scritto anche senza le chiavi, ma i test/run reali richiedono che siano compilate.

---

## STEP 1 — Scaffold + fondamenta
- Inizializza **Next.js** (App Router, TypeScript) nella cartella corrente con pnpm.
- Configura Tailwind (o CSS variabili) importando i token di [DESIGN.md](DESIGN.md).
- Porta in `src/`: `AuroraBackground.tsx` e le keyframes `su-*` di `globals.css`; replica/importa i
  token di `theme.css` (vedi STEP 0.2 per i percorsi e il fallback).
- Crea il client Supabase (`src/lib/supabase.ts`) leggendo le env var.
- Verifica: `pnpm dev` mostra una pagina con sfondo **nero** e particelle **bianche** (look luxury, vedi DESIGN.md).

## STEP 2 — Schema database (Supabase)
Crea `supabase/schema.sql` con le tabelle (l'utente lo eseguirà nel SQL editor di Supabase):
- `user_profile` — `raw_scrape` (jsonb), `summary` (text), `preferences` (jsonb: parole chiave, città,
  esclusioni, regole genere), `updated_at`.
- `contacts` — `linkedin_url` (unique → no duplicati), `name`, `headline`, `company`, `location`,
  `photo_url`, `raw` (jsonb), `score` (int), `gender_guess`, `reason` (text), `badges` (text[]),
  `category`, `status` (`da_valutare|da_fare|fatto|non_fare`), `created_at`.
- `jobs` — campi rilevanti dell'offerta + `score`, `reason`, `status`.
- `categories` — `name`, `emoji`, `color`.
- `outreach_log` — `contact_id`, `sent_at` (per il tracker settimanale).
Indici su `linkedin_url`, `status`, `score`. Spiega all'utente come eseguire lo SQL su Supabase.

## STEP 3 — Setup profilo utente (il "cervello")
- Sezione "Il mio profilo": campo per incollare il link LinkedIn + form con le **5 domande**
  (vedi CLAUDE.md, pre-compilate con le risposte note dell'utente).
- Al salvataggio: Apify scrapa il profilo → Gemini lo riassume → salva `summary` + `preferences` in
  `user_profile`. È il **metro** di tutte le valutazioni. Si ri-genera solo su richiesta.

## STEP 4 — Integrazione Apify
- `src/lib/apify.ts`: lancia un Actor LinkedIn passando parole chiave/città dalle preferenze.
- **Actor di default** (verificare comunque su Apify Store il più economico al momento, ~$1/1k):
  per i profili usare uno scraper "no cookie" tipo `dev_fusion/linkedin-profile-scraper` o
  `harvestapi/linkedin-profile-search`; per i lavori un job scraper LinkedIn. Se l'Actor scelto
  non è disponibile, sceglierne un equivalente no-cookie e annotarlo.
- Una funzione per i **profili**, una per le **offerte di lavoro**.
- Normalizza l'output nei campi delle tabelle. **Salta gli `linkedin_url` già presenti** (no duplicati).

## STEP 5 — Valutazione Gemini (BATCH — critico)
- `src/lib/gemini.ts`: modello **`gemini-2.5-flash-lite`**.
- Prendi i profili nuovi (`status = da_valutare`, senza score), raggruppali in **batch da ~10** →
  UNA chiamata per batch che ritorna un JSON array con `score 0-100`, `gender_guess`, `reason`
  (1 riga), `badges`, `category`.
- Prompt: confronta ogni profilo con `user_profile.summary` + `preferences`. Applica regola genere
  (uomini/dubbi passano, donne in fondo), filtro calibro (no umili/junior), boost + badge per
  Dubai/UAE + founder/tech/investitore.
- `await sleep()` tra i batch per restare sotto ~20 req/min. Stessa logica per i `jobs`.

## STEP 6 — Dashboard (UI)
- **Due tab:** `Persone` / `Lavori`.
- **Card minimale:** foto tonda + nome + ruolo + score + categoria + badge (su `--bg-elevated`).
- **Pop-up al tap:** tutte le info scrapate + bottoni `🔗 Apri LinkedIn`, `✍️ Genera messaggio`,
  selettore categoria.
- **Selezione multipla** (checkbox) + **barra categorie in alto a destra** per spostare N contatti insieme.
- **Stati** con i colori di DESIGN.md. **Pannello Preferenze** modificabile. Mobile-first.

## STEP 7 — Genera messaggio (on-demand)
- Bottone nel pop-up → chiamata Gemini singola che scrive un **MESSAGGIO (DM post-accettazione)**
  personalizzato. Mostra il testo con bottone "Copia". NON è la nota dell'invito (vedi CLAUDE.md).

## STEP 8 — Tracker anti-ban
- Al click su `🔗 Apri LinkedIn` (o "Segna inviato") scrivi in `outreach_log`.
- Conteggio settimanale rolling (es. "47 / 100") + avviso sopra ~80 + suggerimento giornaliero (15-20).

## STEP 9 — Cron (GitHub Actions)
- `.github/workflows/daily.yml`: gira ogni mattina, chiama la route `/api/cron/collect` protetta da
  `CRON_SECRET`, che esegue Apify + valutazione Gemini e salva su Supabase. Usa i Secrets del repo.

## STEP 10 — Deploy
- Deploy su **Vercel** (free). Configura le env var. Verifica la dashboard da mobile.
- (Opzionale) middleware che chiede `DASHBOARD_PASSWORD` per evitare accesso pubblico.

## STEP 11 — Verifica finale
- Aggiorna la checklist "Stato implementazione" in CLAUDE.md.
- Riepiloga all'utente: cosa ha fatto da solo, cosa deve fare a mano (chiavi, SQL su Supabase,
  collegare Vercel/GitHub) e come avviare il primo giro.

---

## Definizione di "fatto"
L'utente incolla il suo profilo + preferenze → il sistema raccoglie ogni giorno ~100 profili nuovi
(90% uomini, alto calibro) + offerte di lavoro, li valuta vs il suo profilo, li mostra ordinati con
foto/score/badge, lui li organizza in categorie/stati con azioni multiple, genera il messaggio quando
serve, apre LinkedIn e invia a mano, e il tracker lo tiene sotto i limiti. Tutto a costo $0.
