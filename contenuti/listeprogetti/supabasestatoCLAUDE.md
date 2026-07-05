# CLAUDE.md — Istruzioni di progetto

Guida permanente per Claude Code quando lavora su questo repository.
**Leggi sempre [DESIGN.md](DESIGN.md) prima di scrivere o modificare codice.**

---

## Cos'è questo progetto

**Multi-Project Monitor**: sistema di monitoraggio centralizzato per progetti
personali (web Vercel, database Supabase, app mobile Expo/EAS), gestito interamente
via **bot Telegram**. Single-user ora, **template-first ma SaaS-ready**.

Il blueprint completo e autorevole è in **DESIGN.md**. Questo file contiene solo le
regole operative e i principi da non violare.

---

## Principi NON negoziabili (dal DESIGN.md)

1. **Ingest disaccoppiato dalla notifica.** Ogni sorgente (pg_cron, webhook,
   Action) fa solo: upsert `project_status`/`metric_values` + insert `events`.
   TUTTA la logica di notifica (transizioni, cooldown, flap, severità, silenzio
   sospetto, health score) vive nei trigger/funzioni Postgres. Mai duplicarla
   negli ingest.
2. **Lo stato del DB è l'unica sorgente di verità.** Niente stato nelle Edge
   Functions o nelle Action.
3. **Segreti SOLO nel Vault.** Mai token in chiaro nelle tabelle, nel codice, nei
   log, nei messaggi versionati. Le tabelle contengono solo `secret_ref`.
4. **`owner_id` su ogni tabella di dati + RLS per-owner.** Anche con un solo utente.
   È ciò che rende il salto a SaaS un'aggiunta e non una riscrittura. Non rimuoverlo
   "perché tanto c'è un solo utente".
5. **Whitelist owner su OGNI messaggio del bot.** chat_id non autorizzato →
   ignorato in silenzio (nessuna risposta). Prima riga di ogni handler.
6. **Notifica sulle TRANSIZIONI, non sugli stati.** Mai notificare "ancora down".
   Flap detection (2 check) + cooldown + rate-limit globale sono obbligatori, non
   opzionali.
7. **Idempotenza via `event_key`.** Ogni evento ha la sua chiave (vedi §4 DESIGN).
   `ON CONFLICT DO NOTHING`. Webhook e polling non devono mai duplicare notifiche.
8. **Down reale ≠ config rotta.** Se un check fallisce per token/query invalidi,
   valorizza `last_check_error` → evento "config", non "down". Non allarmare per
   errori nostri.

---

## Convenzioni tecniche

- **Schema DB:** tutto in `monitor.` (mai `public.`).
- **Timestamp:** sempre `timestamptz` (UTC nel DB). Presentazione `Europe/Rome`,
  formato `21/06 14:30`.
- **Migrazioni:** Supabase CLI in `supabase/migrations/`. **Mai ALTER a mano** sul
  DB. Ogni cambiamento di schema = una nuova migrazione versionata, numerata
  cronologicamente. Una tappa = una o più migrazioni.
- **Edge Functions:** Deno, in `supabase/functions/<nome>/`. Testare in locale
  (`supabase functions serve`) prima del deploy. Accesso DB via service role.
- **GitHub Actions:** in `.github/workflows/`. `concurrency` + `timeout-minutes`
  sempre. Repo privato → minimizzare i minuti.
- **SQL:** funzioni di logica come `SECURITY DEFINER` nello schema `monitor`,
  search_path fisso. Trigger `AFTER` per le transizioni.
- **Naming:** funzioni `monitor.verb_noun()`; eventi `type` in snake_case.

---

## Cosa NON fare (anti over-engineering — vedi §18 DESIGN)

Non aggiungere senza che l'utente lo chieda: dashboard web, Grafana/Prometheus,
PagerDuty, ML anomaly detection, email/SMS, account multipli/billing/login web
(SaaS completo), monitoraggio salute codice/CI/PR (ex-L4, tagliato), le 4 idee
"rosse" (#3 stima costi, #5 timeline narrabile, #6 dipendenze tra progetti, #8
self-monitoring esteso).

L'AI (Claude API) è **solo Tappa 5** e solo per linguaggio/sintesi (recap,
spiegazioni). Il core resta deterministico: per soglie/confronti usa `if`, non LLM.

---

## Ordine di costruzione (vedi §17 DESIGN per dettaglio)

Costruire a tappe, **non tutto insieme**. La Tappa 1 deve restare piccola e
funzionante prima di passare oltre.

- **Tappa 1** — Fondamenta: schema + RLS/owner_id + Vault + bot (claim-token,
  whitelist, `/start /whoami /stato /add base /list /test`) + `notify` + seed finto
  + dead man's switch base + `deploy.yml`.
- **Tappa 2** — Health check pg_cron + SSL + flap/cooldown + rate-limit + Vercel
  polling + `ingest-webhook`.
- **Tappa 3** — Expo via Action + GitHub webhook + metriche custom + silenzio
  sospetto + health score + recap.
- **Tappa 4** — Digest + comandi rifinitura + bottoni inline + grouping + backup.
- **Tappa 5** — AI + heartbeat esterno + idee pianificate (#1/#9/#10).

Alla fine di ogni tappa: il sistema deve essere in uno stato **funzionante e
verificabile** (non lasciare tappe a metà).

---

## Struttura cartelle attesa

```
.
├── DESIGN.md                  # blueprint autorevole
├── CLAUDE.md                  # questo file
├── ESEGUIRE.md                # guida operativa per l'utente
├── supabase/
│   ├── config.toml
│   ├── migrations/            # schema versionato
│   ├── functions/
│   │   ├── telegram-bot/
│   │   ├── notify/
│   │   └── ingest-webhook/
│   └── seed.sql               # SOLO dati finti per test
└── .github/workflows/
    ├── deploy.yml
    └── eas-build.yml
```

---

## Azioni che richiedono l'utente (non automatizzabili)

Vedi §19 DESIGN. Quando arrivi a un punto che richiede un account/segreto
dell'utente (creare progetto Supabase, bot @BotFather, incollare token, primo
`/start`), **fermati e dai istruzioni chiare**, non inventare credenziali.
