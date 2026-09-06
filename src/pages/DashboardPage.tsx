import { useMemo } from "react";
import { Link } from "react-router-dom";
import Button from "../components/Button";
import Card from "../components/Card";
import CumulativeChart from "../components/CumulativeChart";
import PayoutSummary from "../components/PayoutSummary";
import PlayerAvatar from "../components/PlayerAvatar";
import SeasonLeaders from "../components/SeasonLeaders";
import { useCurrentUser } from "../lib/auth";
import { formatPlayedAt, todayIsoDate } from "../lib/format";
import { formatCents, formatSignedCents } from "../lib/money";
import {
  cumulativeByPlayer,
  currentPayoutPeriod,
  leaderboard,
  lifetimeTotals,
  playerSessionNets,
  type Player,
} from "../lib/stats";
import { useLeagueData } from "../lib/useLeagueData";

const WINNER_COLORS = [
  "var(--color-sage-600)",
  "var(--color-teal-500)",
  "var(--color-sky-500)",
];
const LOSER_COLORS = [
  "var(--color-crimson-600)",
  "var(--color-orange-500)",
  "var(--color-amber-500)",
];

export default function DashboardPage() {
  const { player: me, isAdmin } = useCurrentUser();
  const { data, error } = useLeagueData();

  const totals = useMemo(
    () =>
      data ? lifetimeTotals(data.sessions, data.buyIns, data.cashOuts) : null,
    [data]
  );

  const lb = useMemo(
    () =>
      data
        ? leaderboard(data.players, data.sessions, data.buyIns, data.cashOuts)
        : [],
    [data]
  );

  // Top 3 winners + bottom 3 losers (lifetime).
  const featured = useMemo(() => {
    const played = lb.filter((row) => row.sessionsPlayed >= 3 && !row.player.is_guest);
    const winners = played
      .filter((r) => r.totalNetCents > 0)
      .slice(0, 3);
    const losers = played
      .filter((r) => r.totalNetCents < 0)
      .slice(-3)
      .reverse(); // descending magnitude (biggest loser first)
    return { winners, losers };
  }, [lb]);

  const colorByPlayerId = useMemo(() => {
    const map = new Map<string, string>();
    featured.winners.forEach((row, i) => {
      map.set(row.playerId, WINNER_COLORS[i] ?? WINNER_COLORS[2]);
    });
    featured.losers.forEach((row, i) => {
      map.set(row.playerId, LOSER_COLORS[i] ?? LOSER_COLORS[2]);
    });
    return map;
  }, [featured]);

  const chartSeries = useMemo(() => {
    if (!data) return [];
    const cum = cumulativeByPlayer(data.sessions, data.buyIns, data.cashOuts);
    const featuredIds = new Set([
      ...featured.winners.map((r) => r.playerId),
      ...featured.losers.map((r) => r.playerId),
    ]);
    return data.players
      .filter((p) => featuredIds.has(p.id))
      .map((p) => ({
        playerId: p.id,
        name: p.display_name ?? p.name,
        points: cum.get(p.id) ?? [],
      }))
      .filter((s) => s.points.length > 0);
  }, [data, featured]);

  // "Your Last 10" — anchored to the logged-in player's player row.
  const myLast10 = useMemo(() => {
    if (!data || !me) return null;
    const all = playerSessionNets(me.id, data.sessions, data.buyIns, data.cashOuts);
    const last = all.slice(-10).reverse();
    const wins = last.filter((n) => n.netCents > 0).length;
    const losses = last.filter((n) => n.netCents < 0).length;
    const totalNet = last.reduce((s, n) => s + n.netCents, 0);
    return { last, wins, losses, totalNet };
  }, [data, me]);

  if (error && !data) {
    return (
      <Card accent="crimson">
        <p className="p-4 text-sm text-crimson-700">{error}</p>
      </Card>
    );
  }
  if (!data || !totals) {
    return <p className="text-card-50/60">Dealing…</p>;
  }

  const greetingName = me?.display_name ?? me?.name ?? "friend";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl text-card-50">Dashboard</h1>
          <p className="mt-1 text-sm text-card-50/70">
            Welcome to the table, {greetingName}.
          </p>
        </div>
        {isAdmin && (
          <Link to="/sessions/new">
            <Button>+ New session</Button>
          </Link>
        )}
      </div>

      {/* Top widget: Your Last 5 (or fallback for admin without a player row) */}
      <Card dealIn={0}>
        <div className="p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-2xl text-ink-900">Your last 10</h2>
            {me && (
              <Link
                to={`/players/${me.id}`}
                className="text-xs text-ink-500 hover:text-ink-900"
              >
                Your profile →
              </Link>
            )}
          </div>
          {!myLast10 ? (
            <p className="mt-3 text-sm text-ink-500">
              {isAdmin
                ? "You don't have a player row yet — add yourself on the Players page to see personal stats."
                : "No sessions yet."}
            </p>
          ) : myLast10.last.length === 0 ? (
            <p className="mt-3 text-sm text-ink-500">
              You haven't played in any sessions yet.
            </p>
          ) : (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-6 border-t border-card-100 pt-4">
              <div className="flex flex-1 gap-2 overflow-x-auto pb-2 sm:gap-4 sm:pb-0">
                {myLast10.last.map((n) => {
                  const date = new Date(n.session.played_at + "T12:00:00");
                  const dd = String(date.getDate()).padStart(2, "0");
                  const mm = String(date.getMonth() + 1).padStart(2, "0");
                  const yy = String(date.getFullYear()).slice(-2);
                  
                  return (
                    <Link
                      key={n.session.id}
                      to={`/sessions/${n.session.id}`}
                      className="flex min-w-[4rem] flex-col items-center justify-center gap-1.5 rounded-lg bg-card-100/50 p-2 text-center transition hover:bg-card-100 sm:min-w-[5rem] sm:p-3"
                    >
                      <span
                        className={[
                          "relative z-10 font-display text-base tabular sm:text-lg",
                          n.netCents > 0
                            ? "text-sage-600"
                            : n.netCents < 0
                              ? "text-crimson-600"
                              : "text-ink-500",
                        ].join(" ")}
                      >
                        {formatSignedCents(n.netCents)}
                      </span>
                      <span className="text-[10px] uppercase tracking-wide text-ink-500 sm:text-xs">
                        {dd}/{mm}/{yy}
                      </span>
                    </Link>
                  );
                })}
              </div>
              <div className="flex flex-col items-end justify-center gap-1 border-card-100 sm:border-l sm:pl-6">
                <div className="text-[10px] uppercase tracking-wide text-ink-500">
                  Last 10 net
                </div>
                <div
                  className={`font-display text-3xl tabular ${
                    myLast10.totalNet > 0
                      ? "text-sage-700"
                      : myLast10.totalNet < 0
                        ? "text-crimson-700"
                        : "text-ink-700"
                  }`}
                >
                  {formatSignedCents(myLast10.totalNet)}
                </div>
                <div className="text-xs text-ink-500">
                  {myLast10.wins}W · {myLast10.losses}L
                </div>
              </div>
            </div>
          )}
        </div>
      </Card>

      <Card watermarkSuit="spade" rankLabel="Σ" dealIn={120}>
        <div className="p-5">
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-display text-2xl text-ink-900">
              Recent movements
            </h2>
            <p className="text-xs text-ink-500">
              Top 3 winners and bottom 3 losers · all-time
            </p>
          </div>
          {chartSeries.length === 0 ? (
            <p className="mt-3 text-sm text-ink-500">
              Once a few sessions are played, lifetime trajectories will draw
              here.
            </p>
          ) : (
            <>
              <CumulativeChart
                series={chartSeries}
                sessions={data.sessions}
                colorOf={(id) => colorByPlayerId.get(id)}
              />
              <ChartLegend
                winners={featured.winners.map((r) => ({
                  player: r.player,
                  color: colorByPlayerId.get(r.playerId)!,
                }))}
                losers={featured.losers.map((r) => ({
                  player: r.player,
                  color: colorByPlayerId.get(r.playerId)!,
                }))}
              />
            </>
          )}
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card watermarkSuit="club" rankLabel="#" dealIn={240}>
          <div className="p-5">
            <h2 className="font-display text-2xl text-ink-900">All Time Standings</h2>
            {lb.filter((row) => row.sessionsPlayed >= 3 && !row.player.is_guest).length === 0 ? (
              <p className="mt-3 text-sm text-ink-500">
                No standings yet — play at least 3 sessions to populate.
              </p>
            ) : (
              <ol className="mt-3 divide-y divide-card-100">
                {lb
                  .filter((row) => row.sessionsPlayed >= 3 && !row.player.is_guest)
                  .map((row, idx) => (
                    <li
                      key={row.playerId}
                      className="flex items-center gap-4 py-3"
                    >
                      <div className="w-6 font-display text-xl text-ink-700">
                        {idx + 1}
                      </div>
                      <PlayerAvatar player={row.player} size="sm" />
                      <Link
                        to={`/players/${row.playerId}`}
                        className="flex-1 hover:underline"
                      >
                        <div className="font-medium text-ink-900">
                          {row.player.display_name ?? row.player.name}
                        </div>
                        <div className="text-xs text-ink-500">
                          {row.sessionsPlayed} sessions · {row.wins}W{" "}
                          {row.losses}L
                        </div>
                      </Link>
                      <div
                        className={`tabular font-display text-xl ${
                          row.totalNetCents > 0
                            ? "text-sage-600"
                            : row.totalNetCents < 0
                              ? "text-crimson-600"
                              : "text-ink-500"
                        }`}
                      >
                        {formatSignedCents(row.totalNetCents)}
                      </div>
                    </li>
                  ))}
              </ol>
            )}
          </div>
        </Card>

        <div className="flex flex-col gap-4">
          <Card watermarkSuit="diamond" rankLabel="◊" dealIn={300}>
            <div className="p-5">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-2xl text-ink-900">
                  Season Standings
                </h2>
                <span className="text-xs text-ink-500">Last 3 months</span>
              </div>
              <SeasonLeaders
                players={data.players}
                sessions={data.sessions}
                buyIns={data.buyIns}
                cashOuts={data.cashOuts}
              />
            </div>
          </Card>

          {/* Current payout period — what everyone owes / is owed right now */}
          <Card watermarkSuit="diamond" rankLabel="$" accent="gold">
            <div className="p-5">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-xl text-ink-900">
                  Current payout period
                </h2>
                <Link
                  to="/players"
                  className="text-xs text-ink-500 hover:text-ink-900"
                >
                  Settle up →
                </Link>
              </div>
              {(() => {
                const period = currentPayoutPeriod(
                  data.payouts,
                  todayIsoDate()
                );
                return (
                  <>
                    <p className="mt-0.5 text-xs text-ink-500">
                      {period.startAfter
                        ? `Since ${formatPlayedAt(period.startAfter)}`
                        : "All-time (no payouts yet)"}
                    </p>
                    <PayoutSummary
                      players={data.players}
                      sessions={data.sessions}
                      buyIns={data.buyIns}
                      cashOuts={data.cashOuts}
                      startAfter={period.startAfter}
                      endOn={period.endOn}
                      linkProfiles
                    />
                  </>
                );
              })()}
            </div>
          </Card>

          {/* Bottom widgets moved here */}
          <div className="flex flex-col gap-4">
            {(() => {
              const winPlayer = data.players.find(p => p.id === totals.biggestWinPlayerId);
              const winName = winPlayer?.display_name ?? winPlayer?.name ?? "";
              
              return (
                <StatCard
                  label="Biggest win (all time)"
                  value={totals.biggestWinCents > 0 ? formatCents(totals.biggestWinCents) : "—"}
                  sub={totals.biggestWinDate && winName ? `${winName} · ${formatPlayedAt(totals.biggestWinDate)}` : undefined}
                  accent="sage"
                />
              );
            })()}

            {(() => {
              const lossPlayer = data.players.find(p => p.id === totals.biggestLossPlayerId);
              const lossName = lossPlayer?.display_name ?? lossPlayer?.name ?? "";

              return (
                <StatCard
                  label="Biggest loss (all time)"
                  value={totals.biggestLossCents < 0 ? formatCents(Math.abs(totals.biggestLossCents)) : "—"}
                  sub={totals.biggestLossDate && lossName ? `${lossName} · ${formatPlayedAt(totals.biggestLossDate)}` : undefined}
                  accent="crimson"
                />
              );
            })()}
            
            <StatCard label="Total sessions" value={String(totals.sessionCount)} />
          </div>
        </div>
      </div>
    </div>
  );
}

