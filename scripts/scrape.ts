/**
 * Offline scraper check: `npm run scrape`
 * Runs all scrapers and prints normalized JSON. Use this to verify endpoints
 * against the live sites before wiring the full pipeline.
 */
import { indoGold } from "../lib/scrapers/indogold";
import { antam } from "../lib/scrapers/antam";
import { ubs } from "../lib/scrapers/ubs";
import { fetchWorldPrice } from "../lib/scrapers/world-gold";

async function run() {
  for (const src of [antam, indoGold, ubs]) {
    try {
      const prices = await src.fetchPrices();
      console.log(`\n✅ ${src.name}`);
      console.log(JSON.stringify(prices, null, 2));
    } catch (e) {
      console.error(`\n❌ ${src.name}:`, String(e));
    }
  }

  try {
    const world = await fetchWorldPrice();
    console.log(`\n✅ world-gold`);
    console.log(JSON.stringify(world, null, 2));
  } catch (e) {
    console.error(`\n❌ world-gold:`, String(e));
  }
}

run();
