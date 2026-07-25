import { describe, it, expect } from "vitest";
import { analyze } from "./analyze";
import type { DailySnapshot } from "./types";

function snap(date: string, ig: number, lm: number): DailySnapshot {
  return {
    date,
    vendors: [
      { vendor: "indogold", pricePerGram: ig, buyback: ig - 60000, fetchedAt: date },
      { vendor: "antam", pricePerGram: lm, buyback: lm - 40000, fetchedAt: date },
      { vendor: "ubs", pricePerGram: lm - 20000, buyback: lm - 70000, fetchedAt: date },
    ],
  };
}

function avgBuy(s: DailySnapshot): number {
  return s.vendors.reduce((sum, v) => sum + v.pricePerGram, 0) / s.vendors.length;
}

describe("analyze", () => {
  it("computes spreads, cheapest/best, and day change", () => {
    const history = [snap("2026-07-21", 1_300_000, 1_310_000)];
    const today = snap("2026-07-22", 1_290_000, 1_305_000);
    const a = analyze(today, history);

    expect(a.cheapestToBuy).toBe("ubs"); // 1,285,000 (lm - 20,000) is lowest buy price
    expect(a.bestToSell).toBe("antam"); // 1,265,000 is highest buyback
    expect(a.dayChange?.direction).toBe("down");
    expect(a.spreads).toHaveLength(3);
    expect(a.trend).toEqual([avgBuy(history[0]), avgBuy(today)]);
    expect(a.insights.length).toBeGreaterThan(0);

    // per-vendor change: indogold 1,290,000 vs yesterday 1,300,000 -> down
    expect(a.vendorChanges.indogold?.direction).toBe("down");
    // antam 1,305,000 vs yesterday 1,310,000 -> down
    expect(a.vendorChanges.antam?.direction).toBe("down");
    // display order is antam, ubs, indogold
    expect(a.vendors.map((v) => v.vendor)).toEqual(["antam", "ubs", "indogold"]);

    // per-vendor trend: 2-day series (history then today), oldest -> newest
    expect(a.vendorTrends.indogold).toEqual([1_300_000, 1_290_000]);
    expect(a.vendorTrends.antam).toEqual([1_310_000, 1_305_000]);
  });

  it("omits a vendor's trend/change when absent from yesterday's snapshot", () => {
    const yesterday: DailySnapshot = {
      date: "2026-07-21",
      vendors: [{ vendor: "indogold", pricePerGram: 1_300_000, buyback: 1_240_000, fetchedAt: "2026-07-21" }],
    };
    const today = snap("2026-07-22", 1_290_000, 1_305_000);
    const a = analyze(today, [yesterday]);

    expect(a.vendorChanges.antam).toBeUndefined();
    expect(a.vendorTrends.antam).toEqual([1_305_000]); // only today, since antam wasn't tracked yesterday
    expect(a.vendorChanges.indogold?.direction).toBe("down");
  });

  it("detects a 3-day down streak", () => {
    const history = [
      snap("2026-07-19", 1_320_000, 1_330_000),
      snap("2026-07-20", 1_310_000, 1_320_000),
      snap("2026-07-21", 1_300_000, 1_310_000),
    ];
    const today = snap("2026-07-22", 1_290_000, 1_300_000);
    const a = analyze(today, history);
    expect(a.insights.some((l) => l.includes("beruntun"))).toBe(true);
  });
});
