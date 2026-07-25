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
}

/** Every source implements this so vendors are swappable and testable. */
export interface GoldSource {
  readonly name: VendorName;
  fetchPrices(): Promise<VendorPrices>;
}

/** A full day's normalized snapshot persisted to the store. */
export interface DailySnapshot {
  /** YYYY-MM-DD in Asia/Jakarta. */
  date: string;
  vendors: VendorPrices[];
}

export interface DayChange {
  idr: number;
  pct: number;
  direction: "up" | "down" | "flat";
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
}
