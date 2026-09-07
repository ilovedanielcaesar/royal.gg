import type { ReconcileSummary } from "../lib/reconcile";
import { formatCents, formatSignedCents } from "../lib/money";
import Card from "./Card";
import SessionReconciliationStat from "./SessionReconciliationStat";

export default function SessionReconciliationSummary({
  summary,
  thresholdCents,
}: {
  summary: ReconcileSummary;
  /** The group's current reconcile threshold. */
  thresholdCents: number;
}) {
  return (
    <Card
      accent={
        summary.needsReview
          ? "crimson"
          : summary.discrepancyCents === 0
            ? "sage"
            : "gold"
      }
    >
      <div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="grid grid-cols-3 gap-6">
          <SessionReconciliationStat
            label="Buy-ins"
            value={formatCents(summary.totalBuyInCents)}
          />
          <SessionReconciliationStat
            label="Reported"
            value={formatCents(summary.totalReportedCents)}
          />
          <SessionReconciliationStat
            label="Discrepancy"
            value={formatSignedCents(summary.discrepancyCents)}
            tone={
              summary.discrepancyCents === 0
                ? "neutral"
                : summary.needsReview
                  ? "crimson"
                  : "gold"
            }
          />
        </div>
        <div className="text-right text-xs text-ink-500">
          {summary.discrepancyCents === 0 && (
            <span>Books balance perfectly.</span>
          )}
          {summary.discrepancyCents !== 0 && !summary.needsReview && (
            <span>
              {formatSignedCents(summary.discrepancyCents)} will be distributed
              across winners.
            </span>
          )}
          {summary.needsReview && (
            <span className="text-crimson-600">
              Discrepancy exceeds {formatCents(thresholdCents)} — will save
              flagged for review.
            </span>
          )}
        </div>
      </div>
    </Card>
  );
}
