/**
 * Headless-browser fallback for Logam Mulia, run from GitHub Actions
 * (see .github/workflows/scrape-logammulia.yml).
 *
 * Why this exists: logammulia.com sits behind Akamai bot protection that
 * blocks plain server-side fetches from datacenter IPs — confirmed against
 * both a generic curl and Vercel's production serverless egress IPs. GitHub
 * Actions runners are also datacenter IPs and MAY be blocked too; a real
 * browser context (Playwright/Chromium) is the most reliable workaround
 * since it presents a full browser fingerprint, not just a User-Agent string.
 *
 * Posts the scraped vendor to POST {APP_URL}/api/ingest, which merges it
 * into that day's snapshot without disturbing whatever IndoGold data the
 * Vercel cron already scraped directly.
 */
import { chromium } from "playwright";

const APP_URL = process.env.APP_URL;
const CRON_SECRET = process.env.CRON_SECRET;

function jakartaDate(): string {
  const wib = new Date(Date.now() + 7 * 60 * 60 * 1000);
  return wib.toISOString().slice(0, 10);
}

async function main() {
  if (!APP_URL || !CRON_SECRET) {
    throw new Error("Missing APP_URL or CRON_SECRET env var");
  }

  const browser = await chromium.launch();
  const page = await browser.newPage();

  await page.goto("https://www.logammulia.com/id/harga-emas-hari-ini", {
    waitUntil: "domcontentloaded",
  });
  const buyText = await page.locator("table").first().innerText();
  const buyMatch = buyText.match(/1 gr\s+([\d,.]+)/);
  if (!buyMatch) throw new Error("1gr buy price row not found on harga-emas-hari-ini");
  const pricePerGram = Number(buyMatch[1].replace(/,/g, ""));

  await page.goto("https://www.logammulia.com/sell/gold", { waitUntil: "domcontentloaded" });
  const buybackAttr = await page.locator("#valBasePrice").getAttribute("value");
  if (!buybackAttr) throw new Error("#valBasePrice not found on /sell/gold");
  const buyback = Math.round(Number(buybackAttr));

  await browser.close();

  if (!(pricePerGram > 0) || !(buyback > 0)) {
    throw new Error(`Implausible prices: buy=${pricePerGram} buyback=${buyback}`);
  }

  const snapshot = {
    date: jakartaDate(),
    vendors: [
      {
        vendor: "logammulia",
        pricePerGram,
        buyback,
        fetchedAt: new Date().toISOString(),
      },
    ],
  };

  const res = await fetch(`${APP_URL}/api/ingest`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${CRON_SECRET}`,
    },
    body: JSON.stringify(snapshot),
  });
  if (!res.ok) {
    throw new Error(`ingest failed: ${res.status} ${await res.text()}`);
  }
  console.log("Ingested:", JSON.stringify(snapshot));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
