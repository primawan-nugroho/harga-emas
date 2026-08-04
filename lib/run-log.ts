/**
 * Durable per-run log, persisted to Vercel Blob — Vercel's own runtime logs
 * only retain ~1 hour on Hobby, which made a real incident (2026-07-28)
 * impossible to diagnose after the fact. One JSON object per run, keyed by
 * execution timestamp so concurrent/retried runs never collide.
 */
export interface RunLogEntry {
  /** Data date (YYYY-MM-DD, Asia/Jakarta), not the execution timestamp. */
  date: string;
  /** ISO timestamp of when this run executed. */
  timestamp: string;
  status:
    | "published"
    | "skipped"
    | "dry_run"
    | "error"
    | "token_refreshed"
    | "token_refresh_manual";
  vendors: string[];
  failures: Array<{ vendor: string; error: string }>;
  carriedForward: string[];
  mediaId?: string;
  error?: string;
  /** Number of carousel slides published (1 = single image, the daily card
   * alone). Extra slides are additive-only — see app/api/cron/run/route.ts —
   * so a value of 1 here can mean either no extra slides were attempted, or
   * one was attempted and gracefully fell back. */
  slides?: number;
  /** Free-text context for non-post log entries (e.g. token refresh). */
  note?: string;
}

export async function appendRunLog(entry: RunLogEntry): Promise<void> {
  try {
    const { put } = await import("@vercel/blob");
    const key = `logs/${entry.timestamp.replace(/[:.]/g, "-")}.json`;
    await put(key, JSON.stringify(entry, null, 2), {
      access: "public",
      contentType: "application/json",
      addRandomSuffix: false,
    });
  } catch (e) {
    // Never let logging itself break the run.
    console.error("appendRunLog failed", e);
  }
}

/** Most recent N run log entries, newest first. */
export async function recentRunLogs(n = 20): Promise<RunLogEntry[]> {
  const { list } = await import("@vercel/blob");
  const { blobs } = await list({ prefix: "logs/" });
  const sorted = blobs.sort((a, b) => b.pathname.localeCompare(a.pathname));
  const picked = sorted.slice(0, n);
  return Promise.all(
    picked.map(async (b) => {
      const res = await fetch(b.url);
      return res.json();
    }),
  );
}
