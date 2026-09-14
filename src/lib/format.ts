export function formatPlayedAt(played_at: string): string {
  // played_at is a YYYY-MM-DD string from Postgres date column.
  const [y, m, d] = played_at.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function todayIsoDate(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * "Sep 13, 2026" — no weekday.
 *
 * `formatPlayedAt` names a *night*, and which night of the week it was is
 * part of what that means. A payout is a bank transfer; its weekday is noise,
 * and the four extra characters are the ones that wrap the row on a phone.
 */
export function formatDateShort(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
