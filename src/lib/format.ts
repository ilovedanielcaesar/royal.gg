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

/** The day after `isoDate`. Periods are stored half-open and shown closed. */
export function nextIsoDate(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const next = new Date(y, m - 1, d + 1);
  return [
    next.getFullYear(),
    String(next.getMonth() + 1).padStart(2, "0"),
    String(next.getDate()).padStart(2, "0"),
  ].join("-");
}

/**
 * "Aug 3 – Sep 13, 2026" — a payout period, both ends inclusive.
 *
 * The year is written once when both ends share one, which is the common case
 * and the one where repeating it pushes the row into a second line on a phone.
 * A null `from` means the league's own beginning; a null `to` means the period
 * has not been settled yet.
 */
export function formatDateRange(from: string | null, to: string | null): string {
  if (!from) return to ? `Through ${formatDateShort(to)}` : "All time";
  if (!to) return `${formatDateShort(from)} – now`;
  const sameYear = from.slice(0, 4) === to.slice(0, 4);
  const [y, m, d] = from.split("-").map(Number);
  const start = sameYear
    ? new Date(y, m - 1, d).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      })
    : formatDateShort(from);
  return `${start} – ${formatDateShort(to)}`;
}
