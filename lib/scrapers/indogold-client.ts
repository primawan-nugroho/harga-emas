/**
 * Shared client for IndoGold's pricelist API — used by both the "indogold"
 * and "antam" vendor scrapers, since a single call to the
 * "comparison_antamxubs" tab returns IndoGold, Antam, and UBS prices
 * side by side (verified 2026-07-24 via live browser inspection).
 *
 * Flow:
 *   1. GET /harga-emas-hari-ini to obtain a `ci_session` cookie AND a
 *      per-page-load `simulasi-token`, embedded in an inline <script> as:
 *        ...append("simulasi-token","<32-hex-token>")...
 *   2. POST /home/get_data_pricelist as multipart FormData:
 *        form            = JSON.stringify({ product: "comparison_antamxubs" })
 *        simulasi-token  = <token from step 1>
 *      with the ci_session cookie attached. Returns JSON:
 *        { data: { data_denom: { "1.0": { IndoGold: {...}, Antam: {...}, UBS: {...} } } } }
 */

const PAGE_URL = "https://www.indogold.id/harga-emas-hari-ini";
const API_URL = "https://www.indogold.id/home/get_data_pricelist";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0 Safari/537.36";

interface DenomEntry {
  harga?: string; // "Rp. 2,411,400"
  harga_buyback?: string;
}
export interface PricelistResponse {
  status: boolean;
  data?: {
    data_denom: Record<string, Record<string, DenomEntry>>;
  };
}

export function parseRp(s: string | undefined): number | undefined {
  if (!s) return undefined;
  const n = Number(s.replace(/[^\d]/g, ""));
  return Number.isFinite(n) ? n : undefined;
}

async function getSessionAndToken(): Promise<{ cookie: string; token: string }> {
  const res = await fetch(PAGE_URL, {
    headers: { "User-Agent": UA, Accept: "text/html" },
  });
  if (!res.ok) throw new Error(`indogold homepage ${res.status}`);
  const html = await res.text();

  const cookie = (res.headers.get("set-cookie") ?? "")
    .split(/,(?=\s*\w+=)/)
    .map((c) => c.split(";")[0].trim())
    .join("; ");
  const tokenMatch = html.match(/simulasi-token"?\s*,\s*"([a-f0-9]+)"/i);
  if (!cookie || !tokenMatch) {
    throw new Error("indogold: session cookie or simulasi-token not found (site changed?)");
  }
  return { cookie, token: tokenMatch[1] };
}

/** Fetch the comparison pricelist (IndoGold + Antam + UBS) in one call. */
export async function fetchComparisonPricelist(): Promise<PricelistResponse> {
  const { cookie, token } = await getSessionAndToken();
  const form = new FormData();
  form.append("form", JSON.stringify({ product: "comparison_antamxubs" }));
  form.append("simulasi-token", token);

  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "User-Agent": UA,
      Referer: PAGE_URL,
      Cookie: cookie,
    },
    body: form,
  });
  if (!res.ok) throw new Error(`indogold pricelist ${res.status}`);
  return res.json();
}
