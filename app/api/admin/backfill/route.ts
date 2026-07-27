import type { NextRequest } from "next/server";
import { getSnapshot, recentSnapshots } from "@/lib/store";
import { analyze } from "@/lib/analyze";
import { buildCaption } from "@/lib/caption";
import { renderCardImage } from "@/lib/render-image";
import { uploadDailyImage } from "@/lib/image-store";
import { publishToInstagram } from "@/lib/instagram";
import { VENDOR_ORDER } from "@/lib/vendor-labels";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * One-off backfill for a missed day, using that day's already-stored real
 * snapshot (never fabricates data). Publishes exactly what /api/cron/run
 * would have published that day, had the image-URL bug not blocked it.
 * TEMPORARY — remove after backfilling 2026-07-26.
 *
 * GET ?date=YYYY-MM-DD&dry=true  -> render + return caption/imageUrl, no publish
 * GET ?date=YYYY-MM-DD           -> actually publish
 * Requires Authorization: Bearer $CRON_SECRET.
 */
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date");
  const dry = searchParams.get("dry") === "true";
  if (!date) return Response.json({ error: "missing ?date=YYYY-MM-DD" }, { status: 400 });

  const snapshot = await getSnapshot(date);
  if (!snapshot) return Response.json({ error: `no stored snapshot for ${date}` }, { status: 404 });
  if (snapshot.vendors.length < VENDOR_ORDER.length) {
    return Response.json(
      { error: `incomplete snapshot for ${date}: only ${snapshot.vendors.length} vendor(s)` },
      { status: 422 },
    );
  }

  // Strictly-before-`date` history only — recentSnapshots just excludes the
  // exact date, it doesn't know "date" isn't the latest, so days after it
  // (e.g. today, already stored) must be filtered out explicitly here.
  const allRecent = await recentSnapshots(30, date);
  const history = allRecent.filter((s) => s.date < date);

  const analysis = analyze(snapshot, history);
  const caption = buildCaption(analysis);
  const imageBuffer = await renderCardImage(analysis).arrayBuffer();
  const imageUrl = await uploadDailyImage(date, imageBuffer);

  if (dry) {
    return Response.json({ ok: true, dry: true, date, imageUrl, caption });
  }

  const { mediaId } = await publishToInstagram({ imageUrl, caption });
  return Response.json({ ok: true, date, mediaId, imageUrl, caption });
}
