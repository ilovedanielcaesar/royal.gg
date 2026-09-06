import { useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import Button from "../components/Button";
import Card from "../components/Card";
import PayoutSummary from "../components/PayoutSummary";
import PlayerAvatar from "../components/PlayerAvatar";
import { useCurrentUser } from "../lib/auth";
import { describeError } from "../lib/errors";
import { todayIsoDate, formatPlayedAt } from "../lib/format";
import { effectiveSuit } from "../lib/playerSuit";
import { currentPayoutPeriod } from "../lib/stats";
import { requireSupabase } from "../lib/supabase";
import type { Database } from "../types/database";
import { EMPTY_LEAGUE_DATA, useLeagueData } from "../lib/useLeagueData";

type Player = Database["public"]["Tables"]["players"]["Row"];

export default function PlayersPage() {
  const { isAdmin } = useCurrentUser();
  const { data, error: loadError, reload } = useLeagueData();
  const { sessions, buyIns, cashOuts, payouts } = data ?? EMPTY_LEAGUE_DATA;
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [isGuest, setIsGuest] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [showSettleForm, setShowSettleForm] = useState(false);
  const [distributorId, setDistributorId] = useState("");
  const [settling, setSettling] = useState(false);

  const players = useMemo(
    () =>
      data
        ? data.players
            .filter((player) => player.status !== "rejected")
            .sort((a, b) => a.name.localeCompare(b.name))
        : null,
    [data]
  );
  const displayedError = error ?? loadError;

  const period = useMemo(
    () => currentPayoutPeriod(payouts, todayIsoDate()),
    [payouts]
  );

  const distributorOptions = useMemo(
    () => (players ?? []).filter((p) => !p.is_guest),
    [players]
  );

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const sb = requireSupabase();
      const { error } = await sb
        .from("players")
        .insert({ name: name.trim(), is_guest: isGuest, status: "active" });
      if (error) throw error;
      setName("");
      setIsGuest(true);
      await reload();
    } catch (e) {
      console.error(e);
      setError(describeError(e));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this player? Only works if they have no buy-ins.")) {
      return;
    }
    setError(null);
    try {
      const sb = requireSupabase();
      const { error } = await sb.from("players").delete().eq("id", id);
      if (error) throw error;
      await reload();
    } catch (e) {
      console.error(e);
      setError(describeError(e));
    }
  }

  async function handleSettle(e: FormEvent) {
    e.preventDefault();
    if (!distributorId) return;
    setSettling(true);
    setError(null);
    try {
      const sb = requireSupabase();
      const { error } = await sb.from("payouts").insert({
        period_end_date: todayIsoDate(),
        distributor_player_id: distributorId,
      });
      if (error) throw error;
      setShowSettleForm(false);
      setDistributorId("");
      await reload();
    } catch (e) {
      console.error(e);
      setError(describeError(e));
    } finally {
      setSettling(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl text-card-50">League</h1>
          <p className="mt-1 text-sm text-card-50/60">
            Settle up, see the roster, manage guests.
          </p>
        </div>
        <Link
          to="/records"
          className="text-sm text-card-50/70 underline hover:text-card-50"
        >
          Payout records →
        </Link>
      </div>

      {/* Current payout period summary */}
      <Card watermarkSuit="diamond" rankLabel="$" accent="gold">
        <div className="p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <div>
              <h2 className="font-display text-2xl text-ink-900">
                Current payout period
              </h2>
              <p className="mt-0.5 text-xs text-ink-500">
                {period.startAfter
                  ? `Since ${formatPlayedAt(period.startAfter)}`
                  : "All-time (no payouts yet)"}
                {" · ending today"}
              </p>
            </div>
            {isAdmin && players && players.length > 0 && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => setShowSettleForm((v) => !v)}
              >
                {showSettleForm ? "Cancel" : "Settle up"}
              </Button>
            )}
          </div>

          {showSettleForm && isAdmin && (
            <form
              onSubmit={handleSettle}
              className="mt-3 flex flex-wrap items-end gap-3 rounded-md border border-card-200 bg-card-100/40 p-3"
            >
              <label className="flex flex-1 flex-col gap-1">
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
                  {distributorOptions.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.display_name ?? p.name}
                    </option>
                  ))}
                </select>
              </label>
              <Button
                type="submit"
                disabled={settling || !distributorId}
                size="sm"
              >
                {settling ? "Saving…" : "Confirm payout"}
              </Button>
            </form>
          )}

          {players && (
            <PayoutSummary
              players={players}
              sessions={sessions}
              buyIns={buyIns}
              cashOuts={cashOuts}
              startAfter={period.startAfter}
              endOn={period.endOn}
              linkProfiles
            />
          )}
        </div>
      </Card>

      {isAdmin && (
        <Card>
          <form
            onSubmit={handleAdd}
            className="flex flex-col gap-3 p-5 sm:flex-row sm:items-end"
          >
            <label className="flex flex-1 flex-col gap-1">
              <span className="text-xs font-medium uppercase tracking-wide text-ink-500">
                Add a guest
              </span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="rounded-md bg-card-50 px-3 py-2 text-sm text-ink-900 ring-1 ring-card-200 focus:outline-none focus:ring-2 focus:ring-gold-500"
                placeholder="e.g. Daniel"
                required
              />
            </label>
            <label className="flex items-center gap-2 text-sm text-ink-700">
              <input
                type="checkbox"
                checked={isGuest}
                onChange={(e) => setIsGuest(e.target.checked)}
                className="h-4 w-4 accent-crimson-600"
              />
              Guest
            </label>
            <Button type="submit" disabled={submitting}>
              Add
            </Button>
          </form>
        </Card>
      )}

      {displayedError && (
        <Card accent="crimson">
          <p className="p-4 text-sm text-crimson-700">{displayedError}</p>
        </Card>
      )}

      {players === null ? (
        <p className="text-card-50/60">Dealing…</p>
      ) : players.length === 0 ? (
        <Card>
          <p className="p-6 text-sm text-ink-500">No players yet.</p>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {players.map((p, idx) => (
            <PlayerCard
              key={p.id}
              player={p}
              dealIn={idx * 50}
              canDelete={isAdmin}
              onDelete={() => handleDelete(p.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function PlayerCard({
  player,
  dealIn,
  canDelete,
  onDelete,
}: {
  player: Player;
  dealIn: number;
  canDelete: boolean;
  onDelete: () => void;
}) {
  const { suit, rank } = effectiveSuit(player);
  const isPending = player.status === "pending";
  return (
    <Card
      watermarkSuit={suit}
      rankLabel={rank}
      dealIn={dealIn}
      accent={isPending ? "gold" : player.is_guest ? "gold" : "neutral"}
    >
      <div className="flex items-center gap-4 p-5">
        <Link to={`/players/${player.id}`}>
          <PlayerAvatar player={player} size="lg" />
        </Link>
        <div className="flex-1">
          <Link
            to={`/players/${player.id}`}
            className="font-display text-2xl text-ink-900 hover:underline"
          >
            {player.display_name ?? player.name}
          </Link>
          <div className="mt-0.5 text-xs uppercase tracking-wide text-ink-500">
            {isPending
              ? "Pending"
              : player.is_guest
                ? "Guest"
                : "Member"}
          </div>
        </div>
        {canDelete && (
          <button
            type="button"
            onClick={onDelete}
            className="text-xs text-ink-500 transition hover:text-crimson-600"
            aria-label={`Delete ${player.name}`}
          >
            ×
          </button>
        )}
      </div>
    </Card>
  );
}
