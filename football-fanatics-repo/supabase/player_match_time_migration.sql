-- Run once in Supabase SQL Editor.
-- Enables editing the time field in player match records.

alter table public.player_match_stats
  add column if not exists match_time time;

notify pgrst, 'reload schema';
