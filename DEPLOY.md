# FuelTrack 365 — Deployment Guide

## Overview
This is a clean rebuild of FuelTrack. Deploy to Vercel, point at your existing Supabase project.

---

## Step 1: Run the Supabase Migration

1. Go to: https://supabase.com/dashboard/project/laayhugawivxyphystpj/sql/new
2. Open `SUPABASE_MIGRATION.sql` from this zip
3. Paste the full contents into the SQL editor
4. Click **Run**
5. Confirm "Success. No rows returned"

The migration is safe to run on your existing database — it uses `IF NOT EXISTS` and `DROP POLICY IF EXISTS` so it won't break existing data.

---

## Step 2: Deploy to Vercel (New Project)

Since this is a fresh codebase, create a **new Vercel project** called `fueltrack365`.

### Option A — Deploy via GitHub (Recommended)

1. Create a new GitHub repo: `github.com/dppotter2/fueltrack365`
2. Push this code:
   ```bash
   cd ~/Downloads/fueltrack365
   git init
   git add .
   git commit -m "initial: FuelTrack 365 clean build"
   git remote add origin https://github.com/dppotter2/fueltrack365.git
   git push -u origin main
   ```
3. Go to https://vercel.com/new
4. Import `fueltrack365` repo
5. Add environment variables (see Step 3)
6. Deploy

### Option B — Vercel CLI

```bash
cd ~/Downloads/fueltrack365
npm install -g vercel
vercel --prod
```

---

## Step 3: Environment Variables in Vercel

Add these in Vercel → Project → Settings → Environment Variables:

| Variable | Value |
|----------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://laayhugawivxyphystpj.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | (from Supabase → Settings → API → anon key) |
| `ANTHROPIC_API_KEY` | (your Anthropic API key — rotate if ending in `5SeAAA`) |

---

## Step 4: Terminal Command (Zip Deploy)

If you received this as a zip file `fueltrack365.zip`:

```bash
cd ~/Downloads
unzip -o fueltrack365.zip -d fueltrack365
cd fueltrack365
git init
git add .
git commit -m "initial: FuelTrack 365 clean build"
git remote add origin https://github.com/dppotter2/fueltrack365.git
git push -u origin main
```

---

## What Changed vs Old FuelTrack

| Old | New (365) |
|-----|-----------|
| 87KB log page with dead modal code | Clean 4KB log page |
| 86KB recipes page with hidden buttons | Clean 5KB recipes page |
| Multiple API routes for different things | Single `/api/chat` does everything |
| Chat was a secondary feature | Chat IS the app |
| Broken builds from JSX editing | Fresh clean code, no cruft |
| No editable goals | Profile page with editable macro goals |
| log page doesn't refresh after chat log | `window.dispatchEvent('fueltrack:refresh')` |

---

## How Deployments Work Going Forward

Every push to `main` → Vercel auto-builds in ~30 seconds.

```bash
cd ~/Downloads/fueltrack365
git add .
git commit -m "your message"
git push
```

---

## File Structure

```
app/
├── auth/page.tsx          — Login/signup
├── (app)/
│   ├── layout.tsx         — Nav + Claude chat bubble (THE CORE)
│   ├── log/page.tsx       — Daily food log
│   ├── trends/page.tsx    — Charts + weight tracking
│   ├── recipes/page.tsx   — Recipe library
│   └── profile/page.tsx   — Goals + stats
├── api/
│   ├── chat/route.ts      — Claude AI brain (Haiku + web search)
│   ├── log-food/route.ts  — Insert/delete food entries
│   └── export/route.ts    — CSV data export
lib/
├── types.ts               — TypeScript interfaces
├── supabase-browser.ts    — Browser Supabase client
├── supabase-server.ts     — Server Supabase client
├── known-products.ts      — Hardcoded product macros
└── categorize.ts          — Food/drink categorization
```

---

## Adding Icons (PWA)

The `public/manifest.json` references `/icon-192.png` and `/icon-512.png`.
Add these PNG files to the `public/` folder to complete PWA setup.
A gold ✦ on dark background works well.
