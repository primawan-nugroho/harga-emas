import type { GoldSource, VendorPrices } from "../types";
import { nowJakartaISO } from "../time";
import { fetchComparisonPricelist, parseRp } from "./indogold-client";

/**
 * Antam price — blended from two sources:
 *
 *   - Buy price + size ladder: emasantam.id's official COD pricing API
 *     (https://cod.emasantam.id/api/config/cod-prices), PT Emas Antam
 *     Indonesia's own public JSON endpoint. No auth, no bot protection
 *     (verified 2026-07-25). This is the real, official Antam price.
 *
 *   - Buyback: emasantam.id publishes no buyback/sell price at all, so this
 *     falls back to IndoGold's "comparison_antamxubs" pricelist, which
 *     quotes a live Antam buyback figure alongside its own (secondary
 *     sourcing, confirmed with the user as an acceptable trade-off since no
 *     official public Antam buyback feed exists).
 *
 * (Earlier version of this scraper sourced the buy price through IndoGold's
 * comparison too, before emasantam.id's official endpoint was found — see
 * git history. logammulia.com itself remains unreachable from every
 * datacenter IP tested: curl, headless Chromium, Vercel, GitHub Actions.)
 */

const COD_API = "https://cod.emasantam.id/api/config/cod-prices?butik=AJK2";

interface CodPriceRow {
  gramasi: number;
  harga: number;
}
interface CodPricesResponse {
  data: CodPriceRow[];
}

export const antam: GoldSource = {
  name: "antam",
  async fetchPrices(): Promise<VendorPrices> {
    const [codRes, comparison] = await Promise.all([
      fetch(COD_API, { headers: { Accept: "application/json" } }),
      fetchComparisonPricelist(),
    ]);

    if (!codRes.ok) throw new Error(`antam: emasantam.id COD API ${codRes.status}`);
    const cod = (await codRes.json()) as CodPricesResponse;
    const oneGramRow = cod.data.find((r) => r.gramasi === 1);
    if (!oneGramRow) throw new Error("antam: 1g row not found in emasantam.id COD prices");
    const pricePerGram = oneGramRow.harga;

    const sizes: Record<string, number> = {};
    for (const row of cod.data) sizes[String(row.gramasi)] = row.harga;

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
