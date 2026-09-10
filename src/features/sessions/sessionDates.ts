import type { Session } from "../../lib/stats";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;
const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

export type SessionDateParts = {
  year: number;
  month: number;
  day: number;
};

export function sessionDateParts(playedAt: string): SessionDateParts {
  const [year = 0, month = 1, day = 1] = playedAt.split("-").map(Number);
  return { year, month, day };
}

export function shortSessionDate(playedAt: string): string {
  const { month, day } = sessionDateParts(playedAt);
  return `${day} ${MONTHS[month - 1]?.slice(0, 3) ?? ""}`;
}

export function fullSessionDate(playedAt: string): string {
  const { year, month, day } = sessionDateParts(playedAt);
  const weekday = WEEKDAYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
  return `${weekday} ${day} ${MONTHS[month - 1]} ${year}`;
}

export function sessionMonthKey(playedAt: string): string {
  return playedAt.slice(0, 7);
}

export function sessionMonthLabel(playedAt: string): string {
  const { year, month } = sessionDateParts(playedAt);
  return `${MONTHS[month - 1]} ${year}`;
}

export function formatSessionDateRange(sessions: Session[]): string | null {
  if (sessions.length === 0) return null;
  const dates = sessions.map((session) => session.played_at).sort();
  const first = sessionDateParts(dates[0]!);
  const last = sessionDateParts(dates[dates.length - 1]!);
  const firstYear = first.year === last.year ? "" : ` ${first.year}`;
  return `${first.day} ${MONTHS[first.month - 1]?.slice(0, 3)}${firstYear} – ${last.day} ${MONTHS[last.month - 1]?.slice(0, 3)} ${last.year}`;
}

export function formatSessionsSubtitle(sessions: Session[]): string {
  if (sessions.length === 0) return "No nights logged yet.";
  const first = [...sessions].sort((a, b) =>
    a.played_at.localeCompare(b.played_at)
  )[0]!;
  const { month, day } = sessionDateParts(first.played_at);
  const noun = sessions.length === 1 ? "night" : "nights";
  return `${sessions.length} ${noun} logged since ${day} ${MONTHS[month - 1]}.`;
}
