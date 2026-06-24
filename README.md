# Majloasis 🌴

Networking mirato su LinkedIn **senza rischiare il ban**. Raccoglie profili e offerte ogni giorno
via Apify, li valuta con Gemini rispetto al tuo profilo, li mostra in una dashboard mobile-first;
l'invito lo mandi **tu, a mano**. Lo scraping passa SOLO da Apify — mai le tue credenziali LinkedIn.

Vedi [CLAUDE.md](CLAUDE.md) per il contesto completo e [DESIGN.md](DESIGN.md) per lo stile.

## Stack (tutto free tier, target $0)
- **Next.js + Vercel** — dashboard mobile-first (no auth vera, solo password).
- **Supabase** — database.
- **Apify** — scraping profili + lavori (proxy/account propri, no cookie).
- **Gemini 2.5 Flash Lite** — valutazione in batch + generazione messaggi.
- **GitHub Actions / Vercel Cron** — giro giornaliero.

## Setup (cosa devi fare a mano)

### 1. Chiavi/API → `.env.local`
Compila [.env.local](.env.local) (template in [.env.example](.env.example)):

| Variabile | Dove |
|---|---|
| `APIFY_TOKEN` | apify.com → Settings → **Manage tokens** → Personal API token |
| `GEMINI_API_KEY` | aistudio.google.com/app/apikey |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API |
| `CRON_SECRET` | una stringa casuale a tua scelta |
| `DASHBOARD_PASSWORD` | (opzionale) password per la dashboard |
| `APIFY_PROFILE_ACTOR` / `APIFY_PROFILE_DETAIL_ACTOR` / `APIFY_JOB_ACTOR` | (opzionale) override Actor — default harvestapi, vedi sotto |
| `APIFY_PROFILE_MODE` | (opzionale) `Short` (default) o `Full` (più dati, include follower) |
| `COLLECT_PROFILE_LIMIT` / `COLLECT_JOB_LIMIT` | (opzionale) profili/lavori per giro. **Default 15/15** (lotti piccoli = Gemini più preciso, meno spesa per giro). Alza solo se ti serve raccogliere di più in un colpo |

### 2. Database Supabase
Apri Supabase → **SQL Editor** → New query → incolla tutto [supabase/schema.sql](supabase/schema.sql) → **Run**.
È idempotente (puoi rieseguirlo senza perdere dati). Crea tabelle, indici, categorie iniziali e policy RLS (sola lettura anon).
> Se hai già eseguito lo schema in passato, **riesegui lo script**: aggiunge solo ciò che manca
> (colonne warm-up `rel_status`/timestamp/`notes`, `prev_score`/`revalued_at` per la time machine,
> e la tabella `copilot_messages` per la chat del copilota). Senza, le nuove feature danno errore.

