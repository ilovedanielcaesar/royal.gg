import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useParams } from "react-router-dom";
import { useCurrentUser } from "../lib/auth";
import {
  GroupContext,
  type Group,
  type GroupMembership,
} from "../lib/groupContext";
import { requireSupabase } from "../lib/supabase";

export default function GroupProvider({ children }: { children: ReactNode }) {
  const { slug } = useParams<{ slug: string }>();
  const { user, loading: authLoading } = useCurrentUser();
  const [state, setState] = useState<{
    slug: string | undefined;
    group: Group | null;
    membership: GroupMembership | null;
    notFound: boolean;
    loading: boolean;
  }>({ slug, group: null, membership: null, notFound: false, loading: true });

  useEffect(() => {
    if (authLoading) return;
    let cancelled = false;

    void (async () => {
      if (!slug) {
        setState({ slug, group: null, membership: null, notFound: true, loading: false });
        return;
      }
      setState({ slug, group: null, membership: null, notFound: false, loading: true });
      const supabase = requireSupabase();
      const { data: group, error: groupError } = await supabase
        .from("groups")
        .select("*")
        .eq("slug", slug)
        .maybeSingle();
      if (cancelled) return;
      if (groupError || !group) {
        setState({ slug, group: null, membership: null, notFound: true, loading: false });
        return;
      }
      if (!user) {
        setState({ slug, group, membership: null, notFound: false, loading: false });
        return;
      }
      const { data: membership } = await supabase
        .from("group_members")
        .select("*")
        .eq("group_id", group.id)
        .eq("profile_id", user.id)
        .maybeSingle();
      if (!cancelled) {
        setState({ slug, group, membership, notFound: false, loading: false });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authLoading, slug, user]);

  const value = useMemo(() => {
    const activeMembership = state.membership?.status === "active" ? state.membership : null;
    const groupSlug = state.group?.slug ?? state.slug ?? "";
    return {
      loading: authLoading || state.slug !== slug || state.loading,
      group: state.group,
      membership: activeMembership,
      role: activeMembership?.role ?? null,
      isGroupAdmin: activeMembership?.role === "admin",
      notFound: state.notFound,
      path: (sub: string) => {
        const clean = sub.replace(/^\/+|\/+$/g, "");
        return clean ? `/g/${groupSlug}/${clean}` : `/g/${groupSlug}`;
      },
    };
  }, [authLoading, slug, state]);

  return <GroupContext.Provider value={value}>{children}</GroupContext.Provider>;
}
