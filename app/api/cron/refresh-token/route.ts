import type { NextRequest } from "next/server";
import { refreshLongLivedToken, persistTokenToVercel } from "@/lib/meta-token";
import { notify } from "@/lib/notify";

export const runtime = "nodejs";

/**
 * Refreshes the long-lived IG access token before it expires (~60-day life).
 * Scheduled well inside that window (see vercel.ts) so there's margin if a
 * run fails. Requires `Authorization: Bearer $CRON_SECRET`.
 */
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const { accessToken, expiresInSeconds } = await refreshLongLivedToken();
    const mode = await persistTokenToVercel(accessToken);
    const days = Math.round(expiresInSeconds / 86400);

    if (mode === "updated") {
      await notify(`🔑 IG token refreshed automatically, valid ~${days} more days.`);
    } else {
      await notify(
        `🔑 IG token refreshed (valid ~${days} days) but VERCEL_API_TOKEN/VERCEL_PROJECT_ID ` +
          `not set — update IG_ACCESS_TOKEN manually:\n${accessToken}`,
      );
    }
    return Response.json({ ok: true, mode, expiresInDays: days });
  } catch (e) {
    await notify(`❌ Token refresh failed: ${String(e)}`);
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
