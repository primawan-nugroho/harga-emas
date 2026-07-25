import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";
import { buildDaily } from "@/lib/pipeline";
import { idr, nowJakartaHHmm } from "@/lib/time";
import type { Analysis, DayChange } from "@/lib/types";
import { VENDOR_LABEL, VENDOR_LOGO, logoDisplaySize } from "@/lib/vendor-labels";

export const runtime = "nodejs";

/**
 * Renders the daily price card as a 1080x1350 PNG (Instagram portrait).
 * GET /api/render  -> live data
 */
export async function GET(_req: NextRequest) {
  const { analysis } = await buildDaily();
  return new ImageResponse(<Card a={analysis} />, { width: 1080, height: 1350 });
}

function changeLabel(change: DayChange | undefined): { text: string; color: string } {
  if (!change || change.direction === "flat") return { text: "", color: "#9c968a" };
  const up = change.direction === "up";
  return {
    text: `${up ? "NAIK" : "TURUN"} ${Math.abs(change.pct).toFixed(2)}% vs kemarin`,
    color: up ? "#6ee7a8" : "#f28b82",
  };
}

/** SVG path `d` for a small sparkline from a price series (oldest -> newest). */
function sparklinePath(values: number[], width: number, height: number): string {
  if (values.length < 2) return "";
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const stepX = width / (values.length - 1);
  const points = values.map((v, i) => {
    const x = i * stepX;
    const y = height - ((v - min) / range) * height;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return `M${points.join(" L")}`;
}

function Sparkline({ values, color }: { values: number[]; color: string }) {
  const width = 140;
  const height = 40;
  const d = sparklinePath(values, width, height);
  if (!d) return null;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <path d={d} stroke={color} strokeWidth={3} fill="none" />
    </svg>
  );
}

function Card({ a }: { a: Analysis }) {
  const gold = "#C9A227";
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

      <div style={{ display: "flex", flexDirection: "column", gap: 24, marginTop: 48 }}>
        {a.vendors.map((v) => {
          const change = changeLabel(a.vendorChanges[v.vendor]);
          const trend = a.vendorTrends[v.vendor] ?? [];
          return (
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
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={VENDOR_LOGO[v.vendor]} {...logoDisplaySize(v.vendor, 34)} />
                  <div style={{ display: "flex", fontSize: 30, color: gold }}>{VENDOR_LABEL[v.vendor]}</div>
                </div>
                {trend.length >= 2 && (
                  <Sparkline values={trend} color={change.color !== "#9c968a" ? change.color : "#C9A227"} />
                )}
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
              {change.text && (
                <div style={{ display: "flex", fontSize: 22, color: change.color, marginTop: 10 }}>
                  {change.text}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: "auto" }}>
        {a.insights.slice(0, 3).map((line, i) => (
          <div key={i} style={{ display: "flex", fontSize: 24, color: "#cfc9bb" }}>
            {`• ${line}`}
          </div>
        ))}
        <div style={{ display: "flex", flexDirection: "column", marginTop: 16 }}>
          <div style={{ fontSize: 16, color: "#7a7568" }}>
            {`Data diambil dari website resmi masing-masing vendor pada pukul ${nowJakartaHHmm()} WIB.`}
          </div>
          <div style={{ fontSize: 18, color: "#7a7568", marginTop: 6 }}>@harga.emas</div>
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
