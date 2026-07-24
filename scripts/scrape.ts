/**
 * Offline scraper check: `npm run scrape`
 * Runs both scrapers and prints normalized JSON. Use this to verify endpoints
 * against the live sites before wiring the full pipeline.
 */
import { indoGold } from "../lib/scrapers/indogold";
import { logamMulia } from "../lib/scrapers/logammulia";

async function run() {
  for (const src of [logamMulia, indoGold]) {
    try {
      const prices = await src.fetchPrices();
      console.log(`\n✅ ${src.name}`);
      console.log(JSON.stringify(prices, null, 2));
    } catch (e) {
      console.error(`\n❌ ${src.name}:`, String(e));
    }
  }
}

run();
