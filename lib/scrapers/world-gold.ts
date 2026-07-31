import type { WorldPrice } from "../types";
import { nowJakartaISO } from "../time";

/**
 * International gold reference price, converted to IDR/gram — lets the post
 * show each vendor's premium over "what gold should cost", not just the
 * local number in isolation.
 *
 * Both sources are free, keyless, and were verified working 2026-07-30:
 *   - Gold: Yahoo Finance chart API for GC=F (COMEX gold futures). This is
 *     a close proxy for spot, not identical (contango) — never call it
 *     "spot" in copy, use "acuan COMEX".
 *   - FX: exchangerate-api.com's free endpoint for USD/IDR.
 *
 * Optional data source: unlike the vendor scrapers, a failure here must
 * never block the daily post (see pipeline.ts) — the world-price lines are
 * a nice-to-have, not a requirement.
 */

const TROY_OUNCE_IN_GRAMS = 31.1034768;
const GOLD_URL = "https://query1.finance.yahoo.com/v8/finance/chart/GC=F?interval=1d&range=5d";
const FX_URL = "https://api.exchangerate-api.com/v4/latest/USD";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0 Safari/537.36";

export async function fetchWorldPrice(): Promise<WorldPrice> {
  const [goldRes, fxRes] = await Promise.all([
    fetch(GOLD_URL, { headers: { "User-Agent": UA, Accept: "application/json" } }),
    fetch(FX_URL, { headers: { Accept: "application/json" } }),
  ]);

  if (!goldRes.ok) throw new Error(`world-gold: Yahoo GC=F ${goldRes.status}`);
  if (!fxRes.ok) throw new Error(`world-gold: exchangerate-api ${fxRes.status}`);

  const goldJson = (await goldRes.json()) as {
    chart?: { result?: Array<{ meta?: { regularMarketPrice?: number } }> };
  };
  const usdPerOz = goldJson.chart?.result?.[0]?.meta?.regularMarketPrice;
  if (!usdPerOz || !(usdPerOz > 0)) {
    throw new Error("world-gold: regularMarketPrice missing from Yahoo response");
  }

  const fxJson = (await fxRes.json()) as { rates?: Record<string, number> };
  const usdIdr = fxJson.rates?.IDR;
  if (!usdIdr || !(usdIdr > 0)) {
    throw new Error("world-gold: IDR rate missing from exchangerate-api response");
  }

  return {
    usdPerOz,
    usdIdr,
    idrPerGram: (usdPerOz * usdIdr) / TROY_OUNCE_IN_GRAMS,
    fetchedAt: nowJakartaISO(),
  };
}
