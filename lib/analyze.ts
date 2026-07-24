import type { Analysis, DailySnapshot, VendorName, VendorPrices } from "./types";

/**
 * Turn today's snapshot (+ recent history) into descriptive insights.
 * DESCRIPTIVE ONLY — no buy/sell/investment advice.
 */
export function analyze(
  today: DailySnapshot,
  history: DailySnapshot[], // newest-last, excludes today
): Analysis {
  const vendors = today.vendors;

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
  let dayChange: Analysis["dayChange"];
  if (prev) {
    const refPrev = avg(prev.vendors.map((v) => v.pricePerGram));
    const diff = refToday - refPrev;
    dayChange = {
      idr: diff,
      pct: (diff / refPrev) * 100,
      direction: diff > 0 ? "up" : diff < 0 ? "down" : "flat",
    };
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
    trend,
    insights: buildInsights(vendors, spreads, cheapestToBuy, bestToSell, dayChange, trend),
  };
}

function buildInsights(
  vendors: VendorPrices[],
  spreads: Analysis["spreads"],
  cheapestToBuy: VendorName,
  bestToSell: VendorName,
  dayChange: Analysis["dayChange"],
  trend: number[],
): string[] {
  const lines: string[] = [];
  const label: Record<VendorName, string> = {
    indogold: "IndoGold",
    logammulia: "Logam Mulia",
  };

  if (dayChange && dayChange.direction !== "flat") {
    const arrow = dayChange.direction === "up" ? "naik" : "turun";
    lines.push(
      `Harga emas ${arrow} ${Math.abs(dayChange.pct).toFixed(2)}% dibanding kemarin.`,
    );
  }

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
