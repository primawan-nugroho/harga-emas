import type { NextRequest } from "next/server";
import { buildDaily } from "@/lib/pipeline";
import { renderCardImage } from "@/lib/render-image";
import { uploadDailyImage } from "@/lib/image-store";
import { publishToInstagram } from "@/lib/instagram";
import { notify } from "@/lib/notify";
import { appendRunLog } from "@/lib/run-log";

export const runtime = "nodejs";
export const maxDuration = 60;

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

    // Render once and upload to Blob for a stable, publicly-fetchable URL.
    // Previously this pointed at ${req.url origin}/api/render, but Vercel
    // Cron invokes the per-deployment URL, which sits behind Deployment
    // Protection — Instagram's fetch got a login redirect instead of an
    // image and every publish silently failed (see image-store.ts).
    const imageBuffer = await renderCardImage(analysis).arrayBuffer();
    const imageUrl = await uploadDailyImage(analysis.date, imageBuffer);

    const failureNote = failures.length
      ? `\n⚠️ ${failures.map((f) => `${f.vendor} failed: ${f.error}`).join("; ")}`
      : "";
    const carryNote = carriedForward.length
      ? `\n↩️ Carried forward (fetch failed all day): ${carriedForward.join(", ")}`
      : "";
    const vendors = analysis.vendors.map((v) => v.vendor);

    if (process.env.DRY_RUN !== "false") {
      await notify(`🟡 DRY RUN ${analysis.date}${failureNote}${carryNote}\nImage: ${imageUrl}\n\n${caption}`);
      await appendRunLog({ date: analysis.date, timestamp, status: "dry_run", vendors, failures, carriedForward });
      return Response.json({ ok: true, dryRun: true, imageUrl, incomplete, failures, carriedForward });
    }

    if (incomplete) {
      // Refuse to publish a one-vendor "comparison" — one of the two fetches
      // failed this run (transient error, upstream change, etc).
      await notify(
        `⏭️ Skipped publishing ${analysis.date}: only ${analysis.vendors.length} vendor(s) available.${failureNote}${carryNote}`,
      );
      await appendRunLog({ date: analysis.date, timestamp, status: "skipped", vendors, failures, carriedForward });
      return Response.json({ ok: false, skipped: true, incomplete, failures, carriedForward }, { status: 202 });
    }

    const { mediaId } = await publishToInstagram({ imageUrl, caption });
    await notify(`✅ Published ${analysis.date} (media ${mediaId})${failureNote}${carryNote}`);
    await appendRunLog({
      date: analysis.date,
      timestamp,
      status: "published",
      vendors,
      failures,
      carriedForward,
      mediaId,
    });
    return Response.json({ ok: true, mediaId, imageUrl, failures, carriedForward });
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
