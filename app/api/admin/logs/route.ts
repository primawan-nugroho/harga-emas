import type { NextRequest } from "next/server";
import { recentRunLogs } from "@/lib/run-log";

export const runtime = "nodejs";

/**
 * Read-only view of recent daily-run outcomes (see lib/run-log.ts for why
 * this exists — Vercel's own runtime logs only retain ~1 hour on Hobby).
 * GET ?n=20  Requires Authorization: Bearer $CRON_SECRET.
 */
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const n = Number(new URL(req.url).searchParams.get("n") ?? "20");
  const logs = await recentRunLogs(n);
  return Response.json({ logs });
}
