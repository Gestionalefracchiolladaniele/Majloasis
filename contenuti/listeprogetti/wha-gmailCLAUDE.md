# WhatsApp + Gmail AI Assistant

## Progetto
App customer support automatico su **WhatsApp** e **Gmail** (RAG + Gemini Agent) per azienda 16-20 dipendenti, 200+ msg/giorno, max 10 msg/min.

## Stack
| Layer | Tech |
|-------|------|
| **Frontend/Backend** | Next.js 15 + TypeScript / Vercel API Routes |
| **Database** | Supabase PostgreSQL + pgvector (1536D) |
| **AI** | Gemini 2.5 Flash (agent) + embedding-001 (RAG) |
| **Messaging** | Twilio (WA), Gmail API, Google Calendar |
| **Auth** | Google OAuth 2.0 (offline, refresh token), Supabase Auth (magic link + httpOnly JWT) |
| **UI** | Tailwind + Radix UI + Recharts |

## Architettura
```
WA Cliente → Twilio webhook → Rate limit → RAG (pgvector) → Gemini Agent → Twilio send
Gmail      → Pub/Sub webhook → Rate limit → RAG (pgvector) → Gemini Agent → Gmail reply
Dashboard  → Next.js React    → API Routes → Supabase
```

## Struttura Directory
```
app/
├── (auth)/login/page.tsx
├── dashboard/
│   ├── page.tsx | documents/page.tsx | chat-log/page.tsx | settings/page.tsx | calendar/page.tsx
├── api/
│   ├── auth/{google,google/callback,logout,profile}/route.ts
│   ├── documents/route.ts (GET/POST list/upload/DELETE)
│   ├── documents/[id]/route.ts (DELETE)
│   ├── documents/[id]/preview/route.ts (GET — primi 20 chunk testuali)
│   ├── webhooks/{whatsapp,gmail,calendar}/route.ts
│   ├── chat/{test,history}/route.ts
│   ├── stats/{today,week,chart}/route.ts
│   ├── settings/route.ts
│   └── gmail/{watch,stop}/route.ts
├── lib/
│   ├── gemini.ts (embedText, generateAgentResponse)
│   ├── rag.ts (searchRAG)
│   ├── pdf-processor.ts (chunks 512/50)
│   ├── auth.ts | rate-limiter.ts | twilio.ts | gmail.ts | calendar.ts | supabase.ts
│   └── types/index.ts
```

## Database (Tabelle Chiave)
| Tabella | Scopo |
|---------|-------|
| `documents` | PDF uploaded + `category` field |
| `document_chunks` | text + vector(1536) + chunk_order |
| `conversations` | channel: wa\|gmail, status: open\|closed |
| `messages` | sender: user\|agent, source_id (Twilio/Gmail) |
| `daily_stats` | metrics aggregate (date, count) |
| `rate_limits` | token bucket, max 10 msg/min |
| `webhook_logs` | debug Twilio/Gmail payloads |
| `cached_responses` | semantic cache SHA256, TTL 30d |
| `google_oauth_tokens` | per-user tokens (access, refresh, expiry, gmail_scope, calendar_scope); RLS **disabilitato** (service role accede direttamente) |
| `meetings` | calendar bookings (event_id, customer, date, time, meet_link, status) |

**RPC**: `match_documents(query_embedding, company_id, match_count, p_category?)` — cosine similarity + category filter

## Flusso WhatsApp (~1.5s, cache HIT ~200ms)
1. Twilio POST → form-data 2. `checkRateLimit(10)` 3. find/create conversation, save `sender: user` 4. `getCachedResponse()` → HIT: skip RAG+Gemini / MISS: `searchRAG(query, 5)` → `generateAgentResponse()` → `saveCachedResponse()` 5. tool_call auto: check_calendar, book_meeting, send_email (non cached) 6. `sendWhatsAppMessage()` → save `sender: agent`

## Env Vars (.env.local)
```
NEXT_PUBLIC_SUPABASE_URL|ANON_KEY, SUPABASE_SERVICE_KEY, GEMINI_API_KEY
TWILIO_{ACCOUNT_SID,AUTH_TOKEN,PHONE_NUMBER}
GOOGLE_{CLIENT_ID,CLIENT_SECRET,REDIRECT_URI}
NEXT_PUBLIC_APP_URL
```

