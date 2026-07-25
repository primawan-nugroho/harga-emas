import type { GoldSource, VendorPrices } from "../types";
import { nowJakartaISO } from "../time";
import { fetchComparisonPricelist, parseRp } from "./indogold-client";

export const indoGold: GoldSource = {
  name: "indogold",
  async fetchPrices(): Promise<VendorPrices> {
    const json = await fetchComparisonPricelist();
    if (!json.status || !json.data) {
      throw new Error("indogold: pricelist request failed (token/session expired?)");
    }

    const denoms = json.data.data_denom;
    const oneGram = denoms["1.0"]?.IndoGold;
    const pricePerGram = parseRp(oneGram?.harga);
    const buyback = parseRp(oneGram?.harga_buyback);
    if (!pricePerGram || !buyback) {
      throw new Error("indogold: 1g IndoGold price missing from response");
    }

    const sizes: Record<string, number> = {};
    for (const [size, vendors] of Object.entries(denoms)) {
      const price = parseRp(vendors.IndoGold?.harga);
      if (price) sizes[size] = price;
    }

    return {
      vendor: "indogold",
      pricePerGram,
      buyback,
      sizes,
      fetchedAt: nowJakartaISO(),
    };
  },
};
