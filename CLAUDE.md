# Majloasis 🌴

> Nome del progetto: **Majloasis** (da *Majlis*, il luogo arabo dell'incontro, + *oasis*).
> La cartella e `package.json` mantengono ancora `linkedingoat` per ragioni storiche.

Sistema personale per fare networking mirato su LinkedIn **senza rischiare il ban**.
Raccoglie profili (e offerte di lavoro) ogni giorno, li valuta confrontandoli col profilo
dell'utente, li organizza in una dashboard mobile, e l'utente invia le richieste **a mano**.

> ⚠️ **Principio non negoziabile:** il sistema NON automatizza mai l'invio di richieste o
> messaggi su LinkedIn, e NON usa mai le credenziali LinkedIn dell'utente. Lo scraping passa
> SOLO da Apify (che usa proxy/account propri). L'azione finale ("Connetti") la fa sempre
> l'utente manualmente. Questo è ciò che tiene l'account al sicuro. Non proporre mai
> automazioni che violino questo principio.

---

## Contesto utente

- **Chi è:** AI-native Full-Stack Engineer.
- **Obiettivo:** networking a Dubai. Va a Dubai per una vacanza di ~1 settimana a **ottobre 2026**,
  ma il vero scopo è **trasferirsi lì**. Vuole arrivare con una rete di contatti già attivata.
- **Target contatti:** networking ampio, nessun settore obbligatorio, ma **solo profili di alto
  calibro** — founder, CEO, manager, imprenditori, investitori, tech leader, professionisti senior.
- **Esclusioni:** profili "umili"/operativi (camerieri, chef, staff base) e junior/entry-level.
- **Genere:** priorità agli **uomini**. Regola: nome chiaramente maschile → passa; nome ambiguo/incerto
  → passa comunque; nome chiaramente femminile → escluso o in fondo. Target ~90 uomini / 10 donne.
- **Boost contestuale (consulenza accettata):** chi è a **Dubai/UAE** + **founder/tech/investitore** +
  aziende tech/AI riceve uno **score boost leggero** + un **badge visivo** accanto al nome
  (es. 🎯 Tech/Founder, 🇦🇪 UAE). Il boost orienta il ranking senza stravolgerlo; il badge rende
  trasparente il perché uno è in cima.

## Timeline

- **Ora → fine agosto 2026:** costruzione sistema + ottimizzazione profilo LinkedIn dell'utente.
- **Fine agosto / inizio settembre 2026:** inizio invii (15-20/giorno a mano).
- **Settembre 2026:** ritmo costante (~80-100 connessioni/settimana, sotto i limiti).
- **Inizio ottobre 2026:** arrivo a Dubai con ~400-600 contatti già attivati.

---

## Ambiente di sviluppo
- **Package manager: `pnpm`** (NON npm/yarn). `pnpm install`, `pnpm dev`, `pnpm add ...`.
- Windows (PowerShell primaria, bash disponibile). Node 24+, pnpm 10+.
- Per costruire: leggere [seguire.md](seguire.md) ed eseguire gli step in ordine (STEP 0 → 11).

## Convenzioni di codice (per chi lavora sul repo)
- **Integrazioni esterne in `src/lib/`**, una per servizio: `apify.ts` (scraping),
  `gemini.ts` (valutazione/messaggi), `supabase.ts` (DB), `collect.ts` (orchestratore
  del giro). Le **API route** (`src/app/api/*/route.ts`) sono sottili: validano il
  body, chiamano `src/lib`, ritornano JSON. Niente logica di business nelle route.
- **Segreti solo via `src/lib/env.ts`** (getter lazy che lanciano se mancano a
  runtime). Mai `process.env.X` sparso nei componenti.
- **Tipi condivisi in `src/lib/types.ts`**, devono rispecchiare `supabase/schema.sql`.
  Se aggiungi una colonna: schema.sql (con `alter ... add column if not exists`) +
  types.ts insieme.
- **Client dati nei componenti solo via `src/lib/api.ts`** (`api.contacts...`), mai
  `fetch` diretto a `/api/...` nei componenti.
- **Errori**: le route ritornano `{ error }` con status adeguato; `api.ts` lo
  rilancia come `Error`. Gemini/Apify possono fallire → degradare con grazia
  (es. score `null` poi recuperabile col bottone "Completa score").
- **Costo**: ogni nuova chiamata Gemini/Apify va giustificata. Preferire batch,
  cache (`contacts.message`), e riuso dei dati già in DB (vedi `/api/backfill`).

## Architettura (tutto free tier, costo target $0)

| Pezzo | Ruolo | Free tier | Note |
|---|---|---|---|
| **Apify** | scraping profili LinkedIn + offerte di lavoro | $5/mese (~5.000 profili con Actor economico) | NON tocca l'account dell'utente. Actor ricerca profili = `khadinakbar~linkedin-profile-search-scraper` (vedi nota "Scelta Actor" sotto) |
| **Gemini 2.5 Flash Lite** | valuta i profili vs profilo utente + genera messaggi | 1.500 req/giorno, 20-30 req/min | Si usa **batching** per stare sotto i limiti |
| **Supabase** | database (profili, lavori, categorie, stati, profilo utente) | 500MB + ~50k righe | |
| **Next.js + Vercel** | dashboard mobile-first | hobby gratis | Niente auth (uso personale) |
| **GitHub Actions** | cron giornaliero (scrape + valutazione) | 2.000 min/mese | ~5 min/giorno |

### Flusso giornaliero
```
GitHub Actions (cron mattutino)
  → Apify cerca profili nuovi per parole chiave/città (esclude i già visti, dedup URL + semantica)
  → Apify cerca offerte di lavoro inerenti al profilo utente
  → Gemini valuta in BATCH (gruppi da ~15): score 0-100 + genere + 1 riga "perché" + categoria + badge
  → Supabase salva tutto con stato "Da valutare"
  → Dashboard pronta quando l'utente apre il telefono
```

### Schema dati (sintesi — fonte: `supabase/schema.sql`)
- **`user_profile`** — il "cervello": `summary` (profilo sintetico Gemini), `preferences`
  (jsonb: keywords, cities, exclusions, gender_rule, le 5 risposte, `min_followers`/
  `max_followers`/`reach_preset`, stato interno `_lastProfilePage`), `raw_scrape`.
- **`contacts`** — profili raccolti: `linkedin_url` (unique, dedup), `name/headline/
  company/location/photo_url`, `raw` (jsonb Apify), `score`, `gender_guess`, `reason`,
  `badges[]`, `category`, `status` (`da_valutare|da_fare|fatto|non_fare`), `message`
  (cache DM). **Warm-up**: `rel_status` (`nessuno|likato|commentato|invitato|connesso|
  messaggiato|risposto|in_conversazione|freddo` — `likato`/`commentato` sono fasi PRIMA
  dell'invito per scaldare il contatto), `interacted_at` (timer pre-invito),
  `invited_at/connected_at/replied_at/last_touch_at`, `notes`.
  **Time machine**: `prev_score` (score prima della rivalutazione), `revalued_at`.
- **`jobs`** — offerte: come contacts ma `title/description`, niente genere/badge.
- **`categories`** — custom dell'utente (`name` unique, `emoji`, `color`).
- **`outreach_log`** — un record per invito segnato (`sent_at`) → tracker anti-ban.
- **`copilot_messages`** — storico chat del copilota (`role`, `content`, `created_at`).
- **RLS**: anon = sola lettura; tutte le scritture passano dal server con service_role.

### Variabili d'ambiente (vedi `src/lib/env.ts`)
| Nome | Obbligatoria | Default | Effetto |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | sì | — | lettura DB lato client |
| `SUPABASE_SERVICE_ROLE_KEY` | sì (server) | — | scritture (scrape/valutazione/stati) |
| `APIFY_TOKEN` | sì | — | scraping |
| `GEMINI_API_KEY` | sì | — | valutazione + messaggi |
| `CRON_SECRET` | sì | — | protegge la route cron |
| `DASHBOARD_PASSWORD` | sì | — | protezione dashboard (middleware) |
| `APIFY_PROFILE_MODE` | no | `Short` | Solo per harvestapi: `Short` / `Full` (dà i follower). Ignorato da khadinakbar. |
| `APIFY_PROFILE_ACTOR` | no | `khadinakbar~linkedin-profile-search-scraper` | Actor ricerca profili. Default no-cookie, pay-per-event, **senza** il cap "10 run/mese" di harvestapi (vedi nota sotto). |
| `APIFY_PROFILE_DETAIL_ACTOR` / `APIFY_JOB_ACTOR` | no | harvestapi~… | override Actor Apify (scrape singolo profilo / lavori) |
| `COLLECT_PROFILE_LIMIT` / `COLLECT_JOB_LIMIT` | no | `15` / `15` | profili/lavori per giro |

#### Scelta dell'Actor di ricerca profili (perché khadinakbar, non harvestapi)
Storia: l'Actor originale `harvestapi~linkedin-profile-search` **limita gli utenti free di
Apify a 10 run/mese**; dopo il cap risponde `SUCCEEDED` ma con **"free user run limit
reached" → 0 risultati**. Il cron giornaliero esaurisce le 10 run in ~10 giorni, poi la
raccolta si spegne silenziosamente (il credito Apify resta intatto → sintomo ingannevole).

Actor testati dal vivo per sostituirlo (ricerca per keyword, no-cookie):
- ❌ `get-leads~linkedin-scraper` (mode `search`): senza cookie si affida a SERP di motori
  esterni (Brave/Google/…) che lo **rate-limitano** → 0 profili. Inaffidabile per un cron.
- ❌ `curious_coder~…`, `bebity~…`: **a noleggio** (rental, trial scaduto) → richiedono
  abbonamento mensile dell'Actor.
- ❌ `anchor~linkedin-profile-enrichment`: solo **enrichment** da URL noti (`startUrls`), non
  cerca per keyword.
- ✅ **`khadinakbar~linkedin-profile-search-scraper`** (scelto): **pay-per-event, no-cookie,
  nessun cap "10 run/mese"**. Testato: restituisce founder/CEO reali di Dubai. Input
  `keywords`+`location`+`maxResults`; output ricco (`fullName/firstName/lastName/headline/
  profileUrl/publicIdentifier/currentCompany/jobTitle/snippet`). NB: usa Google (`source:
  serpapi`) → il campo `location` per-profilo spesso è vuoto (la città guida la query) e
  `currentCompany` può essere impreciso; l'`headline` resta il segnale affidabile. Non dà il
  n. follower (per `max_followers` serve tornare a harvestapi Full via env).

`searchProfiles()` in [src/lib/apify.ts](src/lib/apify.ts) manda i campi di **più schemi**
insieme, così cambiare Actor via `APIFY_PROFILE_ACTOR` non richiede toccare il codice; e
`normalizeProfile()` copre i nomi-campo di tutti gli Actor testati (+ `cleanText()` che
rimuove i marcatori RTL dai nomi arabi, per non sballare il guess del genere). Regola: **un
Actor non è "valido" finché non l'hai lanciato dal vivo col token e visto profili veri** —
lo schema store spesso mente e il free-tier del singolo Actor è indipendente dal credito Apify.

### Ottimizzazione chiamate Gemini (vincolo: poche chiamate)
- **Batching obbligatorio:** ~15 profili per chiamata (`BATCH_SIZE`). Lotti più grandi
  fanno talvolta saltare/troncare lo score di qualche profilo nel JSON.
- Il profilo dell'utente viene riassunto **una volta sola** e salvato in DB (mai ri-scrapato ogni giorno).
- Il messaggio personalizzato si genera **on-demand** (bottone "Genera messaggio"), non per ogni profilo.
- Piccolo ritardo tra le chiamate batch per restare sotto il limite al minuto (~20 RPM testato).

---

## Funzionalità dashboard (mobile-first)

- **Due tab:** `Persone` e `Lavori`.
- **Setup profilo utente:** campo dove incollare il link del proprio profilo LinkedIn → Apify lo scrapa
  → Gemini lo riassume in un "profilo sintetico" salvato in DB → diventa il metro di valutazione.
  Più le risposte alle 5 domande chiave (sotto).
- **Card minimale:** foto (tonda, piccola) + nome + ruolo + score + categoria + badge.
- **Tap sulla card → pop-up** con tutte le info scrapate (esperienze, azienda, città, ecc.) + bottoni:
  `🔗 Apri LinkedIn`, `✍️ Genera messaggio`, sposta in categoria.
- **Selezione multipla:** checkbox per spostare più contatti insieme.
- **Categorie raggruppate in alto a destra:** selezioni N contatti → click categoria → spostati tutti insieme.
- **Stati:** `📥 Da valutare → ⭐ Da fare → ✅ Fatto`, oppure `❌ Non fare`.
- **Categorie custom** (es. Real Estate Dubai, Finance, Founder, Networking) — create dall'utente.
- **No duplicati:** profili già visti vengono esclusi dalle nuove ricerche.
- **Tracker anti-ban:** conteggio settimanale inviti (es. 47/100) + avviso quando ci si avvicina al limite.
- **Preferenze:** pre-impostate in base al profilo utente, ma modificabili da un pannello nella dashboard.
- **Genera messaggio = MESSAGGIO (DM post-accettazione)**, non la nota dell'invito. Flusso sicuro:
  invito senza nota → quando accettano → si genera e si manda il messaggio personalizzato.
- **Warm-up pre-invito (riscaldamento):** prima del Connetti, l'utente può 👍 likare / 💬 commentare
  i post del contatto a mano e segnarlo nel sistema (`rel_status` likato/commentato). Dopo
  `warmup_days` giorni (default **2**, personalizzabile) la card mostra "⏰ pronto per invitare":
  l'invito a uno che già ti riconosce viene accettato di più. Resta tutto manuale: il sistema non
  mette mai like/commenti al posto dell'utente.

## Le 5 domande chiave per il matching (risposte dell'utente)
1. **Obiettivo a Dubai:** networking, in vista di un trasferimento (vacanza 1 settimana a ottobre).
2. **Contatto ideale:** networking ampio, senza settore specifico.
3. **Settori target:** nessuno specifico (vedi punto 2).
4. **Cosa offre:** AI-native Full-Stack Engineer.
5. **Esclusioni:** no profili umili/operativi e junior; solo alto calibro.

---

## Limiti LinkedIn (riguardano l'utente, NON le API — invio manuale)
- ~**100 inviti/settimana** (free/Premium/Sales Nav uguale); account nuovi 50-80/sett.
- Soft cap **~20-25/giorno** prima del throttling.
- **Raccomandazione:** 15-20 invii/giorno, spalmati nella giornata, mai in raffica, giorni feriali,
  stare sotto ~80-100/settimana. Il tracker della dashboard tiene il conto.

## UI / Design
Vedi [DESIGN.md](DESIGN.md). Look **luxury/premium black & white**: sfondo nero, card bianche,
particelle bianche (effetto "polvere di stelle"), accento oro usato con parsimonia. Riusa la
struttura/animazioni di `../polso-mano` (aurora + particelle, font Sora + Inter) ma NON i colori viola.

## Contenuti LinkedIn (autorità di profilo)
Per la creazione di contenuti LinkedIn vedi [contenuti/README.md](contenuti/README.md) — è il
file di lavoro da aprire a ogni chat nuova. Obiettivo: **autorità di profilo, non viralità**.
Si lavora parlando direttamente con Claude (no tab nell'app); i post pubblicati vivono in
`contenuti/posts/`. Regola "safe": raccontare il sistema come *AI engineering sotto vincoli*,
mai come *scraping LinkedIn*; e **mai auto-posting** (l'AI prepara, l'utente pubblica a mano).
Il **profilo LinkedIn** dell'utente è già configurato e ottimizzato: testi finali e decisioni
di posizionamento in [contenuti/profilo-linkedin.md](contenuti/profilo-linkedin.md)
(identità: *AI-Native Full-Stack Engineer*, target founder, Dubai esplicito, profilo in inglese).

## Stato implementazione

**Codice: COMPLETO e in evoluzione.** Tutti gli step di `seguire.md` (0→11) sono implementati,
build e lint puliti. Lo storico dettagliato delle modifiche è in [CHANGELOG.md](CHANGELOG.md).

Mappa rapida (cosa sta dove):
- **Raccolta + valutazione**: `src/lib/{apify,gemini,collect}.ts`, route `/api/collect`, cron in
  `.github/workflows/daily.yml` + `vercel.json` → `/api/cron/collect`.
- **Dashboard**: `src/components/dashboard/*` (Card, Modal, ProfileSetup, Tracker, Insights,
  JobCard, OutreachSession, Copilot).
- **API**: `/api/{contacts,jobs,categories,profile,message,outreach,stats,backfill,revalue,
  network,copilot}`.
- **DB**: `supabase/schema.sql` (vedi "Schema dati" sopra).
- **Protezione**: `src/middleware.ts` (password dashboard).

Feature chiave attive: dedup (URL + semantica), tracker anti-ban predittivo, warm-up relazione
(`rel_status` + reminder follow-up), note personali, statistiche (tab Stats), preset fascia-follower,
"Completa score" (`/api/backfill`). **Feature avanzate**: sessione invii guidata (`OutreachSession`),
copilota del pool con storico (`Copilot` + `/api/copilot`), time machine (`/api/revalue`, rivaluta
col profilo aggiornato), mappa relazionale (`/api/network`, cluster per azienda con agganci caldi).
Dettagli in [CHANGELOG.md](CHANGELOG.md).

### Da fare a mano (non codice)
- [ ] **Deploy Vercel**: compilare `.env.local`, eseguire `supabase/schema.sql`, collegare repo a
  Vercel + Secrets GitHub (vedi [README.md](README.md) e tabella Env vars sopra).
- NB: il `ContactModal` ha un blocco "🔎 Dati grezzi (debug)" rimovibile quando non serve più.
