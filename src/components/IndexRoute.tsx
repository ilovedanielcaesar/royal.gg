import { Navigate } from "react-router-dom";
import { useCurrentUser } from "../lib/auth";
import LoginPage from "../pages/LoginPage";
import { requireSupabase } from "../lib/supabase";
import { useEffect, useState } from "react";

export default function IndexRoute() {
  const { loading, user, player, isAdmin, isPending } = useCurrentUser();
  const [slug, setSlug] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    if (!user || loading || (!isAdmin && (!player || isPending))) return;
    let cancelled = false;
    void (async () => {
      const sb = requireSupabase();
      const { data: memberships } = await sb.from("group_members").select("group_id")
        .eq("profile_id", user.id).eq("status", "active");
      const ids = (memberships ?? []).map((membership) => membership.group_id);
      if (ids.length !== 1) {
        if (!cancelled) setSlug(null);
        return;
      }
      const { data: group } = await sb.from("groups").select("slug").eq("id", ids[0]).maybeSingle();
      if (!cancelled) setSlug(group?.slug ?? null);
    })();
    return () => { cancelled = true; };
  }, [isAdmin, isPending, loading, player, user]);

  if (loading) {
    return <div className="text-sm text-card-50/60">Dealing in…</div>;
  }
  if (!user) return <LoginPage />;
  if (!isAdmin && !player) return <LoginPage />;
  if (!isAdmin && isPending) return <Navigate to="/pending" replace />;
  if (slug === undefined) return <div className="text-sm text-card-50/60">Dealing in…</div>;
  return <Navigate to={slug ? `/g/${slug}` : "/groups"} replace />;
}
