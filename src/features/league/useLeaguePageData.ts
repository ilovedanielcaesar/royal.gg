import { useMemo, useState } from "react";
import { useCurrentUser } from "../../lib/auth";
import { nextIsoDate, todayIsoDate } from "../../lib/format";
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

/** Rows in the League page's payout preview, the open period included. */
export const PAYOUT_PREVIEW_ROWS = 5;

export type PayoutPreviewRow = {
  key: string;
  /** The day it was settled, and the period's last day. null = still open. */
  paidOn: string | null;
  /**
   * The period's first day, inclusive — the day after the previous payout,
   * since a period is stored as (previous payout, this one]. null means there
   * is no previous payout and the period runs from the league's beginning.
   */
  startsOn: string | null;
  sessionCount: number;
  status: "paid" | "active";
};

export type LeaguePageData = {
  league: LeagueData;
  rankings: LeagueRankingRow[];
  guests: LeagueGuestRow[];
  memberCount: number;
  myPlayerId: string | null;
  /** The open period is the last row; nothing outside needs it separately. */
  payoutPreview: PayoutPreviewRow[];
  /** Who a payout can be distributed by: active, registered players. */
  distributorOptions: Player[];
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

    // Every window is half-open the same way — (startAfter, endOn] — so a
    // session played on a payout's period_end_date belongs to the period that
    // payout closed, and never also to the one that opens the same day.
    const countSessions = (startAfter: string | null, endOn: string) =>
      sessions.filter(
        (session) =>
          (!startAfter || session.played_at > startAfter) &&
          session.played_at <= endOn
      ).length;

    const periodSessionCount = countSessions(period.startAfter, period.endOn);

    const closedPayouts = [...payouts].sort((a, b) =>
      b.period_end_date.localeCompare(a.period_end_date)
    );
    // The open period is always shown, so it takes one of the five slots.
    const payoutPreview: PayoutPreviewRow[] = [
      ...closedPayouts
        .slice(0, PAYOUT_PREVIEW_ROWS - 1)
        .map((payout, i): PayoutPreviewRow => ({
          key: payout.id,
          paidOn: payout.period_end_date,
          startsOn: closedPayouts[i + 1]
            ? nextIsoDate(closedPayouts[i + 1].period_end_date)
            : null,
          // The next *older* payout closed the window this one opened after.
          // Slicing first would be wrong here — the 5th payout is what bounds
          // the 4th, and it is outside the slice.
          sessionCount: countSessions(
            closedPayouts[i + 1]?.period_end_date ?? null,
            payout.period_end_date
          ),
          status: "paid",
        })),
      {
        key: "open",
        paidOn: null,
        startsOn: period.startAfter ? nextIsoDate(period.startAfter) : null,
        sessionCount: periodSessionCount,
        status: "active",
      },
    ];

    return {
      league,
      rankings,
      guests,
      memberCount: players.filter(
        (player) => !player.is_guest && player.status === "active"
      ).length,
      myPlayerId:
        players.find((player) => player.profile_id === user?.id)?.id ?? null,
      payoutPreview,
      distributorOptions: players
        .filter((player) => !player.is_guest && player.status === "active")
        .sort((a, b) =>
          (a.display_name ?? a.name).localeCompare(b.display_name ?? b.name)
        ),
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
