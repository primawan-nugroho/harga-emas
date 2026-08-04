import { describe, it, expect } from "vitest";
import { buildSizeLadderRows } from "./size-ladder";
import type { VendorPrices } from "./types";

function priced(vendor: VendorPrices["vendor"], sizes: Record<string, number>): VendorPrices {
  return { vendor, pricePerGram: 0, buyback: 0, fetchedAt: "2026-08-04", sizes };
}

describe("buildSizeLadderRows", () => {
  it("merges duplicate weights that vendors key differently (\"1\" vs \"1.0\")", () => {
    const rows = buildSizeLadderRows([
      priced("antam", { "1": 2_600_000, "0.5": 1_350_000 }),
      priced("indogold", { "1.0": 2_400_000 }),
    ]);

    expect(rows).toHaveLength(2); // not 3 — "1" and "1.0" merge into one row
    const oneGram = rows.find((r) => r.grams === 1);
    expect(oneGram?.prices).toEqual({ antam: 2_600_000, indogold: 2_400_000 });
  });

  it("sorts rows smallest to largest", () => {
    const rows = buildSizeLadderRows([priced("antam", { "10": 1, "1": 1, "100": 1, "0.5": 1 })]);
    expect(rows.map((r) => r.grams)).toEqual([0.5, 1, 10, 100]);
  });

  it("leaves a vendor's cell absent (not zero) when it doesn't offer that size", () => {
    const rows = buildSizeLadderRows([
      priced("antam", { "1": 2_600_000, "1000": 2_500_000_000 }),
      priced("indogold", { "1": 2_400_000 }),
    ]);
    const thousandGram = rows.find((r) => r.grams === 1000)!;
    expect(thousandGram.prices.antam).toBe(2_500_000_000);
    expect(thousandGram.prices.indogold).toBeUndefined();
  });

  it("skips vendors with no sizes ladder and ignores non-numeric/zero keys", () => {
    const rows = buildSizeLadderRows([
      { vendor: "ubs", pricePerGram: 100, buyback: 90, fetchedAt: "2026-08-04" }, // no `sizes`
      priced("antam", { "1": 2_600_000, "0": 999, "abc": 999 }),
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].grams).toBe(1);
  });

  it("returns an empty array when no vendor has a usable ladder", () => {
    expect(buildSizeLadderRows([])).toEqual([]);
  });
});
