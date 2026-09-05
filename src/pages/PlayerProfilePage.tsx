import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import Card from "../components/Card";
import PlayerAvatar from "../components/PlayerAvatar";
import PlayerStatsCard from "../components/PlayerStatsCard";
import {
  leaderboard,
  playerRating,
} from "../lib/stats";
import { EMPTY_LEAGUE_DATA, useLeagueData } from "../lib/useLeagueData";
import { useGroup } from "../lib/groupContext";

export default function PlayerProfilePage() {
  const { id } = useParams();
  const { path } = useGroup();
  const { data, loading, error } = useLeagueData();
  const {
    players: allPlayers,
    sessions,
    buyIns,
    cashOuts,
  } = data ?? EMPTY_LEAGUE_DATA;
  const player = allPlayers.find((candidate) => candidate.id === id) ?? null;

  const allTimeRank = useMemo(() => {
    if (!player) return null;
    const lb = leaderboard(allPlayers, sessions, buyIns, cashOuts).filter(
      (r) => r.sessionsPlayed > 0
    );
    const idx = lb.findIndex((r) => r.playerId === player.id);
    return idx === -1 ? null : idx + 1;
  }, [player, allPlayers, sessions, buyIns, cashOuts]);

  const ratingRank = useMemo(() => {
    if (!player) return null;
    const ranked = allPlayers
      .map((p) => ({
        id: p.id,
        rating: playerRating(p.id, sessions, buyIns, cashOuts).rating,
      }))
      .filter((r): r is { id: string; rating: number } => r.rating != null)
      .sort((a, b) => b.rating - a.rating);
    const idx = ranked.findIndex((r) => r.id === player.id);
    return idx === -1 ? null : idx + 1;
  }, [player, allPlayers, sessions, buyIns, cashOuts]);

  if (loading) {
    return <div className="text-sm text-card-50/60">Dealing in…</div>;
  }
  if (error || !player) {
    return (
      <Card className="p-6">
        <p className="text-sm text-crimson-700">
          {error ?? "Player not found."}
        </p>
        <Link to={path("/players")} className="mt-2 inline-block text-xs text-sage-700 underline">
          Back to players
        </Link>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-4">
        <PlayerAvatar player={player} size="lg" />
        <div>
          <h1 className="font-display text-3xl text-card-50">
            {player.display_name ?? player.name}
          </h1>
          <p className="text-sm text-card-50/70">
            {player.username
              ? `@${player.username}`
              : player.is_guest
                ? "Guest"
                : "Member"}
          </p>
        </div>
      </header>
      <PlayerStatsCard
        player={player}
        sessions={sessions}
        buyIns={buyIns}
        cashOuts={cashOuts}
        recentCount={10}
        highlightHero
        rankAllTime={allTimeRank}
        rankRating={ratingRank}
      />
    </div>
  );
}
