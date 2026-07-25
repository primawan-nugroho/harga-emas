import type { Analysis } from "./types";
import { idr } from "./time";
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
 * Descriptive only + disclaimer. Optionally polish via AI Gateway later.
 */
export function buildCaption(a: Analysis): string {
  const lines: string[] = [];
  lines.push(`Harga Emas Hari Ini — ${formatDate(a.date)} 🪙`);
  lines.push("");

  for (const v of a.vendors) {
    lines.push(
      `${VENDOR_LABEL[v.vendor]}: beli ${idr(v.pricePerGram)}/gr · buyback ${idr(v.buyback)}/gr`,
    );
  }
  lines.push("");

  for (const line of a.insights) lines.push(`• ${line}`);
  lines.push("");

  lines.push("⚠️ Info harga bersifat informatif, bukan ajakan/saran investasi.");
  lines.push("Harga beli Antam dari sistem resmi COD Antam; buyback Antam & harga UBS dari data pembanding IndoGold.");
  lines.push("Selalu cek harga resmi di situs masing-masing vendor.");
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