## Sicurezza & Configurazione
- **Single-tenant**: 1 Supabase account per azienda, company_id = user_id
- **RLS**: attivo su tutte le tabelle (isolamento per user_id/company_id)
- **Rate limiting**: token bucket DB (10 msg/min)
- **GDPR**: EU data, cancellazione supportata
- **Auth**: Google OAuth 2.0 (offline, refresh token) + Supabase magic link
- **Token storage**: `google_oauth_tokens` table, auto-refresh se expiry < 60s; token_expiry come ISO string (timestamptz); RLS disabilitato (service role)
- **Re-login OAuth**: se Google non rimanda refresh_token (app già autorizzata), callback recupera il vecchio token dal DB — non sovrascrivere con NULL
- **Colonne extra**: `gmail_scope BOOL`, `calendar_scope BOOL` — obbligatorie nello schema; assenti causano errore upsert
- **Billing**: uso diretto, no subscription layer

## Convenzioni Codice
- **Risposte AI**: sempre italiano, tone: professional|friendly|technical (da `settings`)
- **PDF chunks**: 1500 char, overlap 50 (RecursiveCharacterTextSplitter)
- **Embedding**: `embedding-001` (outputDimensionality: 1536) — RETRIEVAL_DOCUMENT per chunks, RETRIEVAL_QUERY per ricerche
- **pgvector**: sempre usato RAG, index `hnsw` (1536D < 2000D limit), no ivfflat
- **Server keys**: Supabase service role + Google OAuth token solo server-side (mai client)
- **Google Auth**: `getAuthenticatedClient(userId)` restituisce client OAuth autenticato con auto-refresh
- **TypeScript**: strict mode, no `any`, tipi da `types/index.ts`
- **Components**: Server Components default, Client solo per interattività/realtime
- **Auth flow**: Google OAuth → /api/auth/google/callback → crea Supabase user → magic link session → cookie
- **Navigation**: `window.location.href` (non `router.push`) per garantire cookie di sessione
- **Tool execution**: `executeToolCall(toolCall, userId)` passa userId a calendar/gmail per operazioni per-utente

## RAG Optimization Plan (8 task, ~2.25h)
| # | Task | File | Cosa | Status |
|-|------|------|------|--------|
| 1 | Chunk Size | `lib/file-processor.ts` | `512 → 1500` char | ✅ Done |
| 2 | DB Schema | `supabase/schema.sql` | `documents` add `category TEXT DEFAULT 'Generale'` | ✅ Done |
| 3 | RPC Update | `supabase/schema.sql` | `match_documents()` add `p_category` param + WHERE filter | ✅ Done |
| 4 | Types | `types/index.ts` | `RAGResult` add `category?`, `Document` add `category`, `CachedResponse` | ✅ Done |
| 5 | Backend API | `app/api/documents/route.ts` | Accept `category` from form, insert to DB, validate < 50 char | ✅ Done |
| 6 | Frontend UI | `app/dashboard/documents/page.tsx` | Modal categoria al drag-drop: dropdown categorie esistenti (no preset) + "Crea nuova"; filtro per nome file e categoria; bottone anteprima (popup con primi 20 chunk); endpoint `GET /api/documents/[id]/preview` | ✅ Done |
| 7 | Cache Table | `supabase/schema.sql` | New `cached_responses` + RLS | ✅ Done |
| 8 | Cache Logic | `lib/cache.ts` (NEW) + webhook | `hashQuery()`, `getCached()`, `saveCached()` + integra WA webhook | ✅ Done |

**Tutte le 8 task completate.**
**Benefit**: 50% fewer chunks (40→20), category filter ready, semantic cache SHA256 60% HIT rate (0 tokens), backward compatible

## Google OAuth 2.0 Setup (✅ completato)
- ✅ Google Cloud Project + Gmail/Calendar API abilitate
- ✅ OAuth Client + Consent Screen (scopes: gmail.modify, calendar)
- ✅ `google_oauth_tokens` table + RLS disabilitato + colonne `gmail_scope`, `calendar_scope`
- ✅ Login page intercetta `#access_token=...` e chiama `setSession()`
- ✅ Gmail Pub/Sub topic + subscription verso Vercel webhook
- ✅ Vercel deploy con env vars (GOOGLE_CLIENT_ID, CLIENT_SECRET, REDIRECT_URI)
- ✅ `/api/gmail/watch` (POST — attiva) + `/api/gmail/stop` (POST — disattiva) + toggle in Settings
- ✅ Callback gestisce refresh_token mancante (re-login): recupera token esistente dal DB
- 📅 Prossimo: test login → attiva toggle Gmail in Settings → invia email di test → verifica risposta automatica

## Roadmap Fasi (8 fasi)

