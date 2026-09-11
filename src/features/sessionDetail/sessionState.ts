import { formatCents, formatSignedCents } from "../../lib/money";

/**
 * The four conditions the session page renders under.
 *
 * `_FEEDBACK_V2.md` stacks all four on one artboard because they are one page
 * under different conditions, and three of them share a layout: a night that
 * is being written, a saved draft that balances and a saved draft that does
 * not are all the editor, differing only in what the banner says. Approved is
 * the one that changes shape — "who's at the table" goes, and what is left is
 * the settled record.
 *
 * `new` is not a database status. It is the page before its first save, and
 * it exists here so the banner can say "nothing saved yet" instead of
 * claiming a draft that has no row behind it.
 */
export type SessionState = "new" | "draft" | "review" | "approved";

export function sessionState(
  status: "draft" | "approved" | null,
  needsReview: boolean
): SessionState {
  if (status === null) return "new";
  if (status === "approved") return "approved";
  return needsReview ? "review" : "draft";
}

export const isEditable = (state: SessionState) => state !== "approved";

type Pill = { label: string; classes: string };

/**
 * The badge in the reconcile banner, which is the only place the state is
 * named while a night is being written.
 *
 * `discrepancyCents` is buy-ins minus reported cash-outs, the same sign
 * `reconcile()` returns: positive means chips came up short. It is money, so
 * it goes through `formatCents`; the pill's colour is state, not money, which
 * is why it does not go through `moneyToneClass`.
 */
export function statePill(
  state: SessionState,
  discrepancyCents: number,
  thresholdCents: number
): Pill {
  const gold = "bg-gold-500/20 text-gold-ink";
  const sage = "bg-sage-600/15 text-sage-700";
  const crimson = "bg-crimson-600/10 text-crimson-700";

  if (state === "approved") {
    return { label: "Approved", classes: sage };
  }
  if (state === "review" || Math.abs(discrepancyCents) > thresholdCents) {
    return {
      label: `Needs review · off by ${formatCents(Math.abs(discrepancyCents))}`,
      classes: crimson,
    };
  }
  if (discrepancyCents === 0) {
    return {
      label: state === "new" ? "Balanced · $0.00" : "Draft · balanced",
      classes: state === "new" ? sage : gold,
    };
  }
  return {
    label: `Draft · ${formatSignedCents(-discrepancyCents)} to distribute`,
    classes: gold,
  };
}

/** The one muted line under the page title, per state. */
export function stateSubtitle(state: SessionState): string {
  switch (state) {
    case "approved":
      return "Approved and settled. An admin can reopen it.";
    case "review":
      return "The chips do not add up to the cash. Nothing has been distributed.";
    case "draft":
      return "A draft. Any member of the league can keep working on it.";
    default:
      return "Pick the date and who played, then count the chips out.";
  }
}
