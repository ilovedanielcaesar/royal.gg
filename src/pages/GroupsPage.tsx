import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Button from "../components/Button";
import Card from "../components/Card";
import { useCurrentUser } from "../lib/auth";
import { describeError } from "../lib/errors";
import type { Group } from "../lib/groupContext";
import { requireSupabase } from "../lib/supabase";

export default function GroupsPage() {
  const { user } = useCurrentUser();
  const [groups, setGroups] = useState<Group[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    void (async () => {
      try {
        const sb = requireSupabase();
        const { data: memberships, error: membershipError } = await sb
          .from("group_members")
          .select("group_id")
          .eq("profile_id", user.id)
          .eq("status", "active");
        if (membershipError) throw membershipError;
        const ids = (memberships ?? []).map((membership) => membership.group_id);
        if (ids.length === 0) {
          if (!cancelled) setGroups([]);
          return;
        }
        const { data, error: groupsError } = await sb
          .from("groups")
          .select("*")
          .in("id", ids)
          .order("name");
        if (groupsError) throw groupsError;
        if (!cancelled) setGroups(data ?? []);
      } catch (e) {
        if (!cancelled) setError(describeError(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl text-card-50">Your groups</h1>
          <p className="mt-1 text-sm text-card-50/70">Choose a table to open.</p>
        </div>
        <Link to="/groups/new"><Button>Create group</Button></Link>
      </div>
      {error && <Card accent="crimson"><p className="p-4 text-sm text-crimson-700">{error}</p></Card>}
      {groups === null ? <p className="text-sm text-card-50/60">Dealing in…</p> : groups.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-sm text-ink-700">You have not joined a group yet.</p>
          <p className="mt-1 text-sm text-ink-500">Create one, or join a table with a code.</p>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map((group, index) => (
            <Link key={group.id} to={`/g/${group.slug}`}>
              <Card interactive dealIn={index * 60} watermarkSuit="spade" rankLabel="A">
                <div className="p-5">
                  <h2 className="font-display text-2xl text-ink-900">{group.name}</h2>
                  <p className="mt-1 text-xs text-ink-500">Open table →</p>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
