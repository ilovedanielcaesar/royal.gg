import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useCurrentUser } from "../lib/auth";
import type { Group } from "../lib/groupContext";
import { requireSupabase } from "../lib/supabase";

export default function GroupSwitcher({ slug }: { slug: string }) {
  const { user } = useCurrentUser();
  const [groups, setGroups] = useState<Group[]>([]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    void (async () => {
      const sb = requireSupabase();
      const { data: memberships } = await sb.from("group_members").select("group_id")
        .eq("profile_id", user.id).eq("status", "active");
      const ids = (memberships ?? []).map((membership) => membership.group_id);
      if (ids.length === 0) return;
      const { data } = await sb.from("groups").select("*").in("id", ids).order("name");
      if (!cancelled) setGroups(data ?? []);
    })();
    return () => { cancelled = true; };
  }, [user]);

  const current = groups.find((group) => group.slug === slug);
  return <details className="relative">
    <summary className="cursor-pointer list-none rounded-md px-2 py-1 text-xs font-medium text-card-50 hover:bg-card-50/10">
      {current?.name ?? "Group"} <span className="text-card-50/60">▾</span>
    </summary>
    <div className="absolute right-0 z-20 mt-2 w-48 rounded-md bg-card-50 p-1 shadow-lg ring-1 ring-card-200">
      {groups.filter((group) => group.slug !== slug).map((group) => <Link key={group.id} to={`/g/${group.slug}`} className="block rounded px-3 py-2 text-sm text-ink-900 hover:bg-card-100">{group.name}</Link>)}
      <Link to="/groups" className="block rounded px-3 py-2 text-sm text-sage-700 hover:bg-card-100">All groups</Link>
    </div>
  </details>;
}
