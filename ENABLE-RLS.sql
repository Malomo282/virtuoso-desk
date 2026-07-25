-- Virtuoso Desk — enable Row Level Security on the three tables that are
-- currently readable with the public anon key.
--
-- Context: the anon key ships inside the browser bundle, so it is public by
-- definition. Any of these tables without RLS can be read by anyone who opens
-- devtools on the site. The stored FILES are safe (both storage buckets are
-- private and only served via short-lived signed URLs) — this is about the
-- table rows: fee figures, document file names, artist ids.
--
-- Safe to run: the app's API routes use the service role key, which bypasses
-- RLS entirely, so /api/agreements, /api/artist-documents and /api/notify are
-- unaffected. The browser-side reads that remain (agency invoices page, agency
-- roster compliance badges, artist document list) are all covered by the
-- policies below. Verified beforehand that profiles.role is populated
-- ('agency' for jesseappiah28@gmail.com, 'artist' for the roster artist), so
-- these role checks will not lock anyone out.
--
-- Run in Supabase → SQL Editor.

-- Helper predicates are inlined rather than defined as functions to keep this
-- a single self-contained script.

-- ---------------------------------------------------------------- invoices --
-- Agency-only: artists must never see venue fees or agency margin.
alter table public.invoices enable row level security;

drop policy if exists "agency manages invoices" on public.invoices;
create policy "agency manages invoices"
  on public.invoices for all to authenticated
  using      (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'agency'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'agency'));

-- -------------------------------------------------------------- agreements --
-- Agency sees everything; an artist sees only their own contracts/riders.
alter table public.agreements enable row level security;

drop policy if exists "agency manages agreements" on public.agreements;
create policy "agency manages agreements"
  on public.agreements for all to authenticated
  using      (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'agency'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'agency'));

drop policy if exists "artists read own agreements" on public.agreements;
create policy "artists read own agreements"
  on public.agreements for select to authenticated
  using (artist_id in (select a.id from public.artists a where a.user_id = auth.uid()));

-- --------------------------------------------------------- artist_documents --
-- Identity documents. An artist manages only their own row; the agency has
-- read access because UK right-to-work verification requires it.
alter table public.artist_documents enable row level security;

drop policy if exists "artists manage own documents" on public.artist_documents;
create policy "artists manage own documents"
  on public.artist_documents for all to authenticated
  using      (artist_id in (select a.id from public.artists a where a.user_id = auth.uid()))
  with check (artist_id in (select a.id from public.artists a where a.user_id = auth.uid()));

drop policy if exists "agency reads documents" on public.artist_documents;
create policy "agency reads documents"
  on public.artist_documents for select to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'agency'));

-- ------------------------------------------------------------------ check --
-- After running, confirm rowsecurity = true for all three:
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in ('invoices', 'agreements', 'artist_documents');