function ChartLegend({
  winners,
  losers,
}: {
  winners: Array<{ player: Player; color: string }>;
  losers: Array<{ player: Player; color: string }>;
}) {
  if (winners.length === 0 && losers.length === 0) return null;
  return (
    <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-ink-700">
      {winners.map((w, i) => (
        <span key={w.player.id} className="inline-flex items-center gap-1.5">
          <span
            className="inline-block h-2.5 w-4 rounded-sm"
            style={{ backgroundColor: w.color }}
          />
          {i + 1}. {w.player.display_name ?? w.player.name}
        </span>
      ))}
      {winners.length > 0 && losers.length > 0 && (
        <span className="text-ink-500">·</span>
      )}
      {losers.map((l, i) => (
        <span key={l.player.id} className="inline-flex items-center gap-1.5">
          <span
            className="inline-block h-2.5 w-4 rounded-sm"
            style={{ backgroundColor: l.color }}
          />
          {i + 1}. {l.player.display_name ?? l.player.name}
        </span>
      ))}
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: "sage" | "crimson";
}) {
  const textColor = accent === "sage" ? "text-sage-700" : accent === "crimson" ? "text-crimson-700" : "text-ink-900";
  return (
    <Card>
      <div className="p-5">
        <div className="text-xs uppercase tracking-wide text-ink-500">
          {label}
        </div>
        <div className={`tabular mt-1 font-display text-3xl ${textColor}`}>
          {value}
        </div>
        {sub && <div className="mt-0.5 text-xs text-ink-500">{sub}</div>}
      </div>
    </Card>
  );
}
