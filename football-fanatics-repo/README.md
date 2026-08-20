# Football Fanatics

Vite + Supabase scaffold for the authenticated Football Fanatics match tracker.

## Supabase setup

1. Create a Supabase project.
2. Open SQL Editor and run `supabase/schema.sql`.
3. Create the first user in Authentication > Users, or sign up in the app.
4. Promote Alfred after his account exists:

```sql
update public.profiles
set role = 'editor'
where email = 'alfredvenczel@yahoo.com';
```

Everyone else defaults to `viewer`. The client only uses the publishable key. Never put a service-role key in the browser.

## Local run

```bash
cp .env.example .env.local
npm install
npm run dev
```

Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in `.env.local`.

## Vercel

Import the repository into Vercel, add the two `VITE_` environment variables for Production, Preview, and Development, then deploy. `vercel.json` already points Vercel at Vite's `dist` output.

## Important

The current scaffold includes the auth, role gate, protected match table, and editable UI wiring. The original 48-match workbook data still needs to be inserted into `public.matches`, either with a CSV import or an insert script.
