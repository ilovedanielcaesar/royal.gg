import Band from "../../components/Band";
import PlayerAvatar from "../../components/PlayerAvatar";
import { formatCents, formatSignedCents } from "../../lib/money";
import { moneyToneClass } from "../../lib/moneyTone";
import type { SessionFormPlayer } from "../../lib/sessionForm";
import type { SettledRow } from "../../lib/useSessionFormData";

type Props = {
  results: SettledRow[];
  playersById: Map<string, SessionFormPlayer>;
  /** True when any row was adjusted, which is what earns the two columns. */
  adjusted: boolean;
};

const COLUMNS =
  "grid-cols-[minmax(130px,1.5fr)_80px_95px] min-[721px]:grid-cols-[minmax(180px,2fr)_100px_120px_100px_120px_110px]";

/**
 * The approved record: in, out and net, one line per player.
 *
 * "Who's at the table" is gone — that is the shape change the fourth state
 * is, and the reason approved does not just render the editor read-only. An
 * approved night is a record, and a record does not have a roster picker on
 * it.
 *
 * The adjustment columns appear only when there was one. On a night that
 * balanced to the cent, "Reported" and "Adjusted" hold the same figure in
 * every row, and two identical columns of money are worse than one.
 */
export default function SettledLedgerBand({
  results,
  playersById,
  adjusted,
}: Props) {
  return (
    <Band
      title="The record"
      caption={
        adjusted
          ? "Chips were miscounted. The gap was distributed among the winners in proportion to what they won; both the reported and the adjusted figure are kept."
          : "The chips counted out to exactly what went in."
      }
    >
      <div className="mt-4 overflow-x-auto">
        <div
          aria-hidden="true"
          className={`grid ${COLUMNS} gap-2 px-2.5 pb-2 text-[9.5px] font-semibold tracking-[0.09em] text-ink-500 uppercase min-[721px]:gap-3`}
        >
          <span>Player</span>
          <span className="text-right">Buy-in</span>
          <span className="hidden text-right min-[721px]:block">
            Reported out
          </span>
          <span className="hidden text-right min-[721px]:block">
            Adjustment
          </span>
          <span className="text-right">
            {adjusted ? "Adjusted out" : "Cash-out"}
          </span>
          <span className="hidden text-right min-[721px]:block">
            {adjusted ? "Net · reconciled" : "Net"}
          </span>
        </div>

        <div className="divide-y divide-card-100">
          {results.map((result) => {
            const player = playersById.get(result.playerId);
            const delta =
              result.adjustedCashOutCents - result.reportedCashOutCents;
            const rawNetCents =
              result.reportedCashOutCents - result.buyInCents;
            return (
              <div
                key={result.playerId}
                className={`grid ${COLUMNS} min-h-12 items-center gap-2 rounded-lg px-2.5 py-2 transition hover:bg-card-100/60 min-[721px]:gap-3`}
              >
                <span className="flex min-w-0 items-center gap-2">
                  {player && <PlayerAvatar player={player} size="sm" />}
                  <span className="truncate text-[13px] font-medium text-ink-900">
                    {player?.display_name ?? player?.name ?? "Unknown player"}
                  </span>
                </span>

                <span className="tabular text-right text-[13px] text-ink-700">
                  {formatCents(result.buyInCents)}
                </span>

                <span className="tabular hidden text-right text-[13px] text-ink-700 min-[721px]:block">
                  {formatCents(result.reportedCashOutCents)}
                </span>

                <span
                  className={`tabular hidden text-right text-[13px] min-[721px]:block ${
                    delta === 0 ? "text-ink-500" : "text-gold-ink"
                  }`}
                >
                  {delta === 0 ? "—" : formatSignedCents(delta)}
                </span>

                <span className="tabular text-right text-[13px] font-semibold text-ink-900">
                  {formatCents(result.adjustedCashOutCents)}
                </span>

                {/* Both nets, for the same reason the editor shows both:
                    what this player counted, and what the shared-out
                    miscount left them with. `netCents` is the adjusted one.
                    See LedgerStepperRow. */}
                <span className="hidden flex-col items-end leading-tight min-[721px]:flex">
                  <span
                    className={`tabular font-display text-base ${moneyToneClass(
                      delta === 0 ? result.netCents : rawNetCents
                    )}`}
                  >
                    {formatSignedCents(
                      delta === 0 ? result.netCents : rawNetCents
                    )}
                  </span>
                  {delta !== 0 && (
                    <span
                      title="Net after the table's miscount was shared out among the winners."
                      className="tabular text-[11px] font-semibold text-gold-ink"
                    >
                      → {formatSignedCents(result.netCents)}
                    </span>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </Band>
  );
}
