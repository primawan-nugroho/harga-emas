import { describe, it, expect } from "vitest";
import { findCarryForward } from "./pipeline";
import type { DailySnapshot } from "./types";

function priced(vendor: "indogold" | "antam" | "ubs", price: number, date: string): DailySnapshot["vendors"][number] {
  return { vendor, pricePerGram: price, buyback: price - 50000, fetchedAt: date };
}

describe("findCarryForward", () => {
  it("carries forward a vendor missing from today using its most recent prior price", () => {
    const history: DailySnapshot[] = [
      { date: "2026-07-23", vendors: [priced("antam", 2_600_000, "2026-07-23")] },
      { date: "2026-07-24", vendors: [priced("indogold", 2_400_000, "2026-07-24")] }, // antam absent this day
    ];
    const today: DailySnapshot = { date: "2026-07-25", vendors: [priced("indogold", 2_410_000, "2026-07-25")] };

    const carried = findCarryForward(today, history);

    // ubs is also missing from today, but it never appears in history either,
    // so there's nothing to carry forward for it — only antam gets carried.
    expect(carried).toHaveLength(1);
    const antamCarry = carried.find((v) => v.vendor === "antam");
    expect(antamCarry).toBeDefined();
    expect(antamCarry?.pricePerGram).toBe(2_600_000); // from 07-23, the most recent day antam appears
    expect(antamCarry?.carriedForward).toBe(true);
  });

  it("returns nothing for a vendor that has never once appeared in history", () => {
    const history: DailySnapshot[] = [
      { date: "2026-07-24", vendors: [priced("indogold", 2_400_000, "2026-07-24")] },
    ];
    const today: DailySnapshot = { date: "2026-07-25", vendors: [priced("indogold", 2_410_000, "2026-07-25")] };

    const carried = findCarryForward(today, history);

    // antam/ubs never seen before -> nothing to carry forward for them
    expect(carried.find((v) => v.vendor === "antam")).toBeUndefined();
    expect(carried.find((v) => v.vendor === "ubs")).toBeUndefined();
  });

  it("carries forward nothing when today already has all known vendors", () => {
    const today: DailySnapshot = {
      date: "2026-07-25",
      vendors: [
        priced("indogold", 2_410_000, "2026-07-25"),
        priced("antam", 2_600_000, "2026-07-25"),
        priced("ubs", 2_490_000, "2026-07-25"),
      ],
    };
    expect(findCarryForward(today, [])).toHaveLength(0);
  });
});
