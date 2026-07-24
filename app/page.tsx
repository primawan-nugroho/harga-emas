export default function Home() {
  return (
    <main style={{ padding: 48, maxWidth: 640, lineHeight: 1.6 }}>
      <h1>🪙 Harga Emas</h1>
      <p>Daily gold-price automation: IndoGold vs Logam Mulia (ANTAM) → Instagram.</p>
      <ul>
        <li>
          <a href="/api/render">/api/render</a> — preview today&apos;s image (PNG)
        </li>
        <li>
          <code>/api/cron/run</code> — daily orchestrator (needs CRON_SECRET)
        </li>
        <li>
          <code>/api/ingest</code> — snapshot ingest for the Playwright fallback
        </li>
      </ul>
    </main>
  );
}
