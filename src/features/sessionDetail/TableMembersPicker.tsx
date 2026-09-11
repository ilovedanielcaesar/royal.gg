import PlayerAvatar from "../../components/PlayerAvatar";
import type { SessionFormPlayer } from "../../lib/sessionForm";

type Props = {
  members: SessionFormPlayer[];
  selectedIds: Set<string>;
  onToggle: (playerId: string) => void;
};

/**
 * Who's at the table — REGISTERED MEMBERS ONLY.
 *
 * Guests are deliberately absent, including ones who played last week. The
 * brief is explicit about it (`_FEEDBACK_V2.md`, Individual session page):
 * this grid is the roster, it is the same every week, and a guest list that
 * grows without bound turns the one control you use every session into a
 * search problem. Guests come in through the field beside it.
 */
export default function TableMembersPicker({
  members,
  selectedIds,
  onToggle,
}: Props) {
  if (members.length === 0) {
    return (
      <p className="mt-1 text-xs text-ink-500">
        Nobody has joined this league yet.
      </p>
    );
  }

  return (
    <div className="mt-1 flex flex-wrap gap-1.5">
      {members.map((member) => {
        const selected = selectedIds.has(member.id);
        return (
          <button
            key={member.id}
            type="button"
            aria-pressed={selected}
            onClick={() => onToggle(member.id)}
            className={[
              "inline-flex min-h-[38px] items-center gap-[7px] rounded-[9px] px-3 text-[12.5px] font-medium text-ink-900 transition",
              selected
                ? "bg-card-100 shadow-[inset_0_0_0_1px_var(--color-sage-600)]"
                : "bg-card-50 ring-1 ring-card-200 hover:bg-card-100",
            ].join(" ")}
          >
            <PlayerAvatar player={member} size="sm" />
            <span className="truncate">
              {member.display_name ?? member.name}
            </span>
          </button>
        );
      })}
    </div>
  );
}
