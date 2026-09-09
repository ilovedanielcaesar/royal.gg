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

/**
 * The contract's `.group-switch`: a cream-tinted capsule with an inset
 * hairline, not a rectangular text button. Both branches below render it —
 * whether the group name is a link (one group) or a menu trigger (several),
 * it looks identical, because to the eye it is the same control.
 */
const PILL = [
  "inline-flex min-h-[34px] items-center gap-[7px] rounded-full px-3",
  "bg-card-50/[0.07] text-[12px] font-medium text-card-50",
  "shadow-[inset_0_0_0_1px_rgba(247,241,222,0.12)]",
  "transition-[background] duration-150 hover:bg-card-50/[0.12]",
].join(" ");

export default function GroupSwitcher() {
  const { user } = useCurrentUser();
  // Keyed on the account id: the user object's identity changes on every
  // token refresh, including the catch-up one a refocused tab triggers.
  const userId = user?.id ?? null;
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [membershipState, setMembershipState] = useState<{
    userId: string;
    groups: GroupSummary[];
  } | null>(null);

  useEffect(() => {
    if (!userId) return;

    let cancelled = false;
    void (async () => {
      try {
        const supabase = requireSupabase();
        const { data, error } = await supabase
          .from("group_members")
          .select("group_id, groups(slug, name)")
          .eq("profile_id", userId)
          .eq("status", "active");
        if (error) throw error;

        const memberships = (data ?? []) as unknown as ActiveMembership[];
        const groups = memberships
          .flatMap((membership) =>
            membership.groups ? [membership.groups] : []
          )
          .sort((a, b) => a.name.localeCompare(b.name));
        if (!cancelled) setMembershipState({ userId, groups });
      } catch (error) {
        if (cancelled) return;
        console.error("Failed to load group switcher:", describeError(error));
        setMembershipState({ userId, groups: [] });
      }
    })();

    return () => {
      cancelled = true;
    };
    // Deliberately re-reads on navigation. This component is rendered by
    // AppLayout, so it never unmounts — with [userId] alone it kept showing a
    // group after the user left it, and would equally miss one they had just
    // joined. The query is one small row set, and this makes the header
    // self-heal on any membership change made anywhere in the app.
  }, [pathname, userId]);

  if (!user) return null;

  const groups =
    membershipState?.userId === user.id ? membershipState.groups : [];
  const currentSlug = pathname.match(/^\/g\/([^/]+)/)?.[1] ?? null;
  const currentGroup = groups.find((group) => group.slug === currentSlug);
  const label = currentGroup?.name ?? "Groups";

  if (groups.length <= 1) {
    return (
      <Link to="/groups" className={PILL}>
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
        className={PILL}
      >
        {label}
        <span aria-hidden="true">▾</span>
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-2 min-w-44 rounded-xl bg-card-50 p-1 shadow-[0_2px_0_rgba(0,0,0,0.14),0_18px_40px_-20px_rgba(0,0,0,0.6),0_0_0_1px_var(--color-card-100)]"
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
