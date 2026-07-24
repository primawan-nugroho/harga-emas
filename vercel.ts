import { type VercelConfig } from "@vercel/config/v1";

/**
 * Vercel project config.
 *  - Daily post: 02:00 UTC == 09:00 WIB (Asia/Jakarta, UTC+7).
 *  - Token refresh: every 30 days, well inside the ~60-day token lifetime,
 *    so a single missed/failed run still leaves margin before expiry.
 * The cron routes validate `Authorization: Bearer $CRON_SECRET` themselves;
 * Vercel Cron sends this header automatically when CRON_SECRET is set on the
 * project.
 */
export const config: VercelConfig = {
  framework: "nextjs",
  crons: [
    { path: "/api/cron/run", schedule: "0 2 * * *" },
    { path: "/api/cron/refresh-token", schedule: "0 3 */30 * *" },
  ],
};
