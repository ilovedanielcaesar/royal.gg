import { Link } from "react-router-dom";
import { signOut, useCurrentUser } from "../lib/auth";
import PlayerAvatar from "./PlayerAvatar";

export default function UserMenu() {
  const { user, player, isAdmin } = useCurrentUser();
  if (!user) return null;

  const label = player?.display_name ?? player?.username ?? user.email ?? "You";

  return (
    <div className="flex items-center gap-2">
      {isAdmin && (
        <Link
          to="/admin/approvals"
          className="rounded-md px-2 py-1 text-xs font-medium text-gold-400 ring-1 ring-gold-500/40 hover:bg-gold-500/10"
        >
          Approvals
        </Link>
      )}
      <Link
        to="/profile"
        className="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-card-50/10"
      >
        {player ? (
          <PlayerAvatar player={player} size="sm" />
        ) : (
          <div className="h-8 w-6 rounded bg-card-50/10" />
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
