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
    // YOUR net, not the night's best result. "Individual highest win" reads
    // as a claim about the person reading it, and sorting by whoever happened
    // to win that night answered a question nobody asked — every player saw
    // the same order.
    //
    // Descending net puts your profitable nights first and your losses after
    // them, worst last. A night you did not play sorts below every night you
    // did, however badly it went: absence is not a result, and ranking it
    // among them would put an empty row above a real one.
    const aNet = a.yourNetCents ?? Number.NEGATIVE_INFINITY;
    const bNet = b.yourNetCents ?? Number.NEGATIVE_INFINITY;
    return bNet - aNet || -date || -id;
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
