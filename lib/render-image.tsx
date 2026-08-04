import { ImageResponse } from "next/og";
import type { ReactNode } from "react";
import { idr, nowJakartaHHmm } from "./time";
import type { Analysis, DayChange } from "./types";
import { VENDOR_LABEL, VENDOR_LOGO, VENDOR_ORDER, logoDisplaySize } from "./vendor-labels";
import { buildSizeLadderRows } from "./size-ladder";

const GOLD = "#C9A227";

/** Renders the daily price card as a 1080x1350 PNG (Instagram portrait). */
export function renderCardImage(a: Analysis): ImageResponse {
  return new ImageResponse(<Card a={a} />, { width: 1080, height: 1350 });
}

/**
 * Renders the carousel's slide 2: the full size ladder for every vendor,
 * across all 3 vendors x up to 12 sizes each — 22 real numbers we already
 * scrape daily but only ever showed 3 of, on slide 1. Additive-only: if
 * this fails, the caller (app/api/cron/run/route.ts) falls back to
 * publishing slide 1 alone rather than blocking the daily post.
 */
export function renderSizeLadderImage(a: Analysis): ImageResponse {
  return new ImageResponse(<SizeLadderCard a={a} />, { width: 1080, height: 1350 });
}

/** Shared outer frame (background, padding, font) for every slide. */
function PageShell({ children }: { children: ReactNode }) {
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
      {children}
    </div>
  );
}

function directionColor(direction: DayChange["direction"]): string {
  return direction === "up" ? "#6ee7a8" : direction === "down" ? "#f28b82" : "#9c968a";
}

/** Small triangle (up/down) or dash (flat), drawn as an SVG polygon rather
 * than the classic CSS transparent-border trick — that trick renders as a
 * solid square in Satori (tested, both shorthand and longhand border props),
 * but SVG shapes render correctly here (same mechanism the sparkline uses). */
function DirectionIcon({ direction, color }: { direction: DayChange["direction"]; color: string }) {
  if (direction === "up" || direction === "down") {
    const points = direction === "up" ? "7,0 14,12 0,12" : "0,0 14,0 7,12";
    return (
      <svg width={14} height={12} viewBox="0 0 14 12">
        <polygon points={points} fill={color} />
      </svg>
    );
  }
  return <div style={{ width: 14, height: 4, borderRadius: 2, background: color }} />;
}

/** Badge shown to the right of each vendor's name: is today's price up,
 * down, or unchanged vs yesterday. Only renders once a real prior-day price
 * exists to compare against (see pipeline.ts's carry-forward for why that
 * might briefly be missing after a multi-day vendor outage). */
function DirectionBadge({ change }: { change: DayChange | undefined }) {
  if (!change) return null;
  const color = directionColor(change.direction);
  const label =
    change.direction === "up" ? "NAIK" : change.direction === "down" ? "TURUN" : "TETAP";
  const pct = change.direction === "flat" ? "" : ` ${Math.abs(change.pct).toFixed(2)}%`;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        background: "rgba(255,255,255,0.06)",
        border: `1px solid ${color}66`,
        borderRadius: 12,
        padding: "8px 14px",
      }}
    >
      <DirectionIcon direction={change.direction} color={color} />
      <div style={{ display: "flex", fontSize: 20, color, fontWeight: 700 }}>{`${label}${pct}`}</div>
    </div>
  );
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

function fmtPct(pct: number): string {
  return `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`;
}

