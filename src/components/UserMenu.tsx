import { Link, useLocation } from "react-router-dom";
import { useCurrentUser } from "../lib/auth";
import { useMyGroupCard } from "../lib/useMyGroupCard";
import PlayerAvatar from "./PlayerAvatar";

export default function UserMenu() {
  const { user, profile, isAppOwner } = useCurrentUser();
  const groupCard = useMyGroupCard();
  // This header sits above GroupProvider, so the URL is the source of its slug.
  const match = useLocation().pathname.match(/^\/g\/([^/]+)/);
  const slug = match?.[1] ?? null;
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
        to={slug ? `/g/${slug}/profile` : "/profile"}
        className="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-card-50/10"
      >
        {profile ? (
          // Inside a group this is the card you actually chose there; outside
          // one there is no group card to show, so `PlayerAvatar` falls back
          // to the card hashed from your account id. Cards are per-group
          // (GROUPS.md decision 10), so this legitimately changes as you move
          // between groups — it is your card AT THIS TABLE, not a global one.
          <PlayerAvatar
            player={{
              id: profile.id,
              name: label,
              chosen_suit: groupCard?.suit ?? null,
              chosen_rank: groupCard?.rank ?? null,
            }}
            size="sm"
          />
        ) : (
          <div className="h-9 w-7 rounded bg-card-50/10" />
        )}
        <span className="hidden text-xs font-medium text-card-50 sm:block">
          {label}
        </span>
      </Link>
    </div>
  );
}
