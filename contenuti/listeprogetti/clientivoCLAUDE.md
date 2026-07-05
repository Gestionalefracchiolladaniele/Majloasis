# CLAUDE.md: Unified Platform Project

## Project Summary
Next.js + Supabase platform con 2 moduli (OneDigit, QuoteBuilder). Single account model: 1 user = 1 account. V2.0: owner + employees condividono `account_id`.

## Tech Stack
- **Frontend**: Next.js 16.2.4 (App Router, Turbopack), React 19, TypeScript, Tailwind CSS, shadcn/ui
- **Backend**: Supabase (auth, DB, RLS), route handlers + server actions · **State**: TanStack Query
- **Auth**: Supabase Auth + Google OAuth only · **Deploy**: Vercel · **Package Manager**: pnpm
- **Font**: Plus Jakarta Sans (300–800) · **Design**: Zinc monochromatic, mesh-gradient bg, dark KPI cards

## App Structure
```
/app/
├── onedigit/        — Dashboard KPI, clienti, pacchetti, contratti, commerciali, costi-fornitore, storico-contratti
├── quotebuilder/    — Preventivi dashboard, editor [id], anteprima [id]/anteprima, servizi, bundle-progetti, impostazioni
├── preview/[token]  — (Public) PublicQuoteView: verifica token + preventivo A4 + Accetta/Rifiuta
└── team/            — Lista membri, toggle 13 permessi granulari, dialog invito
```

## Data Model (RLS account_id su tutte)
`accounts` · `clients` · `packages` · `contracts` · `commercials` · `supplier_price_list` · `template_servizi` · `bundle_progetti` · `bundle_items` · `quotes` · `quote_items` · `quote_public_tokens` · `notifications` · `team_users` · `suppliers`

**V3 Columns**:
- `accounts.sedi` → text[] (default '{}')
- `clients` → +15 campi (ragione_sociale, insegna, cap, citta, partita_iva, pec, agente, sede, date_firma/attivazione/fine/disdetta, commercial_id, commission_override, cpa, supplier_reel_id)
- `packages` → +4 campi (tipo_pacchetto='contenuto'/'servizio', budget_pubblicitario, durata_minima_mesi=1, canone_una_tantum)
- `supplier_price_list` → +2 campi (cost_type='fisso'/'variabile', supplier_id FK→suppliers.id)

## Key Principles
1. Multi-tenant: `getEffectiveAccountId()` server action + `useEffectiveAccountId()` hook risolvono account_id corretto (owner=user.id, employee=team_users.account_id)
2. RLS enforces security sul DB — mai in app code. Employee RLS via `get_accessible_account_ids()` function
3. TanStack Query per caching; server components dove possibile
4. Quote preview = React + **html2pdf.js** (dynamic import). Export Word via `docx` npm. NO `window.print()`, NO HTML template
5. Catalogo servizi: click-to-add (NO drag-drop) · Logo: URL esterno (no Supabase Storage in v1.0)
6. Duplicazione preventivo: copia record + righe + auto-numerazione progressiva

## Permission System (V3.0)
13 colonne boolean in `team_users`: `can_view_onedigit_dashboard`, `can_view_clients`, `can_view_packages`, `can_view_contracts`, `can_view_commercials`, `can_view_supplier_costs`, `can_view_storico_contratti`, `can_view_quotes`, `can_edit_quotes`, `can_view_servizi`, `can_view_bundle`, `can_send_quotes`, `can_view_impostazioni`.
- owner/admin → tutti true · member → valori dal DB
- `PermissionGate` HOC su tutti i 13 page.tsx (server-side, mostra AccessDenied se negato)
- `getCurrentUserRole()` / `getCurrentUserPermissions()` in `src/lib/actions/team-users.ts`
- Checkbox UI: spuntata=BLOCCATA (false nel DB) · `checked={!member[key]}` · default: liberi tranne Dashboard

## Team Invite Flow (V3 — RISOLTO)
`/auth/accept-invite/[token]` → `POST /api/invite/start` setta cookie HTTP-only `pending_invite_token` (600s) → Google OAuth → callback associa uid a `team_users.user_id` + status=active. Trigger `handle_new_user` NON crea `accounts` per dipendenti. RPC `cleanup_employee_account` rimuove orphaned accounts. `inviteTeamUser` fa upsert (riinvita disabilitati).

