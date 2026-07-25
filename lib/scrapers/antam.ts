import type { GoldSource, VendorPrices } from "../types";
import { nowJakartaISO } from "../time";
import { fetchComparisonPricelist, parseRp } from "./indogold-client";

/**
 * Antam price — blended from two sources:
 *
 *   - Buy price + size ladder: emasantam.id's official daily price page
 *     (https://emasantam.id/harga-emas-antam-harian/), specifically the
 *     "Harga Emas ANTAM Certicard Fine Gold Bar 999.9 — Area JABODETABEK"
 *     table (per-butik price, uniform across all Jabodetabek butik at a
 *     given gramasi). The page embeds this table's HTML via a plain,
 *     unprotected JSON-free include at /content/lm.txt — no bot protection
 *     (verified 2026-07-25).
 *
 *   - Buyback: emasantam.id publishes no buyback/sell price at all, so this
 *     falls back to IndoGold's "comparison_antamxubs" pricelist, which
 *     quotes a live Antam buyback figure alongside its own (secondary
 *     sourcing, confirmed with the user as an acceptable trade-off since no
 *     official public Antam buyback feed exists).
 *
 * (Earlier version of this scraper used emasantam.id's COD delivery pricing
 * API instead, which includes a delivery-service margin on top of the base
 * butik price — this JABODETABEK table is the more direct "shelf" price.
 * logammulia.com itself remains unreachable from every datacenter IP
 * tested: curl, headless Chromium, Vercel, GitHub Actions.)
 */

const PRICE_TABLE_URL = "https://emasantam.id/content/lm.txt?q=123";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0 Safari/537.36";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * emasantam.id intermittently 403s (observed on Vercel's egress, not
 * consistent — a retry from the same host often succeeds seconds later).
 * A couple of quick retries costs little and avoids falling back to a
 * stale cached price for a transient blip.
 */
async function fetchPriceTableWithRetry(attempts = 3): Promise<Response> {
  let lastRes: Response | undefined;
  for (let i = 0; i < attempts; i++) {
    const res = await fetch(PRICE_TABLE_URL, { headers: { "User-Agent": UA, Accept: "text/html" } });
    if (res.ok) return res;
    lastRes = res;
    if (i < attempts - 1) await sleep(1500 * (i + 1));
  }
  return lastRes!;
}

/** Extract the JABODETABEK section's gramasi -> price (first butik column). */
function parseJabodetabekLadder(html: string): Record<string, number> {
  const start = html.indexOf("JABODETABEK");
  if (start < 0) throw new Error("antam: JABODETABEK section not found (site changed?)");
  const end = html.indexOf("Jawa &amp; Bali", start);
  const section = end > start ? html.slice(start, end) : html.slice(start);

  const sizes: Record<string, number> = {};
  const rowRe = /<td class="ar">([\d.]+)<\/td>\s*<td class="ar">Rp ([\d.]+)/g;
  let m: RegExpExecArray | null;
  while ((m = rowRe.exec(section))) {
    const gramasi = m[1];
    const price = Number(m[2].replace(/\./g, ""));
    if (price > 0) sizes[gramasi] = price;
  }
  return sizes;
}

export const antam: GoldSource = {
  name: "antam",
  async fetchPrices(): Promise<VendorPrices> {
    const [tableRes, comparison] = await Promise.all([
      fetchPriceTableWithRetry(),
      fetchComparisonPricelist(),
    ]);

    if (!tableRes.ok) throw new Error(`antam: emasantam.id price table ${tableRes.status}`);
    const html = await tableRes.text();
    const sizes = parseJabodetabekLadder(html);
    const pricePerGram = sizes["1"];
    if (!pricePerGram) throw new Error("antam: 1g JABODETABEK price not found (site changed?)");

    let buyback: number | undefined;
    if (comparison.status && comparison.data) {
      buyback = parseRp(comparison.data.data_denom["1.0"]?.Antam?.harga_buyback);
    }
    if (!buyback) throw new Error("antam: buyback fallback (via IndoGold) unavailable");

    if (!(pricePerGram > 0) || !(buyback > 0)) {
      throw new Error(`antam: implausible prices: buy=${pricePerGram} buyback=${buyback}`);
    }

    return {
      vendor: "antam",
      pricePerGram,
      buyback,
      sizes,
      fetchedAt: nowJakartaISO(),
    };
  },
};
