import { useState } from "react";
import Button from "./Button";
import ConfirmButton from "./ConfirmButton";
import { publicAppUrl } from "../lib/appUrl";
import type { Database } from "../types/database";

type GroupInvite = Database["public"]["Tables"]["group_invites"]["Row"];

type Props = {
  invite: GroupInvite;
  busy: boolean;
  locked: boolean;
  onRevoke: () => void;
};

export default function InviteLinkRow({
  invite,
  busy,
  locked,
  onRevoke,
}: Props) {
  const [loadedAt] = useState(() => Date.now());
  const inviteUrl = publicAppUrl(`/join/${invite.token}`);
  const expired =
    invite.expires_at !== null &&
    new Date(invite.expires_at).getTime() <= loadedAt;
  const usedUp =
    invite.max_uses !== null && invite.used_count >= invite.max_uses;
  const spent = expired || usedUp;

  return (
    <div
      className={`flex flex-wrap items-center gap-3 p-4 ${
        spent ? "opacity-60" : ""
      }`}
    >
      <div className="min-w-0 flex-1">
        <p className="break-all font-mono text-sm text-ink-900">{inviteUrl}</p>
        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink-500">
          <span>
            Expires: {invite.expires_at ? new Date(invite.expires_at).toLocaleString() : "never"}
          </span>
          <span>
            Uses: {invite.used_count}
            {invite.max_uses === null
              ? " · unlimited"
              : ` / ${invite.max_uses}`}
          </span>
          {spent && (
            <span className="font-medium uppercase tracking-wide text-crimson-700">
              Spent
            </span>
          )}
        </div>
      </div>
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="secondary"
          onClick={() => void navigator.clipboard.writeText(inviteUrl)}
        >
          Copy
        </Button>
        {/* Arms in place. This was a window.confirm asking "Revoke this
            invite link?" — which, on a page listing several of them, does not
            say WHICH one. The armed button is next to the link it revokes. */}
        <ConfirmButton
          label="Revoke"
          confirmLabel="Revoke link"
          consequence="The link stops working."
          busy={busy}
          busyLabel="Revoking…"
          disabled={locked}
          onConfirm={onRevoke}
        />
      </div>
    </div>
  );
}
