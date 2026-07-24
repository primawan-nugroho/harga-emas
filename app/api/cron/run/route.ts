import type { NextRequest } from "next/server";
import { buildDaily } from "@/lib/pipeline";
import { publishToInstagram } from "@/lib/instagram";
import { notify } from "@/lib/notify";

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

  try {
    const { caption, analysis, failures, incomplete } = await buildDaily();

    // Public PNG URL for the Graph API. In prod: render then upload to Blob and
    // use that URL. Here we point at our own /api/render (must be public https).
    const origin = new URL(req.url).origin;
    const imageUrl = `${origin}/api/render?d=${analysis.date}`;
    const failureNote = failures.length
      ? `\n⚠️ ${failures.map((f) => `${f.vendor} failed: ${f.error}`).join("; ")}`
      : "";

    if (process.env.DRY_RUN !== "false") {
      await notify(`🟡 DRY RUN ${analysis.date}${failureNote}\nImage: ${imageUrl}\n\n${caption}`);
      return Response.json({ ok: true, dryRun: true, imageUrl, incomplete, failures });
    }

    if (incomplete) {
      // Refuse to publish a one-vendor "comparison" — likely the Akamai-blocked
      // Logam Mulia scrape hasn't landed yet via the GitHub Actions fallback.
      await notify(
        `⏭️ Skipped publishing ${analysis.date}: only ${analysis.vendors.length} vendor(s) available.${failureNote}`,
      );
      return Response.json({ ok: false, skipped: true, incomplete, failures }, { status: 202 });
    }

    const { mediaId } = await publishToInstagram({ imageUrl, caption });
    await notify(`✅ Published ${analysis.date} (media ${mediaId})${failureNote}`);
    return Response.json({ ok: true, mediaId, failures });
  } catch (e) {
    await notify(`❌ Daily run failed: ${String(e)}`);
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
