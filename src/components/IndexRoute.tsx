import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useCurrentUser } from "../lib/auth";
import { describeError } from "../lib/errors";
import { requireSupabase } from "../lib/supabase";
import LoginPage from "../pages/LoginPage";

type ActiveMembership = {
  group_id: string;
  groups: { slug: string } | null;
};

export default function IndexRoute() {
  const { loading, user, profile } = useCurrentUser();
  const [membershipState, setMembershipState] = useState<{
    userId: string;
    memberships: ActiveMembership[];
  } | null>(null);

  useEffect(() => {
    if (!user) return;

    let cancelled = false;
    void (async () => {
      try {
        const supabase = requireSupabase();
        const { data, error } = await supabase
          .from("group_members")
          .select("group_id, groups(slug)")
          .eq("profile_id", user.id)
          .eq("status", "active");
        if (error) throw error;
        if (!cancelled) {
          setMembershipState({
            userId: user.id,
            memberships: (data ?? []) as unknown as ActiveMembership[],
          });
        }
      } catch (error) {
        if (cancelled) return;
        console.error(
          "Failed to load active group memberships:",
          describeError(error)
        );
        setMembershipState({ userId: user.id, memberships: [] });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user]);

  if (loading) {
    return <div className="text-sm text-card-50/60">Dealing in…</div>;
  }
  if (!user || !profile) return <LoginPage />;
  if (!membershipState || membershipState.userId !== user.id) {
    return <div className="text-sm text-card-50/60">Dealing in…</div>;
  }

  const { memberships } = membershipState;
  const slug = memberships.length === 1 ? memberships[0].groups?.slug : null;
  if (slug) return <Navigate to={`/g/${slug}`} replace />;
  // No group, or several. Either way /groups is the right landing: its empty
  // state is the onboarding for a brand-new account.
  return <Navigate to="/groups" replace />;
}
