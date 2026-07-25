import type { Analysis } from "./types";
import { idr, nowJakartaHHmm } from "./time";
import { VENDOR_LABEL } from "./vendor-labels";

const HASHTAGS = [
  "#hargaemas",
  "#emas",
  "#antam",
  "#indogold",
  "#ubsgold",
  "#investasiemas",
  "#emashariini",
];

/**
 * Build the Instagram caption (Bahasa Indonesia).
 * Descriptive only. Optionally polish via AI Gateway later.
 */
export function buildCaption(a: Analysis): string {
  const lines: string[] = [];
  lines.push(`Harga Emas Hari Ini — ${formatDate(a.date)} 🪙`);
  lines.push("");

  for (const v of a.vendors) {
    const change = a.vendorChanges[v.vendor];
    const changeText =
      change && change.direction !== "flat"
        ? ` (${change.direction === "up" ? "naik" : "turun"} ${Math.abs(change.pct).toFixed(2)}% vs kemarin)`
        : "";
    lines.push(
      `${VENDOR_LABEL[v.vendor]}: beli ${idr(v.pricePerGram)}/gr · buyback ${idr(v.buyback)}/gr${changeText}`,
    );
  }
  lines.push("");

  for (const line of a.insights) lines.push(`• ${line}`);
  lines.push("");

  lines.push(
    "Harga beli Antam & UBS dari situs resmi masing-masing vendor; buyback Antam & UBS mengacu data pembanding IndoGold.",
  );
  lines.push(`Data diambil dari website resmi masing-masing vendor pada pukul ${nowJakartaHHmm()} WIB.`);
  lines.push("");
  lines.push(HASHTAGS.join(" "));

  return lines.join("\n");
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
