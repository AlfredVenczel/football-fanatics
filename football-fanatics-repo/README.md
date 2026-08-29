# Football Fanatics live Tabella update

This package keeps the public viewer and Alfred-only editor access.

- Tabella builds the league table live from League matches in the selected season, including new seasons such as 2026/2027. For 2024/2025 it also shows a separate Play out table above the main table.
- Teams are sorted automatically by Pont, then GA (goal difference), then RG (goals scored), with # assigned after sorting.
- Future matches with status U are included as teams but do not count in J, Gy, D, V, RG, KG, GA, or Pont.
- The next scheduled match for the selected season appears above the table.
- Existing Csapatok, editable match records, player profiles, player-match delete, and Bajnoksag/Kupa editing remain included.

Replace the repository contents in GitHub, commit to `main`, and let Vercel redeploy. Editors can click **Tabella adat** beside each team and manually enter J, Gy, D, V, RG, KG, and Pont. The 2024/2025 Play out table has its own **Play out csapat hozzaadasa** button so you can enter the seven teams manually. Each Play out row has its own **Tabella adat** button. The button uses delegated click handling so it remains active after the season table redraws. Manual values override calculated match totals for that team and season, so you do not need to store every league result. Run the updated `supabase/teams_and_match_details.sql` once. It fixes the duplicate-name error by allowing the same team in regular season and Play out for the same season to add the manual-stat columns.


Manual team statistics are stored per team and season. Pont is calculated as Gy × 3 + D. GA is calculated as RG minus KG by default, and Pont defaults to Gy × 3 + D. Both GA inputs, including KG/RG, and Pont can be entered manually. The table sorts by Pont, GA, and RG.


The Jatekosok match history now shows only Datum, not Ora. Match time remains available on Merkozesek and Csapatok where needed.


New player-match records now generate a unique ID automatically, fixing the Supabase null `id` error when adding an imported missing match.


Jatekosok Minden szezon nézet uses the saved player totals from `players` as the authority, so duplicate or supplemental player-match rows do not inflate the all-season totals.


Player totals are now derived from the player's match records. In Jatekosok, editors can change only Mez szam. Adding, editing, or deleting a match from Jatekos adatlap recalculates Jatszott and Gol by competition and updates the league/cup totals in the players table automatically. Total Gol is calculated from those values.


Jatekosok Minden szezon now sorts players by latest active season first, newest season to oldest: 2026/2027, 2025/2026, then 2024/2025. The selected statistic sort is used inside each season group.


Vercel Web Analytics is wired into the Vite entry point with `@vercel/analytics`. After deploying this version, open the production URL once, then allow about 30 seconds for the first page view to appear. Preview deployments are not the right place to check production analytics.
