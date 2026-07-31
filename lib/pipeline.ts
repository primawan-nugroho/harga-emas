import type { DailySnapshot, VendorName, VendorPrices, WorldPrice } from "./types";
import { indoGold } from "./scrapers/indogold";
import { antam } from "./scrapers/antam";
import { ubs } from "./scrapers/ubs";
import { fetchWorldPrice } from "./scrapers/world-gold";
import { analyze } from "./analyze";
import { buildCaption } from "./caption";
import { mergeSnapshot, recentSnapshots } from "./store";
import { jakartaDate } from "./time";
import { VENDOR_ORDER } from "./vendor-labels";

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

/**
 * For any known vendor still missing from today's snapshot (every fetch
 * attempt failed today), carry forward its price from *yesterday only* —
 * capped to one day old — so tomorrow's strict "vs yesterday" comparison
 * doesn't come up empty after a single bad day. Reuses a real,
 * previously-fetched price — never fabricates one — flagged with
 * `carriedForward: true`.
 *
 * Deliberately does not search further back than yesterday, and refuses to
 * carry forward an entry that was itself carried forward: staleness must
 * never compound across multiple days (a vendor blocked for 2+ days in a
 * row simply goes missing/incomplete rather than silently showing an
 * increasingly stale price as if it were current).
 */
export function findCarryForward(
  today: DailySnapshot,
  history: DailySnapshot[], // newest-last, excludes today
): VendorPrices[] {
  const present = new Set(today.vendors.map((v) => v.vendor));
  const missing = VENDOR_ORDER.filter((v) => !present.has(v));
  const yesterday = history.at(-1);
  if (!yesterday) return [];

  const carried: VendorPrices[] = [];
  for (const vendor of missing) {
    const found = yesterday.vendors.find((p) => p.vendor === vendor);
    if (found && !found.carriedForward) {
      carried.push({ ...found, carriedForward: true });
    }
  }
  return carried;
}

export interface DailyResult {
  snapshot: DailySnapshot;
  caption: string;
  analysis: ReturnType<typeof analyze>;
  failures: Array<{ vendor: string; error: string }>;
  /** Vendors whose price was carried forward from a prior day rather than
   * freshly fetched today (every attempt today failed). */
  carriedForward: VendorName[];
  /** True if today's snapshot is still missing a vendor after fetch +
   * carry-forward (i.e. that vendor has never once been fetched successfully).
   * Callers should avoid publishing an incomplete comparison. */
  incomplete: boolean;
}

/**
 * World gold price is optional — unlike a missing vendor, a failed fetch
 * here must never block the daily post. Reported into the same `failures`
 * array as vendor failures (vendor: "world") so it's visible in Telegram
 * alerts and the durable run log without affecting `incomplete`.
 */
async function fetchWorldPriceTolerant(): Promise<{
  worldPrice?: WorldPrice;
  failure?: { vendor: string; error: string };
}> {
  try {
    return { worldPrice: await fetchWorldPrice() };
  } catch (e) {
    return { failure: { vendor: "world", error: String(e) } };
  }
}

/** Fetch → carry forward any still-missing vendor → merge into today's stored snapshot → analyze → caption. */
export async function buildDaily(): Promise<DailyResult> {
  const date = jakartaDate();
  const { vendors, failures } = await fetchAllVendors();

  if (vendors.length === 0 && failures.length > 0) {
    throw new Error(`All vendors failed: ${failures.map((f) => `${f.vendor}: ${f.error}`).join(" | ")}`);
  }

  const { worldPrice, failure: worldFailure } = await fetchWorldPriceTolerant();
  if (worldFailure) failures.push(worldFailure);

  let snapshot = await mergeSnapshot(date, vendors, worldPrice);

  let history = await recentSnapshots(7, date);
  const carried = findCarryForward(snapshot, history);
  if (carried.length > 0) {
    snapshot = await mergeSnapshot(date, carried);
    history = await recentSnapshots(7, date); // re-fetch in case carry-forward affected it (it doesn't, but stay consistent)
  }

  const analysis = analyze(snapshot, history);
  const caption = buildCaption(analysis);

  return {
    snapshot,
    caption,
    analysis,
    failures,
    carriedForward: carried.map((v) => v.vendor),
    incomplete: snapshot.vendors.length < VENDOR_ORDER.length,
  };
}
