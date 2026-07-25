import type { DailySnapshot, VendorPrices } from "./types";
import { indoGold } from "./scrapers/indogold";
import { antam } from "./scrapers/antam";
import { ubs } from "./scrapers/ubs";
import { analyze } from "./analyze";
import { buildCaption } from "./caption";
import { mergeSnapshot, recentSnapshots } from "./store";
import { jakartaDate } from "./time";

const VENDOR_COUNT = 3;

export interface FetchResult {
  vendors: VendorPrices[];
  failures: Array<{ vendor: string; error: string }>;
}

/** Fetch all vendors; tolerate individual vendors failing (reported, not thrown). */
export async function fetchAllVendors(): Promise<FetchResult> {
  const sources = [indoGold, antam, ubs] as const;
  const results = await Promise.allSettled(sources.map((s) => s.fetchPrices()));
  const vendors: VendorPrices[] = [];
  const failures: Array<{ vendor: string; error: string }> = [];
  results.forEach((r, i) => {
    if (r.status === "fulfilled") vendors.push(r.value);
    else failures.push({ vendor: sources[i].name, error: String(r.reason) });
  });
  return { vendors, failures };
}

export interface DailyResult {
  snapshot: DailySnapshot;
  caption: string;
  analysis: ReturnType<typeof analyze>;
  failures: Array<{ vendor: string; error: string }>;
  /** True if today's merged snapshot is still missing a vendor (e.g. a
   * transient failure on one of the fetches). Callers should avoid
   * publishing an incomplete comparison. */
  incomplete: boolean;
}

/** Fetch → merge into today's stored snapshot → analyze → caption. */
export async function buildDaily(): Promise<DailyResult> {
  const date = jakartaDate();
  const { vendors, failures } = await fetchAllVendors();

  if (vendors.length === 0 && failures.length > 0) {
    throw new Error(`All vendors failed: ${failures.map((f) => `${f.vendor}: ${f.error}`).join(" | ")}`);
  }

  const snapshot = await mergeSnapshot(date, vendors);
  const history = await recentSnapshots(7, date);
  const analysis = analyze(snapshot, history);
  const caption = buildCaption(analysis);

  return { snapshot, caption, analysis, failures, incomplete: snapshot.vendors.length < VENDOR_COUNT };
}
