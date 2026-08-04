/**
 * Uploads the rendered daily image to Vercel Blob and returns its public URL.
 *
 * Why this exists: the cron job previously pointed Instagram's Graph API at
 * `${req.url origin}/api/render`. That origin is the per-deployment URL when
 * invoked by Vercel Cron, which sits behind Vercel's Deployment Protection —
 * Instagram's fetch got a 302 login redirect instead of an image, so every
 * publish attempt silently failed (confirmed 2026-07-27, two missed days).
 * Uploading to a public Blob URL sidesteps that entirely, and is also faster
 * for Instagram's fetcher than a live-rendering endpoint with a scrape-heavy
 * cold start (~9s observed).
 */
export async function uploadDailyImage(date: string, png: ArrayBuffer, slide?: string): Promise<string> {
  const { put } = await import("@vercel/blob");
  const suffix = slide ? `-${slide}` : "";
  const { url } = await put(`images/${date}${suffix}.png`, png, {
    access: "public",
    contentType: "image/png",
    addRandomSuffix: false,
  });
  return url;
}
