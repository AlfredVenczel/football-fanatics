-- Run once in Supabase SQL Editor.
-- This makes the app readable without login while keeping writes editor-only.

grant select on table public.matches, public.players, public.player_match_stats, public.seasons, public.player_seasons to anon;

alter table public.matches enable row level security;
alter table public.players enable row level security;
alter table public.player_match_stats enable row level security;
alter table public.seasons enable row level security;
alter table public.player_seasons enable row level security;

drop policy if exists "public can read matches" on public.matches;
create policy "public can read matches" on public.matches for select to anon using (true);

drop policy if exists "public can read players" on public.players;
create policy "public can read players" on public.players for select to anon using (true);

drop policy if exists "public can read player match stats" on public.player_match_stats;
create policy "public can read player match stats" on public.player_match_stats for select to anon using (true);

drop policy if exists "public can read seasons" on public.seasons;
create policy "public can read seasons" on public.seasons for select to anon using (true);

drop policy if exists "public can read player seasons" on public.player_seasons;
create policy "public can read player seasons" on public.player_seasons for select to anon using (true);

