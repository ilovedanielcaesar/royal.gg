import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import Button from "../components/Button";
import Card from "../components/Card";
import { useCurrentUser } from "../lib/auth";
import { describeError } from "../lib/errors";
import type { Group } from "../lib/groupContext";
import { requireSupabase } from "../lib/supabase";
import type { Database } from "../types/database";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

export default function ProfilePage() {
  const { user } = useCurrentUser();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    void (async () => {
      try {
        const sb = requireSupabase();
        const { data: profileRow, error: profileError } = await sb
          .from("profiles").select("*").eq("id", user.id).single();
        if (profileError) throw profileError;
        const { data: memberships, error: membershipError } = await sb
          .from("group_members").select("group_id").eq("profile_id", user.id).eq("status", "active");
        if (membershipError) throw membershipError;
        const ids = (memberships ?? []).map((membership) => membership.group_id);
        let groupRows: Group[] = [];
        if (ids.length > 0) {
          const { data, error: groupsError } = await sb.from("groups").select("*").in("id", ids).order("name");
          if (groupsError) throw groupsError;
          groupRows = data ?? [];
        }
        if (!cancelled) {
          setProfile(profileRow); setDisplayName(profileRow.display_name);
          setUsername(profileRow.username); setGroups(groupRows);
        }
      } catch (e) {
        if (!cancelled) setError(describeError(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!user) return;
    setSaving(true); setError(null);
    try {
      const { error: updateError } = await requireSupabase().from("profiles")
        .update({ display_name: displayName.trim(), username: username.trim() }).eq("id", user.id);
      if (updateError) throw updateError;
      setProfile((current) => current ? { ...current, display_name: displayName.trim(), username: username.trim() } : current);
    } catch (e) { setError(describeError(e)); } finally { setSaving(false); }
  }

  if (loading) return <p className="text-sm text-card-50/60">Dealing in…</p>;
  if (!profile) return <Card accent="crimson"><p className="p-4 text-sm text-crimson-700">{error ?? "Profile not found."}</p></Card>;
  return <div className="space-y-6">
    <header><h1 className="font-display text-4xl text-card-50">Your account</h1><p className="mt-1 text-sm text-card-50/70">Your name and username are shared across your groups.</p></header>
    <Card className="p-5"><h2 className="font-display text-xl text-ink-900">Profile</h2><form className="mt-3 space-y-3" onSubmit={save}>
      <label className="block"><span className="text-xs font-medium text-ink-700">Display name</span><input value={displayName} onChange={(event) => setDisplayName(event.target.value)} required className="mt-1 w-full rounded-md border border-card-200 bg-card-50 px-3 py-2 text-sm" /></label>
      <label className="block"><span className="text-xs font-medium text-ink-700">Username</span><input value={username} onChange={(event) => setUsername(event.target.value)} required className="mt-1 w-full rounded-md border border-card-200 bg-card-50 px-3 py-2 text-sm" /></label>
      {error && <div className="rounded-md bg-crimson-500/10 px-3 py-2 text-xs text-crimson-700">{error}</div>}
      <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
    </form></Card>
    <section><h2 className="font-display text-2xl text-card-50">Your groups</h2><div className="mt-3 grid gap-4 sm:grid-cols-2">
      {groups.map((group) => <Link key={group.id} to={`/g/${group.slug}`}><Card interactive className="p-4"><div className="font-display text-xl text-ink-900">{group.name}</div><div className="mt-1 text-xs text-ink-500">Open table →</div></Card></Link>)}
      {groups.length === 0 && <Card className="p-4"><Link to="/groups" className="text-sm text-sage-700 underline">Find or create a group</Link></Card>}
    </div></section>
  </div>;
}
