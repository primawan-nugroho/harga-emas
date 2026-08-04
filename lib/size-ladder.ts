import type { VendorName, VendorPrices } from "./types";

export interface SizeLadderRow {
  grams: number;
  label: string;
  /** Total price for that bar, per vendor that offers this size. */
  prices: Partial<Record<VendorName, number>>;
}

/**
 * Union of all vendors' size ladders for the carousel's slide-2 table,
 * keyed by the *parsed* gram value rather than the raw string key — vendors
 * don't normalize keys the same way (Antam stores "1", IndoGold/UBS store
 * "1.0"), so keying on the raw string would produce duplicate rows for the
 * same weight. Sorted smallest to largest.
 */
export function buildSizeLadderRows(vendors: VendorPrices[]): SizeLadderRow[] {
  const byGrams = new Map<number, SizeLadderRow>();
  for (const v of vendors) {
    if (!v.sizes) continue;
    for (const [key, price] of Object.entries(v.sizes)) {
      const grams = Number(key);
      if (!Number.isFinite(grams) || grams <= 0) continue;
      let row = byGrams.get(grams);
      if (!row) {
        row = { grams, label: `${grams}g`, prices: {} };
        byGrams.set(grams, row);
      }
      row.prices[v.vendor] = price;
    }
  }
  return [...byGrams.values()].sort((a, b) => a.grams - b.grams);
}
