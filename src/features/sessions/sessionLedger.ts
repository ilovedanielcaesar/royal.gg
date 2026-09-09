import type {
  SessionFilter,
  SessionLedgerRow,
  SessionSort,
  SessionsSummary,
} from "./useSessionsData";

export const SESSION_FILTERS: Array<{
  value: SessionFilter;
  label: string;
}> = [
  { value: "all", label: "All" },
  { value: "reconciled", label: "Reconciled" },
  { value: "draft", label: "Draft" },
  { value: "review", label: "Needs review" },
];

export function matchesSessionFilter(
  row: SessionLedgerRow,
  filter: SessionFilter
): boolean {
  if (filter === "all") return true;
  if (filter === "reconciled") return row.session.reconciled;
  if (filter === "review") return row.session.needs_review;
  return row.session.status !== "approved" && !row.session.needs_review;
}

export function compareSessionRows(
  a: SessionLedgerRow,
  b: SessionLedgerRow,
  sort: SessionSort
): number {
  const date = a.session.played_at.localeCompare(b.session.played_at);
  const id = a.session.id.localeCompare(b.session.id);
  if (sort === "oldest") return date || id;
  if (sort === "action") {
    return b.actionScore - a.actionScore || -date || -id;
  }
  if (sort === "biggest-win") {
    const aWin = a.biggestWinCents ?? Number.NEGATIVE_INFINITY;
    const bWin = b.biggestWinCents ?? Number.NEGATIVE_INFINITY;
    return bWin - aWin || -date || -id;
  }
  return -date || -id;
}

export function countForSessionFilter(
  counts: SessionsSummary,
  filter: SessionFilter
): number {
  // Spelled out rather than `counts[filter]`. The filter union and the
  // summary's field names are not the same vocabulary — "draft" against
  // "drafted" — and indexing one with the other is a rename away from
  // breaking, which is how it arrived.
  switch (filter) {
    case "all":
      return counts.nights;
    case "reconciled":
      return counts.reconciled;
    case "draft":
      return counts.drafted;
    case "review":
      return counts.review;
  }
}
