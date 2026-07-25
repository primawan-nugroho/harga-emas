import type { GoldSource, VendorPrices } from "../types";
import { nowJakartaISO } from "../time";
import { fetchComparisonPricelist, parseRp } from "./indogold-client";

/**
 * UBS Gold price, sourced through IndoGold's comparison pricelist.
 *
 * ubsgold.com (the manufacturer's corporate site) publishes no live spot
 * price at all — it's a marketing/jewelry-catalog site pointing to
 * ubslifestyle.com, an e-commerce storefront with per-product listings, not
 * a daily buy/sell price table. IndoGold's "comparison_antamxubs" pricelist
 * tab already surfaces a live UBS quote (buy + buyback) alongside its own
 * and Antam's, so that's the source here — same endpoint already used by
 * the "indogold" and "antam" vendors.
 */
export const ubs: GoldSource = {
  name: "ubs",
  async fetchPrices(): Promise<VendorPrices> {
    const json = await fetchComparisonPricelist();
    if (!json.status || !json.data) {
      throw new Error("ubs: pricelist request failed (token/session expired?)");
    }

    const denoms = json.data.data_denom;
    const oneGram = denoms["1.0"]?.UBS;
    const pricePerGram = parseRp(oneGram?.harga);
    const buyback = parseRp(oneGram?.harga_buyback);
    if (!pricePerGram || !buyback) {
      throw new Error("ubs: 1g UBS price missing from response");
    }

    const sizes: Record<string, number> = {};
    for (const [size, vendors] of Object.entries(denoms)) {
      const price = parseRp(vendors.UBS?.harga);
      if (price) sizes[size] = price;
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
