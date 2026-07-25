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
