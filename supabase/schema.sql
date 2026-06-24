-- Majloasis — schema database (Supabase / Postgres)
-- Esegui questo file nel SQL Editor di Supabase (Dashboard → SQL Editor → New query → incolla → Run).
-- È idempotente: puoi rieseguirlo senza perdere dati.

-- ─────────────────────────────────────────────────────────────
-- user_profile : il "cervello" — profilo sintetico + preferenze
-- ─────────────────────────────────────────────────────────────
create table if not exists public.user_profile (
  id          uuid primary key default gen_random_uuid(),
  linkedin_url text,
  raw_scrape  jsonb,
  summary     text,
  preferences jsonb,
  updated_at  timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────
-- contacts : profili raccolti e valutati
-- ─────────────────────────────────────────────────────────────
create table if not exists public.contacts (
  id           uuid primary key default gen_random_uuid(),
  linkedin_url text not null unique,          -- niente duplicati
  name         text,
  headline     text,
  company      text,
  location     text,
  photo_url    text,
  raw          jsonb,
  score        int,
  gender_guess text check (gender_guess in ('male','female','unknown')),
  reason       text,
  badges       text[] default '{}',
  category     text,
  status       text not null default 'da_valutare'
               check (status in ('da_valutare','da_fare','fatto','non_fare')),
  message      text,                               -- DM generato (cache: niente ri-chiamate Gemini)
  -- ── warm-up / gestione relazione post-accettazione ──
  -- Dove sta la relazione DOPO l'invito: il sistema non automatizza nulla,
  -- l'utente avanza lo stato a mano man mano che la conversazione procede.
  -- Fasi PRIMA dell'invito (warm-up): like/commento sui suoi post per "scaldarlo",
  -- così quando arriva il Connetti ti riconosce già → accetta di più.
  rel_status   text not null default 'nessuno',
  interacted_at timestamptz,                       -- ultimo like/commento (per il reminder "pronto per invitare")
  invited_at   timestamptz,                        -- quando hai mandato l'invito
  connected_at timestamptz,                        -- quando ha accettato
  replied_at   timestamptz,                        -- quando ti ha risposto
  last_touch_at timestamptz,                       -- ultimo contatto (per il reminder follow-up)
  notes        text,                               -- intelligence umana libera (#6): "amico di X", "incontrato a Y"
  prev_score   int,                                -- score precedente alla rivalutazione (time machine)
  revalued_at  timestamptz,                        -- quando il profilo è stato rivalutato col profilo utente aggiornato
  created_at   timestamptz not null default now()
);

-- ── migrazioni idempotenti per chi ha già la tabella ──
-- IMPORTANTE: le colonne vanno aggiunte PRIMA degli indici/constraint che le usano.
alter table public.contacts add column if not exists message text;
alter table public.contacts add column if not exists rel_status text not null default 'nessuno';
alter table public.contacts add column if not exists invited_at timestamptz;
alter table public.contacts add column if not exists connected_at timestamptz;
alter table public.contacts add column if not exists replied_at timestamptz;
alter table public.contacts add column if not exists last_touch_at timestamptz;
alter table public.contacts add column if not exists notes text;
alter table public.contacts add column if not exists prev_score int;
alter table public.contacts add column if not exists revalued_at timestamptz;
alter table public.contacts add column if not exists interacted_at timestamptz;

-- check su rel_status: include le fasi pre-invito (likato/commentato). Lo si
-- ricrea sempre (drop + add) così chi aveva la versione vecchia del CHECK la aggiorna.
do $$ begin
  if exists (select 1 from pg_constraint where conname = 'contacts_rel_status_check') then
    alter table public.contacts drop constraint contacts_rel_status_check;
  end if;
  alter table public.contacts add constraint contacts_rel_status_check
    check (rel_status in ('nessuno','likato','commentato','invitato','connesso','messaggiato','risposto','in_conversazione','freddo'));
end $$;

-- Indici (dopo che tutte le colonne esistono).
create index if not exists contacts_status_idx on public.contacts (status);
create index if not exists contacts_score_idx  on public.contacts (score desc);
create index if not exists contacts_category_idx on public.contacts (category);
create index if not exists contacts_rel_status_idx on public.contacts (rel_status);
-- dedup semantica: stessa persona con URL diversi → nome normalizzato + azienda
create index if not exists contacts_name_company_idx on public.contacts (lower(name), lower(company));

-- ─────────────────────────────────────────────────────────────
-- jobs : offerte di lavoro raccolte e valutate
-- ─────────────────────────────────────────────────────────────
create table if not exists public.jobs (
  id           uuid primary key default gen_random_uuid(),
  linkedin_url text not null unique,
  title        text,
  company      text,
  location     text,
  description  text,
  raw          jsonb,
  score        int,
  reason       text,
  status       text not null default 'da_valutare'
               check (status in ('da_valutare','da_fare','fatto','non_fare')),
  created_at   timestamptz not null default now()
);

create index if not exists jobs_status_idx on public.jobs (status);
create index if not exists jobs_score_idx  on public.jobs (score desc);

-- ─────────────────────────────────────────────────────────────
-- categories : categorie custom create dall'utente
-- ─────────────────────────────────────────────────────────────
create table if not exists public.categories (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  emoji      text,
  color      text,
  created_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────
-- outreach_log : tracker anti-ban (un record per invito segnato)
-- ─────────────────────────────────────────────────────────────
create table if not exists public.outreach_log (
  id         uuid primary key default gen_random_uuid(),
  contact_id uuid references public.contacts(id) on delete cascade,
  sent_at    timestamptz not null default now()
);

create index if not exists outreach_log_sent_at_idx on public.outreach_log (sent_at desc);

-- ─────────────────────────────────────────────────────────────
-- copilot_messages : storico della chat col copilota del pool (#6)
-- ─────────────────────────────────────────────────────────────
create table if not exists public.copilot_messages (
  id         uuid primary key default gen_random_uuid(),
  role       text not null check (role in ('user','assistant')),
  content    text not null,
  created_at timestamptz not null default now()
);

create index if not exists copilot_messages_created_idx on public.copilot_messages (created_at);

-- ─────────────────────────────────────────────────────────────
-- Seed: categorie iniziali suggerite (modificabili / cancellabili)
-- ─────────────────────────────────────────────────────────────
insert into public.categories (name, emoji, color) values
  ('Founder',          '🚀', '#c9a227'),
  ('Tech Leader',      '🎯', '#ffffff'),
  ('Investitori',      '💰', '#c9a227'),
  ('Real Estate Dubai','🏙️', '#ffffff'),
  ('Finance',          '🏦', '#ffffff'),
  ('Crypto/Web3',      '🪙', '#c9a227'),
  ('Marketing',        '📣', '#ffffff'),
  ('Consulenza',       '🧠', '#ffffff'),
  ('Imprenditori',     '💼', '#ffffff'),
  ('Real Estate',      '🏠', '#ffffff'),
  ('Networking',       '🤝', '#ffffff')
on conflict (name) do nothing;

-- ─────────────────────────────────────────────────────────────
-- RLS : uso personale. La dashboard legge con la anon key; tutte
-- le scritture (scrape/valutazione/stati) passano dal server con la
-- service_role key che bypassa RLS. Quindi: anon = solo lettura.
-- ─────────────────────────────────────────────────────────────
alter table public.user_profile enable row level security;
alter table public.contacts     enable row level security;
alter table public.jobs         enable row level security;
alter table public.categories   enable row level security;
alter table public.outreach_log enable row level security;
alter table public.copilot_messages enable row level security;

do $$
begin
  -- letture pubbliche (anon) — la dashboard è protetta a monte da DASHBOARD_PASSWORD
  if not exists (select 1 from pg_policies where tablename='user_profile' and policyname='anon read') then
    create policy "anon read" on public.user_profile for select using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='contacts' and policyname='anon read') then
    create policy "anon read" on public.contacts for select using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='jobs' and policyname='anon read') then
    create policy "anon read" on public.jobs for select using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='categories' and policyname='anon read') then
    create policy "anon read" on public.categories for select using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='outreach_log' and policyname='anon read') then
    create policy "anon read" on public.outreach_log for select using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='copilot_messages' and policyname='anon read') then
    create policy "anon read" on public.copilot_messages for select using (true);
  end if;
end $$;
