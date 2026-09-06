import CurrencyInput from "./CurrencyInput";
import PlayerAvatar from "./PlayerAvatar";
import {
  parseCount,
  parseDraftCents,
  type SessionFormPlayer,
  type SessionFormRow,
} from "../lib/sessionForm";
import {
  DEFAULT_BUY_IN_CENTS,
  formatCents,
  formatSignedCents,
} from "../lib/money";
import type { ReconcileSummary } from "../lib/reconcile";

type Props = {
  row: SessionFormRow;
  player?: SessionFormPlayer;
  summary: ReconcileSummary | null;
  canEdit: boolean;
  onChange: (playerId: string, patch: Partial<SessionFormRow>) => void;
};

export default function SessionPlayerRow({
  row,
  player,
  summary,
  canEdit,
  onChange,
}: Props) {
  const count = parseCount(row.buyInCount);
  const buyTotal = count * DEFAULT_BUY_IN_CENTS;
  const cashCents = parseDraftCents(row.cashOut) ?? 0;
  const adjusted =
    summary?.results.find((result) => result.playerId === row.playerId)
      ?.adjustedCashOutCents ?? cashCents;
  const net = adjusted - buyTotal;
  const adjustedDiffers = adjusted !== cashCents;

  return (
    <tr className="border-t border-card-100">
      <td className="py-3 pr-3">
        <div className="flex items-center gap-3">
          {player && <PlayerAvatar player={player} size="sm" />}
          <div>
            <div className="font-medium text-ink-900">
              {player?.display_name ?? player?.name ?? "Unknown"}
            </div>
            {player?.is_guest && (
              <div className="text-xs text-ink-500">guest</div>
            )}
          </div>
        </div>
      </td>
      <td className="py-3 pr-3 text-right">
        <div className="flex items-center justify-end gap-2">
          {canEdit ? (
            <input
              type="number"
              min="0"
              step="1"
              value={row.buyInCount}
              onChange={(event) =>
                onChange(row.playerId, { buyInCount: event.target.value })
              }
              className="tabular w-14 rounded-md bg-card-50 px-2 py-1.5 text-right text-sm text-ink-900 ring-1 ring-card-200 focus:outline-none focus:ring-2 focus:ring-gold-500"
            />
          ) : (
            <span className="tabular text-ink-900">{count}</span>
          )}
          <span className="tabular text-xs text-ink-500">
            = {formatCents(buyTotal)}
          </span>
        </div>
      </td>
      <td className="py-3 pr-3 text-right">
        {canEdit ? (
          <div className="ml-auto w-28">
            <CurrencyInput
              value={row.cashOut}
              onChange={(value) => onChange(row.playerId, { cashOut: value })}
            />
          </div>
        ) : (
          <span className="tabular text-ink-900">
            {formatCents(cashCents)}
          </span>
        )}
        {adjustedDiffers && summary && !summary.needsReview && (
          <div className="mt-1 text-right text-xs text-gold-500">
            adj. {formatCents(adjusted)}
          </div>
        )}
      </td>
      <td
        className={`tabular py-3 pr-3 text-right font-semibold ${
          net > 0
            ? "text-sage-600"
            : net < 0
              ? "text-crimson-600"
              : "text-ink-500"
        }`}
      >
        {formatSignedCents(net)}
      </td>
    </tr>
  );
}
