# Align

A calm command center for ADHD founders — weekly horizontal planner, focus lane, brain dump, daily closure. Built with Next.js + Supabase. Installable on phone and desktop as a PWA, with optional daily PDF push to a reMarkable tablet.

```
align/
├── app/                          Next.js routes
├── components/AlignApp.jsx       Main app (the React component)
├── lib/                          Supabase clients + storage hook
├── public/                       PWA manifest, service worker, icons
├── supabase/schema.sql           Database schema (run once)
└── scripts/push-to-remarkable/   Optional: daily PDF push script
```

---

## Step-by-step setup

### 1. Get the code into a repo

```bash
git init
git add .
git commit -m "Initial commit"
# Create a new private repo on GitHub, then:
git remote add origin git@github.com:YOUR_USERNAME/align.git
git branch -M main
git push -u origin main
```

### 2. Create a Supabase project

1. Sign up at [supabase.com](https://supabase.com) — free tier is enough.
2. Click **New project**. Name it `align`. Choose a region near you. Pick a strong database password (save it; you won't need it daily, but save it).
3. Wait ~2 minutes for it to provision.

### 3. Run the schema

In your Supabase dashboard:

1. **SQL Editor** → **New query**.
2. Open `supabase/schema.sql` in this repo, copy the entire contents, paste into the editor, click **Run**.
3. You should see `Success. No rows returned.`

This creates the `tasks`, `brain_dump`, and `stats` tables, sets up row-level security (each user only sees their own data), and enables real-time sync.

### 4. Configure auth

In Supabase: **Authentication → Providers**. Email should already be enabled. Scroll to **Site URL** under **Authentication → URL Configuration**:

- **Site URL**: `http://localhost:3000` for now (we'll change after deploying)
- **Redirect URLs**: add `http://localhost:3000/auth/callback`

### 5. Grab your API keys

**Settings → API**. Copy:

- **Project URL** → goes into `NEXT_PUBLIC_SUPABASE_URL`
- **anon public** key → goes into `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### 6. Run locally

```bash
cp .env.local.example .env.local
# paste your URL and anon key into .env.local
npm install
npm run dev
```

Open [localhost:3000](http://localhost:3000). You'll be redirected to `/login`. Enter your email, click the magic link in your inbox, and you're in.

Add a task, open and close the brain dump (B), enter the focus lane on a task. Open the same URL in a second browser window logged in as the same user — changes sync live. That's it working.

### 7. Deploy to Vercel

1. Sign up at [vercel.com](https://vercel.com) and connect your GitHub.
2. Click **Add New → Project**, select your `align` repo, click **Import**.
3. In **Environment Variables**, add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` with the same values from `.env.local`.
4. Click **Deploy**. After about 90 seconds you'll have a URL like `align-yourname.vercel.app`.

Now go back to Supabase, **Authentication → URL Configuration**, and update:

- **Site URL**: `https://align-yourname.vercel.app`
- **Redirect URLs**: add `https://align-yourname.vercel.app/auth/callback`

(Optional: in Vercel, **Settings → Domains**, add your own domain.)

### 8. Install on your devices

**iPhone / iPad** — open Safari, navigate to your URL, tap the share button, scroll down, **Add to Home Screen**. The Align icon appears on your home screen and opens fullscreen, no browser chrome.

**Android** — open Chrome, navigate to your URL, tap the three-dot menu, **Install app** (or **Add to Home Screen**, depending on Android version).

**macOS / Windows / Linux desktop** — in Chrome or Edge, navigate to your URL. You'll see an install icon in the address bar (looks like a monitor with a down arrow). Click it. Align installs as a standalone app — it shows up in Spotlight / Start Menu / Activities like any native app, runs in its own window, has its own dock icon.

### 9. Sign in once on each device

The PWA shares cookies with Safari/Chrome, so if you signed in via the browser, you'll already be signed in. If you installed before signing in, just enter your email and click the magic link.

That's the core app done. Everything syncs in real time across all your devices, end-to-end.

---

## Optional: reMarkable PDF push

If you want today's plan to show up on your reMarkable each morning, set up the push script. **See `scripts/push-to-remarkable/README.md` for setup.** Be honest with yourself first about whether you'll actually use it — it's a one-way push, marks you make on the reMarkable don't sync back. Useful for "morning glance at the tablet" workflows; not useful if you wanted to capture tasks on the reMarkable.

---

## Tech and conventions

- **Next.js 14, App Router.** Server components for auth, client components for everything interactive.
- **Supabase.** PostgreSQL + auth + real-time subscriptions. Row-level security means each user only ever queries their own rows.
- **Tailwind** for layout utilities, but most styling is inline CSS-in-JS to keep one component visually self-contained. This isn't a "Tailwind app" — it's a React app that happens to use Tailwind for grid and flex.
- **Fraunces** (variable serif) + **Inter Tight** loaded from Google Fonts via `@import`. No font CDN config needed.
- **No external state management.** A single `useStorage()` hook owns everything (user, tasks, brain dump, stats) and exposes mutation functions. Optimistic updates everywhere — UI moves instantly, Supabase catches up in the background.
- **PWA** via a hand-written service worker (`public/sw.js`) — not next-pwa. Simpler, easier to read, no build-time magic.

## Cost

- **Supabase free tier**: 500MB database, 2GB bandwidth, unlimited API requests, 50,000 monthly active users. You will not exceed this.
- **Vercel free tier**: unlimited deployments, 100GB bandwidth/month. You will not exceed this.

Total monthly cost for personal use: **$0**.

## Common issues

**"Magic link doesn't work" / "redirected back to /login"** — your Site URL or Redirect URLs in Supabase don't match where you're actually running. Re-check step 4 and step 7.

**"Service worker not registering"** — check the browser console. SW only registers over HTTPS or on `localhost`. If you're testing on a phone over your LAN, you'll need to either use `localhost` via port forwarding or deploy to Vercel first.

**"Tasks don't sync between devices in real time"** — make sure you ran the entire schema. The `alter publication supabase_realtime add table ...` lines at the bottom are required for real-time.

**"Sign-in works but I see no tasks on a second device"** — refresh once. Real-time subscribes after initial load; the first load on a new device fetches normally.

## Extending

The code is straightforward — single component file for the UI (`components/AlignApp.jsx`), single hook for all data (`lib/useStorage.js`). To add a feature:

- New task field? Add a column to the SQL, add it to the row mapping in `useStorage.js`, expose it in the UI.
- Subtasks? Add a `parent_id` column to `tasks`, update the grouping logic.
- Tags or projects? New table, new query, new UI slot.

Have fun.
