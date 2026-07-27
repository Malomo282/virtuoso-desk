-- Virtuoso Desk — indexes for the queries the app actually runs.
--
-- Postgres indexes primary keys automatically but not foreign keys, so every
-- lookup below is currently a sequential scan. That is invisible at today's
-- row counts and becomes the dominant cost as the roster and booking history
-- grow. Safe to run at any time; CREATE INDEX IF NOT EXISTS is idempotent.
--
-- Run in Supabase → SQL Editor.

-- Conflict detection on every booking create and reschedule, plus the artist's
-- own booking list. Partial: cancelled rows are excluded from all of it.
create index if not exists idx_bookings_artist_starts
  on public.bookings (artist_id, starts_at)
  where cancelled_at is null;

-- Calendar and reminder sweeps scan by date across all artists.
create index if not exists idx_bookings_starts_at
  on public.bookings (starts_at)
  where cancelled_at is null;

create index if not exists idx_bookings_venue
  on public.bookings (venue_id);

-- The completed-gigs page and invoice generation both filter on status.
create index if not exists idx_bookings_brag_status
  on public.bookings (brag_status)
  where cancelled_at is null;

-- The unread badge polls this on every portal page. Partial index keeps it
-- tiny: only unread rows are ever counted.
create index if not exists idx_notifications_user_unread
  on public.notifications (user_id)
  where read = false;

create index if not exists idx_notifications_user
  on public.notifications (user_id);

-- Gig responses are looked up both ways: by artist (their own answers) and by
-- gig (who has put a hand up).
create index if not exists idx_gig_responses_artist
  on public.gig_responses (artist_id);

create index if not exists idx_gig_responses_gig
  on public.gig_responses (gig_id);

-- Artists only ever see open gigs.
create index if not exists idx_available_gigs_status_starts
  on public.available_gigs (status, starts_at);

-- Blackout checks run on every booking create and reschedule.
create index if not exists idx_artist_availability_artist_date
  on public.artist_availability (artist_id, date);

-- Document and paperwork lookups.
create index if not exists idx_artist_documents_artist
  on public.artist_documents (artist_id);

create index if not exists idx_agreements_booking
  on public.agreements (booking_id);

create index if not exists idx_invoices_booking
  on public.invoices (booking_id);

-- The RLS policies themselves call this on nearly every request.
create index if not exists idx_artists_user
  on public.artists (user_id);

-- Confirm what landed.
select indexname, tablename
from pg_indexes
where schemaname = 'public' and indexname like 'idx_%'
order by tablename, indexname;
