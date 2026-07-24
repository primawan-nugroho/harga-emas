import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";
import { buildDaily } from "@/lib/pipeline";
import { idr } from "@/lib/time";
import type { Analysis } from "@/lib/types";

export const runtime = "nodejs";

/**
 * Renders the daily price card as a 1080x1350 PNG (Instagram portrait).
 * GET /api/render  -> live data
 */
export async function GET(_req: NextRequest) {
  const { analysis } = await buildDaily();
  return new ImageResponse(<Card a={analysis} />, { width: 1080, height: 1350 });
}

function Card({ a }: { a: Analysis }) {
  const gold = "#C9A227";
  const up = a.dayChange?.direction === "up";
  const arrow = a.dayChange ? (up ? "▲" : a.dayChange.direction === "down" ? "▼" : "■") : "";
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: "linear-gradient(160deg,#0b0b0f 0%,#171410 60%,#241d0e 100%)",
        color: "#f5f2e8",
        padding: 72,
        fontFamily: "sans-serif",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ fontSize: 34, color: gold, letterSpacing: 2 }}>HARGA EMAS HARI INI</div>
        <div style={{ fontSize: 26, color: "#9c968a" }}>{formatDate(a.date)}</div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 28, marginTop: 56 }}>
        {a.vendors.map((v) => (
          <div
            key={v.vendor}
            style={{
              display: "flex",
              flexDirection: "column",
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(201,162,39,0.35)",
              borderRadius: 24,
              padding: 32,
            }}
          >
            <div style={{ fontSize: 30, color: gold }}>
              {v.vendor === "indogold" ? "IndoGold" : "Logam Mulia (ANTAM)"}
            </div>
            <div style={{ display: "flex", gap: 48, marginTop: 12 }}>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontSize: 22, color: "#9c968a" }}>Beli / gram</span>
                <span style={{ fontSize: 46, fontWeight: 700 }}>{idr(v.pricePerGram)}</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontSize: 22, color: "#9c968a" }}>Buyback / gram</span>
                <span style={{ fontSize: 46, fontWeight: 700 }}>{idr(v.buyback)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {a.dayChange && (
        <div style={{ display: "flex", fontSize: 30, marginTop: 40, color: up ? "#6ee7a8" : "#f28b82" }}>
          {arrow} {Math.abs(a.dayChange.pct).toFixed(2)}% vs kemarin
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: "auto" }}>
        {a.insights.slice(0, 3).map((line, i) => (
          <div key={i} style={{ display: "flex", fontSize: 24, color: "#cfc9bb" }}>
            {`• ${line}`}
          </div>
        ))}
        <div style={{ fontSize: 18, color: "#7a7568", marginTop: 16 }}>
          Informatif, bukan saran investasi · @hargaemas
        </div>
      </div>
    </div>
  );
}

function formatDate(iso: string): string {
  return new Date(iso + "T00:00:00+07:00").toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  });
}
