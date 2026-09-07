/**
 * Dollars typed by a human -> integer cents, or null if it is not a plain
 * non-negative amount with at most two decimal places.
 *
 * Parsed out of the string rather than as `Math.round(Number(raw) * 100)`,
 * which is what `parseDraftCents` in sessionForm.ts still does. That form
 * multiplies a float: "0.29" becomes 28.999999999999996 and only survives
 * because of the rounding, and "1.005" rounds DOWN to 100 because the float is
 * really 1.00499999999999989. Splitting on the dot never leaves the integers.
 *
 * Deliberately strict: "40.005", "4e3", "-40" and "$40" are all rejected
 * rather than coerced, because this reads a setting that then prices every
 * buy-in in the group.
 */
export function parseDollarsToCents(raw: string): number | null {
  const trimmed = raw.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return null;
  const [whole, frac = ""] = trimmed.split(".");
  return Number(whole) * 100 + Number(frac.padEnd(2, "0"));
}

export function formatCents(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  const dollars = Math.floor(abs / 100);
  const remainder = abs % 100;
  return `${sign}$${dollars}.${remainder.toString().padStart(2, "0")}`;
}

export function formatSignedCents(cents: number): string {
  if (cents > 0) return `+${formatCents(cents)}`;
  return formatCents(cents);
}
