import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useParams } from "react-router-dom";
import { useCurrentUser } from "../lib/auth";
import {
  GroupContext,
  type Group,
  type GroupMembership,
} from "../lib/groupContext";
import { describeError } from "../lib/errors";
import { requireSupabase } from "../lib/supabase";

type Loaded = {
  group: Group | null;
  membership: GroupMembership | null;
  notFound: boolean;
};

/** The group behind a slug, plus this account's membership of it. */
async function fetchGroup(
  slug: string,
  userId: string | null
): Promise<Loaded> {
  const supabase = requireSupabase();
  const { data: group, error: groupError } = await supabase
    .from("groups")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (groupError) throw groupError;
  if (!group) return { group: null, membership: null, notFound: true };
  if (!userId) return { group, membership: null, notFound: false };

  const { data: membership, error: membershipError } = await supabase
    .from("group_members")
    .select("*")
    .eq("group_id", group.id)
    .eq("profile_id", userId)
    .maybeSingle();
  if (membershipError) throw membershipError;
  return { group, membership, notFound: false };
}

export default function GroupProvider({ children }: { children: ReactNode }) {
  const { slug } = useParams<{ slug: string }>();
  const { user, loading: authLoading } = useCurrentUser();
  // The ACCOUNT id, not the user object. A token refresh — which is what
  // returning to a hidden tab triggers — hands us a new user object with the
  // same id in it, and keying this effect on the object refetched the whole
  // group and blanked the page to "Dealing…" every time the tab regained
  // focus.
  const userId = user?.id ?? null;
  const [state, setState] = useState<
    Loaded & { slug: string | undefined; loading: boolean }
  >({
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
      setState({
        slug,
        group: null,
        membership: null,
        notFound: false,
        loading: true,
      });
      try {
        const loaded = await fetchGroup(slug, userId);
        if (!cancelled) setState({ slug, ...loaded, loading: false });
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
  }, [authLoading, slug, userId]);

  /**
   * Re-read the group after changing it — the settings page rotating the join
   * code, say. The effect above only refires when the slug or the account
   * changes, so without this the context keeps serving the values it first
   * loaded, and a remounted page would show a join code that no longer works.
   *
   * Deliberately does NOT flip `loading`: this is a refresh of something
   * already on screen, and blanking the page mid-save reads as a bug.
   */
  const reload = useCallback(async () => {
    if (!slug) return;
    try {
      const loaded = await fetchGroup(slug, userId);
      // The slug may have changed while this was in flight.
      setState((prev) =>
        prev.slug === slug ? { ...prev, ...loaded, loading: false } : prev
      );
    } catch (error) {
      console.error("Failed to reload group:", describeError(error));
    }
  }, [slug, userId]);

  const value = useMemo(() => {
    const activeMembership =
      slug && state.membership?.status === "active" ? state.membership : null;
    const groupSlug = slug ? state.group?.slug ?? state.slug ?? "" : "";
    return {
      loading:
        Boolean(slug) && (authLoading || state.slug !== slug || state.loading),
      group: slug ? state.group : null,
      membership: slug ? activeMembership : null,
      role: activeMembership?.role ?? null,
      isGroupAdmin: activeMembership?.role === "admin",
      notFound: slug ? state.notFound : false,
      reload,
      path: (sub: string) => {
        const clean = sub.replace(/^\/+|\/+$/g, "");
        // Outside a group route there is no prefix to add; returning
        // "/g//players" would be a broken link.
        if (!groupSlug) return clean ? `/${clean}` : "/";
        return clean ? `/g/${groupSlug}/${clean}` : `/g/${groupSlug}`;
      },
    };
  }, [authLoading, reload, slug, state]);

  return (
    <GroupContext.Provider value={value}>{children}</GroupContext.Provider>
  );
}
