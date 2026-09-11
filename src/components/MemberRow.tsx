import Button from "./Button";
import ConfirmButton from "./ConfirmButton";
import LinkGuestControl from "./LinkGuestControl";
import PlayerAvatar from "./PlayerAvatar";
import {
  memberName,
  ONLY_ADMIN_REASON,
  type LinkableGuest,
  type MemberSection,
  type MemberUpdate,
  type Membership,
} from "../lib/membership";

type Props = {
  member: Membership;
  section: MemberSection;
  /** The group would be left with no admin if this row lost the role. */
  soleAdmin: boolean;
  /** This row is saving a membership change. */
  busy: boolean;
  /** This row is saving a guest link. */
  linking: boolean;
  /** Some row is saving, so every button is held. */
  locked: boolean;
  linkableGuests: LinkableGuest[];
  onLink: (guestId: string) => void;
  onUpdate: (update: MemberUpdate) => void;
};

export default function MemberRow(props: Props) {
  const {
    member,
    section,
    soleAdmin,
    busy,
    linking,
    locked,
    linkableGuests,
    onLink,
    onUpdate,
  } = props;
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

      <div className="flex flex-wrap items-end gap-2">
        {section === "pending" && (
          <>
            <LinkGuestControl
              guests={linkableGuests}
              busy={linking}
              locked={locked}
              onLink={onLink}
            />
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
            {/* Removal keeps the row: decision 9 preserves their history and
                their place on the leaderboard, which is what the armed label
                says. It was a window.confirm, whose one sentence was the only
                place that got explained. */}
            <ConfirmButton
              label="Remove"
              confirmLabel={`Remove ${name}`}
              consequence="Their game history is kept."
              busy={busy}
              busyLabel="Removing…"
              disabled={locked || soleAdmin}
              onConfirm={() => onUpdate({ status: "removed" })}
            />
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
