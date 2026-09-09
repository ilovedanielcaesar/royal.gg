import { useMemo } from "react";
import { useCurrentUser } from "../../lib/auth";
import {
  cumulativeByPlayer,
  isRankingEligible,
  leaderboard,
  lifetimeTotals,
  playerRating,
  playerSessionNets,
  playerStats,
  recentSessions,
  type CumulativePoint,
  type Player,
  type PlayerRating,
  type PlayerStats,
  type Session,
} from "../../lib/stats";
import { useLeagueData, type LeagueData } from "../../lib/useLeagueData";

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

/** Band 5's window, in games. See DESIGN.md → Dashboard layout, band 5. */
const SEASON_WINDOW_GAMES = 5;

type Series = { playerId: string; name: string; points: CumulativePoint[] };

export type DashboardData = {
  league: LeagueData;
  /** Your roster row in THIS group, or null if you have none. */
  me: Player | null;
  you: {
    stats: PlayerStats;
    rating: PlayerRating;
    netsOldestFirst: number[];
    sessionNets: Array<{ session: Session; netCents: number }>;
  } | null;
  totals: ReturnType<typeof lifetimeTotals>;
  /** Ranking-eligible players, lifetime, best first, with per-night nets. */
  tableRows: Array<
    PlayerStats & { player: Player; netsOldestFirst: number[] }
  >;
  yourSeries: Series[];
  leagueSeries: Series[];
  colorOf: (playerId: string) => string | undefined;
  legend: {
    winners: Array<{ player: Player; color: string }>;
    losers: Array<{ player: Player; color: string }>;
  };
  seasonWindow: Session[];
  /** Ranking-eligible players, for band 5. */
  eligiblePlayers: Player[];
};

/**
 * Everything the dashboard's five bands need, assembled once.
 *
 * Separated from `DashboardPage` so the page is composition and this is
 * arithmetic. It also keeps the derivations inside `useMemo` — computing
 * per-player nets in the JSX re-ran them on every keystroke of a parent
 * re-render, and there are `players × sessions` of them.
 */
export function useDashboardData(): {
  data: DashboardData | null;
  error: string | null;
} {
  const { user } = useCurrentUser();
  const { data: league, error } = useLeagueData();

  const value = useMemo<DashboardData | null>(() => {
    if (!league) return null;

    const { players, sessions, buyIns, cashOuts } = league;

    // An account can sit on several rosters, so this is looked up per group
    // rather than carried on the session.
    const me = players.find((p) => p.profile_id === user?.id) ?? null;

    const netsByPlayer = new Map<string, number[]>();
    players.forEach((p) => {
      netsByPlayer.set(
        p.id,
        playerSessionNets(p.id, sessions, buyIns, cashOuts).map(
          (n) => n.netCents
        )
      );
    });

    const lb = leaderboard(players, sessions, buyIns, cashOuts);
    const eligible = lb.filter((row) =>
      isRankingEligible(row.player, row.sessionsPlayed)
    );

    // The chart's League view is a claim about the league, so it obeys the
    // same eligibility rule the standings do.
    const winners = eligible.filter((r) => r.totalNetCents > 0).slice(0, 3);
    const losers = eligible
      .filter((r) => r.totalNetCents < 0)
      .slice(-3)
      .reverse();

    const colors = new Map<string, string>();
    winners.forEach((row, i) =>
      colors.set(row.playerId, WINNER_COLORS[i] ?? WINNER_COLORS[2]!)
    );
    losers.forEach((row, i) =>
      colors.set(row.playerId, LOSER_COLORS[i] ?? LOSER_COLORS[2]!)
    );

    const cum = cumulativeByPlayer(sessions, buyIns, cashOuts);
    const seriesFor = (ids: string[]): Series[] =>
      ids
        .map((id) => {
          const p = players.find((q) => q.id === id);
          return {
            playerId: id,
            name: p ? (p.display_name ?? p.name) : "Unknown",
            points: cum.get(id) ?? [],
          };
        })
        .filter((s) => s.points.length > 0);

    return {
      league,
      me,
      you: me
        ? {
            stats: playerStats(me.id, sessions, buyIns, cashOuts),
            rating: playerRating(me.id, sessions, buyIns, cashOuts),
            netsOldestFirst: netsByPlayer.get(me.id) ?? [],
            sessionNets: playerSessionNets(me.id, sessions, buyIns, cashOuts),
          }
        : null,
      totals: lifetimeTotals(sessions, buyIns, cashOuts),
      // Standings, so the same `eligible` set the chart and band 5 rank from —
      // one filter, not three copies of the rule. Guest money still counts in
      // every total, chart and record; only the ranking excludes it.
      tableRows: eligible.map((row) => ({
        ...row,
        netsOldestFirst: netsByPlayer.get(row.playerId) ?? [],
      })),
      yourSeries: me ? seriesFor([me.id]) : [],
      leagueSeries: seriesFor([
        ...winners.map((r) => r.playerId),
        ...losers.map((r) => r.playerId),
      ]),
      colorOf: (id: string) => colors.get(id),
      legend: {
        winners: winners.map((r) => ({
          player: r.player,
          color: colors.get(r.playerId)!,
        })),
        losers: losers.map((r) => ({
          player: r.player,
          color: colors.get(r.playerId)!,
        })),
      },
      seasonWindow: recentSessions(sessions, SEASON_WINDOW_GAMES),
      eligiblePlayers: eligible.map((row) => row.player),
    };
  }, [league, user?.id]);

  return { data: value, error };
}
