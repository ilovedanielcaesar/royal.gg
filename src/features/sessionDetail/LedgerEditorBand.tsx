import Band from "../../components/Band";
import { formatCents } from "../../lib/money";
import type { ReconcileSummary } from "../../lib/reconcile";
import type {
  SessionFormPlayer,
  SessionFormRow,
} from "../../lib/sessionForm";
import LedgerStepperRow from "./LedgerStepperRow";
import ReconcileBanner from "./ReconcileBanner";
import type { SessionState } from "./sessionState";

type Props = {
  rows: SessionFormRow[];
  playersById: Map<string, SessionFormPlayer>;
  buyInCents: number;
  onRowChange: (playerId: string, patch: Partial<SessionFormRow>) => void;
  onRemove: (playerId: string) => void;
  summary: ReconcileSummary | null;
  state: SessionState;
  thresholdCents: number;
};

const HEADINGS = ["Player", "Buy-ins", "Cash-out", "Net", ""];

export default function LedgerEditorBand({
  rows,
  playersById,
  buyInCents,
  onRowChange,
  onRemove,
  summary,
  state,
  thresholdCents,
}: Props) {
  const resultsById = new Map(
    (summary?.results ?? []).map((result) => [result.playerId, result])
  );
  // True only when the miscount was small enough to share out. Over the
  // threshold nothing is distributed, so every adjusted figure equals its
  // reported one and there is no second net to show.
  const distributing = (summary?.results ?? []).some(
    (r) => r.adjustedCashOutCents !== r.reportedCashOutCents
  );

  // The banner lives inside this band rather than in one of its own: it is
  // the running total of the table under it, and a hairline rule between a
  // total and the rows it totals reads as two unrelated things.
  const banner = (
    <ReconcileBanner
      summary={summary}
      state={state}
      thresholdCents={thresholdCents}
    />
  );

  if (rows.length === 0) {
    return (
      <Band
        title="The ledger"
        caption="Nobody is at the table yet. Pick who played above and their line appears here, balanced."
      >
        {banner}
      </Band>
    );
  }

  return (
    <Band
      title="The ledger"
      caption={
        distributing
          ? `The table is out by ${formatCents(
              Math.abs(summary?.discrepancyCents ?? 0)
            )}, which is under the threshold, so it is shared out among the winners in proportion to what they won. Each winner's second figure is their net after that.`
          : "A player starts with one buy-in in and the same value out, so the night balances before anyone counts a chip."
      }
    >
      {banner}
      <div className="mt-4">
        <div
          aria-hidden="true"
          className="hidden grid-cols-[minmax(150px,1.8fr)_170px_180px_128px_42px] gap-3 px-2.5 pb-2 text-[9.5px] font-semibold tracking-[0.09em] text-ink-500 uppercase min-[721px]:grid"
        >
          <span>{HEADINGS[0]}</span>
          <span className="text-center">{HEADINGS[1]}</span>
          <span className="text-right">{HEADINGS[2]}</span>
          <span className="text-right">
            {distributing ? "Net · reconciled" : HEADINGS[3]}
          </span>
          <span />
        </div>

        <div className="divide-y divide-card-100">
          {rows.map((row) => (
            <LedgerStepperRow
              key={row.playerId}
              row={row}
              player={playersById.get(row.playerId)}
              buyInCents={buyInCents}
              result={resultsById.get(row.playerId)}
              onChange={(patch) => onRowChange(row.playerId, patch)}
              onRemove={() => onRemove(row.playerId)}
            />
          ))}
        </div>
      </div>
    </Band>
  );
}
