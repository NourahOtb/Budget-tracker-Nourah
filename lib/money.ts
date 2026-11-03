// All amounts are stored as whole fils (1 KWD = 1000 fils) to avoid decimal errors.
export const FILS_PER_KWD = 1000;

/** Formats fils as KWD with three decimals, without a sign: 289700 -> "289.700". */
export function fmt(fils: number): string {
  const abs = Math.abs(Math.round(fils));
  const whole = Math.floor(abs / FILS_PER_KWD);
  const frac = abs % FILS_PER_KWD;
  return `${whole}.${String(frac).padStart(3, "0")}`;
}

/** Same as fmt with the currency: "289.700 KWD". */
export function fmtKwd(fils: number): string {
  return `${fmt(fils)} KWD`;
}

/**
 * Parses a typed KWD amount ("4.5", "12", "1,750") into fils.
 * Returns null for anything that isn't a positive amount with at most three decimals.
 */
export function parseKwd(text: string): number | null {
  const m = text.trim().match(/^(\d{1,7})(?:[.,](\d{1,3}))?$/);
  if (!m) return null;
  const fils = Number(m[1]) * FILS_PER_KWD + Number((m[2] ?? "").padEnd(3, "0"));
  return fils > 0 ? fils : null;
}
