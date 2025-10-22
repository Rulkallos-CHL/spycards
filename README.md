# SpyCards — Starter Web Client (HTML/CSS/JS) + Supabase

This repository is a starter implementation for an online turn-taking card game UI using HTML, JS and CSS with Supabase auth & data. It implements these states:

- login (must login/register before anything)
- title (main menu)
- decks & decksModify
- store (buy items)
- playPrep (generate/join/play-code, match)
- play (simulated round)

It also includes:
- Ads carousel (right-hand large box switching every 5s)
- Top bar (game title, user name, SPY-Coin) for selected states
- Basic Supabase integration and DB schema (see supabase.sql)

Security summary:
- Use Supabase Edge Functions or other server-side logic for all privileged operations (purchases, matchmaking, creating play-codes).
- Use RLS (Row-Level Security) policies on Supabase tables.
- Do not embed service_role key in client code. Only the anon public key is safe to use in front-end.

Files included:
- index.html — main page
- styles.css — layout & UI
- supabase.js — supabase client initialization
- app.js — main state & UI logic (demo)
- supabase.sql — DB schema and RLS suggestions
- netlify.toml — recommended Netlify config

How to run locally (quick)
1. Create a Supabase project (see instructions below) and create the DB using supabase.sql.
2. Replace placeholders in supabase.js with your SUPABASE_URL and SUPABASE_ANON_KEY (for local dev only).
3. Serve the folder via a local static server (e.g., `npx http-server` or `live-server`) and open index.html.

Deploying with GitHub + Netlify (recommended)
1. Create a new GitHub repo and push this code.
2. On Netlify, "New site from Git" → connect your GitHub repo → pick branch.
3. Build command: none (static site). Publish directory: root (or ./).
4. In Netlify Site settings → Environment → Add these environment variables:
   - SUPABASE_URL
   - SUPABASE_ANON_KEY
5. (Optional) Create Netlify Functions for server-side actions (purchases, matching) and assign the SUPABASE_SERVICE_ROLE key to Netlify function env (never expose to client).

Supabase setup (high-level)
1. Create a project on app.supabase.com. Save the project URL and anon key.
2. In SQL Editor, run the provided `supabase.sql` to create tables.
3. Configure Row-Level Security (RLS) policies for each table to restrict writes to rightful owners, and use service-role only for trusted server operations.
4. Use Supabase Auth for user registration / login.

Notes / Next improvements
- Implement full card-play UI (drag/drop, turn-taking).
- Use Supabase Realtime or a server push (WebSocket) for low-latency match state updates.
- Move critical logic (match pairing, play-code generation, charging coins) to server (Edge functions) and call them from the client. This ensures atomicity and avoids cheating.
- Add image uploads (cards, ads) to Supabase Storage and serve signed URLs.
- Add strong input validation on client and server, sanitize any free-text fields.

See supabase.sql for table schema and example RLS policies.