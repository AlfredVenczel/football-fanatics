# Football Fanatics latest update

This is the latest clean app bundle. It includes:

- Supabase login with Editor and Viewer access
- 48 match records from the shared database
- Full team table on the Dashboard
- Hungarian labels: Tablazat, Merkozesek, Jatekosok, Szezon, Datum, Sorozat, Ellenfel, Allas, Eredmeny, Jatszott, Gol
- Hungarian team table abbreviations: J, Gy, D, V, RG, KG, GA, Pont
- Clickable player rows and player detail pages
- Add season and Add match inside a player profile
- Editable player summaries and player match records
- W green, D yellow, L red
- Card icons only in the player-history table header

## GitHub upload

Inside your existing repository, upload and replace:

- `src/main.js`
- `src/styles.css`
- `src/players.json`
- `src/player_matches.json`
- `src/standings.json`

Keep `src/lib/supabase.js`, `index.html`, `package.json`, and `vercel.json`.

## Supabase

If you already ran the previous player migration, do not run it again. If not, run the earlier `players_migration.sql` and `seed_players.sql` first. Run `supabase/player_seasons_migration.sql` once for the Add season button.

## Deploy

Commit the files to the `main` branch. Vercel should redeploy automatically. If not, open the latest deployment and choose Redeploy.
