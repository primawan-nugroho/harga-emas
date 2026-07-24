# 🪙 Harga Emas — Daily Gold Price → Instagram Automation

Fetches Indonesian gold prices from **IndoGold** and **Logam Mulia (ANTAM)**, computes an
insightful comparison (buy/buyback spread, day-over-day change, best vendor), renders a branded
1080×1350 image, writes a Bahasa Indonesia caption, and auto-publishes to Instagram via the Graph
API. Runs daily on Vercel Cron.

## Stack
Next.js (App Router) + TypeScript on Vercel · `next/og` for image rendering · Vercel Blob for
snapshot + PNG storage · Instagram Graph API for publishing.

## Layout
```
app/api/render/route.tsx  – live data → PNG (Instagram portrait)
app/api/cron/run/route.ts – daily orchestrator (CRON_SECRET, DRY_RUN aware)
app/api/ingest/route.ts   – snapshot ingest for the Playwright fallback
lib/scrapers/*            – indogold.ts, logammulia.ts (behind GoldSource)
lib/analyze.ts            – spreads, deltas, insights (descriptive only)
lib/caption.ts            – caption + hashtags + disclaimer
lib/instagram.ts          – Graph API container → publish
lib/pipeline.ts           – fetch → persist → analyze → caption
lib/store.ts              – local FS (dev) / Vercel Blob (prod)
vercel.ts                 – cron schedule (09:30 WIB)
```

## Local dev
```bash
npm install
npm run scrape        # verify scrapers against live sites (prints JSON)
npm run test          # analyze unit tests
npm run dev           # http://localhost:3000/api/render for image preview
```

## Before going live
1. **Verify scraper endpoints** — both sites load via JS; confirm the JSON endpoints / selectors in
   `lib/scrapers/*` against the live Network tab. See TODOs there.
2. **Meta setup** — IG Business/Creator acct + FB Page + Meta app with `instagram_content_publish`;
   get a long-lived `IG_ACCESS_TOKEN` (refresh before ~60-day expiry).
3. **Env** — copy `.env.example` → set secrets in Vercel (never commit).
4. **Dry run first** — keep `DRY_RUN=true`; the cron renders + notifies via Telegram without posting.
   Flip to `DRY_RUN=false` only after a test IG account works end-to-end.

## Guardrail
Posts present data + descriptive trends only — **no investment advice** — with a disclaimer line.