function Card({ a }: { a: Analysis }) {
  const gold = GOLD;
  return (
    <PageShell>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ fontSize: 34, color: gold, letterSpacing: 2 }}>HARGA EMAS HARI INI</div>
        <div style={{ fontSize: 26, color: "#9c968a" }}>{formatDate(a.date)}</div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 24, marginTop: 48 }}>
        {a.vendors.map((v) => {
          const change = a.vendorChanges[v.vendor];
          const trend = a.vendorTrends[v.vendor] ?? [];
          const sparkColor = change ? directionColor(change.direction) : "#C9A227";
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
                <DirectionBadge change={change} />
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 12 }}>
                <div style={{ display: "flex", gap: 48 }}>
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    <span style={{ fontSize: 22, color: "#9c968a" }}>Beli / gram</span>
                    <span style={{ fontSize: 46, fontWeight: 700 }}>{idr(v.pricePerGram)}</span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    <span style={{ fontSize: 22, color: "#9c968a" }}>Buyback / gram</span>
                    <span style={{ fontSize: 46, fontWeight: 700 }}>{idr(v.buyback)}</span>
                  </div>
                </div>
                {trend.length >= 2 && <Sparkline values={trend} color={sparkColor} />}
              </div>
              {a.worldPremium[v.vendor] != null && (
                <div style={{ display: "flex", fontSize: 20, color: "#9c968a", marginTop: 10 }}>
                  {`${fmtPct(a.worldPremium[v.vendor]!)} vs harga dunia`}
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
        {a.worldPrice && (
          <div style={{ display: "flex", fontSize: 20, color: "#cfc9bb" }}>
            {`• Harga emas dunia: ${idr(a.worldPrice.idrPerGram)}/gr (COMEX, kurs ${Math.round(a.worldPrice.usdIdr).toLocaleString("id-ID")})`}
          </div>
        )}
        {a.bestSizePremiumVendor && (
          <div style={{ display: "flex", fontSize: 20, color: "#cfc9bb" }}>
            {(() => {
              const info = a.sizePremium[a.bestSizePremiumVendor]!;
              return `• ${VENDOR_LABEL[a.bestSizePremiumVendor]} pecahan ${info.smallestSize}g lebih mahal ${fmtPct(info.premiumPct)} per gram vs ${info.largestSize}g.`;
            })()}
          </div>
        )}
        <div style={{ display: "flex", flexDirection: "column", marginTop: 16 }}>
          <div style={{ fontSize: 16, color: "#7a7568" }}>
            {`Data diambil dari website resmi masing-masing vendor pada pukul ${nowJakartaHHmm()} WIB.`}
          </div>
          <div style={{ fontSize: 18, color: "#7a7568", marginTop: 6 }}>@harga.emas</div>
        </div>
      </div>
    </PageShell>
  );
}

/**
 * Carousel slide 2: every vendor's full size ladder in one table (up to
 * 12 rows x 3 vendors), with the per-gram premium headline as a footer.
 * Shows total price per bar — the number a buyer actually looks up.
 */
function SizeLadderCard({ a }: { a: Analysis }) {
  const rows = buildSizeLadderRows(a.vendors);
  const vendorsInOrder = VENDOR_ORDER.filter((v) => a.vendors.some((av) => av.vendor === v));

  return (
    <PageShell>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ fontSize: 34, color: GOLD, letterSpacing: 2 }}>DAFTAR HARGA PER PECAHAN</div>
        <div style={{ fontSize: 26, color: "#9c968a" }}>{formatDate(a.date)}</div>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          marginTop: 40,
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(201,162,39,0.35)",
          borderRadius: 24,
          padding: "8px 32px",
        }}
      >
        <div style={{ display: "flex", padding: "16px 0", borderBottom: "1px solid rgba(201,162,39,0.35)" }}>
          <div style={{ display: "flex", width: 140, fontSize: 20, color: "#9c968a" }}>Gramasi</div>
          {vendorsInOrder.map((vendor) => (
            <div key={vendor} style={{ display: "flex", flex: 1, fontSize: 20, color: "#9c968a", justifyContent: "flex-end" }}>
              {VENDOR_LABEL[vendor]}
            </div>
          ))}
        </div>
        {rows.map((row, i) => (
          <div
            key={row.grams}
            style={{
              display: "flex",
              padding: "14px 0",
              borderBottom: i < rows.length - 1 ? "1px solid rgba(255,255,255,0.06)" : undefined,
            }}
          >
            <div style={{ display: "flex", width: 140, fontSize: 22, fontWeight: 700, color: GOLD }}>
              {row.label}
            </div>
            {vendorsInOrder.map((vendor) => (
              <div key={vendor} style={{ display: "flex", flex: 1, fontSize: 22, justifyContent: "flex-end" }}>
                {row.prices[vendor] != null ? idr(row.prices[vendor]!) : "—"}
              </div>
            ))}
          </div>
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: "auto" }}>
        {a.bestSizePremiumVendor && (
          <div style={{ display: "flex", fontSize: 22, color: "#cfc9bb" }}>
            {(() => {
              const info = a.sizePremium[a.bestSizePremiumVendor]!;
              return `• ${VENDOR_LABEL[a.bestSizePremiumVendor]} pecahan ${info.smallestSize}g lebih mahal ${fmtPct(info.premiumPct)} per gram vs ${info.largestSize}g.`;
            })()}
          </div>
        )}
        <div style={{ display: "flex", fontSize: 20, color: "#cfc9bb" }}>
          {"• Harga di atas adalah harga total per pecahan, bukan per gram."}
        </div>
        <div style={{ display: "flex", flexDirection: "column", marginTop: 16 }}>
          <div style={{ fontSize: 16, color: "#7a7568" }}>
            {`Data diambil dari website resmi masing-masing vendor pada pukul ${nowJakartaHHmm()} WIB.`}
          </div>
          <div style={{ fontSize: 18, color: "#7a7568", marginTop: 6 }}>@harga.emas</div>
        </div>
      </div>
    </PageShell>
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
