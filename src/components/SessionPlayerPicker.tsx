import type { Dispatch, SetStateAction } from "react";
import type {
  SessionFormPlayer,
  SessionFormRow,
} from "../lib/sessionForm";
import AddGuestForm from "./AddGuestForm";
import Card from "./Card";
import PlayerAvatar from "./PlayerAvatar";

type Props = {
  players: SessionFormPlayer[];
  rows: SessionFormRow[];
  groupId: string;
  canAddGuest: boolean;
  onToggle: (playerId: string) => void;
  onGuestAdded: (player: SessionFormPlayer) => void;
  setError: Dispatch<SetStateAction<string | null>>;
};

export default function SessionPlayerPicker({
  players,
  rows,
  groupId,
  canAddGuest,
  onToggle,
  onGuestAdded,
  setError,
}: Props) {
  const visible = players.filter((player) => player.status === "active");
  const gridPlayers = [
    ...visible.filter((player) => !player.is_guest),
    ...visible.filter((player) => player.is_guest),
  ];
  const selectedIds = new Set(rows.map((row) => row.playerId));

  return (
    <Card>
      <div className="p-5">
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-xl text-ink-900">
            Who's at the table?
          </h2>
          <span className="text-xs text-ink-500">
            {rows.length} selected
          </span>
        </div>

        {gridPlayers.length === 0 ? (
          <p className="mt-3 text-sm text-ink-500">
            No players in the roster yet.
          </p>
        ) : (
          <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-5">
            {gridPlayers.map((player) => {
              const selected = selectedIds.has(player.id);
              return (
                <button
                  key={player.id}
                  type="button"
                  onClick={() => onToggle(player.id)}
                  className={[
                    "flex flex-col items-center gap-2 rounded-lg p-3 transition",
                    selected
                      ? "bg-sage-500/15 ring-2 ring-sage-600"
                      : "bg-card-100/40 ring-1 ring-card-200 hover:bg-card-100",
                  ].join(" ")}
                >
                  <PlayerAvatar player={player} size="md" />
                  <div className="w-full truncate text-center text-xs font-medium text-ink-900">
                    {player.display_name ?? player.name}
                  </div>
                  {player.is_guest && (
                    <div className="text-[10px] uppercase tracking-wide text-ink-500">
                      guest
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {canAddGuest && (
          <AddGuestForm
            groupId={groupId}
            onAdded={onGuestAdded}
            onError={setError}
          />
        )}
      </div>
    </Card>
  );
}
