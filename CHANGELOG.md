# Changelog — Majloasis 🌴

Storico delle decisioni operative e delle modifiche. Il `CLAUDE.md` descrive solo
lo stato *corrente*; qui sta la cronologia.

## 2026-07 — Cambio Actor ricerca profili (fix "free user run limit reached")

- **Sintomo:** dopo il 28 giugno la raccolta profili restituiva 0 risultati ogni giorno,
  con run `SUCCEEDED` ma status **"free user run limit reached"** — mentre il credito Apify
  era ancora intatto ($0.71/$5.00). Causa: `harvestapi~linkedin-profile-search` limita gli
  **utenti free** di Apify a **10 run/mese**; il cron giornaliero le esaurisce in ~10 giorni.
  Il limite è del *singolo Actor* (HarvestAPI), non della piattaforma Apify.
- **Fix:** cambiato l'Actor di default della ricerca profili in
  **`khadinakbar~linkedin-profile-search-scraper`** (pay-per-event, no-cookie, **senza** cap
  "10 run/mese"). Scelto dopo aver **testato dal vivo** col token vari candidati:
  `get-leads` (SERP rate-limited → 0 profili), `curious_coder`/`bebity` (a noleggio),
  `anchor` (solo enrichment da URL). khadinakbar restituisce founder/CEO reali di Dubai.
- **Codice** ([src/lib/apify.ts](src/lib/apify.ts), [src/lib/env.ts](src/lib/env.ts)):
  `searchProfiles()` ora manda i campi di più schemi insieme (`keywords`/`location`/
  `maxResults` per khadinakbar + i campi harvestapi), così cambiare Actor via
  `APIFY_PROFILE_ACTOR` non richiede toccare il codice. `normalizeProfile()` estesa ai
  nomi-campo di khadinakbar (`jobTitle`, `currentCompany`, `snippet`, ricostruzione URL da
  `publicIdentifier`). Aggiunto `cleanText()` che rimuove i marcatori RTL dai nomi arabi
  (sballavano il guess del genere). Type-check + eslint puliti; flusso testato end-to-end.
- **Nota:** khadinakbar non fornisce il n. follower → il filtro `max_followers` richiede di
  tornare a harvestapi Full via `APIFY_PROFILE_ACTOR=harvestapi~linkedin-profile-search`.

## 2026-06 — Ottimizzazioni e nuove feature

### Rebranding
- Il progetto si chiama ora **Majloasis 🌴** (era "LinkedIn Goat 🐐"). Tolto "LinkedIn"
  dal nome (marchio protetto / rischio su tool di scraping) e dalla UI. Cambiati titoli
  dashboard, landing, pagina di login (middleware), metadata e doc. `package.json` e la
  cartella restano `linkedingoat` per non rompere riferimenti.

### Sistema
- **Batch/giro ridotto a 15** (era 25/50). Apify costa per profilo, quindi meno
  profili = meno spesa per giro; soprattutto Gemini con lotti da 15 salta meno
  score (JSON più corto da generare). Override via `COLLECT_PROFILE_LIMIT` /
  `BATCH_SIZE`. Allineato al ritmo invii (~15-20/giorno).
- **Dedup semantica**: oltre all'unicità per `linkedin_url`, si scartano i profili
  la cui coppia `(nome+azienda)` normalizzata è già in DB (stessa persona con URL
  diverso). Vale anche per i duplicati interni allo stesso giro.
- **Tracker predittivo**: il `dailySuggestion` non è più un testo fisso; calcola
  quanti inviti restano nel budget settimanale spalmati sui giorni feriali residui.
- **Fascia follower (preset)**: prima c'era solo un `max_followers` (default 10k).
  Ora `min_followers`+`max_followers` con preset 🌱 Modesto (500–3000, default per
  chi parte da 0), ⚖️ Bilanciato (1000–6000), 🦈 Ambizioso (2000–10000). In Full =
  filtro numerico; in Short = istruzione semantica a Gemini (funziona comunque).

### Nuove feature
- **Warm-up / gestione relazione** (`contacts.rel_status` + timestamp): traccia
  cosa succede DOPO l'invito (invitato → connesso → messaggiato → risposto →
  in_conversazione → freddo). Reminder follow-up sulla card quando una relazione
  "viva" non viene toccata da ≥4 giorni.
