import { describe, it, expect } from "vitest";
import { analyze } from "./analyze";
import type { DailySnapshot } from "./types";

function snap(date: string, ig: number, lm: number): DailySnapshot {
  return {
    date,
    vendors: [
      { vendor: "indogold", pricePerGram: ig, buyback: ig - 60000, fetchedAt: date },
      { vendor: "antam", pricePerGram: lm, buyback: lm - 40000, fetchedAt: date },
    ],
  };
}

describe("analyze", () => {
  it("computes spreads, cheapest/best, and day change", () => {
    const history = [snap("2026-07-21", 1_300_000, 1_310_000)];
    const today = snap("2026-07-22", 1_290_000, 1_305_000);
    const a = analyze(today, history);

    expect(a.cheapestToBuy).toBe("indogold"); // 1,290,000 < 1,305,000
    expect(a.bestToSell).toBe("antam"); // 1,265,000 > 1,230,000
    expect(a.dayChange?.direction).toBe("down");
    expect(a.spreads).toHaveLength(2);
    expect(a.trend).toEqual([1_305_000, 1_297_500]); // avg per day
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
