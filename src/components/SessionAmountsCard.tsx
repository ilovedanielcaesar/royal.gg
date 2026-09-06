import { DEFAULT_BUY_IN_CENTS } from "../lib/money";
import type { ReconcileSummary } from "../lib/reconcile";
import type {
  SessionFormPlayer,
  SessionFormRow,
} from "../lib/sessionForm";
import Card from "./Card";
import SessionPlayerRow from "./SessionPlayerRow";

type Props = {
  rows: SessionFormRow[];
  playersById: Map<string, SessionFormPlayer>;
  summary: ReconcileSummary | null;
  canEdit: boolean;
  onRowChange: (
    playerId: string,
    patch: Partial<SessionFormRow>
  ) => void;
};

export default function SessionAmountsCard({
  rows,
  playersById,
  summary,
  canEdit,
  onRowChange,
}: Props) {
  return (
    <Card>
      <div className="p-5">
        <h2 className="font-display text-xl text-ink-900">
          Buy-ins & cash-outs
        </h2>
        <p className="mt-1 text-xs text-ink-500">
          Each buy-in is ${(DEFAULT_BUY_IN_CENTS / 100).toFixed(0)}.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-ink-500">
                <th className="pb-2 pr-3">Player</th>
                <th className="pb-2 pr-3 text-right">Buy-ins</th>
                <th className="pb-2 pr-3 text-right">Cash-out</th>
                <th className="pb-2 pr-3 text-right">Net</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <SessionPlayerRow
                  key={row.playerId}
                  row={row}
                  player={playersById.get(row.playerId)}
                  summary={summary}
                  canEdit={canEdit}
                  onChange={onRowChange}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Card>
  );
}
