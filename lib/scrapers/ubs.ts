import type { GoldSource, VendorPrices } from "../types";
import { nowJakartaISO } from "../time";
import { fetchComparisonPricelist, parseRp } from "./indogold-client";

/**
 * UBS Gold price — blended, same pattern as the "antam" vendor:
 *
 *   - Buy price: ubslifestyle.com's official product page for the 1g bar
 *     (https://ubslifestyle.com/fine-gold-1gram/), UBS's own e-commerce
 *     storefront. No bot protection (verified 2026-07-25). Parsed from the
 *     standard schema.org `<meta itemprop="price" content="...">` microdata.
 *
 *   - Buyback: ubslifestyle.com is a retail storefront with no buyback/sell
 *     price at all, so this falls back to IndoGold's "comparison_antamxubs"
 *     pricelist, which quotes a live UBS buyback figure alongside its own
 *     (same trade-off as Antam's buyback — no official public UBS buyback
 *     feed exists).
 *
 * Note: ubslifestyle.com only lists a single 1g product page reliably (no
 * clean size-ladder page like Antam's COD API), so `sizes` falls back to
 * IndoGold's UBS quotes across denominations.
 */

const PRODUCT_URL = "https://ubslifestyle.com/fine-gold-1gram/";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0 Safari/537.36";

export const ubs: GoldSource = {
  name: "ubs",
  async fetchPrices(): Promise<VendorPrices> {
    const [productRes, comparison] = await Promise.all([
      fetch(PRODUCT_URL, { headers: { "User-Agent": UA, Accept: "text/html" } }),
      fetchComparisonPricelist(),
    ]);

    if (!productRes.ok) throw new Error(`ubs: ubslifestyle.com ${productRes.status}`);
    const html = await productRes.text();
    const priceMatch = html.match(/itemprop="price"\s+content="(\d+)"/i);
    if (!priceMatch) throw new Error("ubs: price meta tag not found (site changed?)");
    const pricePerGram = Number(priceMatch[1]);

    let buyback: number | undefined;
    const sizes: Record<string, number> = {};
    if (comparison.status && comparison.data) {
      buyback = parseRp(comparison.data.data_denom["1.0"]?.UBS?.harga_buyback);
      for (const [size, vendors] of Object.entries(comparison.data.data_denom)) {
        const price = parseRp(vendors.UBS?.harga);
        if (price) sizes[size] = price;
      }
    }
    if (!buyback) throw new Error("ubs: buyback fallback (via IndoGold) unavailable");

    if (!(pricePerGram > 0) || !(buyback > 0)) {
      throw new Error(`ubs: implausible prices: buy=${pricePerGram} buyback=${buyback}`);
    }

    return {
      vendor: "ubs",
      pricePerGram,
      buyback,
      sizes,
      fetchedAt: nowJakartaISO(),
    };
  },
};
