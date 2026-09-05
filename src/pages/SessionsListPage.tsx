import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Button from "../components/Button";
import Card from "../components/Card";
import { describeError } from "../lib/errors";
import { formatPlayedAt } from "../lib/format";
import { formatSignedCents } from "../lib/money";
import { requireSupabase } from "../lib/supabase";
import type { Database } from "../types/database";
import { useGroup } from "../lib/groupContext";

type Session = Database["public"]["Tables"]["sessions"]["Row"];

type SessionWithStats = Session & {
  player_count: number;
  /** Action score 0–10 — how violently stacks moved this night. */
  action_score: number;
};

export default function SessionsListPage() {
  const { group, isGroupAdmin, path } = useGroup();
  const [sessions, setSessions] = useState<SessionWithStats[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const sb = requireSupabase();
      const { data: rows, error } = await sb
        .from("sessions")
        .select(
          "*, buy_ins(amount_cents, player_id), cash_outs(adjusted_amount_cents, player_id)"
        )
        .eq("group_id", group!.id)
        .order("played_at", { ascending: false });
      if (error) throw error;

      type Row = Session & {
        buy_ins: { amount_cents: number; player_id: string }[];
        cash_outs: { adjusted_amount_cents: number; player_id: string }[];
      };
      const enriched: SessionWithStats[] = (rows as unknown as Row[]).map(
        (s) => {
          const playerIds = new Set([
            ...s.buy_ins.map((b) => b.player_id),
            ...(s.cash_outs || []).map((c) => c.player_id),
          ]);

          // Action score: see sessionScore() in stats.ts. Three parts:
          //   per-player swing + table-size bonus + rebuy bonus.
          let totalAbsCents = 0;
          let rebuyPlayerCount = 0;
          playerIds.forEach((pid) => {
            const playerBuys = s.buy_ins.filter((b) => b.player_id === pid);
            const buy = playerBuys.reduce((sum, b) => sum + b.amount_cents, 0);
            const cashOut =
              (s.cash_outs || []).find((c) => c.player_id === pid)
                ?.adjusted_amount_cents ?? 0;
            totalAbsCents += Math.abs(cashOut - buy);
            if (playerBuys.length > 1) rebuyPlayerCount += 1;
          });
          const perPlayerDollars =
            playerIds.size > 0
              ? totalAbsCents / playerIds.size / 100
              : 0;
          const swingScore = perPlayerDollars / 8;
          const tableBonus = Math.max(0, playerIds.size - 4) * 0.3;
          const rebuyBonus = rebuyPlayerCount * 0.4;
          const totalScore = swingScore + tableBonus + rebuyBonus;
          const actionScore = Math.max(
            0,
            Math.min(10, Math.round(totalScore * 10) / 10)
          );

          return {
            ...s,
            player_count: playerIds.size,
            action_score: actionScore,
          };
        }
      );
      setSessions(enriched);
    } catch (e) {
      console.error(e);
      setError(describeError(e));
    }
  }, [group]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleDelete(id: string) {
    if (
      !confirm(
        "Delete this session? Buy-ins and cash-outs will be removed too. This cannot be undone."
      )
    ) {
      return;
    }
    setDeletingId(id);
    setError(null);
    try {
      const sb = requireSupabase();
      const { error } = await sb.from("sessions").delete().eq("id", id).eq("group_id", group!.id);
      if (error) throw error;
      setSessions((prev) => (prev ? prev.filter((s) => s.id !== id) : prev));
    } catch (e) {
      console.error(e);
      setError(describeError(e));
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl text-card-50">Sessions</h1>
          <p className="mt-1 text-sm text-card-50/60">
            Every night, in reverse-chronological order.
          </p>
        </div>
        {isGroupAdmin && (
          <Link to={path("/sessions/new")}>
            <Button>+ New session</Button>
          </Link>
        )}
      </div>

      {error && (
        <Card accent="crimson">
          <p className="p-4 text-sm text-crimson-700">{error}</p>
        </Card>
      )}

      {sessions === null ? (
        <p className="text-card-50/60">Dealing…</p>
      ) : sessions.length === 0 ? (
        <Card>
          <p className="p-6 text-sm text-ink-500">
            No sessions yet.
            {isGroupAdmin
              ? ' Hit "New session" to log the first night.'
              : " Once the host logs a night, it'll appear here."}
          </p>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sessions.map((s, idx) => (
            <SessionCard
              key={s.id}
              session={s}
              dealIn={idx * 60}
              isAdmin={isGroupAdmin}
              deleting={deletingId === s.id}
              onDelete={() => void handleDelete(s.id)}
              path={path}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SessionCard({
  session,
  dealIn,
  isAdmin,
  deleting,
  onDelete,
  path,
}: {
  session: SessionWithStats;
  dealIn: number;
  isAdmin: boolean;
  deleting: boolean;
  onDelete: () => void;
  path: (sub: string) => string;
}) {
  const accent = session.needs_review
    ? "crimson"
    : session.reconciled
      ? "sage"
      : "gold";
  const date = parseLocalDate(session.played_at);
  const day = date.getDate();
  const monthShort = date.toLocaleString(undefined, { month: "short" });

  return (
    <div className="relative">
      <Link to={path(`/sessions/${session.id}`)}>
        <Card
          as="article"
          accent={accent}
          interactive
          watermarkSuit={(["spade", "heart", "diamond", "club"] as const)[
            day % 4
          ]}
          rankLabel={`${monthShort} ${day}`}
          dealIn={dealIn}
        >
          <div className="flex h-44 flex-col justify-between p-5">
            <div className="pl-10 sm:pl-14">
              <div className="font-display text-2xl text-ink-900">
                {formatPlayedAt(session.played_at)}
              </div>
              {session.notes && (
                <div className="mt-1 line-clamp-1 text-xs text-ink-500">
                  {session.notes}
                </div>
              )}
            </div>
            <div className="flex items-end justify-between">
              <div>
                <div className="text-xs uppercase tracking-wide text-ink-500">
                  Action
                </div>
                <div className="tabular font-display text-3xl text-ink-900">
                  {session.action_score.toFixed(1)}
                  <span className="text-base text-ink-500">/10</span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs uppercase tracking-wide text-ink-500">
                  Players
                </div>
                <div className="font-display text-3xl text-ink-900">
                  {session.player_count}
                </div>
              </div>
            </div>
            <StatusPill session={session} />
          </div>
        </Card>
      </Link>
      {isAdmin && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onDelete();
          }}
          disabled={deleting}
          className="absolute right-3 top-3 rounded-md bg-card-50/90 px-2 py-1 text-xs text-ink-500 ring-1 ring-card-200 transition hover:bg-crimson-500/10 hover:text-crimson-700 disabled:opacity-50"
          aria-label="Delete session"
        >
          {deleting ? "…" : "Delete"}
        </button>
      )}
    </div>
  );
}

function StatusPill({ session }: { session: SessionWithStats }) {
  if (session.needs_review) {
    return (
      <div className="inline-flex w-max items-center gap-1 rounded-full bg-crimson-600/10 px-2 py-0.5 text-xs text-crimson-700">
        Needs review · {formatSignedCents(session.discrepancy_cents)}
      </div>
    );
  }
  if (session.reconciled) {
    return (
      <div className="inline-flex w-max items-center gap-1 rounded-full bg-sage-600/15 px-2 py-0.5 text-xs text-sage-700">
        Reconciled
      </div>
    );
  }
  return (
    <div className="inline-flex w-max items-center gap-1 rounded-full bg-card-200/50 px-2 py-0.5 text-xs text-ink-500">
      In progress
    </div>
  );
}

function parseLocalDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}