## Supabase Setup (migrations in ordine)
```
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxxxx
SUPABASE_SERVICE_ROLE_KEY=eyJxxxxx   ← richiesto per Client Portal
```
1. `supabase-fix-schema.sql` — tabelle base + RLS
2. `supabase-migrations.sql` — colonne mancanti (idempotente)
3. `supabase-v2-migration.sql` — `quote_public_tokens` + `notifications`
4. `supabase-team-migration.sql` — estende `team_users` + `get_accessible_account_ids()`
5. `supabase-fix-employee-trigger.sql` — FIX trigger + RPC `cleanup_employee_account`
6. `supabase-team-missing-columns.sql` — 13 colonne permessi + avatar_url
7. `supabase-fix-team-rls.sql` — policy team_access su commercials, supplier_price_list, contracts, accounts; team_write/update/delete su quotes + quote_items
8. `supabase-v3-migration.sql` — V3: aggiunge colonne a accounts (sedi array), clients (15 campi), packages (4 campi), supplier_price_list (cost_type, supplier_id + FK)
9. `supabase-v4-fix-template-servizi.sql` — V4: **CLEANUP**: rimuove colonne obsolete di template_servizi (tenant_id, nome, descrizione, prezzo_unitario, iva_percent, categoria, solo_progetto) → standardizza su account_id + ricrea RLS policies (account_isolation, team_access/write/update/delete) + `NOTIFY pgrst` per flush schema cache
10. `supabase-v4-team-rls.sql` — V4: team RLS su template_servizi, bundle_progetti, bundle_items, supplier_price_list, suppliers (tenant_id), clients, packages

RLS pattern: `USING (account_id = auth.uid()) WITH CHECK (account_id = auth.uid())`. `account_id` sempre `uuid`.

## Auth Flow
`/auth/login` → Google OAuth → `/auth/callback` → crea/aggiorna `accounts` → `/app/onedigit`
Middleware: `src/proxy.ts` (non `middleware.ts`) — protegge `/app/*`, redirige autenticati da `/auth/*`

## Code Patterns
```ts
useQuery(['key'], () => supabaseClient().from('table').select('*'))
useMutation(...) + queryClient.invalidateQueries(['key'])
const { toast } = useToast(); toast('msg', 'success'|'error')
// Dialog: <Dialog open={show} onClose={...} title={...}>
// Print: className="no-print" su toolbar/sidebar nell'anteprima
```

## Design System
- Background: `mesh-bg` (`#fbf8ff`) · Palette: **zinc only** (no gray-*, blue-*, indigo-*, emerald-*)
- KPI cards: `bg-[#09090b] border border-white/10 rounded-lg px-5 py-4`
- Sidebar: `bg-[#18181b]` (180px/56px, localStorage) · Dialogs: `bg-zinc-900 border border-zinc-800`
- Buttons: `zinc-900` primary, `white` su dark · Tab: `bg-zinc-100 rounded-lg p-1` + active `bg-white shadow-sm rounded`
- Page containers: `px-4 sm:px-6 lg:px-8` + h1 `-ml-0.5` · Toggle: `accent-zinc-900`

## Naming & Notes
- Components: PascalCase · Hooks: `use` prefix · Routes: kebab-case · DB: snake_case
- Dates: ISO strings nel DB, `date-fns` lato client · Form errors: messaggi Supabase dettagliati
- Bundle query: `bundle_items(order_position, template_servizi(*))` per ordine corretto
- Custom RPC richiede `(admin as any).rpc(...)` per bypass TypeScript auto-generated types
- QuoteEditor: layout `flex h-full` con sidebar destra Servizi/Bundle
- `src/lib/permissions.ts` usa React `cache()` per deduplicare chiamate nella stessa request
- Invite link: `{origin}/auth/accept-invite/{token}` — pubblica, non redirige loggati, verifica token prima di mostrarla
- RLS su tabelle con FK (es. `bundle_items`): usare join su tabella parent con account_id, non diretta
- `useAccount.ts` e `QuotePreview.tsx` usano `useEffectiveAccountId()` — mai `user.id` diretto (rompe employee access)

## Impostazioni (5 tab — `/app/impostazioni`)
Azienda · Numerazione (counter preventivi) · Pagamenti (+ Metodi) · Stile PDF (logo/colori/font/margini/sezioni visibili) · Firma
Tutti i valori salvati in `accounts`. Logo come URL esterno. Sezioni visibili in anteprima configurabili per account.

**V3 — Sedi Dinamiche & Costi Interni**:
- `accounts.sedi` = text[] per sedi aziendali (non hardcoded Roma/Bari)
- Tab Azienda: sezione "Sedi" con input field + pulsante "+", lista sedi con tasto elimina
- `useSedi()` hook espone account.sedi a ClientForm, PackageForm, SupplierForm
- Info button accanto "Costi Interni" apre `MarginFormulaModal`: mostra 6 formule (Ricavi, Costo Contenuti, Costo Coordinamento, Budget Pubblicitario, Costo Totale, Margine Netto)

