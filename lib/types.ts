/** Canonical, normalized gold-price data shared across the pipeline. */

export type VendorName = "indogold" | "antam" | "ubs";

/** One vendor's prices as fetched at a point in time. */
export interface VendorPrices {
  vendor: VendorName;
  /** Buy price (what you pay to buy) for the reference 1g bar, in IDR. */
  pricePerGram: number;
  /** Buyback price (what the vendor pays you), in IDR. */
  buyback: number;
  /** Optional price ladder by gram size, e.g. { "1": 1300000, "5": 6400000 }. */
  sizes?: Record<string, number>;
  /** ISO timestamp when the data was fetched. */
  fetchedAt: string;
  /** True if this entry was carried forward from a prior day (every fetch
   * attempt failed today) rather than freshly fetched — see pipeline.ts. */
  carriedForward?: boolean;
}

/** Every source implements this so vendors are swappable and testable. */
export interface GoldSource {
  readonly name: VendorName;
  fetchPrices(): Promise<VendorPrices>;
}

/** International gold reference price, converted to IDR/gram for comparison. */
export interface WorldPrice {
  /** COMEX gold futures (GC=F), USD per troy ounce. A close proxy for spot,
   * not identical (contango) — label accordingly in copy. */
  usdPerOz: number;
  usdIdr: number;
  /** Derived: usdPerOz * usdIdr / 31.1034768 (troy oz -> gram). */
  idrPerGram: number;
  fetchedAt: string;
}

/** A full day's normalized snapshot persisted to the store. */
export interface DailySnapshot {
  /** YYYY-MM-DD in Asia/Jakarta. */
  date: string;
  vendors: VendorPrices[];
  /** Optional — a failed fetch simply omits this; never blocks the post
   * (unlike a missing vendor, which does). See lib/pipeline.ts. */
  worldPrice?: WorldPrice;
}

export interface DayChange {
  idr: number;
  pct: number;
  direction: "up" | "down" | "flat";
}

/** Per-vendor "small bars cost more per gram" fact, derived from `sizes`. */
export interface SizePremiumInfo {
  smallestSize: string;
  smallestPerGram: number;
  largestSize: string;
  largestPerGram: number;
  /** How much more the smallest size costs per gram vs the largest, in %. */
  premiumPct: number;
}

/** Output of the insight layer used to render the image + caption. */
export interface Analysis {
  date: string;
  vendors: VendorPrices[];
  /** Per-vendor buy/buyback spread in IDR and %. */
  spreads: Array<{ vendor: VendorName; spreadIdr: number; spreadPct: number }>;
  /** Cheapest vendor to buy from today. */
  cheapestToBuy: VendorName;
  /** Best vendor to sell back to today. */
  bestToSell: VendorName;
  /** Day-over-day change of the reference buy price (avg across vendors). */
  dayChange?: DayChange;
  /** Day-over-day change of each vendor's own buy price vs yesterday. */
  vendorChanges: Partial<Record<VendorName, DayChange>>;
  /** Last N reference prices for the sparkline (oldest → newest). */
  trend: number[];
  /** Each vendor's own last-N-day buy price series (oldest → newest), for its sparkline. */
  vendorTrends: Partial<Record<VendorName, number[]>>;
  /** Human-readable descriptive insight lines (Bahasa Indonesia). No advice. */
  insights: string[];
  /** World gold reference, if fetched successfully today (see WorldPrice). */
  worldPrice?: WorldPrice;
  /** Per-vendor premium vs world price, in % ((local/world - 1) * 100). Empty if worldPrice missing. */
  worldPremium: Partial<Record<VendorName, number>>;
  /** Per-vendor size-ladder premium (small bars cost more per gram). Only for vendors with 2+ sizes. */
  sizePremium: Partial<Record<VendorName, SizePremiumInfo>>;
  /** The single vendor with the largest size premium, for the one-line headline. */
  bestSizePremiumVendor?: VendorName;
}
