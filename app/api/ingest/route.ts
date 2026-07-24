import type { NextRequest } from "next/server";
import { mergeSnapshot } from "@/lib/store";
import type { DailySnapshot } from "@/lib/types";

export const runtime = "nodejs";

/**
 * Fallback ingest endpoint for the GitHub Actions Playwright scraper
 * (used when a vendor requires a real browser, e.g. Akamai-protected
 * logammulia.com). POST a partial DailySnapshot (one or more vendors) with
 * `Authorization: Bearer $CRON_SECRET`; vendors are merged (upserted) into
 * whatever is already stored for that date, not overwritten.
 */
export async function POST(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const snap = (await req.json()) as DailySnapshot;
  if (!snap?.date || !Array.isArray(snap.vendors) || snap.vendors.length === 0) {
    return Response.json({ error: "invalid snapshot" }, { status: 400 });
  }
  const merged = await mergeSnapshot(snap.date, snap.vendors);
  return Response.json({ ok: true, date: merged.date, vendors: merged.vendors.map((v) => v.vendor) });
}