## Critical Fixes (non dimenticare)
- **Employee data access**: `useEffectiveAccountId()` deve essere usato in TUTTE le query client — non `user.id`
- **Trigger `handle_new_user`**: NON crea `accounts` per utenti con email in `team_users` (pending/active) — fix in `supabase-fix-employee-trigger.sql`
- **Cookie OAuth**: `POST /api/invite/start` setta cookie PRIMA di `signInWithOAuth()` perché il cookie sopravvive al round-trip; se settato dopo, si perde
- **Layer 2 fallback**: `getEffectiveAccountId()` fa email-matching per utenti già loggati che aprono link invito (auto-bind senza re-login)
- **Re-invite**: `inviteTeamUser` fa upsert — se dipendente era `disabled`, aggiorna record esistente invece di creare duplicato
- **V3 — Sedi non hardcoded**: Sempre usare `useSedi()` hook, MAI array SEDI costante in componenti
- **Suppliers account_id**: Suppliers usa `account_id` come tutte le altre tabelle. Query: `.eq('account_id', accountId)`. Insert: `{ nome, account_id: accountId }`
- **V3 — Cost type**: Supplier price list ha `cost_type` (fisso/variabile) con CHECK constraint. Sempre inviare nel payload
- **V4 — template_servizi cleanup**: La tabella aveva colonne obsolete (tenant_id, nome, descrizione, prezzo_unitario, iva_percent, categoria, solo_progetto). Usare `supabase-v4-fix-template-servizi.sql` che rimuove le colonne vecchie e standardizza su `account_id` con RLS corrette (account_isolation + team_access/write/update/delete). ❌ Non usare tenant_id su template_servizi (è per suppliers only)
- **V4 — Suppliers ClientForm**: Query fornitori usa `.eq('tenant_id', accountId)`, `.order('nome')`, render `s.nome`. ❌ Non usare `account_id` o `s.name`
- **V4 — ServizioForm account_id**: Usa `useEffectiveAccountId()` per insert in template_servizi. ❌ Non usare `supabase.auth.getUser().user.id`
- **V4 — PDF download**: Usa `downloadPdf(elementId, filename)` da `src/lib/downloadPdf.ts` (html2pdf.js dynamic import). ❌ Non usare `window.print()`
- **V4 — SendQuoteDialog**: Supporta Gmail e WhatsApp. `defaultPhone` prop preso da `clients.phone` (non da quote). QuoteBuilderDashboard select deve includere `phone`: `.select('*, clients(name, company, email, phone)')`
- **V5 — Quote layout**: QuotePreview e PublicQuoteView hanno layout identico. Tutto il layout dentro `id="quote-document"` usa `<table>/<tr>/<td>` invece di flexbox (html2canvas non renderizza flex). Header: `<table>` 50/50, colonna sinistra logo+dati azienda, colonna destra `textAlign:'right'` con titolo PREVENTIVO in cima + numero/date con `marginTop:'0.75rem'` per separazione visiva. Numero preventivo: `<p>` testo semplice senza bordi, `fontWeight:700`, allineato a destra. Sezione destinatario/oggetto: `<table>` 50/50. Firma: mostra SOLO `account.quote_signature_image` + `account.quote_signature_role` (NO nome firmatario), immagine sopra linea `borderTop`, ruolo sotto. ❌ NO `display: flex` nei layout principali. ❌ NO bordi/pill sul numero preventivo. ❌ NO nome firmatario — solo firma digitale + ruolo. ❌ Non usare `marginBottom` su `<p>` dentro `<td>` (non rispettato da html2canvas) — usare `paddingBottom`. ❌ Non usare classi Tailwind dentro `id="quote-document"` — solo `style={{}}` inline.
- **V5 — SignaturePad**: `strokeStyle='#09090b'` (nero), sfondo canvas bianco (`bg-white`). Salva base64 PNG in `accounts.quote_signature_image`. ❌ Non usare strokeStyle bianco (invisibile su sfondo bianco del documento).
- **V5 — Impostazioni Firma**: Sia `ImpostazioniAziendaView` che `QuoteBuilderImpostazioniView` tab Firma: rimosso campo "Nome firmatario", rimangono solo SignaturePad + campo "Ruolo/Titolo" (`quote_signature_role`). Payload salvataggio include `quote_signature_image` e `quote_signature_role`.

