import Button from "./Button";
import PlayerAvatar from "./PlayerAvatar";
import {
  memberName,
  ONLY_ADMIN_REASON,
  type MemberSection,
  type MemberUpdate,
  type Membership,
} from "../lib/membership";

type Props = {
  member: Membership;
  section: MemberSection;
  /** The group would be left with no admin if this row lost the role. */
  soleAdmin: boolean;
  /** This row is the one currently saving. */
  busy: boolean;
  /** Some row is saving, so every button is held. */
  locked: boolean;
  onUpdate: (update: MemberUpdate) => void;
};

export default function MemberRow(props: Props) {
  const { member, section, soleAdmin, busy, locked, onUpdate } = props;
  const profile = member.profiles;
  const name = memberName(member);

  return (
    <div
      className={`flex flex-wrap items-center gap-3 p-4 ${
        section === "inactive" ? "opacity-60" : ""
      }`}
    >
      <PlayerAvatar
        player={{
          id: profile?.id ?? member.id,
          name,
          display_name: profile?.display_name,
        }}
        size="sm"
      />
      <div className="min-w-40 flex-1">
        <p className="font-medium text-ink-900">{name}</p>
        <p className="text-xs text-ink-500">@{profile?.username ?? "—"}</p>
        {section === "pending" && (
          <time className="text-xs text-ink-500" dateTime={member.created_at}>
            Asked {new Date(member.created_at).toLocaleDateString()}
          </time>
        )}
      </div>

      <span className="text-xs uppercase tracking-wide text-ink-500">
        {section === "active" ? member.role : ""}
        {section === "inactive" ? member.status : ""}
      </span>

      <div className="flex flex-wrap gap-2">
        {section === "pending" && (
          <>
            <Button
              size="sm"
              variant="secondary"
              disabled={locked}
              onClick={() => onUpdate({ status: "active" })}
            >
              {busy ? "Saving…" : "Approve"}
            </Button>
            <Button
              size="sm"
              variant="danger"
              disabled={locked}
              onClick={() => onUpdate({ status: "rejected" })}
            >
              Reject
            </Button>
          </>
        )}

        {section === "active" && (
          <>
            <Button
              size="sm"
              variant="secondary"
              disabled={locked || soleAdmin}
              title={soleAdmin ? ONLY_ADMIN_REASON : undefined}
              onClick={() =>
                onUpdate({
                  role: member.role === "admin" ? "member" : "admin",
                })
              }
            >
              {busy
                ? "Saving…"
                : member.role === "admin"
                  ? "Demote"
                  : "Promote"}
            </Button>
            <Button
              size="sm"
              variant="danger"
              disabled={locked || soleAdmin}
              title={soleAdmin ? ONLY_ADMIN_REASON : undefined}
              onClick={() => {
                // Removal keeps the row: decision 9 preserves their history
                // and their place on the leaderboard.
                if (
                  !confirm(`Remove ${name}? Their game history is kept.`)
                ) {
                  return;
                }
                onUpdate({ status: "removed" });
              }}
            >
              Remove
            </Button>
          </>
        )}

        {section === "inactive" && (
          <Button
            size="sm"
            variant="secondary"
            disabled={locked}
            onClick={() => onUpdate({ status: "active" })}
          >
            {busy ? "Restoring…" : "Restore"}
          </Button>
        )}
      </div>
    </div>
  );
}
