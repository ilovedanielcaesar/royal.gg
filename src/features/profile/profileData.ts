import {
  isRankingEligible,
  leaderboard,
  netStats,
  playerRating,
  playerSessionNets,
  playerStats,
  rebuySuccessRate,
  type CumulativePoint,
  type Player,
  type PlayerRating,
  type PlayerStats,
  type RebuySuccess,
  type Session,
} from "../../lib/stats";
import type { LeagueData } from "../../lib/useLeagueData";

export type ProfileLedgerRow = {
  session: Session;
  /** Rows in `buy_ins`, not dollars — what `rebuySuccessRate()` counts. */
  buyInCount: number;
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
  rebuy: RebuySuccess;
  chartSessions: Session[];
  chartSeries: Array<{
    playerId: string;
    name: string;
    points: CumulativePoint[];
  }>;
  ledgerRows: ProfileLedgerRow[];
};

/**
 * Everything a profile page shows about one roster row, derived from the
 * league data already in hand.
 *
 * Pure, and taking the player rather than finding them, so the same figures
 * back your own page and somebody else's. The two hooks over it in
 * `useProfileData.ts` differ only in how they pick the player.
 */
export function buildPlayerProfile(
  league: LeagueData,
  player: Player | null
): ProfileData {
  if (!player) return emptyProfile(league);

  const sessionNets = playerSessionNets(
    player.id,
    league.sessions,
    league.buyIns,
    league.cashOuts
  );
  let runningTotalCents = 0;
  const ledgerOldestFirst = sessionNets.map(({ session, netCents }) => {
    const nightBuyIns = league.buyIns.filter(
      (entry) =>
        entry.session_id === session.id && entry.player_id === player.id
    );
    const buyInCents = nightBuyIns.reduce(
      (sum, entry) => sum + entry.amount_cents,
      0
    );
    const cashOutCents = league.cashOuts
      .filter(
        (entry) =>
          entry.session_id === session.id && entry.player_id === player.id
      )
      .reduce((sum, entry) => sum + entry.adjusted_amount_cents, 0);
    runningTotalCents += netCents;
    return {
      session,
      buyInCount: nightBuyIns.length,
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
    rebuy: rebuySuccessRate(ledgerOldestFirst),
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
    rebuy: { rate: null, successes: 0, qualifying: 0 },
    chartSessions: [],
    chartSeries: [],
    ledgerRows: [],
  };
}