## Pitfalls
- ❌ `account_id` mancante nelle query → data leak
- ❌ RLS logic in app code (va sul DB) · ❌ Stripe in v1.0
- ❌ `window.print()` per preventivi → usa `downloadPdf()` da `src/lib/downloadPdf.ts` · ❌ Drag-drop
- ❌ Dimenticare `quote_numbering_counter` dopo duplicazione
- ❌ Riferimenti a PulseMargin, quote_templates, html_content (obsoleti)
- ❌ Colori non-zinc
- ❌ `user.id` diretto in componenti condivisi owner/employee → usa sempre `useEffectiveAccountId()`
- ❌ **V3**: Hardcoded SEDI array, dimenticare `useSedi()` hook → sempre dinamiche da `accounts.sedi`
- ❌ **V3**: Dimenticare `cost_type` in supplier_price_list payload (richiesto, default='fisso')
- ❌ **V4**: Usare `tenant_id` su template_servizi — la tabella deve usare SOLO `account_id` (tenant_id è ESCLUSIVO per suppliers)

## Key Files (V2.0+)
- `src/lib/supabase-admin.ts` — admin client service role (NEVER browser)
- `src/lib/actions/account.ts` — `getEffectiveAccountId()` con Layer 2 fallback email-matching
- `src/lib/actions/team-users.ts` — `inviteTeamUser`, `acceptInvite`, `getCurrentUserRole()`, `getCurrentUserPermissions()`
- `src/lib/actions/quote-tokens.ts` — `getOrCreateQuoteToken(quoteId)`
- `src/lib/actions/notifications.ts` — `getNotifications`, `markAsRead`, `markAllAsRead`
- `src/hooks/useEffectiveAccountId.ts` — TanStack Query wrapper, `staleTime: Infinity`
- `src/hooks/useSedi.ts` — **V3**: espone `account.sedi` a componenti (ClientForm, PackageForm, SupplierForm)
- `src/components/PermissionGate.tsx` — `PermissionGate` + `AccessDenied` (Lock icon)
- `src/lib/downloadPdf.ts` — **V4**: utility html2pdf.js (dynamic import), `downloadPdf(elementId, filename)`
- `src/components/SendQuoteDialog.tsx` — **V4**: dialog "Invia al cliente" con toggle Gmail/WhatsApp, `defaultPhone` prop da clients.phone
- `src/components/Sidebar.tsx` — badge notifiche + drawer + polling 5s
- `src/app/preview/[token]/` — PublicQuoteView pubblica (Accetta/Rifiuta)
- `src/app/api/quote-response/[token]/route.ts` — aggiorna status + invalida token + notifica
- `src/app/api/invite/start/route.ts` — setta cookie HTTP-only `pending_invite_token`
- `src/app/auth/accept-invite/[token]/` — verifica token + AcceptInviteClient Google OAuth
- `src/app/app/onedigit/clienti/ClientForm.tsx` — **V3**: usa `useSedi()` per sedi dinamiche
- `src/app/app/onedigit/pacchetti/PackageForm.tsx` — **V3**: usa `useSedi()` per sedi dinamiche
- `src/app/app/onedigit/costi-fornitore/SupplierForm.tsx` — forma semplice nome fornitore, usa `account_id` per insert
- `src/app/app/onedigit/costi-fornitore/CostoFornitoreForm.tsx` — dropdown fornitori (da suppliers table con `account_id`), select tipo_costo (fisso/variabile)
- `src/app/app/onedigit/costi-fornitore/CostiFornitoreView.tsx` — tab Listino/Fornitori con mutazioni CRUD, suppliers query con `account_id`
- `src/app/app/impostazioni/ImpostazioniAziendaView.tsx` — **V3**: tab Azienda con sedi dinamiche + info button MarginFormulaModal. **V5**: tab Firma senza nome firmatario, solo SignaturePad + ruolo
- `src/app/app/quotebuilder/[id]/anteprima/QuotePreview.tsx` — **V5**: `id="quote-document"`, layout `<table>` (no flex), numero preventivo testo semplice senza bordi, firma digitale da `account.quote_signature_image` + ruolo sotto linea
- `src/app/preview/[token]/PublicQuoteView.tsx` — **V5**: `id="quote-document-public"`, layout identico a QuotePreview
- `src/app/app/quotebuilder/impostazioni/QuoteBuilderImpostazioniView.tsx` — **V5**: tab Firma con SignaturePad + ruolo (no nome firmatario), salva `quote_signature_image` + `quote_signature_role`
- `src/components/ui/signature-pad.tsx` — **V5**: strokeStyle nero `#09090b`, canvas sfondo bianco. Firma visibile nel documento PDF
- `src/app/app/quotebuilder/servizi/ServizioForm.tsx` — **V4**: usa `useEffectiveAccountId()` per insert (non `user.id`)
- `src/app/app/quotebuilder/QuoteBuilderDashboard.tsx` — **V4**: select include `phone` nei clients, `defaultPhone` a SendQuoteDialog
