import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import Band from "../components/Band";
import PageHeading from "../components/PageHeading";
import Sheet from "../components/Sheet";
import AccountBand from "../features/profile/AccountBand";
import { useCurrentUser } from "../lib/auth";
import { describeError } from "../lib/errors";
import { requireSupabase } from "../lib/supabase";

type GroupSummary = { name: string; slug: string };
type ActiveMembership = {
  group_id: string;
  groups: GroupSummary | null;
};

type State = {
  userId: string;
  groups: GroupSummary[];
  error: string | null;
};

export default function ProfilePage() {
  const { user, profile } = useCurrentUser();
  const userId = user?.id ?? null;
  const [state, setState] = useState<State | null>(null);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    void (async () => {
      try {
        const { data, error } = await requireSupabase()
          .from("group_members")
          .select("group_id, groups(name, slug)")
          .eq("profile_id", userId)
          .eq("status", "active");
        if (error) throw error;
        const memberships = (data ?? []) as unknown as ActiveMembership[];
        const groups = memberships
          .flatMap((membership) =>
            membership.groups ? [membership.groups] : []
          )
          .sort((a, b) => a.name.localeCompare(b.name));
        if (!cancelled) setState({ userId, groups, error: null });
      } catch (caught) {
        if (!cancelled) {
          setState({ userId, groups: [], error: describeError(caught) });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (!user || !state || state.userId !== user.id) {
    return <p className="text-sm text-card-50/60">Dealing…</p>;
  }

  if (state.groups[0]) {
    // Outside a slug there is no current group. Match GroupsPage's stable,
    // name-sorted order and choose the first active membership deterministically.
    return <Navigate to={`/g/${state.groups[0].slug}/profile`} replace />;
  }

  return (
    <>
      <PageHeading
        title={profile?.display_name ?? "Your account"}
        subtitle="Account profile"
      />
      <Sheet>
        {state.error && (
          <Band className="bg-crimson-500/[0.06]">
            <p className="text-sm text-crimson-700">{state.error}</p>
          </Band>
        )}
        <AccountBand email={user.email ?? null} />
      </Sheet>
    </>
  );
}
