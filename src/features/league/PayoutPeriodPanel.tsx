import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import Button from "../../components/Button";
import ErrorNote from "../../components/ErrorNote";
import GoldPill from "../../components/GoldPill";
import { describeError } from "../../lib/errors";
import { formatDateShort, todayIsoDate } from "../../lib/format";
import { PAYOUT_REMINDER_AFTER_SESSIONS, type Player } from "../../lib/stats";
import { requireSupabase } from "../../lib/supabase";
import type { PayoutPreviewRow } from "./useLeaguePageData";

type Props = {
  groupId: string;
  rows: PayoutPreviewRow[];
  /** Who can be the distributor: registered players, guests excluded. */
  distributorOptions: Player[];
  isGroupAdmin: boolean;
  recordsHref: string;
  reload: () => Promise<void>;
};

/**
 * The left half of the payout band: the last few settle-ups, the one still
 * open, and — for an admin — the form that closes it.
 *
 * The open period is listed with the closed ones rather than given its own
 * heading, because it is the same kind of thing: a window of nights with a
 * session count. The only difference is that its date has not happened yet,
 * which is what "Active" says.
 */
export default function PayoutPeriodPanel({
  groupId,
  rows,
  distributorOptions,
  isGroupAdmin,
  recordsHref,
  reload,
}: Props) {
  const navigate = useNavigate();
  const [showSettleForm, setShowSettleForm] = useState(false);
  const [distributorId, setDistributorId] = useState("");
  const [settling, setSettling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openRow = rows.find((row) => row.status === "active");
  const openSessions = openRow?.sessionCount ?? 0;

  async function handleSettle(e: FormEvent) {
    e.preventDefault();
    if (!distributorId) return;
    setSettling(true);
    setError(null);
    try {
      const sb = requireSupabase();
      // period_end_date is today, not the last session's date: the period runs
      // up to the moment it is settled, so a night played tonight after this
      // button is pressed opens the next one rather than falling into a
      // period whose money has already moved.
      const { error } = await sb.from("payouts").insert({
        group_id: groupId,
        period_end_date: todayIsoDate(),
        distributor_player_id: distributorId,
      });
      if (error) throw error;
      setShowSettleForm(false);
      setDistributorId("");
      await reload();
    } catch (e) {
      setError(describeError(e));
    } finally {
      setSettling(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="font-display text-[23px] leading-[1.1]">Payouts</h2>
        <p className="mt-1 text-xs text-ink-500">
          The most recent settle-ups, and the period still open.
        </p>
      </div>

      <ul className="divide-y divide-card-100">
        {rows.map((row) => (
          <li
            key={row.key}
            className={`grid min-h-11 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-0.5 px-2.5 py-2 sm:grid-cols-[minmax(0,1fr)_auto_auto] ${
              row.status === "active" ? "rounded-lg bg-gold-500/[0.06]" : ""
            }`}
          >
            <span className="truncate text-sm font-medium text-ink-900">
              {row.paidOn
                ? formatDateShort(row.paidOn)
                : row.openedAfter
                  ? `Opened ${formatDateShort(row.openedAfter)}`
                  : "Since the league began"}
            </span>
            {/* On a phone the pill keeps the first row and the count drops
                under the date, so neither ever truncates. */}
            <span className="order-last text-xs text-ink-500 sm:order-none sm:text-right">
              {row.sessionCount}{" "}
              {row.sessionCount === 1 ? "session" : "sessions"}
            </span>
            <span className="justify-self-end">
              {row.status === "active" ? (
                <GoldPill size="sm">Active</GoldPill>
              ) : (
                <span className="text-[10px] font-semibold tracking-[0.12em] text-ink-500 uppercase">
                  Paid out
                </span>
              )}
            </span>
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="subtle"
          onClick={() => navigate(recordsHref)}
        >
          Go to payout page →
        </Button>
        {isGroupAdmin && (
          <Button
            type="button"
            variant="primary"
            disabled={openSessions === 0 || distributorOptions.length === 0}
            title={
              openSessions === 0
                ? "No sessions have been played in this period yet."
                : distributorOptions.length === 0
                  ? "A payout needs a registered player to distribute it."
                  : undefined
            }
            onClick={() => {
              setError(null);
              setShowSettleForm((shown) => !shown);
            }}
            aria-expanded={showSettleForm}
          >
            {showSettleForm ? "Cancel" : "Settle up"}
          </Button>
        )}
      </div>

      {showSettleForm && isGroupAdmin && (
        <form
          onSubmit={handleSettle}
          className="flex flex-wrap items-end gap-3 rounded-xl border border-card-200 bg-card-100/40 p-3"
        >
          <label className="flex min-w-48 flex-1 flex-col gap-1">
            <span className="text-xs font-medium text-ink-700">
              Distributor (everyone settles with this person)
            </span>
            <select
              required
              value={distributorId}
              onChange={(e) => setDistributorId(e.target.value)}
              className="rounded-md border border-card-200 bg-card-50 px-3 py-2 text-sm focus:border-sage-600 focus:outline-none"
            >
              <option value="">— pick someone —</option>
              {distributorOptions.map((player) => (
                <option key={player.id} value={player.id}>
                  {player.display_name ?? player.name}
                </option>
              ))}
            </select>
          </label>
          <Button type="submit" disabled={settling || !distributorId}>
            {settling ? "Saving…" : `Confirm payout · ${openSessions} ${openSessions === 1 ? "session" : "sessions"}`}
          </Button>
        </form>
      )}

      {error && <ErrorNote>{error}</ErrorNote>}

      {openSessions > PAYOUT_REMINDER_AFTER_SESSIONS && (
        <div className="flex items-center gap-2 rounded-xl border border-dashed border-card-200 bg-card-100/40 px-4 py-3">
          <GoldPill>Reminder</GoldPill>
          <p className="text-xs leading-5 text-ink-700">
            Time to pay out: {openSessions} sessions have run in the current
            payout period.
          </p>
        </div>
      )}
    </div>
  );
}
