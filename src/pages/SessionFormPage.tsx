import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import Button from "../components/Button";
import Card from "../components/Card";
import CurrencyInput from "../components/CurrencyInput";
import PlayerAvatar from "../components/PlayerAvatar";
import { describeError } from "../lib/errors";
import { formatPlayedAt, todayIsoDate } from "../lib/format";
import { useGroup } from "../lib/groupContext";
import {
  DEFAULT_BUY_IN_CENTS,
  formatCents,
  formatSignedCents,
} from "../lib/money";
import {
  RECONCILE_THRESHOLD_CENTS,
  reconcile,
  type ReconcileInput,
} from "../lib/reconcile";
import { requireSupabase } from "../lib/supabase";
import type { Database } from "../types/database";

type Player = Database["public"]["Tables"]["players"]["Row"];
type BuyIn = Database["public"]["Tables"]["buy_ins"]["Row"];
type CashOut = Database["public"]["Tables"]["cash_outs"]["Row"];

type Row = {
  playerId: string;
  buyInCount: string;
  cashOut: string;
};

function parseDraftCents(raw: string): number | null {
  if (raw.trim() === "") return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

function parseCount(raw: string): number {
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

export default function SessionFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { path } = useGroup();
  const isEdit = Boolean(id);

  const [allPlayers, setAllPlayers] = useState<Player[]>([]);
  const [playedAt, setPlayedAt] = useState(todayIsoDate());
  const [notes, setNotes] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [guestName, setGuestName] = useState("");
  const [guestAdding, setGuestAdding] = useState(false);
  const [loading, setLoading] = useState(isEdit);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedStatus, setSavedStatus] = useState<{
    reconciled: boolean;
    needsReview: boolean;
  } | null>(null);

  const playersById = useMemo(() => {
    const m = new Map<string, Player>();
    allPlayers.forEach((p) => m.set(p.id, p));
    return m;
  }, [allPlayers]);

  const load = useCallback(async () => {
    setError(null);
    try {
      const sb = requireSupabase();
      const { data: players, error: pErr } = await sb
        .from("players")
        .select("*")
        .neq("status", "rejected")
        .order("name");
      if (pErr) throw pErr;
      setAllPlayers(players ?? []);

      if (isEdit && id) {
        const [
          { data: session, error: sErr },
          { data: buyIns, error: biErr },
          { data: cashOuts, error: coErr },
        ] = await Promise.all([
          sb.from("sessions").select("*").eq("id", id).single(),
          sb.from("buy_ins").select("*").eq("session_id", id),
          sb.from("cash_outs").select("*").eq("session_id", id),
        ]);
        if (sErr) throw sErr;
        if (biErr) throw biErr;
        if (coErr) throw coErr;

        setPlayedAt(session.played_at);
        setNotes(session.notes ?? "");
        setSavedStatus({
          reconciled: session.reconciled,
          needsReview: session.needs_review,
        });

        const playerIds = Array.from(
          new Set([
            ...(buyIns ?? []).map((b: BuyIn) => b.player_id),
            ...(cashOuts ?? []).map((c: CashOut) => c.player_id),
          ])
        );
        const draft: Row[] = playerIds.map((pid) => {
          const count = (buyIns ?? []).filter(
            (b: BuyIn) => b.player_id === pid
          ).length;
          const co = (cashOuts ?? []).find(
            (c: CashOut) => c.player_id === pid
          );
          return {
            playerId: pid,
            buyInCount: String(count || 1),
            cashOut: co
              ? (co.reported_amount_cents / 100).toFixed(2)
              : "",
          };
        });
        setRows(draft);
      }
    } catch (e) {
      console.error(e);
      setError(describeError(e));
    } finally {
      setLoading(false);
    }
  }, [id, isEdit]);

  useEffect(() => {
    void load();
  }, [load]);

  function togglePlayer(playerId: string) {
    setRows((prev) => {
      const existing = prev.find((r) => r.playerId === playerId);
      if (!existing) {
        return [...prev, { playerId, buyInCount: "1", cashOut: "" }];
      }
      // Confirm before deselecting if any data has been entered.
      const hasData =
        existing.cashOut.trim() !== "" || parseCount(existing.buyInCount) > 1;
      if (
        hasData &&
        !confirm("Remove this player and discard their entered amounts?")
      ) {
        return prev;
      }
      return prev.filter((r) => r.playerId !== playerId);
    });
  }

  async function addGuest(e: FormEvent) {
    e.preventDefault();
    const name = guestName.trim();
    if (!name) return;
    setGuestAdding(true);
    setError(null);
    try {
      const sb = requireSupabase();
      const { data, error: insErr } = await sb
        .from("players")
        .insert({ name, is_guest: true, status: "active" })
        .select()
        .single();
      if (insErr) throw insErr;
      setAllPlayers((prev) =>
        [...prev, data].sort((a, b) => a.name.localeCompare(b.name))
      );
      setRows((prev) => [
        ...prev,
        { playerId: data.id, buyInCount: "1", cashOut: "" },
      ]);
      setGuestName("");
    } catch (e) {
      setError(describeError(e));
    } finally {
      setGuestAdding(false);
    }
  }

  function updateRow(playerId: string, patch: Partial<Row>) {
    setRows((prev) =>
      prev.map((r) => (r.playerId === playerId ? { ...r, ...patch } : r))
    );
  }

  const reconcileSummary = useMemo(() => {
    if (rows.length === 0) return null;
    const inputs: ReconcileInput[] = rows.map((r) => ({
      playerId: r.playerId,
      buyInCents: parseCount(r.buyInCount) * DEFAULT_BUY_IN_CENTS,
      reportedCashOutCents: parseDraftCents(r.cashOut) ?? 0,
    }));
    return reconcile(inputs);
  }, [rows]);

  // Player grid: regulars first (members + non-guest entries), then guests.
  const gridPlayers = useMemo(() => {
    const visible = allPlayers.filter((p) => p.status === "active");
    const regulars = visible.filter((p) => !p.is_guest);
    const guests = visible.filter((p) => p.is_guest);
    return [...regulars, ...guests];
  }, [allPlayers]);

  const selectedIds = useMemo(
    () => new Set(rows.map((r) => r.playerId)),
    [rows]
  );

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (rows.length === 0) {
      setError("Pick at least one player.");
      return;
    }
    if (!reconcileSummary) return;
    setBusy(true);
    setError(null);
    try {
      const sb = requireSupabase();

      let sessionId = id;
      if (isEdit && sessionId) {
        const { error: sErr } = await sb
          .from("sessions")
          .update({
            played_at: playedAt,
            notes: notes.trim() || null,
            reconciled: !reconcileSummary.needsReview,
            needs_review: reconcileSummary.needsReview,
            discrepancy_cents: reconcileSummary.discrepancyCents,
          })
          .eq("id", sessionId);
        if (sErr) throw sErr;
        const { error: delBiErr } = await sb
          .from("buy_ins")
          .delete()
          .eq("session_id", sessionId);
        if (delBiErr) throw delBiErr;
      } else {
        const { data: session, error: sErr } = await sb
          .from("sessions")
          .insert({
            played_at: playedAt,
            notes: notes.trim() || null,
            reconciled: !reconcileSummary.needsReview,
            needs_review: reconcileSummary.needsReview,
            discrepancy_cents: reconcileSummary.discrepancyCents,
          })
          .select()
          .single();
        if (sErr) throw sErr;
        sessionId = session.id;
      }

      const buyRows: Array<{
        session_id: string;
        player_id: string;
        amount_cents: number;
      }> = [];
      rows.forEach((r) => {
        const count = parseCount(r.buyInCount);
        for (let i = 0; i < count; i += 1) {
          buyRows.push({
            session_id: sessionId!,
            player_id: r.playerId,
            amount_cents: DEFAULT_BUY_IN_CENTS,
          });
        }
      });
      if (buyRows.length > 0) {
        const { error: biErr } = await sb.from("buy_ins").insert(buyRows);
        if (biErr) throw biErr;
      }

      const { error: delCoErr } = await sb
        .from("cash_outs")
        .delete()
        .eq("session_id", sessionId!);
      if (delCoErr) throw delCoErr;

      const cashRows = reconcileSummary.results.map((r) => ({
        session_id: sessionId!,
        player_id: r.playerId,
        reported_amount_cents: r.reportedCashOutCents,
        adjusted_amount_cents: r.adjustedCashOutCents,
      }));
      if (cashRows.length > 0) {
        const { error: coErr } = await sb.from("cash_outs").insert(cashRows);
        if (coErr) throw coErr;
      }

      navigate(path(`/sessions/${sessionId}`));
      if (isEdit) {
        await load();
      }
    } catch (e) {
      console.error(e);
      setError(describeError(e));
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <p className="text-card-50/60">Dealing…</p>;
  }

  const summary = reconcileSummary;
  const hasSelection = rows.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <Link
            to={path("/sessions")}
            className="text-xs text-card-50/60 hover:text-card-50"
          >
            ← Sessions
          </Link>
          <h1 className="mt-1 font-display text-4xl text-card-50">
            {isEdit ? "Edit session" : "New session"}
          </h1>
          <p className="mt-1 text-sm text-card-50/70">
            {isEdit
              ? `Logged ${formatPlayedAt(playedAt)}.`
              : "Tap who played, then enter buy-ins and cash-outs."}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium uppercase tracking-wide text-ink-500">
                Date
              </span>
              <input
                type="date"
                value={playedAt}
                onChange={(e) => setPlayedAt(e.target.value)}
                required
                className="rounded-md bg-card-50 px-3 py-2 text-sm text-ink-900 ring-1 ring-card-200 focus:outline-none focus:ring-2 focus:ring-gold-500"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium uppercase tracking-wide text-ink-500">
                Notes
              </span>
              <input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="rounded-md bg-card-50 px-3 py-2 text-sm text-ink-900 ring-1 ring-card-200 focus:outline-none focus:ring-2 focus:ring-gold-500"
                placeholder="e.g. Daniel's place"
              />
            </label>
          </div>
        </Card>

        {/* Step 1 — Pick players */}
        <Card>
          <div className="p-5">
            <div className="flex items-baseline justify-between">
              <h2 className="font-display text-xl text-ink-900">
                Who's at the table?
              </h2>
              <span className="text-xs text-ink-500">
                {rows.length} selected
              </span>
            </div>

            {gridPlayers.length === 0 ? (
              <p className="mt-3 text-sm text-ink-500">
                No players in the roster yet.
              </p>
            ) : (
              <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-5">
                {gridPlayers.map((p) => {
                  const selected = selectedIds.has(p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => togglePlayer(p.id)}
                      className={[
                        "flex flex-col items-center gap-2 rounded-lg p-3 transition",
                        selected
                          ? "bg-sage-500/15 ring-2 ring-sage-600"
                          : "bg-card-100/40 ring-1 ring-card-200 hover:bg-card-100",
                      ].join(" ")}
                    >
                      <PlayerAvatar player={p} size="md" />
                      <div className="w-full truncate text-center text-xs font-medium text-ink-900">
                        {p.display_name ?? p.name}
                      </div>
                      {p.is_guest && (
                        <div className="text-[10px] uppercase tracking-wide text-ink-500">
                          guest
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Add guest inline */}
            <div className="mt-4 flex flex-wrap items-end gap-2 border-t border-card-100 pt-4">
              <label className="flex flex-1 flex-col gap-1">
                <span className="text-xs font-medium uppercase tracking-wide text-ink-500">
                  Add a guest (one-off player)
                </span>
                <input
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  placeholder="Name"
                  className="rounded-md bg-card-50 px-3 py-2 text-sm text-ink-900 ring-1 ring-card-200 focus:outline-none focus:ring-2 focus:ring-gold-500"
                />
              </label>
              <Button
                type="button"
                variant="secondary"
                onClick={(e) => void addGuest(e)}
                disabled={guestAdding || !guestName.trim()}
              >
                {guestAdding ? "Adding…" : "+ Add guest"}
              </Button>
            </div>
          </div>
        </Card>

        {/* Step 2 — Amounts (revealed once anyone is selected) */}
        {hasSelection && (
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
                    {rows.map((r) => {
                      const player = playersById.get(r.playerId);
                      const count = parseCount(r.buyInCount);
                      const buyTotal = count * DEFAULT_BUY_IN_CENTS;
                      const cashCents = parseDraftCents(r.cashOut) ?? 0;
                      const adjusted =
                        summary?.results.find(
                          (x) => x.playerId === r.playerId
                        )?.adjustedCashOutCents ?? cashCents;
                      const net = adjusted - buyTotal;
                      const adjustedDiffers = adjusted !== cashCents;
                      return (
                        <tr
                          key={r.playerId}
                          className="border-t border-card-100"
                        >
                          <td className="py-3 pr-3">
                            <div className="flex items-center gap-3">
                              {player && (
                                <PlayerAvatar player={player} size="sm" />
                              )}
                              <div>
                                <div className="font-medium text-ink-900">
                                  {player?.display_name ??
                                    player?.name ??
                                    "Unknown"}
                                </div>
                                {player?.is_guest && (
                                  <div className="text-xs text-ink-500">
                                    guest
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="py-3 pr-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <input
                                type="number"
                                min="0"
                                step="1"
                                value={r.buyInCount}
                                onChange={(e) =>
                                  updateRow(r.playerId, {
                                    buyInCount: e.target.value,
                                  })
                                }
                                className="tabular w-14 rounded-md bg-card-50 px-2 py-1.5 text-right text-sm text-ink-900 ring-1 ring-card-200 focus:outline-none focus:ring-2 focus:ring-gold-500"
                              />
                              <span className="tabular text-xs text-ink-500">
                                = {formatCents(buyTotal)}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 pr-3">
                            <div className="ml-auto w-28">
                              <CurrencyInput
                                value={r.cashOut}
                                onChange={(v) =>
                                  updateRow(r.playerId, { cashOut: v })
                                }
                              />
                            </div>
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
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </Card>
        )}

        {summary && rows.length > 0 && (
          <Card
            accent={
              summary.needsReview
                ? "crimson"
                : summary.discrepancyCents === 0
                  ? "sage"
                  : "gold"
            }
          >
            <div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="grid grid-cols-3 gap-6">
                <Stat
                  label="Buy-ins"
                  value={formatCents(summary.totalBuyInCents)}
                />
                <Stat
                  label="Reported"
                  value={formatCents(summary.totalReportedCents)}
                />
                <Stat
                  label="Discrepancy"
                  value={formatSignedCents(summary.discrepancyCents)}
                  tone={
                    summary.discrepancyCents === 0
                      ? "neutral"
                      : summary.needsReview
                        ? "crimson"
                        : "gold"
                  }
                />
              </div>
              <div className="text-right text-xs text-ink-500">
                {summary.discrepancyCents === 0 && (
                  <span>Books balance perfectly.</span>
                )}
                {summary.discrepancyCents !== 0 && !summary.needsReview && (
                  <span>
                    {formatSignedCents(summary.discrepancyCents)} will be
                    distributed across winners.
                  </span>
                )}
                {summary.needsReview && (
                  <span className="text-crimson-600">
                    Discrepancy exceeds $
                    {(RECONCILE_THRESHOLD_CENTS / 100).toFixed(2)} — will save
                    flagged for review.
                  </span>
                )}
              </div>
            </div>
          </Card>
        )}

        {error && (
          <Card accent="crimson">
            <p className="p-4 text-sm text-crimson-700">{error}</p>
          </Card>
        )}

        {savedStatus && (
          <Card accent={savedStatus.needsReview ? "crimson" : "sage"}>
            <p className="p-4 text-sm text-ink-700">
              {savedStatus.needsReview
                ? "This session is currently flagged for review."
                : "This session was previously reconciled. Saving will overwrite."}
            </p>
          </Card>
        )}

        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={busy || rows.length === 0}>
            {summary?.needsReview
              ? "Save flagged for review"
              : isEdit
                ? "Save changes"
                : "Save session"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => navigate(path("/sessions"))}
          >
            Cancel
          </Button>
          {isEdit && (
            <div className="ml-auto">
              <Button
                type="button"
                variant="danger"
                disabled={busy}
                onClick={async () => {
                  if (!confirm("Are you sure you want to delete this session? This will permanently wipe all buy-in and cash-out records for this date.")) return;
                  setBusy(true);
                  try {
                    const sb = requireSupabase();
                    // buy_ins and cash_outs are ON DELETE CASCADE off
                    // sessions.id (migration 0001), so this is sufficient.
                    const { error } = await sb
                      .from("sessions")
                      .delete()
                      .eq("id", id!);
                    if (error) throw error;
                    navigate(path("/sessions"));
                  } catch (e) {
                    setError(describeError(e));
                    setBusy(false);
                  }
                }}
              >
                Delete session
              </Button>
            </div>
          )}
        </div>
      </form>
    </div>
  );
}

function Stat({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "sage" | "crimson" | "gold";
}) {
  const toneClass = {
    neutral: "text-ink-900",
    sage: "text-sage-600",
    crimson: "text-crimson-600",
    gold: "text-gold-500",
  }[tone];
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-ink-500">
        {label}
      </div>
      <div className={`tabular mt-0.5 font-display text-2xl ${toneClass}`}>
        {value}
      </div>
    </div>
  );
}
