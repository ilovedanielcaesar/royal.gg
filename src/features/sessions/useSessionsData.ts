import { useMemo } from "react";
import { useCurrentUser } from "../../lib/auth";
import {
  actionScore,
  leaderboard,
  playerSessionNets,
  type Player,
  type Session,
} from "../../lib/stats";
import { useLeagueData } from "../../lib/useLeagueData";
import {
  formatSessionDateRange,
  formatSessionsSubtitle,
} from "./sessionDates";

export type SessionFilter = "all" | "reconciled" | "draft" | "review";
export type SessionSort = "latest" | "oldest" | "action" | "biggest-win";

export type SessionLedgerRow = {
  session: Session;
  nightNumber: number;
  players: Player[];
  participantNames: string[];
  playerCount: number;
  avatarOverflow: number;
  actionScore: number;
  biggestWinCents: number | null;
  yourNetCents: number | null;
};

export type SessionsSummary = {
  nights: number;
  reconciled: number;
  drafted: number;
  review: number;
  dateRange: string | null;
};

type SessionsData = {
  rows: SessionLedgerRow[];
  summary: SessionsSummary;
  subtitle: string;
};

export function useSessionsData(): {
  data: SessionsData | null;
  error: string | null;
} {
  const { user } = useCurrentUser();
  const { data: league, error } = useLeagueData();

  const data = useMemo<SessionsData | null>(() => {
    if (!league) return null;

    const { players, sessions, buyIns, cashOuts } = league;
    const me = players.find((player) => player.profile_id === user?.id) ?? null;
    const yourNets = new Map(
      me
        ? playerSessionNets(me.id, sessions, buyIns, cashOuts).map((entry) => [
            entry.session.id,
            entry.netCents,
          ])
        : []
    );
    const lifetimeNet = new Map(
      leaderboard(players, sessions, buyIns, cashOuts).map((entry) => [
        entry.playerId,
        entry.totalNetCents,
      ])
    );
    const playerById = new Map(players.map((player) => [player.id, player]));
    const chronological = [...sessions].sort(compareDateAscending);
    const nightNumber = new Map(
      chronological.map((session, index) => [session.id, index + 1])
    );

    const rows = sessions.map((session): SessionLedgerRow => {
      const sessionBuyIns = buyIns.filter(
        (buyIn) => buyIn.session_id === session.id
      );
      const sessionCashOuts = cashOuts.filter(
        (cashOut) => cashOut.session_id === session.id
      );
      const playerIds = new Set([
        ...sessionBuyIns.map((buyIn) => buyIn.player_id),
        ...sessionCashOuts.map((cashOut) => cashOut.player_id),
      ]);
      const participantPlayers = [...playerIds]
        .map((id) => playerById.get(id))
        .filter((player): player is Player => player !== undefined);
      const playersForAvatars = [...participantPlayers].sort((a, b) => {
        if (playerIds.size > 8) {
          const netDifference =
            (lifetimeNet.get(b.id) ?? 0) - (lifetimeNet.get(a.id) ?? 0);
          if (netDifference !== 0) return netDifference;
        }
        return displayName(a).localeCompare(displayName(b));
      });
      const visiblePlayers =
        playerIds.size > 8 ? playersForAvatars.slice(0, 5) : playersForAvatars;
      const playerNets = [...playerIds].map((playerId) => {
        const totalIn = sessionBuyIns
          .filter((buyIn) => buyIn.player_id === playerId)
          .reduce((sum, buyIn) => sum + buyIn.amount_cents, 0);
        const totalOut = sessionCashOuts
          .filter((cashOut) => cashOut.player_id === playerId)
          .reduce((sum, cashOut) => sum + cashOut.adjusted_amount_cents, 0);
        return totalOut - totalIn;
      });

      return {
        session,
        nightNumber: nightNumber.get(session.id) ?? 0,
        players: visiblePlayers,
        participantNames: participantPlayers.map(displayName),
        playerCount: playerIds.size,
        avatarOverflow: Math.max(0, playerIds.size - visiblePlayers.length),
        actionScore: actionScore(session.id, buyIns, cashOuts),
        biggestWinCents:
          playerNets.length > 0 ? Math.max(...playerNets) : null,
        yourNetCents: yourNets.get(session.id) ?? null,
      };
    });

    return {
      rows,
      summary: {
        nights: sessions.length,
        reconciled: sessions.filter((session) => session.reconciled).length,
        drafted: sessions.filter(
          (session) => session.status !== "approved" && !session.needs_review
        ).length,
        review: sessions.filter((session) => session.needs_review).length,
        dateRange: formatSessionDateRange(sessions),
      },
      subtitle: formatSessionsSubtitle(sessions),
    };
  }, [league, user?.id]);

  return { data, error };
}

function compareDateAscending(a: Session, b: Session): number {
  return a.played_at.localeCompare(b.played_at) || a.id.localeCompare(b.id);
}

function displayName(player: Player): string {
  return player.display_name ?? player.name;
}
