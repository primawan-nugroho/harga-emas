import type { NextRequest } from "next/server";
import { buildDaily } from "@/lib/pipeline";
import { renderSlides, publishWithFallback } from "@/lib/carousel";
import { notify } from "@/lib/notify";
import { appendRunLog } from "@/lib/run-log";

export const runtime = "nodejs";
// Carousel adds a render + upload + container per extra slide on top of the
// proven ~5s single-image path; 300s (Vercel's platform default) leaves
// comfortable headroom even with the publish-retry backoff in a bad case.
export const maxDuration = 300;

/**
 * Daily orchestrator, triggered by Vercel Cron.
 * Security: requires `Authorization: Bearer $CRON_SECRET`.
 * Set DRY_RUN=true to render + notify WITHOUT publishing.
 */
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const timestamp = new Date().toISOString();

  try {
    const { caption, analysis, failures, incomplete, carriedForward } = await buildDaily();

    // See lib/carousel.ts: slide 2 is additive-only and never blocks this.
    const { imageUrls } = await renderSlides(analysis);
    const slides = imageUrls.length;

    const failureNote = failures.length
      ? `\n⚠️ ${failures.map((f) => `${f.vendor} failed: ${f.error}`).join("; ")}`
      : "";
    const carryNote = carriedForward.length
      ? `\n↩️ Carried forward (fetch failed all day): ${carriedForward.join(", ")}`
      : "";
    const slideNote = slides > 1 ? ` (${slides} slides)` : "";
    const vendors = analysis.vendors.map((v) => v.vendor);

    if (process.env.DRY_RUN !== "false") {
      await notify(
        `🟡 DRY RUN ${analysis.date}${slideNote}${failureNote}${carryNote}\nImage: ${imageUrls[0]}\n\n${caption}`,
      );
      await appendRunLog({
        date: analysis.date,
        timestamp,
        status: "dry_run",
        vendors,
        failures,
        carriedForward,
        slides,
      });
      return Response.json({ ok: true, dryRun: true, imageUrls, incomplete, failures, carriedForward, slides });
    }

    if (incomplete) {
      // Refuse to publish a one-vendor "comparison" — one of the fetches
      // failed this run (transient error, upstream change, etc).
      await notify(
        `⏭️ Skipped publishing ${analysis.date}: only ${analysis.vendors.length} vendor(s) available.${failureNote}${carryNote}`,
      );
      await appendRunLog({
        date: analysis.date,
        timestamp,
        status: "skipped",
        vendors,
        failures,
        carriedForward,
        slides,
      });
      return Response.json({ ok: false, skipped: true, incomplete, failures, carriedForward }, { status: 202 });
    }

    const { mediaId, publishedSlides } = await publishWithFallback(imageUrls, caption);
    await notify(`✅ Published ${analysis.date} (media ${mediaId})${slideNote}${failureNote}${carryNote}`);
    await appendRunLog({
      date: analysis.date,
      timestamp,
      status: "published",
      vendors,
      failures,
      carriedForward,
      mediaId,
      slides: publishedSlides,
    });
    return Response.json({ ok: true, mediaId, imageUrls, failures, carriedForward, slides: publishedSlides });
  } catch (e) {
    await notify(`❌ Daily run failed: ${String(e)}`);
    await appendRunLog({
      date: new Date().toISOString().slice(0, 10),
      timestamp,
      status: "error",
      vendors: [],
      failures: [],
      carriedForward: [],
      error: String(e),
    });
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
