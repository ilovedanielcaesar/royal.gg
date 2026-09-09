import { useMemo } from "react";
import { useCurrentUser } from "../../lib/auth";
import {
  isRankingEligible,
  leaderboard,
  netStats,
  playerRating,
  playerSessionNets,
  playerStats,
  type CumulativePoint,
  type Player,
  type PlayerRating,
  type PlayerStats,
  type Session,
} from "../../lib/stats";
import { useLeagueData, type LeagueData } from "../../lib/useLeagueData";

export type ProfileLedgerRow = {
  session: Session;
  nightNumber: number;
  buyInCents: number;
  cashOutCents: number;
  netCents: number;
  runningTotalCents: number;
};

export type ProfileData = {
  league: LeagueData;
  player: Player | null;
  stats: PlayerStats | null;
  rating: PlayerRating | null;
  leagueRank: number | null;
  meanCents: number | null;
  varianceCentsSquared: number | null;
  stdevCents: number | null;
  chartSessions: Session[];
  chartSeries: Array<{
    playerId: string;
    name: string;
    points: CumulativePoint[];
  }>;
  ledgerRows: ProfileLedgerRow[];
};

export function useProfileData(): {
  data: ProfileData | null;
  error: string | null;
  reload: () => Promise<void>;
} {
  const { user } = useCurrentUser();
  const { data: league, error, reload } = useLeagueData();

  const data = useMemo<ProfileData | null>(() => {
    if (!league) return null;
    const player =
      league.players.find((entry) => entry.profile_id === user?.id) ?? null;
    if (!player) return emptyProfile(league);

    const sessionNets = playerSessionNets(
      player.id,
      league.sessions,
      league.buyIns,
      league.cashOuts
    );
    let runningTotalCents = 0;
    const ledgerOldestFirst = sessionNets.map(({ session, netCents }, index) => {
      const buyInCents = league.buyIns
        .filter(
          (entry) =>
            entry.session_id === session.id && entry.player_id === player.id
        )
        .reduce((sum, entry) => sum + entry.amount_cents, 0);
      const cashOutCents = league.cashOuts
        .filter(
          (entry) =>
            entry.session_id === session.id && entry.player_id === player.id
        )
        .reduce((sum, entry) => sum + entry.adjusted_amount_cents, 0);
      runningTotalCents += netCents;
      return {
        session,
        nightNumber: index + 1,
        buyInCents,
        cashOutCents,
        netCents,
        runningTotalCents,
      };
    });
    const points = ledgerOldestFirst.map((row, sessionIndex) => ({
      sessionIndex,
      sessionId: row.session.id,
      playedAt: row.session.played_at,
      netCents: row.netCents,
      cumulativeCents: row.runningTotalCents,
    }));
    const netSummary = netStats(sessionNets.map((entry) => entry.netCents));
    const rankIndex = leaderboard(
      league.players,
      league.sessions,
      league.buyIns,
      league.cashOuts
    )
      .filter((entry) =>
        isRankingEligible(entry.player, entry.sessionsPlayed)
      )
      .findIndex((entry) => entry.playerId === player.id);

    return {
      league,
      player,
      stats: playerStats(
        player.id,
        league.sessions,
        league.buyIns,
        league.cashOuts
      ),
      rating: playerRating(
        player.id,
        league.sessions,
        league.buyIns,
        league.cashOuts
      ),
      leagueRank: rankIndex < 0 ? null : rankIndex + 1,
      meanCents: netSummary.mean,
      varianceCentsSquared: netSummary.variance,
      stdevCents: netSummary.stdev,
      chartSessions: ledgerOldestFirst.map((row) => row.session),
      chartSeries: [
        {
          playerId: player.id,
          name: player.display_name ?? player.name,
          points,
        },
      ],
      ledgerRows: [...ledgerOldestFirst].reverse(),
    };
  }, [league, user?.id]);

  return { data, error, reload };
}

function emptyProfile(league: LeagueData): ProfileData {
  return {
    league,
    player: null,
    stats: null,
    rating: null,
    leagueRank: null,
    meanCents: null,
    varianceCentsSquared: null,
    stdevCents: null,
    chartSessions: [],
    chartSeries: [],
    ledgerRows: [],
  };
}
