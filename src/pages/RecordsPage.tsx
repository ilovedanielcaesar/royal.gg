import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Button from "../components/Button";
import Card from "../components/Card";
import PayoutSummary from "../components/PayoutSummary";
import PlayerAvatar from "../components/PlayerAvatar";
import { useCurrentUser } from "../lib/auth";
import { describeError } from "../lib/errors";
import { formatPlayedAt } from "../lib/format";
import {
  type Player,
} from "../lib/stats";
import { requireSupabase } from "../lib/supabase";
import { useLeagueData } from "../lib/useLeagueData";

export default function RecordsPage() {
  const { isAdmin } = useCurrentUser();
  const { data, error: loadError, reload } = useLeagueData();
  const [error, setError] = useState<string | null>(null);
  const [revertingId, setRevertingId] = useState<string | null>(null);
  const displayedError = error ?? loadError;

  const playerById = useMemo(() => {
    const m = new Map<string, Player>();
    (data?.players ?? []).forEach((p) => m.set(p.id, p));
    return m;
  }, [data]);

  // For each payout, the "startAfter" is the period_end_date of the
  // previous (older) payout. Sorted descending, so we pair index i with
  // payouts[i+1].
  const payoutsWithRange = useMemo(() => {
    if (!data) return [];
    const payouts = [...data.payouts].sort((a, b) =>
      b.period_end_date.localeCompare(a.period_end_date)
    );
    return payouts.map((p, i) => ({
      payout: p,
      startAfter: payouts[i + 1]?.period_end_date ?? null,
    }));
  }, [data]);

  async function handleRevert(payoutId: string) {
    if (
      !confirm(
        "Revert this payout? The period reopens — sessions are kept, the settle-up event is removed."
      )
    ) {
      return;
    }
    setRevertingId(payoutId);
    setError(null);
    try {
      const sb = requireSupabase();
      const { error } = await sb.from("payouts").delete().eq("id", payoutId);
      if (error) throw error;
      await reload();
    } catch (e) {
      setError(describeError(e));
    } finally {
      setRevertingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          to="/players"
          className="text-xs text-card-50/60 hover:text-card-50"
        >
          ← League
        </Link>
        <h1 className="mt-1 font-display text-4xl text-card-50">
          Payout records
        </h1>
        <p className="mt-1 text-sm text-card-50/70">
          Every settle-up that has ever happened. Reverting a payout
          re-opens its period — sessions stay, only the event is removed.
        </p>
      </div>

      {displayedError && (
        <Card accent="crimson">
          <p className="p-4 text-sm text-crimson-700">{displayedError}</p>
        </Card>
      )}

      {!data ? (
        <p className="text-sm text-card-50/60">Dealing…</p>
      ) : payoutsWithRange.length === 0 ? (
        <Card>
          <p className="p-6 text-sm text-ink-500">
            No payouts yet. Hit "Settle up" on the League page when it's
            time to settle.
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {payoutsWithRange.map(({ payout, startAfter }) => {
            const distributor = playerById.get(payout.distributor_player_id);
            return (
              <Card key={payout.id} accent="sage">
                <div className="p-5">
                  <div className="flex flex-wrap items-baseline justify-between gap-3">
                    <div>
                      <h2 className="font-display text-2xl text-ink-900">
                        Payout · {formatPlayedAt(payout.period_end_date)}
                      </h2>
                      <p className="mt-0.5 text-xs text-ink-500">
                        {startAfter
                          ? `Period since ${formatPlayedAt(startAfter)}`
                          : "First-ever payout — covers all-time"}
                      </p>
                    </div>
                    {isAdmin && (
                      <Button
                        variant="danger"
                        size="sm"
                        disabled={revertingId === payout.id}
                        onClick={() => void handleRevert(payout.id)}
                      >
                        {revertingId === payout.id ? "Reverting…" : "Revert"}
                      </Button>
                    )}
                  </div>

                  {distributor && (
                    <div className="mt-3 flex items-center gap-3 rounded-md bg-card-100/60 p-3">
                      <PlayerAvatar player={distributor} size="sm" />
                      <div>
                        <div className="text-xs uppercase tracking-wide text-ink-500">
                          Distributor
                        </div>
                        <div className="font-medium text-ink-900">
                          {distributor.display_name ?? distributor.name}
                        </div>
                      </div>
                    </div>
                  )}

                  <PayoutSummary
                    players={data.players}
                    sessions={data.sessions}
                    buyIns={data.buyIns}
                    cashOuts={data.cashOuts}
                    startAfter={startAfter}
                    endOn={payout.period_end_date}
                  />
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
