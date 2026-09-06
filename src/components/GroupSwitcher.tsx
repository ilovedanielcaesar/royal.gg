import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useCurrentUser } from "../lib/auth";
import { describeError } from "../lib/errors";
import { requireSupabase } from "../lib/supabase";

type GroupSummary = {
  slug: string;
  name: string;
};

type ActiveMembership = {
  group_id: string;
  groups: GroupSummary | null;
};

export default function GroupSwitcher() {
  const { user } = useCurrentUser();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [membershipState, setMembershipState] = useState<{
    userId: string;
    groups: GroupSummary[];
  } | null>(null);

  useEffect(() => {
    if (!user) return;

    let cancelled = false;
    void (async () => {
      try {
        const supabase = requireSupabase();
        const { data, error } = await supabase
          .from("group_members")
          .select("group_id, groups(slug, name)")
          .eq("profile_id", user.id)
          .eq("status", "active");
        if (error) throw error;

        const memberships = (data ?? []) as unknown as ActiveMembership[];
        const groups = memberships
          .flatMap((membership) =>
            membership.groups ? [membership.groups] : []
          )
          .sort((a, b) => a.name.localeCompare(b.name));
        if (!cancelled) setMembershipState({ userId: user.id, groups });
      } catch (error) {
        if (cancelled) return;
        console.error("Failed to load group switcher:", describeError(error));
        setMembershipState({ userId: user.id, groups: [] });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user]);

  if (!user) return null;

  const groups =
    membershipState?.userId === user.id ? membershipState.groups : [];
  const currentSlug = pathname.match(/^\/g\/([^/]+)/)?.[1] ?? null;
  const currentGroup = groups.find((group) => group.slug === currentSlug);
  const label = currentGroup?.name ?? "Groups";

  if (groups.length <= 1) {
    return (
      <Link
        to="/groups"
        className="rounded-md px-2 py-1 text-xs font-medium text-card-50/70 hover:bg-card-50/10 hover:text-card-50"
      >
        {label}
      </Link>
    );
  }

  const otherGroups = groups.filter((group) => group.slug !== currentSlug);

  return (
    <div className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((value) => !value)}
        className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-card-50/70 hover:bg-card-50/10 hover:text-card-50"
      >
        {label}
        <span aria-hidden="true">▾</span>
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-2 min-w-44 rounded-md bg-card-50 p-1 shadow-lg ring-1 ring-card-200"
        >
          {otherGroups.map((group) => (
            <Link
              key={group.slug}
              to={`/g/${group.slug}`}
              role="menuitem"
              onClick={() => setOpen(false)}
              className="block rounded px-3 py-2 text-sm text-ink-700 hover:bg-card-100 hover:text-ink-900"
            >
              {group.name}
            </Link>
          ))}
          <Link
            to="/groups"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="mt-1 block border-t border-card-200 px-3 py-2 text-sm text-ink-700 hover:bg-card-100 hover:text-ink-900"
          >
            All groups
          </Link>
        </div>
      )}
    </div>
  );
}
