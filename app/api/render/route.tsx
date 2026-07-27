import type { NextRequest } from "next/server";
import { buildDaily } from "@/lib/pipeline";
import { renderCardImage } from "@/lib/render-image";

export const runtime = "nodejs";

/**
 * Renders the daily price card as a 1080x1350 PNG (Instagram portrait), using
 * fresh live data. Used for manual preview/debugging — the cron job renders
 * and uploads its own image to Blob rather than pointing Instagram at this
 * endpoint (see app/api/cron/run/route.ts for why).
 * GET /api/render  -> live data
 */
export async function GET(_req: NextRequest) {
  const { analysis } = await buildDaily();
  return renderCardImage(analysis);
}
