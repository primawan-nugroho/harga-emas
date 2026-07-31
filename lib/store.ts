import type { DailySnapshot, WorldPrice } from "./types";
import { promises as fs } from "node:fs";
import path from "node:path";

/**
 * Snapshot store. Two backends:
 *  - Local FS (default in dev): ./data/YYYY-MM-DD.json
 *  - Vercel Blob (prod): set BLOB_READ_WRITE_TOKEN.
 *
 * The Blob path is stubbed for now (import @vercel/blob when wiring prod).
 */

const DATA_DIR = path.join(process.cwd(), "data");
const useBlob = !!process.env.BLOB_READ_WRITE_TOKEN;

export async function saveSnapshot(snap: DailySnapshot): Promise<void> {
  if (useBlob) return saveBlob(snap);
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(
    path.join(DATA_DIR, `${snap.date}.json`),
    JSON.stringify(snap, null, 2),
    "utf8",
  );
}

/** Fetch a single day's snapshot, or null if none stored yet. */
export async function getSnapshot(date: string): Promise<DailySnapshot | null> {
  if (useBlob) return getBlob(date);
  try {
    const raw = await fs.readFile(path.join(DATA_DIR, `${date}.json`), "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Merge freshly-fetched vendors into whatever is already stored for `date`
 * (upsert by vendor name) and persist the result. This lets a vendor scraped
 * by one path (e.g. Vercel) coexist with a vendor scraped by another (e.g.
 * the GitHub Actions Playwright fallback for Akamai-protected sources)
 * without either overwriting the other.
 *
 * `worldPrice` is optional and upserted the same way: pass it when freshly
 * fetched, omit it to keep whatever was already stored for that date (e.g.
 * the carry-forward merge call in pipeline.ts, which never re-fetches world
 * price, must not wipe out a value an earlier call already set today).
 */
export async function mergeSnapshot(
  date: string,
  newVendors: DailySnapshot["vendors"],
  worldPrice?: WorldPrice,
): Promise<DailySnapshot> {
  const existing = await getSnapshot(date);
  const byName = new Map((existing?.vendors ?? []).map((v) => [v.vendor, v]));
  for (const v of newVendors) byName.set(v.vendor, v);
  const merged: DailySnapshot = {
    date,
    vendors: [...byName.values()],
    worldPrice: worldPrice ?? existing?.worldPrice,
  };
  await saveSnapshot(merged);
  return merged;
}

/** Return the last `n` snapshots (newest last), excluding `excludeDate`. */
export async function recentSnapshots(
  n: number,
  excludeDate?: string,
): Promise<DailySnapshot[]> {
  if (useBlob) return recentBlob(n, excludeDate);
  let files: string[] = [];
  try {
    files = (await fs.readdir(DATA_DIR)).filter((f) => f.endsWith(".json"));
  } catch {
    return [];
  }
  const dates = files
    .map((f) => f.replace(".json", ""))
    .filter((d) => d !== excludeDate)
    .sort();
  const pick = dates.slice(-n);
  return Promise.all(
    pick.map(async (d) =>
      JSON.parse(await fs.readFile(path.join(DATA_DIR, `${d}.json`), "utf8")),
    ),
  );
}

// --- Vercel Blob backend ----------------------------------------------------
async function getBlob(date: string): Promise<DailySnapshot | null> {
  const { list } = await import("@vercel/blob");
  const { blobs } = await list({ prefix: `snapshots/${date}.json` });
  if (blobs.length === 0) return null;
  const res = await fetch(blobs[0].url);
  return res.json();
}

async function saveBlob(snap: DailySnapshot): Promise<void> {
  const { put } = await import("@vercel/blob");
  await put(`snapshots/${snap.date}.json`, JSON.stringify(snap), {
    access: "public",
    contentType: "application/json",
    addRandomSuffix: false,
  });
}

async function recentBlob(n: number, exclude?: string): Promise<DailySnapshot[]> {
  const { list } = await import("@vercel/blob");
  const { blobs } = await list({ prefix: "snapshots/" });
  const dates = blobs
    .map((b) => b.pathname.replace("snapshots/", "").replace(".json", ""))
    .filter((d) => d !== exclude)
    .sort();
  const pick = dates.slice(-n);
  const byDate = new Map(blobs.map((b) => [b.pathname, b.url]));
  return Promise.all(
    pick.map(async (d) => {
      const url = byDate.get(`snapshots/${d}.json`)!;
      const res = await fetch(url);
      return res.json();
    }),
  );
}
