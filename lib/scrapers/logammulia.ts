import type { GoldSource, VendorPrices } from "../types";
import { nowJakartaISO } from "../time";

/**
 * Logam Mulia (ANTAM) scraper.
 *
 * Verified 2026-07-24 via live browser inspection: prices are plain
 * server-rendered HTML — no CSRF token or XHR involved.
 *   - Buy (Harga Dasar, pre-tax) table: GET /id/harga-emas-hari-ini
 *       <td>1 gr</td><td ...>2,605,000</td><!-- --><td ...>2,611,513</td>
 *   - Buyback: GET /sell/gold
 *       <input type="hidden" id="valBasePrice" value="2345000.00">
 *
 * IMPORTANT — confirmed constraint: logammulia.com sits behind Akamai bot
 * protection that 403s plain datacenter-IP requests (verified via curl from
 * this environment). Vercel serverless functions egress from AWS datacenter
 * IPs and are likely to be blocked the same way. If direct fetch below fails
 * in production, fall back to the GitHub Actions + Playwright path documented
 * in README.md, POSTing the snapshot to /api/ingest instead.
 */

const BUY_URL = "https://www.logammulia.com/id/harga-emas-hari-ini";
const SELL_URL = "https://www.logammulia.com/sell/gold";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0 Safari/537.36";

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": UA,
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "id-ID,id;q=0.9",
    },
  });
  if (!res.ok) {
    throw new Error(
      `logammulia ${url} -> ${res.status} (Akamai bot-block likely if 403; ` +
        `use the GitHub Actions/Playwright fallback — see README.md)`,
    );
  }
  return res.text();
}

/** Extract the "1 gr" row's Harga Dasar from the buy table. */
function extractBuyPrice(html: string): number {
  const m = html.match(/<td>\s*1\s*gr\s*<\/td>\s*<td[^>]*>\s*([\d,.]+)\s*<\/td>/i);
  if (!m) throw new Error("logammulia: 1gr row not found in buy table (site changed?)");
  return Number(m[1].replace(/,/g, ""));
}

/** Extract the buyback price from the hidden #valBasePrice input. */
function extractBuybackPrice(html: string): number {
  const m = html.match(/id="valBasePrice"\s+value="([\d.]+)"/i);
  if (!m) throw new Error("logammulia: valBasePrice not found (site changed?)");
  return Math.round(Number(m[1]));
}

export const logamMulia: GoldSource = {
  name: "logammulia",
  async fetchPrices(): Promise<VendorPrices> {
    const [buyHtml, sellHtml] = await Promise.all([
      fetchHtml(BUY_URL),
      fetchHtml(SELL_URL),
    ]);
    const pricePerGram = extractBuyPrice(buyHtml);
    const buyback = extractBuybackPrice(sellHtml);
    if (!(pricePerGram > 0) || !(buyback > 0)) {
      throw new Error("logammulia: implausible prices");
    }
    return {
      vendor: "logammulia",
      pricePerGram,
      buyback,
      fetchedAt: nowJakartaISO(),
    };
  },
};
