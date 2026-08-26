# Football Fanatics editable Csapatok update

This package keeps the public viewer and Alfred-only editor access, and adds editable team management:

- **Merkozesek** can be filtered by season
- **Csapatok** lists every opponent with Meccs, Nyert, Dontetlen, Vesztett, RG, KG, and GA
- editors can add a season, add a team to a season, rename a team, add matches for a selected team, and edit match details
- team detail shows Szezon, Datum, Ora, Hazai, Idegen, Eredmeny, and Gol szerzo
- clickable team and player names stay light blue and underlined

Upload/replace the repository contents, then run `supabase/teams_and_match_details.sql` once in Supabase SQL Editor. Commit to `main` and let Vercel redeploy. If you have not already applied public viewer access, also run `supabase/public-viewer.sql`.

Only the authenticated `editor` role can change data. Public visitors can view the app without signing in.
