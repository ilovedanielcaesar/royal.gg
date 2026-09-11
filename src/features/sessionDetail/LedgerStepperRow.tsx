import PlayerAvatar from "../../components/PlayerAvatar";
import { formatCents, formatSignedCents } from "../../lib/money";
import { moneyToneClass } from "../../lib/moneyTone";
import type { ReconcileResult } from "../../lib/reconcile";
import {
  parseCount,
  parseDraftCents,
  type SessionFormPlayer,
  type SessionFormRow,
} from "../../lib/sessionForm";

type Props = {
  row: SessionFormRow;
  player: SessionFormPlayer | undefined;
  buyInCents: number;
  /**
   * This player's line out of the live `reconcile()` run, when there is one.
   * Absent while the group or the summary has not resolved.
   */
  result: ReconcileResult | undefined;
  onChange: (patch: Partial<SessionFormRow>) => void;
  onRemove: () => void;
};

/** The cash-out stepper moves by a DOLLAR, not a cent. */
const STEP_CENTS = 100;

const centsToField = (cents: number) => (cents / 100).toFixed(2);

/**
 * One player's line while the night is being written.
 *
 * Both steppers exist because this is filled in at a table with a phone in
 * one hand. Rebuys are counted, not typed; a cash-out is nudged a dollar at a
 * press, because chips are counted in dollars and a cent-level stepper would
 * need a hundred presses to cross one. The field stays typeable all the same
 * — a stack that came to $47.35 is faster typed than stepped, and
 * `parseDraftCents` accepts the half-finished states typing goes through.
 *
 * ONE DELIBERATE DEVIATION FROM THE MOCK. `session_detail_v2.html` hides the
 * buy-in column and the remove button under 720px (`.buyin-col, .remove-col
 * { display: none }`). That would leave a phone unable to record a rebuy or
 * unseat a player — on the device the app exists to be used on, at the table.
 * So below 721px the row becomes two lines instead of losing two controls.
 * Flagged in REDESIGN.md rather than done quietly; revert it if the mock is
 * meant literally here.
 */
