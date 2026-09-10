import { useMemo } from "react";
import { useCurrentUser } from "../../lib/auth";
import {
  actionScore,
  playerSessionNets,
  type Player,
  type Session,
} from "../../lib/stats";
import { useLeagueData } from "../../lib/useLeagueData";
import {
  formatSessionDateRange,
  formatSessionsSubtitle,
} from "./sessionDates";

/**
 * Faces shown on a ledger row before the rest become a `+n`.
 *
 * Three, always — not "all of them up to eight". A row is a glance, and eight
 * overlapping cards is a smear that says nothing; three says who won.
 */
const AVATAR_PREVIEW = 3;

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

      // That night's net per player, which is what orders the avatars. Not
      // lifetime net: the row is about one night, so the three faces on it
      // should be the three who won that night, not the three who are up
      // overall and happened to be there.
      const netByPlayer = new Map(
        [...playerIds].map((playerId) => {
          const totalIn = sessionBuyIns
            .filter((buyIn) => buyIn.player_id === playerId)
            .reduce((sum, buyIn) => sum + buyIn.amount_cents, 0);
          const totalOut = sessionCashOuts
            .filter((cashOut) => cashOut.player_id === playerId)
            .reduce((sum, cashOut) => sum + cashOut.adjusted_amount_cents, 0);
          return [playerId, totalOut - totalIn] as const;
        })
      );
      const visiblePlayers = [...participantPlayers]
        .sort(
          (a, b) =>
            (netByPlayer.get(b.id) ?? 0) - (netByPlayer.get(a.id) ?? 0) ||
            displayName(a).localeCompare(displayName(b))
        )
        .slice(0, AVATAR_PREVIEW);

      return {
        session,
        nightNumber: nightNumber.get(session.id) ?? 0,
        players: visiblePlayers,
        participantNames: participantPlayers.map(displayName),
        playerCount: playerIds.size,
        avatarOverflow: Math.max(0, playerIds.size - visiblePlayers.length),
        actionScore: actionScore(session.id, buyIns, cashOuts),
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
