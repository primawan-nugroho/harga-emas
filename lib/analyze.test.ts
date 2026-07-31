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

describe("analyze — world price premium", () => {
  it("computes each vendor's premium vs world price when present", () => {
    // Hand-verified against live data captured 2026-07-30 (see plan):
    // world Rp2,397,805/gr; Antam 1g Rp2,601,000 -> +8.5%.
    const today: DailySnapshot = {
      date: "2026-07-30",
      vendors: [
        { vendor: "antam", pricePerGram: 2_601_000, buyback: 2_477_000, fetchedAt: "2026-07-30" },
        { vendor: "ubs", pricePerGram: 2_488_800, buyback: 2_275_000, fetchedAt: "2026-07-30" },
        { vendor: "indogold", pricePerGram: 2_411_400, buyback: 2_276_000, fetchedAt: "2026-07-30" },
      ],
      worldPrice: {
        usdPerOz: 4_125.7,
        usdIdr: 18_076.95,
        idrPerGram: 2_397_805,
        fetchedAt: "2026-07-30",
      },
    };
    const a = analyze(today, []);

    expect(a.worldPrice?.idrPerGram).toBeCloseTo(2_397_805, 0);
    expect(a.worldPremium.antam).toBeCloseTo(8.48, 1);
    expect(a.worldPremium.ubs).toBeCloseTo(3.8, 1);
    expect(a.worldPremium.indogold).toBeCloseTo(0.57, 1);
  });

  it("omits worldPrice/worldPremium entirely when the fetch failed that day", () => {
    const today = snap("2026-07-30", 1_290_000, 1_305_000); // no worldPrice set
    const a = analyze(today, []);

    expect(a.worldPrice).toBeUndefined();
    expect(a.worldPremium).toEqual({});
  });
});

describe("analyze — size-ladder premium", () => {
  it("computes the small-bar-costs-more-per-gram fact from real Antam sizes", () => {
    // Hand-verified against live data captured 2026-07-29 (see plan):
    // 0.5g @ Rp2,701,000/gr vs 1000g @ Rp2,541,600/gr -> +6.27%.
    const today: DailySnapshot = {
      date: "2026-07-29",
      vendors: [
        {
          vendor: "antam",
          pricePerGram: 2_601_000,
          buyback: 2_477_000,
          fetchedAt: "2026-07-29",
          sizes: {
            "0.5": 1_350_500,
            "1": 2_601_000,
            "10": 25_560_000,
            "1000": 2_541_600_000,
          },
        },
        { vendor: "ubs", pricePerGram: 2_488_800, buyback: 2_275_000, fetchedAt: "2026-07-29" },
        { vendor: "indogold", pricePerGram: 2_411_400, buyback: 2_276_000, fetchedAt: "2026-07-29" },
      ],
    };
    const a = analyze(today, []);

    const info = a.sizePremium.antam;
    expect(info?.smallestSize).toBe("0.5");
    expect(info?.largestSize).toBe("1000");
    expect(info?.premiumPct).toBeCloseTo(6.27, 1);
    expect(a.bestSizePremiumVendor).toBe("antam"); // only vendor with a computable ladder here
  });

  it("skips a vendor with only a single size (nothing to compare)", () => {
    const today: DailySnapshot = {
      date: "2026-07-29",
      vendors: [
        {
          vendor: "antam",
          pricePerGram: 2_601_000,
          buyback: 2_477_000,
          fetchedAt: "2026-07-29",
          sizes: { "1": 2_601_000 },
        },
      ],
    };
    const a = analyze(today, []);
    expect(a.sizePremium.antam).toBeUndefined();
    expect(a.bestSizePremiumVendor).toBeUndefined();
  });

  it("skips a vendor with no sizes ladder at all", () => {
    const today = snap("2026-07-29", 1_290_000, 1_305_000); // snap() sets no `sizes`
    const a = analyze(today, []);
    expect(a.sizePremium).toEqual({});
    expect(a.bestSizePremiumVendor).toBeUndefined();
  });

  it("picks the vendor with the largest premium as the headline when several have ladders", () => {
    const today: DailySnapshot = {
      date: "2026-07-29",
      vendors: [
        {
          vendor: "antam",
          pricePerGram: 2_601_000,
          buyback: 2_477_000,
          fetchedAt: "2026-07-29",
          sizes: { "0.5": 1_350_500, "1000": 2_541_600_000 }, // ~6.27% premium
        },
        {
          vendor: "ubs",
          pricePerGram: 2_488_800,
          buyback: 2_275_000,
          fetchedAt: "2026-07-29",
          sizes: { "0.5": 1_260_000, "100": 250_000_000 }, // ~0.8% premium — smaller
        },
      ],
    };
    const a = analyze(today, []);
    expect(a.bestSizePremiumVendor).toBe("antam");
  });
});
