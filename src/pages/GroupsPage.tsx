import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Band from "../components/Band";
import Button from "../components/Button";
import Card from "../components/Card";
import ErrorNote from "../components/ErrorNote";
import FeltButton from "../components/FeltButton";
import Field from "../components/Field";
import LoadingState from "../components/LoadingState";
import PageHeading from "../components/PageHeading";
import Sheet from "../components/Sheet";
import TextInput from "../components/TextInput";
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
    <>
      <PageHeading
        title="Your groups"
        subtitle="Choose a table or start a new one."
        actions={
          <>
            <FeltButton variant="ghost" to="/join">
              Join with a code
            </FeltButton>
            <FeltButton to="/groups/new">Create group</FeltButton>
          </>
        }
      />

      {state?.error && (
        <ErrorNote tone="felt" className="mb-4">
          {state.error}
        </ErrorNote>
      )}

      {loading ? (
        <LoadingState tone="felt" label="Dealing in…" full />
      ) : state.groups.length === 0 ? (
        // The empty state is the onboarding for a brand-new account, so it is
        // a page body — a sheet — rather than one lonely card in a grid of one.
        <Sheet>
          <Band
            kicker="Nothing dealt yet"
            title="No groups yet"
            caption="Create a group to start your own table, or ask a group admin for a join code."
          >
            <form
              className="mt-5 flex max-w-md flex-col gap-3 sm:flex-row sm:items-end"
              onSubmit={(event) => {
                event.preventDefault();
                const code = joinCode.trim();
                navigate(code ? `/join/${encodeURIComponent(code)}` : "/join");
              }}
            >
              <Field label="Join code" className="flex-1">
                <TextInput
                  value={joinCode}
                  onChange={(event) => setJoinCode(event.target.value)}
                  placeholder="Join code"
                  autoComplete="off"
                />
              </Field>
              <Button type="submit" variant="secondary">
                Join group
              </Button>
            </form>
          </Band>
        </Sheet>
      ) : (
        // A grid of tiles is the one page body that is NOT a sheet: `Card` is
        // exactly the primitive for several small standalone tiles side by
        // side, and folding these into bands would lose the deal-in stagger
        // and the hover lift that make a table feel pickable.
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
                  <span className="mt-4 inline-block text-xs font-medium text-ink-500">
                    Open group →
                  </span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
