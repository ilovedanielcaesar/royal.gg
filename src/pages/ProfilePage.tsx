import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
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

export default function ProfilePage() {
  const { user } = useCurrentUser();
  const [loadedUserId, setLoadedUserId] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    if (!user) return;

    let cancelled = false;
    void (async () => {
      try {
        const supabase = requireSupabase();
        const [profileResult, groupsResult] = await Promise.all([
          supabase
            .from("profiles")
            .select("display_name, username")
            .eq("id", user.id)
            .single(),
          supabase
            .from("group_members")
            .select("group_id, groups(name, slug, stakes_label)")
            .eq("profile_id", user.id)
            .eq("status", "active"),
        ]);
        if (profileResult.error) throw profileResult.error;
        if (groupsResult.error) throw groupsResult.error;

        const memberships = (groupsResult.data ?? []) as unknown as ActiveMembership[];
        const activeGroups = memberships
          .flatMap((membership) =>
            membership.groups ? [membership.groups] : []
          )
          .sort((a, b) => a.name.localeCompare(b.name));
        if (!cancelled) {
          setDisplayName(profileResult.data.display_name);
          setUsername(profileResult.data.username);
          setGroups(activeGroups);
          setLoadError(null);
          setLoadedUserId(user.id);
        }
      } catch (error) {
        if (!cancelled) {
          setGroups([]);
          setLoadError(describeError(error));
          setLoadedUserId(user.id);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user]);

  if (!user || loadedUserId !== user.id) {
    return <div className="text-sm text-card-50/60">Dealing in…</div>;
  }

  async function onSave(event: React.FormEvent) {
    event.preventDefault();
    if (!user) return;
    setSaving(true);
    setSaveError(null);
    try {
      const supabase = requireSupabase();
      const { error } = await supabase
        .from("profiles")
        .update({
          display_name: displayName.trim(),
          username: username.trim(),
        })
        .eq("id", user.id);
      if (error) throw error;
      setSavedAt(Date.now());
    } catch (error) {
      setSaveError(describeError(error));
    } finally {
      setSaving(false);
    }
  }

  const error = saveError ?? loadError;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl text-card-50">
          {displayName || "Your profile"}
        </h1>
        <p className="text-sm text-card-50/70">@{username || "—"}</p>
      </header>

      <Card className="p-5" accent="sage">
        <h2 className="font-display text-xl text-ink-900">Profile</h2>
        <form className="mt-3 space-y-3" onSubmit={onSave}>
          <label className="block">
            <span className="text-xs font-medium text-ink-700">
              Display name
            </span>
            <input
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              className="mt-1 w-full rounded-md border border-card-200 bg-card-50 px-3 py-2 text-sm focus:border-sage-600 focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-ink-700">Username</span>
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              className="mt-1 w-full rounded-md border border-card-200 bg-card-50 px-3 py-2 text-sm focus:border-sage-600 focus:outline-none"
            />
          </label>
          {error && (
            <div className="rounded-md bg-crimson-500/10 px-3 py-2 text-xs text-crimson-700">
              {error}
            </div>
          )}
          {savedAt && !error && (
            <div className="text-xs text-sage-700">Saved.</div>
          )}
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </form>
      </Card>

      <Card className="p-5">
        <h2 className="font-display text-xl text-ink-900">Your groups</h2>
        {groups.length === 0 ? (
          <p className="mt-2 text-sm text-ink-500">
            You are not an active member of any groups yet.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-card-100">
            {groups.map((group) => (
              <li key={group.slug}>
                <Link
                  to={`/g/${group.slug}`}
                  className="flex items-center justify-between gap-4 py-3 text-sm text-ink-700 hover:text-ink-900"
                >
                  <span className="font-medium">{group.name}</span>
                  <span className="text-xs text-sage-700">
                    Open group →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
