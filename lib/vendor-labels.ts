import type { VendorName } from "./types";

/** Display label shown in the caption and rendered image. */
export const VENDOR_LABEL: Record<VendorName, string> = {
  indogold: "IndoGold",
  antam: "Antam",
  ubs: "UBS Gold",
};

/** Display order for the caption and rendered image (top to bottom). */
export const VENDOR_ORDER: VendorName[] = ["antam", "ubs", "indogold"];

/** Sort any vendor-keyed array into the standard display order. */
export function sortByVendorOrder<T extends { vendor: VendorName }>(items: T[]): T[] {
  return [...items].sort(
    (a, b) => VENDOR_ORDER.indexOf(a.vendor) - VENDOR_ORDER.indexOf(b.vendor),
  );
}
