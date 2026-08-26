# Football Fanatics phone-friendly update

This package keeps the public viewer and Alfred-only editor access, then adds a mobile-first layout:

- compact navigation and logos on small screens
- 44px touch targets for buttons, links, selects, and forms
- responsive controls that stack cleanly
- intentional horizontal scrolling for wide stat tables, with a swipe hint
- dialogs and editor forms constrained to the phone viewport
- readable headers and spacing at 320px and up

To update the existing GitHub/Vercel app, replace the repository contents with this folder, commit to `main`, and let Vercel redeploy. The existing Supabase public-viewer SQL remains included under `supabase/public-viewer.sql`.

Only the authenticated `editor` role can add, edit, or delete data. Public visitors can view the app without signing in.