- **Note personali** (`contacts.notes`): campo libero per l'intelligence umana sul
  contatto, editabile dal modal.
- **Statistiche** (tab 📊 Stats + `/api/stats`): totali, score medio, % alto
  calibro, % uomini, funnel networking (invitati → accettazione % → risposta %),
  breakdown per categoria.
- **Completa score** (`/api/backfill`): bottone che ri-valuta i contatti rimasti
  senza score (Gemini li ha saltati per 429/timeout). Non ri-scrapa Apify → costo 0.

### Warm-up pre-invito (riscaldamento)
- Nuove fasi `rel_status` **PRIMA** dell'invito: `likato` 👍 e `commentato` 💬. Il flusso
  consigliato è: scaldi il contatto (like/commento sui suoi post, a mano) → aspetti qualche
  giorno → poi clicchi Connetti su uno che ormai ti riconosce → accetta di più.
- Colonna `contacts.interacted_at` (timer dal like/commento).
- Preferenza `warmup_days` (default **2**, personalizzabile dal tab Profilo). Dopo `warmup_days`
  giorni dall'interazione, la card mostra **⏰ pronto per invitare**. (2 giorni = sweet spot:
  ti ricorda ma non sei invadente.)
- La sessione invii guidata (#3) ora pesca anche i contatti già scaldati (likato/commentato),
  non solo quelli a freddo. Resta tutto manuale: il sistema non mette mai like/commenti.

### Feature "uniche" (seconda tornata)
- **#3 Sessione invii guidata** (`OutreachSession.tsx`): modalità a tutto schermo che
  pesca i top contatti `da_fare` non ancora invitati (rispettando il pacing del
  tracker), li mostra UNO ALLA VOLTA. Un tap "🔗 Apri e segna invitato" → apre il
  LinkedIn + `rel_status=invitato` + log sul tracker + avanza. Scorciatoie tastiera
  (Invio=invita, S=salta, Esc=esci), genera DM al volo (cache), contatore inviati.
  Rispetta il principio non-negoziabile: apre solo il profilo, non invia nulla.
- **#6 Copilota del pool** (`Copilot.tsx` + `/api/copilot`): bottone flottante ✨ che
  apre una chat. Storico PERSISTENTE (tabella `copilot_messages`). Riceve un contesto
  compatto del pool (poche colonne, top 120 → pochi token) e risponde ad analisi
  ("tasso di accettazione?", "chi contattare oggi?") oppure propone/esegue azioni in
  blocco (sposta contatti in stato/categoria) riusando le API esistenti.
- **A Time machine** (`/api/revalue` + bottone in ProfileSetup): ri-valuta i contatti
  ancora in gioco (`da_valutare`/`da_fare`, non invitati) col profilo utente
  AGGIORNATO. Non ri-scrapa Apify → costo 0. Salva `prev_score` → la card mostra
  ▲/▼ il delta. Da lanciare dopo aver ri-scrapato il proprio profilo.
- **C Mappa relazionale** (`/api/network` + vista in tab Stats): trova cluster di
  contatti che condividono un'azienda (corrente + ex-aziende dalle esperienze). Un
  cluster è 🔥 "caldo" se hai già un contatto `connesso` lì → la prossima persona è
  un'intro, non un cold. Toggle "solo caldi". Caldi sempre in cima.

### Note operative storiche (giugno 2026, prima del refactor del doc)
- Actor Apify = harvestapi (no-cookie): `harvestapi~linkedin-profile-search`,
  `harvestapi~linkedin-profile-scraper`, `harvestapi~linkedin-job-search`.
- Persone e Lavori = raccolte separate (`/api/collect?what=people|jobs`).
- Paginazione: stato in `user_profile.preferences._lastProfilePage`, avanza ogni
  giro, riparte da 1 quando la ricerca si esaurisce.
- Gemini: backoff che rispetta il `retryDelay` del 429 (free tier 20 req/min).
- Costo misurato: Short ≈ $0.004/profilo ⇒ ~1.000+ profili/mese coi $5 gratis Apify.
- `ContactModal` ha un blocco "🔎 Dati grezzi (debug)" rimovibile.
