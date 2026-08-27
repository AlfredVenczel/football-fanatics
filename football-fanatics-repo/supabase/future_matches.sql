-- Run once in Supabase SQL Editor to allow future/unplayed matches.
-- The app uses U for upcoming matches. Existing W/D/L records remain unchanged.

alter table public.matches drop constraint if exists matches_result_check;
alter table public.matches add constraint matches_result_check
  check (result is null or result in ('W', 'D', 'L', 'U'));
