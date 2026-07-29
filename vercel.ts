import { type VercelConfig } from "@vercel/config/v1";

/**
 * Vercel project config.
 *  - Daily post: 02:00 UTC == 09:00 WIB (Asia/Jakarta, UTC+7).
 *  - Token refresh: every 30 days, well inside the ~60-day token lifetime,
 *    so a single missed/failed run still leaves margin before expiry.
 *  - regions: sin1 (Singapore) instead of the default iad1 (US East). Several
 *    Indonesian vendor sites (confirmed: emasantam.id) block or rate-limit
 *    requests from US datacenter IPs but not Southeast Asian ones — running
 *    functions in-region avoids that entirely rather than working around it.
 * The cron routes validate `Authorization: Bearer $CRON_SECRET` themselves;
 * Vercel Cron sends this header automatically when CRON_SECRET is set on the
 * project.
 */
export const config: VercelConfig = {
  framework: "nextjs",
  regions: ["sin1"],
  crons: [
    { path: "/api/cron/run", schedule: "0 2 * * *" },
    { path: "/api/cron/refresh-token", schedule: "0 3 */30 * *" },
  ],
};
