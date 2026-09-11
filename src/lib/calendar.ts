/**
 * Month-grid arithmetic for the hand-rolled date picker.
 *
 * Kept out of the component because every one of these is a pure function of
 * a string, and because date maths done inline is where off-by-one bugs live.
 * Everything here speaks the same `YYYY-MM-DD` that `sessions.played_at` is,
 * so nothing ever converts through a `Date` at a call site.
 *
 * `Date` IS used inside, and only in local time — `new Date("2026-08-28")`
 * parses as UTC and comes back as the 27th for anyone west of Greenwich,
 * which is exactly the class of bug that puts a poker night on the wrong day.
 * Splitting the string and passing three numbers never touches UTC.
 */

export type CalendarDay = {
  /** `YYYY-MM-DD`, or null for a leading/trailing blank in the grid. */
  iso: string | null;
  /** Day of the month, for the label. */
  day: number;
};

export function toIsoDate(year: number, month: number, day: number): string {
  return [
    String(year).padStart(4, "0"),
    String(month + 1).padStart(2, "0"),
    String(day).padStart(2, "0"),
  ].join("-");
}

/** The three numbers behind a `YYYY-MM-DD`, with `month` zero-based. */
export function fromIsoDate(iso: string): {
  year: number;
  month: number;
  day: number;
} {
  const [year, month, day] = iso.split("-").map(Number);
  return { year, month: month - 1, day };
}

/**
 * A 7-column grid for one month, blank-padded to start on Sunday.
 *
 * Not padded to a fixed six rows: a five-week month should not draw an empty
 * sixth. The popover is absolutely positioned, so its height may vary.
 */
export function monthGrid(year: number, month: number): CalendarDay[] {
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: CalendarDay[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push({ iso: null, day: 0 });
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push({ iso: toIsoDate(year, month, day), day });
  }
  return cells;
}

/** `iso` moved by whole days, staying in `YYYY-MM-DD`. */
export function shiftIsoDate(iso: string, days: number): string {
  const { year, month, day } = fromIsoDate(iso);
  const moved = new Date(year, month, day + days);
  return toIsoDate(moved.getFullYear(), moved.getMonth(), moved.getDate());
}

/** `iso` moved by whole months, clamped to the end of a shorter month. */
export function shiftIsoMonth(iso: string, months: number): string {
  const { year, month, day } = fromIsoDate(iso);
  const target = new Date(year, month + months, 1);
  const lastDay = new Date(
    target.getFullYear(),
    target.getMonth() + 1,
    0
  ).getDate();
  return toIsoDate(
    target.getFullYear(),
    target.getMonth(),
    Math.min(day, lastDay)
  );
}

export function monthTitle(year: number, month: number): string {
  return new Date(year, month, 1).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
}

/** "Friday, 28 August 2026" — the long form, for a heading or a label. */
export function fullIsoDate(iso: string): string {
  const { year, month, day } = fromIsoDate(iso);
  return new Date(year, month, day).toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export const WEEKDAY_INITIALS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
