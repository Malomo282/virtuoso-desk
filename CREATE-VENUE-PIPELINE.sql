-- Virtuoso Desk — Venue Pipeline (CRM)
--
-- Run in Supabase → SQL Editor. Safe to re-run.
--
-- Agency-only by construction: there is no artist-facing policy on either
-- table, so an artist querying them with the public anon key gets nothing
-- back regardless of what the UI does.
--
-- Depends on public.is_agency(), created earlier for the roster fix. It is
-- SECURITY DEFINER so a policy on profiles can ask "is this user an agency
-- user?" without recursing into profiles' own RLS.

create extension if not exists "pgcrypto";

create table if not exists public.venue_pipeline (
  id                uuid primary key default gen_random_uuid(),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  holding_company   text,
  brand_name        text not null,
  venue_type        text,
  area              text,
  priority          text check (priority in ('High','Medium','Low')),
  contact_name      text,
  contact_title     text,
  linkedin_url      text,
  email             text,
  status            text not null default 'Not Contacted' check (status in (
                      'Not Contacted','Connection Sent','Connected',
                      'Messaged','Call Booked','Proposal Sent',
                      'Negotiating','Trial Booked','Active Partner',
                      'No Response','Not Interested','Agency Deal',
                      'Revisit Later','Wrong Contact')),
  date_contacted    date,
  last_activity     date,
  next_action       text,
  next_action_date  date,
  notes             text,
  assigned_to       text default 'Jesse'
);

create table if not exists public.activity_log (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  venue_id      uuid references public.venue_pipeline(id) on delete cascade,
  activity_type text check (activity_type in (
                  'LinkedIn Message','Email','Call','Meeting','Note','Status Change')),
  content       text,
  logged_by     text default 'Jesse'
);

-- The board groups by status; the table sorts by next action and priority.
create index if not exists idx_venue_pipeline_status   on public.venue_pipeline (status);
create index if not exists idx_venue_pipeline_priority on public.venue_pipeline (priority);
create index if not exists idx_venue_pipeline_next     on public.venue_pipeline (next_action_date);
create index if not exists idx_activity_log_venue      on public.activity_log (venue_id, created_at desc);

-- Keep updated_at honest without the client having to remember.
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists trg_venue_pipeline_updated on public.venue_pipeline;
create trigger trg_venue_pipeline_updated
  before update on public.venue_pipeline
  for each row execute function public.touch_updated_at();

alter table public.venue_pipeline enable row level security;
alter table public.activity_log   enable row level security;

drop policy if exists "Agency manages venue pipeline" on public.venue_pipeline;
create policy "Agency manages venue pipeline" on public.venue_pipeline
  for all using (public.is_agency()) with check (public.is_agency());

drop policy if exists "Agency manages activity log" on public.activity_log;
create policy "Agency manages activity log" on public.activity_log
  for all using (public.is_agency()) with check (public.is_agency());

-- PostgREST needs table privileges as well as policies. Deliberately NOT
-- granted to anon: this data never leaves an authenticated agency session.
grant select, insert, update, delete on public.venue_pipeline to authenticated, service_role;
grant select, insert, update, delete on public.activity_log   to authenticated, service_role;

-- Confirm what landed.
select tablename,
       (select count(*) from pg_policies p where p.tablename = t.tablename) as policies
from pg_tables t
where schemaname = 'public' and tablename in ('venue_pipeline','activity_log');
