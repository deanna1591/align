# Align → reMarkable: daily PDF push

A small Node script that turns your today's tasks into a clean PDF and uploads it to your reMarkable tablet. **One-way push, not real-time sync.** You see today's plan on the reMarkable each morning; you still check things off on phone or desktop.

## What you need

- The Align app already deployed and you've signed in at least once
- A reMarkable tablet (any model, Gen 1/2/Pro all work via `rmapi`)
- Node.js 20+ on whatever machine will run this (laptop, home server, Raspberry Pi)
- About 10 minutes

## Setup

### 1. Install `rmapi`

`rmapi` is the unofficial CLI that talks to reMarkable's cloud. Install from [github.com/ddvk/rmapi](https://github.com/ddvk/rmapi). On macOS with Homebrew:

```bash
brew install rmapi
```

On Linux, grab the binary from the GitHub releases page.

### 2. Pair `rmapi` with your reMarkable

Run `rmapi` once with no arguments. It will print a URL — visit it on a logged-in browser, copy the one-time code, paste it back. This stores credentials in `~/.config/rmapi/rmapi.conf` and you won't need to do it again.

Verify pairing works:

```bash
rmapi ls
```

You should see the file listing from your reMarkable.

### 3. Get your Supabase service role key

In your Supabase dashboard: **Settings → API → service_role**. Copy it. **This is sensitive** — treat it like a password. It bypasses row-level security, which is fine for a server-side script.

### 4. Configure this script

```bash
cd scripts/push-to-remarkable
cp .env.example .env
# Edit .env and fill in SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ALIGN_USER_EMAIL
npm install
```

### 5. Test it

```bash
npm run push
```

Within a few seconds you should see `Pushed /tmp/.../align-2026-05-12.pdf → reMarkable:/Align/`. Open your reMarkable — the file is in the `Align` folder.

## Automate

### Local cron (simplest)

Edit your crontab (`crontab -e`) and add a line like this for a 6:30am push every morning:

```
30 6 * * * cd /full/path/to/scripts/push-to-remarkable && /usr/local/bin/node push.js >> ~/align-push.log 2>&1
```

Use `which node` to find the right path. The log file is so you can debug if something stops working.

### GitHub Actions (no local machine needed)

If you don't want a machine on at 6:30am, you can run this from GitHub Actions on a schedule. You'll need to:

1. Copy `~/.config/rmapi/rmapi.conf` into a GitHub Actions secret called `RMAPI_CONFIG`
2. Add `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ALIGN_USER_EMAIL` as secrets too
3. Create `.github/workflows/push-remarkable.yml` with a scheduled cron trigger

I haven't included the workflow file here because the details depend on where you put the script in your repo. Ping me and I'll write it for your specific layout.

## What's in the PDF

- The day of the week, big
- Today's three (auto-prioritized: in-motion first, then the rest)
- All today's tasks with empty checkboxes (so you can mark them on the device with the stylus — these marks won't sync back, they're just visual)
- The latest 20 brain-dump items, for reference

The PDF is plain text in serif type, sized for comfortable reading at the reMarkable's native zoom. No icons, no fancy styling — just words.

## Caveats

- **One-way.** Marks you make on the reMarkable don't sync back. This is a fundamental reMarkable limitation, not a script limitation.
- **Replaces by default.** Same-named PDFs get replaced on push. If you want a daily archive, change the filename in `push.js` to include the date in the name (`align-${today}` already does this — `rmapi` will append `-1`, `-2` if it sees collisions, but behavior varies by `rmapi` version).
- **rmapi can break.** It's unofficial. If reMarkable changes their cloud API, you may need to update `rmapi`. Pin a version that works.
