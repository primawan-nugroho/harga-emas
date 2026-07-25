import type { GoldSource, VendorPrices } from "../types";
import { nowJakartaISO } from "../time";
import { fetchComparisonPricelist, parseRp } from "./indogold-client";

/**
 * Antam price, sourced through IndoGold's comparison pricelist rather than
 * scraped from logammulia.com (the manufacturer's own site) directly.
 *
 * Why: logammulia.com sits behind Akamai bot protection that returns a 403
 * to every datacenter-IP request we tried — plain curl, real headless
 * Chromium, Vercel serverless functions, and GitHub Actions runners all got
 * blocked (confirmed 2026-07-24/25). IndoGold's own "comparison_antamxubs"
 * pricelist tab already surfaces a live Antam quote alongside its own, and
 * that endpoint has no such protection.
 *
 * Trade-off (by design, confirmed with the user): this is IndoGold's quoted
 * price *for* Antam-brand bars, not Antam/Logam Mulia's own official listed
 * price — still a real, live, meaningful comparison point, just sourced
 * through a reseller's book instead of the manufacturer's site. Reflected in
 * the "Antam (via IndoGold)" label used in the caption and rendered image.
 */
export const antam: GoldSource = {
  name: "antam",
  async fetchPrices(): Promise<VendorPrices> {
    const json = await fetchComparisonPricelist();
    if (!json.status || !json.data) {
      throw new Error("antam: pricelist request failed (token/session expired?)");
    }

    const denoms = json.data.data_denom;
    const oneGram = denoms["1.0"]?.Antam;
    const pricePerGram = parseRp(oneGram?.harga);
    const buyback = parseRp(oneGram?.harga_buyback);
    if (!pricePerGram || !buyback) {
      throw new Error("antam: 1g Antam price missing from response");
    }

    const sizes: Record<string, number> = {};
    for (const [size, vendors] of Object.entries(denoms)) {
      const price = parseRp(vendors.Antam?.harga);
      if (price) sizes[size] = price;
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
