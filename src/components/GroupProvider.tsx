import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useParams } from "react-router-dom";
import { useCurrentUser } from "../lib/auth";
import {
  GroupContext,
  type Group,
  type GroupMembership,
} from "../lib/groupContext";
import { describeError } from "../lib/errors";
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
  }>({
    slug,
    group: null,
    membership: null,
    notFound: false,
    loading: Boolean(slug),
  });

  useEffect(() => {
    if (!slug) return;
    if (authLoading) return;

    let cancelled = false;
    void (async () => {
      setState({ slug, group: null, membership: null, notFound: false, loading: true });
      try {
        const supabase = requireSupabase();
        const { data: group, error: groupError } = await supabase
          .from("groups")
          .select("*")
          .eq("slug", slug)
          .maybeSingle();
        if (groupError) throw groupError;
        if (!group) {
          setState({
            slug,
            group: null,
            membership: null,
            notFound: true,
            loading: false,
          });
          return;
        }
        if (!user) {
          setState({
            slug,
            group,
            membership: null,
            notFound: false,
            loading: false,
          });
          return;
        }

        const { data: membership, error: membershipError } = await supabase
          .from("group_members")
          .select("*")
          .eq("group_id", group.id)
          .eq("profile_id", user.id)
          .maybeSingle();
        if (membershipError) throw membershipError;
        if (!cancelled) {
          setState({
            slug,
            group,
            membership,
            notFound: false,
            loading: false,
          });
        }
      } catch (error) {
        if (cancelled) return;
        console.error("Failed to load group:", describeError(error));
        setState({
          slug,
          group: null,
          membership: null,
          notFound: true,
          loading: false,
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authLoading, slug, user]);

  const value = useMemo(() => {
    const activeMembership =
      slug && state.membership?.status === "active" ? state.membership : null;
    const groupSlug = slug ? state.group?.slug ?? state.slug ?? "" : "";
    return {
      loading: Boolean(slug) && (authLoading || state.slug !== slug || state.loading),
      group: slug ? state.group : null,
      membership: slug ? activeMembership : null,
      role: activeMembership?.role ?? null,
      isGroupAdmin: activeMembership?.role === "admin",
      notFound: slug ? state.notFound : false,
      path: (sub: string) => {
        const clean = sub.replace(/^\/+|\/+$/g, "");
        return clean ? `/g/${groupSlug}/${clean}` : `/g/${groupSlug}`;
      },
    };
  }, [authLoading, slug, state]);

  return (
    <GroupContext.Provider value={value}>{children}</GroupContext.Provider>
  );
}