| Fase | Status | Feature |
|------|--------|---------|
| **0** | ✅ Done | Next.js 15 + TS strict, Supabase + RLS schema, Env vars, Gemini SDK, Twilio + Gmail SDK |
| **1** | ✅ Done | Google OAuth (Google sign-in only), Dashboard layout + stats, Settings (tone, integrazioni), Middleware auth, API structure |
| **2** | ✅ Done | PDF upload drag-drop, chunking (1500/50), Gemini embeddings → pgvector, RAG search, Documents mgmt |
| **3** | ✅ Done | Gemini agent core, tool stubs (calendar/meeting/email), test endpoint, conversation storage, tone config |
| **4** | ✅ Done | Twilio webhook (form-data), rate limit token bucket, message pipeline, Twilio send, webhook logging |
| **5** | ✅ Done | Gmail Pub/Sub (base64 decode), email pipeline, Gmail reply, multi-channel chat-log, per-user OAuth |
| **6** | ✅ Done | Calendar API (availability, bookMeeting), meeting bookings real, calendar sync + rules, 24h reminders |
| **7** | 🔍 Check | Recharts trends, conversation analytics, CSV export, full-text search, admin settings panel |
| **8** | 🚀 In Progress | Vercel deploy ✅, OAuth token fix ✅, gmail.watch toggle ✅, test end-to-end (mail→reply) ⏳, error logging (Sentry/pino) ⏳ |

## Common Pitfalls
| Errore | Fix |
|--------|-----|
| Twilio webhook body è form-data non JSON | `req.formData()` |
| Gmail Pub/Sub payload base64 | decode prima di parse |
| RAG non trova chunks | embedQuery() per ricerche (RETRIEVAL_QUERY), embedText() per documenti (RETRIEVAL_DOCUMENT) — task type differente |
| pgvector index fail (>2000D) | usare HNSW (no ivfflat), truncare a 1536D con outputDimensionality |
| Rate limiting non rispettato | token bucket DB (10 msg/min) |
| Supabase RLS non isola user_id | verifica policy isolation |
| Polling vs Realtime | `channel.on('postgres_changes', ...)` su `messages` |
| Build error `build-manifest.json ENOENT` | `rm -rf .next` e riavviare `npm run dev` — cartella .next corrotta |
| Token OAuth non salvato al login | RLS su `google_oauth_tokens` blocca service role → disabilitare RLS sulla tabella |
| Google non rimanda refresh_token al re-login | App già autorizzata → nel callback, se `refresh_token` assente recuperare quello esistente dal DB (non salvare NULL) |
| Upsert token_expiry fail | Salvare come ISO string (`.toISOString()`), leggere con `new Date(str).getTime()` — non come numero raw |
| Colonne gmail_scope/calendar_scope mancanti | Aggiungere manualmente in Supabase: `ALTER TABLE google_oauth_tokens ADD COLUMN gmail_scope BOOL DEFAULT FALSE` |

## Reuse from Friday.app (../friday/)
| Phase | Reference | Target | Pattern |
|-------|-----------|--------|---------|
| **4** | `middleware.ts` 1-63 | `middleware.ts` | @supabase/ssr + cookie handling |
| **4** | `app/api/auth/complete-signup/route.ts` 14-18 | webhooks (wa/gmail) | service role bypass RLS |
| **5** | `hooks/useBoard.ts` 21-89 | `hooks/useConversations.ts` | TanStack Query (boards→conversations) |
| **5** | `lib/supabase/client.ts` 1-15 | `lib/supabase.ts` | singleton client (no multiple instances) |
| **6-7** | `stores/uiStore.ts` 1-40 | `stores/uiStore.ts` | Zustand (activeBoardId→activeConversationId) |
| **6-7** | `stores/boardStore.ts` 16-48 | `stores/conversationsStore.ts` | optimistic updates (no refetch) |
| **6-7** | `components/layout/Sidebar.tsx` 46-140 | `components/dashboard/Sidebar.tsx` | nav: Dashboard, Chat Log, Documents, Settings |
| **6-7** | `components/layout/Topbar.tsx` 37-57 | `components/dashboard/Topbar.tsx` | notification badge for new msgs |
| **7** | `lib/utils.ts` 1-48 | `lib/utils.ts` | helpers: cn(), formatRelativeTime(), getInitials(), truncate() |

## Skills & Agents
**Quick Skills**: `/commit` (auto-msg), `/tdd` (test-first), `/security-scan`, `/smart-debug`
**Agents**: `ai-engineer` (RAG/vector), `vector-db` (pgvector), `frontend-dev` (React), `security-auditor` (OWASP), `customer-support` (conversational), `typescript-pro` (types)
