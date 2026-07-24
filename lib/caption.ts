import type { Analysis } from "./types";
import { idr } from "./time";

const HASHTAGS = [
  "#hargaemas",
  "#emas",
  "#logammulia",
  "#antam",
  "#indogold",
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
    const name = v.vendor === "indogold" ? "IndoGold" : "Logam Mulia";
    lines.push(`${name}: beli ${idr(v.pricePerGram)}/gr · buyback ${idr(v.buyback)}/gr`);
  }
  lines.push("");

  for (const line of a.insights) lines.push(`• ${line}`);
  lines.push("");

  lines.push("⚠️ Info harga bersifat informatif, bukan ajakan/saran investasi.");
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
