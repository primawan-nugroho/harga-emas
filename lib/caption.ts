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

  const premiumEntries = a.vendors
    .map((v) => {
      const pct = a.worldPremium[v.vendor];
      return pct == null ? null : `${VENDOR_LABEL[v.vendor]} ${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`;
    })
    .filter((s): s is string => s != null);
  if (a.worldPrice && premiumEntries.length > 0) {
    lines.push("Selisih terhadap harga emas dunia hari ini:");
    lines.push(`• ${premiumEntries.join(" · ")}`);
    lines.push("");
    lines.push(
      "Catatan: selisih ini mencakup biaya cetak, sertifikat, distribusi, dan pajak — bukan semata keuntungan penjual.",
    );
    lines.push("Acuan dunia: COMEX gold futures & kurs USD/IDR.");
    lines.push("");
  }

  if (a.bestSizePremiumVendor) {
    const info = a.sizePremium[a.bestSizePremiumVendor]!;
    lines.push(
      `Tahukah kamu: ${VENDOR_LABEL[a.bestSizePremiumVendor]} pecahan ${info.smallestSize}g lebih mahal ${info.premiumPct >= 0 ? "+" : ""}${info.premiumPct.toFixed(1)}% per gram dibanding pecahan ${info.largestSize}g.`,
    );
    lines.push("");
  }

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
