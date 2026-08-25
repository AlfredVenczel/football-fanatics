# Football Fanatics controls update

Adds:
- Dashboard title `Tablazat` and an `Uj szezon` button.
- Players title `Jatekosok`, an `Uj jatekos` button, and `Mez szam` after `Jatekos`.
- Jersey numbers loaded from the Excel player sheet.
- Existing clickable player profiles and per-season match records.
- Existing editor-only controls and W/D/L colors.
- Card icons only in the player-history header.

Replace inside the existing `football-fanatics-repo`:
- `src/main.js`
- `src/styles.css`
- `src/players.json`
- `src/player_matches.json`
- `src/standings.json`

Keep `src/lib/supabase.js`, `index.html`, `package.json`, and `vercel.json`.

In Supabase SQL Editor, run `supabase/player_and_season_controls.sql` once. It adds jersey numbers, named card columns, and the seasons table needed by `Uj szezon`.

Commit to `main`; Vercel should redeploy automatically.
