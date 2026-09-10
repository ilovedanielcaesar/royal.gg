import { useMemo, useState } from "react";
import { useCurrentUser } from "../../lib/auth";
import { todayIsoDate } from "../../lib/format";
import {
  consistencyScore,
  currentPayoutPeriod,
  isRankingEligible,
  leaderboard,
  playerRating,
  playerSessionNets,
  type Player,
  type PlayerStats,
} from "../../lib/stats";
import {
  useGroupMemberStatus,
  type GroupMemberStatus,
} from "../../lib/useGroupMemberStatus";
import { useLeagueData, type LeagueData } from "../../lib/useLeagueData";

export type LeagueSort =
  | "pl-desc"
  | "pl-asc"
  | "rating-desc"
  | "consistency-desc"
  | "nights-desc";

export type LeagueRankingRow = PlayerStats & {
  player: Player;
  rating: number | null;
  consistency: number;
  lastFiveNets: number[];
  memberStatus: GroupMemberStatus | null;
};

export type LeagueGuestRow = PlayerStats & { player: Player };

export type LeaguePageData = {
  league: LeagueData;
  rankings: LeagueRankingRow[];
  guests: LeagueGuestRow[];
  memberCount: number;
  myPlayerId: string | null;
  period: ReturnType<typeof currentPayoutPeriod>;
  periodSessionCount: number;
};

function nullableDesc(a: number | null, b: number | null): number {
  if (a == null) return b == null ? 0 : 1;
  if (b == null) return -1;
  return b - a;
}

export function useLeaguePageData(): {
  data: LeaguePageData | null;
  error: string | null;
  reload: () => Promise<void>;
  sort: LeagueSort;
  setSort: (sort: LeagueSort) => void;
} {
  const { user } = useCurrentUser();
  const { data: league, error: leagueError, reload } = useLeagueData();
  const memberStatuses = useGroupMemberStatus();
  const [sort, setSort] = useState<LeagueSort>("pl-desc");
  const today = todayIsoDate();

  const data = useMemo<LeaguePageData | null>(() => {
    if (!league) return null;
    const { players, sessions, buyIns, cashOuts, payouts } = league;
    const period = currentPayoutPeriod(payouts, today);
    const rankings = leaderboard(players, sessions, buyIns, cashOuts)
      .filter((row) => isRankingEligible(row.player, row.sessionsPlayed))
      .map((row): LeagueRankingRow => {
        const sessionNets = playerSessionNets(
          row.playerId,
          sessions,
          buyIns,
          cashOuts
        ).map((night) => night.netCents);
        return {
          ...row,
          rating: playerRating(row.playerId, sessions, buyIns, cashOuts).rating,
          consistency: consistencyScore(sessionNets).subscore,
          lastFiveNets: sessionNets.slice(-5),
          memberStatus: row.player.profile_id
            ? memberStatuses.statuses.get(row.player.profile_id) ?? null
            : null,
        };
      });

    rankings.sort((a, b) => {
      let compared = 0;
      if (sort === "pl-desc") compared = b.totalNetCents - a.totalNetCents;
      if (sort === "pl-asc") compared = a.totalNetCents - b.totalNetCents;
      if (sort === "rating-desc") compared = nullableDesc(a.rating, b.rating);
      if (sort === "consistency-desc") compared = b.consistency - a.consistency;
      if (sort === "nights-desc") compared = b.sessionsPlayed - a.sessionsPlayed;
      return compared || a.player.name.localeCompare(b.player.name);
    });

    const guests = leaderboard(
      players.filter((player) => player.is_guest),
      sessions,
      buyIns,
      cashOuts
    ).map((row) => ({ ...row }));

    return {
      league,
      rankings,
      guests,
      memberCount: players.filter(
        (player) => !player.is_guest && player.status === "active"
      ).length,
      myPlayerId:
        players.find((player) => player.profile_id === user?.id)?.id ?? null,
      period,
      periodSessionCount: sessions.filter((session) => {
        if (period.startAfter && session.played_at <= period.startAfter) {
          return false;
        }
        return session.played_at <= period.endOn;
      }).length,
    };
  }, [league, memberStatuses.statuses, sort, today, user?.id]);

  return {
    data,
    error: leagueError ?? memberStatuses.error,
    reload,
    sort,
    setSort,
  };
}
