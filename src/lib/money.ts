export const DEFAULT_BUY_IN_CENTS = 4000;

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
