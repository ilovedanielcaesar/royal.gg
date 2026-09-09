import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Button from "../components/Button";
import Card from "../components/Card";
import { useCurrentUser } from "../lib/auth";
import { describeError } from "../lib/errors";
import { requireSupabase } from "../lib/supabase";

type GroupSummary = {
  name: string;
  slug: string;
  stakes_label: string | null;
};

type ActiveMembership = {
  group_id: string;
  groups: GroupSummary | null;
};

export default function GroupsPage() {
  const navigate = useNavigate();
  const { user } = useCurrentUser();
  // Keyed on the account id: the user object's identity changes on every
  // token refresh, including the catch-up one a refocused tab triggers.
  const userId = user?.id ?? null;
  const [joinCode, setJoinCode] = useState("");
  const [state, setState] = useState<{
    userId: string;
    groups: GroupSummary[];
    error: string | null;
  } | null>(null);

  useEffect(() => {
    if (!userId) return;

    let cancelled = false;
    void (async () => {
      try {
        const supabase = requireSupabase();
        const { data, error } = await supabase
          .from("group_members")
          .select("group_id, groups(name, slug, stakes_label)")
          .eq("profile_id", userId)
          .eq("status", "active");
        if (error) throw error;

        const memberships = (data ?? []) as unknown as ActiveMembership[];
        const groups = memberships
          .flatMap((membership) =>
            membership.groups ? [membership.groups] : []
          )
          .sort((a, b) => a.name.localeCompare(b.name));
        if (!cancelled) {
          setState({ userId, groups, error: null });
        }
      } catch (error) {
        if (!cancelled) {
          setState({
            userId,
            groups: [],
            error: describeError(error),
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  const loading = !user || !state || state.userId !== user.id;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl text-card-50">Your groups</h1>
          <p className="mt-1 text-sm text-card-50/60">
            Choose a table or start a new one.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/join">
            <Button variant="ghost">Join with a code</Button>
          </Link>
          <Link to="/groups/new">
            <Button>Create group</Button>
          </Link>
        </div>
      </div>

      {state?.error && (
        <Card accent="crimson">
          <p className="p-4 text-sm text-crimson-700">{state.error}</p>
        </Card>
      )}

      {loading ? (
        <p className="text-sm text-card-50/60">Dealing in…</p>
      ) : state.groups.length === 0 ? (
        <Card watermarkSuit="club" accent="gold">
          <div className="p-6">
            <h2 className="font-display text-2xl text-ink-900">
              No groups yet
            </h2>
            <p className="mt-2 max-w-xl text-sm text-ink-500">
              Create a group to start your own table, or ask a group admin for
              a join code.
            </p>
            <form
              className="mt-5 flex max-w-md flex-col gap-3 sm:flex-row"
              onSubmit={(event) => {
                event.preventDefault();
                const code = joinCode.trim();
                navigate(code ? `/join/${encodeURIComponent(code)}` : "/join");
              }}
            >
              <label className="flex-1">
                <span className="sr-only">Join code</span>
                <input
                  value={joinCode}
                  onChange={(event) => setJoinCode(event.target.value)}
                  placeholder="Join code"
                  autoComplete="off"
                  className="w-full rounded-md bg-card-50 px-3 py-2 text-sm text-ink-900 ring-1 ring-card-200 focus:outline-none focus:ring-2 focus:ring-gold-500"
                />
              </label>
              <Button type="submit" variant="secondary">
                Join group
              </Button>
            </form>
            <Link
              to="/join"
              className="mt-3 inline-block text-xs text-sage-700 underline"
            >
              Enter a code on the join page
            </Link>
          </div>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {state.groups.map((group, index) => (
            <Link key={group.slug} to={`/g/${group.slug}`}>
              <Card
                className="h-full"
                watermarkSuit="spade"
                accent="sage"
                interactive
                dealIn={index * 60}
              >
                <div className="p-5">
                  <h2 className="font-display text-2xl text-ink-900">
                    {group.name}
                  </h2>
                  {group.stakes_label && (
                    <p className="tabular mt-1 text-sm text-ink-500">
                      {group.stakes_label}
                    </p>
                  )}
                  <span className="mt-4 inline-block text-xs font-medium text-sage-700">
                    Open group →
                  </span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
