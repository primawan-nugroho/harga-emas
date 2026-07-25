# 🪙 Harga Emas — Daily Gold Price → Instagram Automation

Fetches Indonesian gold prices for **IndoGold** and **Antam** (via IndoGold's own comparison
pricelist — see note below), computes an insightful comparison (buy/buyback spread, day-over-day
change, best vendor), renders a branded 1080×1350 image, writes a Bahasa Indonesia caption, and
auto-publishes to Instagram via the Graph API. Runs daily on Vercel Cron at 09:00 WIB.

## Data source note
Antam/Logam Mulia's own site (`logammulia.com`) sits behind Akamai bot protection that returns a
403 to every datacenter-IP request tested — curl, headless Chromium, Vercel serverless, and GitHub
Actions runners were all blocked (confirmed 2026-07-25). Instead, the "antam" vendor is sourced
through **IndoGold's own comparison pricelist endpoint**, which already surfaces a live Antam quote
alongside IndoGold's — same live market data, just reached through a reseller's book instead of the
manufacturer's own site. This is reflected in the "Antam (via IndoGold)" label in the caption/image.

## Stack
Next.js (App Router) + TypeScript on Vercel · `next/og` for image rendering · Vercel Blob for
snapshot + PNG storage · Instagram Graph API for publishing.

## Layout
```
app/api/render/route.tsx  – live data → PNG (Instagram portrait)
app/api/cron/run/route.ts – daily orchestrator (CRON_SECRET, DRY_RUN aware)
app/api/ingest/route.ts   – manual/external snapshot ingest (merges into a day's snapshot)
lib/scrapers/indogold-client.ts – shared IndoGold session/token + pricelist client
lib/scrapers/indogold.ts  – "indogold" vendor (behind GoldSource)
lib/scrapers/antam.ts     – "antam" vendor, via the same IndoGold client (behind GoldSource)
lib/analyze.ts            – spreads, deltas, insights (descriptive only)
lib/caption.ts            – caption + hashtags + disclaimer
lib/instagram.ts          – Graph API container → publish
lib/meta-token.ts         – long-lived IG token refresh (+ optional Vercel env auto-update)
lib/pipeline.ts           – fetch → merge into store → analyze → caption
lib/store.ts              – local FS (dev) / Vercel Blob (prod)
vercel.ts                 – cron schedule (daily post 09:00 WIB, token refresh every 30 days)
```

## Local dev
```bash
npm install
npm run scrape        # verify scrapers against live sites (prints JSON)
npm run test          # analyze unit tests
npm run dev           # http://localhost:3000/api/render for image preview
```

## Before going live
1. **Meta setup** — IG Business/Creator acct + FB Page + Meta app with `instagram_content_publish`;
   get a long-lived `IG_ACCESS_TOKEN` (refresh before ~60-day expiry — `/api/cron/refresh-token`
   handles this automatically if `VERCEL_API_TOKEN`/`VERCEL_PROJECT_ID` are set).
2. **Env** — copy `.env.example` → set secrets in Vercel (never commit).
3. **Dry run first** — keep `DRY_RUN=true`; the cron renders + notifies via Telegram without posting.
   Flip to `DRY_RUN=false` only after a test IG account works end-to-end.

## Guardrails
- Posts present data + descriptive trends only — **no investment advice** — with a disclaimer line.
- `/api/cron/run` refuses to publish if either vendor's fetch failed that run (returns 202
  "skipped" instead of posting a misleading one-vendor "comparison").