export default function LedgerStepperRow({
  row,
  player,
  buyInCents,
  result,
  onChange,
  onRemove,
}: Props) {
  const count = parseCount(row.buyInCount);
  const cashOutCents = parseDraftCents(row.cashOut);
  const netCents =
    cashOutCents === null ? null : cashOutCents - count * buyInCents;
  const name = player?.display_name ?? player?.name ?? "Unknown player";

  function stepCash(delta: number) {
    const from = cashOutCents ?? 0;
    onChange({ cashOut: centsToField(Math.max(0, from + delta)) });
  }

  // Two nets, when the miscount was small enough to distribute.
  //
  // The first is what this player counted: cash-out minus buy-ins, the
  // number they can check against the chips in front of them. The second is
  // what they actually walk away with once the table's discrepancy has been
  // shared out among the winners. Showing only the first hides the
  // adjustment until after saving; showing only the second makes their own
  // arithmetic look wrong. Both, or neither is trustworthy.
  //
  // `result.netCents` is already the adjusted net — see reconcile().
  const adjustedNetCents =
    result && result.adjustedCashOutCents !== result.reportedCashOutCents
      ? result.netCents
      : null;

  const net = (
    <span
      className="flex flex-col items-end leading-tight"
      aria-label={
        netCents === null
          ? `Net for ${name}: not entered`
          : adjustedNetCents === null
            ? `Net for ${name}: ${formatSignedCents(netCents)}`
            : `Net for ${name}: ${formatSignedCents(netCents)} as counted, ${formatSignedCents(adjustedNetCents)} after the miscount is shared out`
      }
    >
      <span
        className={`tabular font-display text-base ${
          netCents === null ? "text-ink-500" : moneyToneClass(netCents)
        }`}
      >
        {netCents === null ? "—" : formatSignedCents(netCents)}
      </span>
      {netCents !== null && adjustedNetCents !== null && (
        <span
          aria-hidden="true"
          title="Net after the table's miscount is shared out among the winners."
          className="tabular text-[11px] font-semibold text-gold-ink"
        >
          → {formatSignedCents(adjustedNetCents)}
        </span>
      )}
    </span>
  );

  const buyInStepper = (
    <Stepper
      label={`Buy-ins for ${name}`}
      onDown={() => onChange({ buyInCount: String(Math.max(1, count - 1)) })}
      onUp={() => onChange({ buyInCount: String(count + 1) })}
      downDisabled={count <= 1}
    >
      <span className="tabular min-w-[4.5rem] text-center text-[13px] font-semibold text-ink-900">
        {count} × {formatCents(buyInCents)}
      </span>
    </Stepper>
  );

  const cashStepper = (
    <Stepper
      label={`Cash-out for ${name}`}
      onDown={() => stepCash(-STEP_CENTS)}
      onUp={() => stepCash(STEP_CENTS)}
      downDisabled={(cashOutCents ?? 0) < STEP_CENTS}
    >
      <input
        inputMode="decimal"
        value={row.cashOut}
        aria-label={`Cash-out for ${name}, in dollars`}
        onChange={(event) => onChange({ cashOut: event.target.value })}
        onBlur={() =>
          onChange({
            cashOut: cashOutCents === null ? "" : centsToField(cashOutCents),
          })
        }
        placeholder="0.00"
        className="tabular h-8 w-[82px] rounded-md bg-card-50 px-2 text-right text-[13px] font-semibold text-ink-900 ring-1 ring-card-200 outline-none focus:ring-gold-ink"
      />
    </Stepper>
  );

  const remove = (
    <button
      type="button"
      onClick={onRemove}
      aria-label={`Remove ${name} from this night`}
      className="rounded p-1 text-lg leading-none text-ink-500 transition hover:text-crimson-600"
    >
      ×
    </button>
  );

  return (
    <div className="rounded-lg px-2.5 py-2 transition hover:bg-card-100/60 min-[721px]:grid min-[721px]:min-h-[52px] min-[721px]:grid-cols-[minmax(150px,1.8fr)_170px_180px_128px_42px] min-[721px]:items-center min-[721px]:gap-3">
      <span className="flex items-center justify-between gap-2 min-[721px]:justify-start">
        <span className="flex min-w-0 items-center gap-2">
          {player && <PlayerAvatar player={player} size="sm" />}
          <span className="min-w-0">
            <span className="block truncate text-[13px] font-medium text-ink-900">
              {name}
            </span>
            {player?.is_guest && (
              <span className="text-[10px] tracking-[0.09em] text-ink-500 uppercase">
                guest
              </span>
            )}
          </span>
        </span>
        <span className="min-[721px]:hidden">{net}</span>
      </span>

      <span className="mt-2 flex items-center justify-between gap-2 min-[721px]:mt-0 min-[721px]:justify-center">
        {buyInStepper}
        <span className="min-[721px]:hidden">{remove}</span>
      </span>

      <span className="mt-2 flex justify-end min-[721px]:mt-0">
        {cashStepper}
      </span>

      <span className="hidden min-[721px]:block">{net}</span>
      <span className="hidden justify-end min-[721px]:flex">{remove}</span>
    </div>
  );
}

function Stepper({
  label,
  onDown,
  onUp,
  downDisabled,
  children,
}: {
  label: string;
  onDown: () => void;
  onUp: () => void;
  downDisabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={label}>
      <StepButton
        glyph="−"
        label={`${label}: down`}
        onClick={onDown}
        disabled={downDisabled}
      />
      {children}
      <StepButton glyph="+" label={`${label}: up`} onClick={onUp} />
    </span>
  );
}

function StepButton({
  glyph,
  label,
  onClick,
  disabled,
}: {
  glyph: string;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-card-50 text-[15px] font-bold text-ink-900 ring-1 ring-card-200 transition hover:bg-card-100 disabled:opacity-40 disabled:hover:bg-card-50"
    >
      {glyph}
    </button>
  );
}