### 3. Autorizza gli Actor su Apify (una volta)
Gli Actor pubblici vanno "aperti" una volta dal tuo account per essere lanciabili via API.
Apri ognuna di queste pagine e premi **"Try for free"** (o approva i permessi):
- [harvestapi/linkedin-profile-search](https://apify.com/harvestapi/linkedin-profile-search) (ricerca profili)
- [harvestapi/linkedin-profile-scraper](https://apify.com/harvestapi/linkedin-profile-scraper) (scrape del tuo profilo)
- [harvestapi/linkedin-job-search](https://apify.com/harvestapi/linkedin-job-search) (offerte di lavoro)

### 4. Avvio locale
```bash
pnpm install
pnpm dev
```
Apri http://localhost:3000 → "Apri la dashboard" → tab **⚙️ Profilo**:
incolla il tuo link LinkedIn, controlla le 5 risposte (pre-compilate) e premi **"Scrapa e riassumi profilo"**.
Poi, nelle rispettive tab: **"↻ Aggiorna persone"** e **"↻ Aggiorna lavori"** (raccolte separate).

### 5. Deploy su Vercel
- Importa il repo su Vercel, imposta **tutte** le env var di `.env.local` (incluso `CRON_SECRET`).
- `vercel.json` registra il cron giornaliero (06:00 UTC). Vercel chiama `/api/cron/collect`
  con `Authorization: Bearer $CRON_SECRET` automaticamente.
- In alternativa/aggiunta: GitHub Actions ([.github/workflows/daily.yml](.github/workflows/daily.yml))
  — imposta i Secrets del repo `APP_URL` e `CRON_SECRET`.

## Actor Apify (default: harvestapi, no-cookie)
| Compito | Actor (slug env) | Costo (Free) |
|---|---|---|
| Ricerca profili | `harvestapi~linkedin-profile-search` (Short) | ~$0.004/profilo |
| Scrape tuo profilo | `harvestapi~linkedin-profile-scraper` | trascurabile (raro) |
| Ricerca lavori | `harvestapi~linkedin-job-search` | ~$1/1k |

Con i **$5 gratis/mese** di Apify e la modalità **Short** raccogli ~1.000+ profili/mese — molto più
del necessario (~500 contatti totali entro ottobre 2026). Se vuoi il **numero di follower** per il
filtro numerico, passa a `APIFY_PROFILE_MODE=Full` (~2× il costo, comunque dentro i $5).

I nomi dei campi di input variano da Actor ad Actor: il codice ([src/lib/apify.ts](src/lib/apify.ts))
manda più alias ed è tollerante, ma se cambi Actor verifica i campi sul suo input-schema.

## "Pesci troppo grossi" e profili raggiungibili
L'obiettivo è gente di **buon calibro ma che ricambia** — non influencer/CEO famosi irraggiungibili.
- **Fascia follower (preset)**, dal tab Profilo: 🌱 Modesto (500–3000, **default** per chi parte da
  zero), ⚖️ Bilanciato (1000–6000), 🦈 Ambizioso (2000–10000), o min/max custom.
- **Filtro numerico** (solo in modalità Full): scarta chi è **fuori** dalla fascia [min, max].
- **Filtro semantico Gemini** (sempre, anche in Short dove i follower non ci sono): la fascia viene
  passata nel prompt → Gemini preferisce profili con quella visibilità e penalizza chi è troppo
  piccolo (inattivo) o troppo grosso (mega-influencer irraggiungibile).

## Flusso giornaliero
```
"Aggiorna persone" / "Aggiorna lavori" (o cron) →
  Apify cerca (paginando: ogni giro pagina diversa, niente duplicati) →
  filtro fascia-follower → dedup (URL + nome+azienda) → Gemini valuta in batch da 15 (score, genere dal nome, badge, categoria, perché) →
  Supabase salva con stato "Da valutare" →
  Dashboard: organizzi, generi il DM, apri LinkedIn, invii a mano
```

## Ottimizzazioni incluse
- **Persone e Lavori separati**: due pulsanti distinti, raccolte indipendenti.
- **Paginazione**: ogni giro avanza di pagina → profili sempre nuovi (riparte da pagina 1 quando finisce).
- **Batching Gemini** (15 profili/chiamata: lotti piccoli = meno score saltati) + **retry** che rispetta il `retryDelay` del 429.
- **Filtro calibro**: fascia follower (preset min/max) numerico in Full + semantico via Gemini (sempre).
- **Cache del messaggio**: il DM è salvato su `contacts.message` e riusato (bottone ♻️ Rigenera).
- **Regola genere**: genere dedotto dal nome di battesimo; le donne in fondo a parità di score.
- **No-duplicati**: dedup per `linkedin_url` **+ semantica** (nome+azienda, stessa persona con URL diverso).
- **Tracker anti-ban predittivo**: suggerisce quanti inviti fare oggi (budget residuo ÷ giorni feriali).
- **"Completa score"**: ri-valuta i contatti che Gemini ha saltato, senza ri-scrapare Apify.

## Feature avanzate
- **▶️ Sessione invii guidata** (tab Persone): scorre i top contatti da fare uno alla volta; un tap
  apre il LinkedIn + segna invitato + aggiorna il tracker + avanza. Scorciatoie tastiera, DM al volo.
  Riduce a 1 tap il lavoro manuale. (Non invia nulla: apre solo il profilo.)
- **✨ Copilota** (bottone flottante): chat in linguaggio naturale sul tuo pool, con **storico
  persistente**. Risponde ad analisi ("tasso di accettazione?", "chi contatto oggi?") ed esegue
  azioni in blocco ("sposta i top 5 founder in Da fare").
- **🕰️ Time machine** (tab Profilo): il tuo profilo migliora nel tempo → ri-valuta i vecchi contatti
  col profilo **aggiornato**. Costo 0 (niente Apify). La card mostra ▲/▼ chi è salito/sceso.
- **🕸️ Mappa relazionale** (tab Stats): aziende dove conosci già 2+ persone. 🔥 = ne hai già una
  connessa lì → la prossima è un'**intro calda**, non un cold. Toggle "solo caldi".
- **📊 Statistiche** (tab Stats): score medio, % alto calibro, % uomini, funnel networking
  (invitati → accettazione % → risposta %), breakdown categorie.
- **🤝 Warm-up + note**: nel modal di ogni contatto avanzi lo stato relazione e scrivi note personali.
  **Riscaldamento pre-invito**: prima del Connetti puoi 👍 likare / 💬 commentare i suoi post (a mano)
  e segnarlo; dopo `warmup_days` giorni (default 2, personalizzabile) la card mostra ⏰ "pronto per
  invitare" — invitare uno che già ti riconosce alza l'accettazione. La card mostra anche ⏰ il
  follow-up dovuto dopo la connessione. (Il sistema non mette mai like/commenti al posto tuo.)

## Troubleshooting (errori reali e soluzioni)
| Errore | Causa | Soluzione |
|---|---|---|
| `Could not find the table 'public.jobs'` | Schema non eseguito | Esegui `supabase/schema.sql` nel SQL Editor |
| `403 full-permission-actor-not-approved` | Actor non autorizzato | Apri la pagina dell'Actor su Apify → "Try for free" |
| `400 ... profileScraperMode must be equal to one of...` | Valore mode errato | I valori esatti differiscono tra Actor: il codice li gestisce già; se cambi Actor allinea il valore |
| `429 ... quota ... limit: 20` (Gemini) | Free tier 20 req/min | Il codice ora aspetta il `retryDelay`; riduci `COLLECT_PROFILE_LIMIT` se persiste |
| "0 contatti nuovi" | Tutti già visti / query | La paginazione ora prende pagine nuove; verifica il banner (trovati/nuovi/salvati) e i log `[apify]` |

## Principio non negoziabile
Il sistema **non** automatizza mai invii/messaggi su LinkedIn e **non** usa mai le tue credenziali.
"Genera messaggio" produce il **DM post-accettazione**, non la nota dell'invito.
