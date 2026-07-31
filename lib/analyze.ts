import type {
  Analysis,
  DailySnapshot,
  DayChange,
  SizePremiumInfo,
  VendorName,
  VendorPrices,
} from "./types";
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

  const vendorTrends: Partial<Record<VendorName, number[]>> = {};
  for (const v of vendors) {
    const series = [...history, today]
      .map((s) => s.vendors.find((p) => p.vendor === v.vendor)?.pricePerGram)
      .filter((p): p is number => p != null);
    if (series.length > 0) vendorTrends[v.vendor] = series;
  }

  const worldPremium: Partial<Record<VendorName, number>> = {};
  if (today.worldPrice) {
    const worldPerGram = today.worldPrice.idrPerGram;
    for (const v of vendors) {
      worldPremium[v.vendor] = (v.pricePerGram / worldPerGram - 1) * 100;
    }
  }

  const sizePremium: Partial<Record<VendorName, SizePremiumInfo>> = {};
  for (const v of vendors) {
    const info = computeSizePremium(v);
    if (info) sizePremium[v.vendor] = info;
  }
  const bestSizePremiumVendor = pickBestSizePremiumVendor(sizePremium);

  return {
    date: today.date,
    vendors,
    spreads,
    cheapestToBuy,
    bestToSell,
    dayChange,
    vendorChanges,
    trend,
    vendorTrends,
    insights: buildInsights(spreads, cheapestToBuy, bestToSell, trend),
    worldPrice: today.worldPrice,
    worldPremium,
    sizePremium,
    bestSizePremiumVendor,
  };
}

/**
 * Small bars cost more per gram than large bars — a real, actionable fact
 * for buyers, computed from data we already scrape (`sizes`) but had never
 * surfaced. Needs at least 2 distinct sizes to be meaningful.
 */
function computeSizePremium(v: VendorPrices): SizePremiumInfo | undefined {
  if (!v.sizes) return undefined;
  const entries = Object.entries(v.sizes)
    .map(([size, total]) => ({ size, grams: Number(size), perGram: total / Number(size) }))
    .filter((e) => e.grams > 0 && Number.isFinite(e.perGram));
  if (entries.length < 2) return undefined;

  entries.sort((a, b) => a.grams - b.grams);
  const smallest = entries[0];
  const largest = entries[entries.length - 1];

  return {
    smallestSize: smallest.size,
    smallestPerGram: smallest.perGram,
    largestSize: largest.size,
    largestPerGram: largest.perGram,
    premiumPct: (smallest.perGram / largest.perGram - 1) * 100,
  };
}

/** The single most notable size-premium fact across vendors, for the one-line headline. */
function pickBestSizePremiumVendor(
  sizePremium: Partial<Record<VendorName, SizePremiumInfo>>,
): VendorName | undefined {
  const entries = Object.entries(sizePremium) as Array<[VendorName, SizePremiumInfo]>;
  if (entries.length === 0) return undefined;
  return entries.reduce((best, cur) => (cur[1].premiumPct > best[1].premiumPct ? cur : best))[0];
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
