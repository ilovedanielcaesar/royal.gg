import { Link } from "react-router-dom";
import { signOut, useCurrentUser } from "../lib/auth";
import PlayerAvatar from "./PlayerAvatar";

export default function UserMenu() {
  const { user, profile, isAppOwner } = useCurrentUser();
  if (!user) return null;

  const label = profile?.display_name ?? profile?.username ?? "You";

  return (
    <div className="flex items-center gap-2">
      {isAppOwner && (
        <Link
          to="/admin"
          className="flex min-h-9 items-center rounded-md px-2 text-xs font-medium text-card-50/70 hover:bg-card-50/10 hover:text-card-50"
        >
          Admin
        </Link>
      )}
      <Link
        to="/profile"
        className="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-card-50/10"
      >
        {profile ? (
          // The card here is derived from the account id. Chosen cards are
          // per-group (GROUPS.md decision 10) and the header sits above
          // GroupProvider, so there is no group card to show.
          <PlayerAvatar
            player={{ id: profile.id, name: label }}
            size="sm"
          />
        ) : (
          <div className="h-9 w-7 rounded bg-card-50/10" />
        )}
        <span className="hidden text-xs font-medium text-card-50 sm:block">
          {label}
        </span>
      </Link>
      <button
        type="button"
        onClick={() => void signOut()}
        className="rounded-md px-2 py-1 text-xs text-card-50/70 hover:bg-card-50/10"
      >
        Sign out
      </button>
    </div>
  );
}
