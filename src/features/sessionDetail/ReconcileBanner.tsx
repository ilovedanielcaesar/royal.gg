import { formatCents } from "../../lib/money";
import type { ReconcileSummary } from "../../lib/reconcile";
import { statePill, type SessionState } from "./sessionState";

type Props = {
  summary: ReconcileSummary | null;
  state: SessionState;
  thresholdCents: number;
};

/**
 * Buy-ins, reported cash-outs and the gap between them, live.
 *
 * The discrepancy is the number the whole page exists to drive to zero, so it
 * is shown from the first player seated rather than at save time. Because a
 * player is seated with one buy-in in and one buy-in's value out, it starts
 * at exactly $0.00 and only moves when somebody's count is entered.
 *
 * It is money and goes through `formatCents`, but it is NOT tinted by
 * `moneyToneClass`: sage and crimson mean won and lost, and a session being
 * $4 short is neither. The state pill carries that meaning instead.
 */
export default function ReconcileBanner({
  summary,
  state,
  thresholdCents,
}: Props) {
  const totalBuyIn = summary?.totalBuyInCents ?? 0;
  const totalReported = summary?.totalReportedCents ?? 0;
  const discrepancy = summary?.discrepancyCents ?? 0;
  const pill = statePill(state, discrepancy, thresholdCents);

  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-4 rounded-xl bg-card-100/70 px-4.5 py-3.5">
      <Metric label="Total buy-ins" value={formatCents(totalBuyIn)} />
      <Metric label="Reported cash-outs" value={formatCents(totalReported)} />
      <Metric
        label="Discrepancy"
        value={formatCents(Math.abs(discrepancy))}
        hint={
          discrepancy === 0
            ? undefined
            : discrepancy > 0
              ? "short"
              : "over"
        }
      />
      <span
        className={`inline-flex w-max items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${pill.classes}`}
      >
        {pill.label}
      </span>
    </div>
  );
}

function Metric({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="flex items-baseline gap-2 text-xs">
      <span className="text-ink-500">{label}</span>
      <strong className="tabular font-display text-lg font-normal text-ink-900">
        {value}
      </strong>
      {hint && <span className="text-ink-500">{hint}</span>}
    </div>
  );
}
