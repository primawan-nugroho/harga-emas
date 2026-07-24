/** Asia/Jakarta (WIB, UTC+7) helpers — the app's canonical timezone. */

const JAKARTA_OFFSET_MS = 7 * 60 * 60 * 1000;

/** Current instant as an ISO string in WIB (with +07:00 offset). */
export function nowJakartaISO(): string {
  const wib = new Date(Date.now() + JAKARTA_OFFSET_MS);
  return wib.toISOString().replace("Z", "+07:00");
}

/** Today's date as YYYY-MM-DD in WIB. */
export function jakartaDate(d: Date = new Date()): string {
  return new Date(d.getTime() + JAKARTA_OFFSET_MS).toISOString().slice(0, 10);
}

/** Format IDR without decimals, e.g. 1300500 -> "Rp1.300.500". */
export function idr(n: number): string {
  return "Rp" + Math.round(n).toLocaleString("id-ID");
}
