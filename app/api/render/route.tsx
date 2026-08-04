import type { NextRequest } from "next/server";
import { buildDaily } from "@/lib/pipeline";
import { renderCardImage, renderSizeLadderImage } from "@/lib/render-image";

export const runtime = "nodejs";

/**
 * Renders a slide as a 1080x1350 PNG (Instagram portrait), using fresh live
 * data. Used for manual preview/debugging — the cron job renders and
 * uploads its own images to Blob rather than pointing Instagram at this
 * endpoint (see app/api/cron/run/route.ts for why).
 * GET /api/render            -> slide 1, the daily card
 * GET /api/render?slide=2    -> slide 2, the size ladder table
 */
export async function GET(req: NextRequest) {
  const { analysis } = await buildDaily();
  const slide = new URL(req.url).searchParams.get("slide");
  return slide === "2" ? renderSizeLadderImage(analysis) : renderCardImage(analysis);
}
