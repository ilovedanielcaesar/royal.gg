import { useMemo, useState } from "react";
import Band from "../components/Band";
import ConfirmButton from "../components/ConfirmButton";
import ErrorNote from "../components/ErrorNote";
import FeltButton from "../components/FeltButton";
import LoadingState from "../components/LoadingState";
import PageHeading from "../components/PageHeading";
import PayoutSummary from "../components/PayoutSummary";
import PlayerAvatar from "../components/PlayerAvatar";
import Sheet from "../components/Sheet";
import { describeError } from "../lib/errors";
import { formatPlayedAt } from "../lib/format";
import { useGroup } from "../lib/groupContext";
import { type Player } from "../lib/stats";
import { requireSupabase } from "../lib/supabase";
import { useLeagueData } from "../lib/useLeagueData";

/**
 * Every settle-up that has ever happened, newest first.
 *
 * One sheet, one band per payout. This page has no v2 mock — it is restyled
 * into the sheet language rather than redesigned, so its structure is the one
 * that was already here and only its clothes are new.
 *
 * Per-payout Revert sits in its band's head rather than in the page heading,
 * which is where the "no controls in the sheet" rule bends: a per-row action
 * has nowhere else to go, and the v2 mocks put buttons in band heads too
 * (league_v2's "+ Add guest"). The rule is about page-level controls.
 */
export default function RecordsPage() {
  const { isGroupAdmin, path } = useGroup();
  const { data, error: loadError, reload } = useLeagueData();
  const [error, setError] = useState<string | null>(null);
  const [revertingId, setRevertingId] = useState<string | null>(null);
  const displayedError = error ?? loadError;

  const playerById = useMemo(() => {
    const m = new Map<string, Player>();
    (data?.players ?? []).forEach((p) => m.set(p.id, p));
    return m;
  }, [data]);

  // For each payout, the "startAfter" is the period_end_date of the previous
  // (older) payout. Sorted descending, so index i pairs with payouts[i+1].
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
    <>
      <PageHeading
        title="Payout records"
        subtitle="Every settle-up that has ever happened. Reverting one re-opens its period — the sessions stay, only the event is removed."
        actions={
          <FeltButton variant="ghost" to={path("/league")}>
            ← League
          </FeltButton>
        }
      />

      <Sheet>
        {displayedError && (
          <Band>
            <ErrorNote>{displayedError}</ErrorNote>
          </Band>
        )}

        {!data ? (
          <Band>
            {/* No spinners, per contract rule 6. */}
            <LoadingState />
          </Band>
        ) : payoutsWithRange.length === 0 ? (
          <Band title="No payouts yet">
            <p className="mt-2 text-sm text-ink-500">
              When it is time to settle, the League page's payout band is where
              it starts. Nothing is settled from this page — it is the record.
            </p>
          </Band>
        ) : (
          payoutsWithRange.map(({ payout, startAfter }) => {
            const distributor = playerById.get(payout.distributor_player_id);
            return (
              <Band
                key={payout.id}
                kicker="Settled"
                title={formatPlayedAt(payout.period_end_date)}
                caption={
                  startAfter
                    ? `Period since ${formatPlayedAt(startAfter)}`
                    : "First-ever payout — covers all-time"
                }
                action={
                  isGroupAdmin && (
                    <ConfirmButton
                      label="Revert"
                      confirmLabel="Revert payout"
                      consequence="Re-opens the period."
                      busy={revertingId === payout.id}
                      busyLabel="Reverting…"
                      onConfirm={() => void handleRevert(payout.id)}
                    />
                  )
                }
              >
                {distributor && (
                  <div className="mt-4 flex items-center gap-3 rounded-xl bg-card-100/60 px-4 py-3">
                    <PlayerAvatar player={distributor} size="sm" />
                    <div>
                      <p className="text-[10px] font-semibold tracking-[0.13em] text-ink-500 uppercase">
                        Distributor
                      </p>
                      <p className="text-sm font-medium text-ink-900">
                        {distributor.display_name ?? distributor.name}
                      </p>
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
              </Band>
            );
          })
        )}
      </Sheet>
    </>
  );
}
