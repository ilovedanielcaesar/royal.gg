import PlayerAvatar from "../../components/PlayerAvatar";
import type { Player } from "../../lib/stats";

type Props = {
  players: Player[];
  playerCount: number;
  overflow: number;
};

export default function SessionPlayerAvatars({
  players,
  playerCount,
  overflow,
}: Props) {
  const names = players.map((player) => player.display_name ?? player.name);

  return (
    <span
      className="min-w-0"
      aria-label={`${playerCount} ${playerCount === 1 ? "player" : "players"}: ${names.join(", ")}${overflow > 0 ? `, and ${overflow} more` : ""}`}
    >
      <span className="mb-1 block text-[11px] text-ink-700">
        {playerCount} {playerCount === 1 ? "player" : "players"}
      </span>
      <span className="flex items-center -space-x-2" aria-hidden="true">
        {players.map((player) => (
          <PlayerAvatar key={player.id} player={player} size="sm" />
        ))}
        {overflow > 0 && (
          <span className="z-10 ml-3 inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-card-100 px-1.5 text-[10px] font-semibold text-ink-500">
            +{overflow}
          </span>
        )}
      </span>
    </span>
  );
}
