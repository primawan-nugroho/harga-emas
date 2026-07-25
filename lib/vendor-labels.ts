import type { VendorName } from "./types";

/** Display label shown in the caption and rendered image. */
export const VENDOR_LABEL: Record<VendorName, string> = {
  indogold: "IndoGold",
  antam: "Antam",
  ubs: "UBS Gold",
};

/**
 * Official vendor logos (transparent, chosen to sit on the rendered image's
 * dark card background), confirmed with the user 2026-07-25.
 *
 * Antam uses the icon-only PNG mark, not the full "Logo-EAI-Baru-Putih.svg"
 * wordmark confirmed with the user — Satori (next/og's renderer) does not
 * rasterize remote SVG images via <img src>, only raster formats.
 */
export const VENDOR_LOGO: Record<VendorName, string> = {
  indogold: "https://www.indogold.id/template/Assets/img/indo-gold-logo-inverse.png",
  antam: "https://emasantam.id/wp-content/uploads/2022/01/cropped-Master-Logo-gunung-kotak-kecil-270x270.png",
  ubs: "https://ubsgold.com/storage/2024/03/logo-ubs-gold.png",
};

/** Intrinsic size (px) of each logo asset, for correct aspect-ratio rendering. */
export const VENDOR_LOGO_SIZE: Record<VendorName, { width: number; height: number }> = {
  indogold: { width: 186, height: 43 },
  antam: { width: 270, height: 270 },
  ubs: { width: 400, height: 225 },
};

/** Logo dimensions scaled to a fixed display height, preserving aspect ratio. */
export function logoDisplaySize(vendor: VendorName, displayHeight: number) {
  const { width, height } = VENDOR_LOGO_SIZE[vendor];
  return { width: Math.round((width / height) * displayHeight), height: displayHeight };
}

/** Display order for the caption and rendered image (top to bottom). */
export const VENDOR_ORDER: VendorName[] = ["antam", "ubs", "indogold"];

/** Sort any vendor-keyed array into the standard display order. */
export function sortByVendorOrder<T extends { vendor: VendorName }>(items: T[]): T[] {
  return [...items].sort(
    (a, b) => VENDOR_ORDER.indexOf(a.vendor) - VENDOR_ORDER.indexOf(b.vendor),
  );
}
