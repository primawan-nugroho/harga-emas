import type { Analysis, DailySnapshot, DayChange, VendorName, VendorPrices } from "./types";
import { VENDOR_LABEL, sortByVendorOrder } from "./vendor-labels";

/**
 * Turn today's snapshot (+ recent history) into descriptive insights.
 * DESCRIPTIVE ONLY — no buy/sell/investment advice.
 */
export function analyze(
  today: DailySnapshot,
  history: DailySnapshot[], // newest-last, excludes today
): Analysis {
  const vendors = sortByVendorOrder(today.vendors);

  const spreads = vendors.map((v) => {
    const spreadIdr = v.pricePerGram - v.buyback;
    return {
      vendor: v.vendor,
      spreadIdr,
      spreadPct: (spreadIdr / v.pricePerGram) * 100,
    };
  });

  const cheapestToBuy = pick(vendors, (v) => v.pricePerGram, "min");
  const bestToSell = pick(vendors, (v) => v.buyback, "max");

  const refToday = avg(vendors.map((v) => v.pricePerGram));
  const prev = history.at(-1);
  let dayChange: DayChange | undefined;
  if (prev) {
    const refPrev = avg(prev.vendors.map((v) => v.pricePerGram));
    dayChange = computeChange(refToday, refPrev);
  }

  const vendorChanges: Partial<Record<VendorName, DayChange>> = {};
  if (prev) {
    for (const v of vendors) {
      const prevVendor = prev.vendors.find((p) => p.vendor === v.vendor);
      if (prevVendor) vendorChanges[v.vendor] = computeChange(v.pricePerGram, prevVendor.pricePerGram);
    }
  }

  const trend = [...history, today].map((s) =>
    avg(s.vendors.map((v) => v.pricePerGram)),
  );

  return {
    date: today.date,
    vendors,
    spreads,
    cheapestToBuy,
    bestToSell,
    dayChange,
    vendorChanges,
    trend,
    insights: buildInsights(spreads, cheapestToBuy, bestToSell, trend),
  };
}

function computeChange(current: number, previous: number): DayChange {
  const diff = current - previous;
  return {
    idr: diff,
    pct: (diff / previous) * 100,
    direction: diff > 0 ? "up" : diff < 0 ? "down" : "flat",
  };
}

function buildInsights(
  spreads: Analysis["spreads"],
  cheapestToBuy: VendorName,
  bestToSell: VendorName,
  trend: number[],
): string[] {
  const lines: string[] = [];
  const label = VENDOR_LABEL;

  lines.push(`Termurah untuk beli hari ini: ${label[cheapestToBuy]}.`);
  lines.push(`Buyback terbaik hari ini: ${label[bestToSell]}.`);

  const tightest = [...spreads].sort((a, b) => a.spreadPct - b.spreadPct)[0];
  lines.push(
    `Selisih beli–buyback tersempit: ${label[tightest.vendor]} (${tightest.spreadPct.toFixed(1)}%).`,
  );

  const streak = downStreak(trend);
  if (streak >= 3) lines.push(`Harga turun ${streak} hari beruntun.`);

  return lines;
}

function downStreak(trend: number[]): number {
  let n = 0;
  for (let i = trend.length - 1; i > 0; i--) {
    if (trend[i] < trend[i - 1]) n++;
    else break;
  }
  return n;
}

function avg(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function pick(
  vendors: VendorPrices[],
  key: (v: VendorPrices) => number,
  dir: "min" | "max",
): VendorName {
  return vendors.reduce((best, v) =>
    dir === "min"
      ? key(v) < key(best)
        ? v
        : best
      : key(v) > key(best)
        ? v
        : best,
  ).vendor;
}
