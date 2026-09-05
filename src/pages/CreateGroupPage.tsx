import { useMemo, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import Button from "../components/Button";
import Card from "../components/Card";
import { useCurrentUser } from "../lib/auth";
import { describeError } from "../lib/errors";
import { requireSupabase } from "../lib/supabase";

function slugify(name: string): string {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function parseCents(value: string): number | null {
  const match = value.trim().match(/^(\d+)(?:\.(\d{1,2}))?$/);
  if (!match) return null;
  return Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
}

export default function CreateGroupPage() {
  const { user } = useCurrentUser();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [buyIn, setBuyIn] = useState("40.00");
  const [threshold, setThreshold] = useState("5.00");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const slug = useMemo(() => slugify(name), [name]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const defaultBuyInCents = parseCents(buyIn);
    const reconcileThresholdCents = parseCents(threshold);
    if (!user || !name.trim() || !slug || defaultBuyInCents == null || defaultBuyInCents <= 0 || reconcileThresholdCents == null) {
      setError("Enter a name, a positive buy-in, and a valid reconcile threshold.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const sb = requireSupabase();
      const { data: existing, error: lookupError } = await sb.from("groups").select("id").eq("slug", slug).maybeSingle();
      if (lookupError) throw lookupError;
      if (existing) throw new Error("That group URL is already taken.");
      const { data: group, error: groupError } = await sb
        .from("groups")
        .insert({
          name: name.trim(), slug, join_code: crypto.randomUUID(),
          default_buy_in_cents: defaultBuyInCents,
          reconcile_threshold_cents: reconcileThresholdCents,
          created_by: user.id,
        })
        .select()
        .single();
      if (groupError) throw groupError;
      const { error: membershipError } = await sb.from("group_members").insert({
        group_id: group.id, profile_id: user.id, role: "admin", status: "active",
      });
      if (membershipError) throw membershipError;
      navigate(`/g/${group.slug}`, { replace: true });
    } catch (e) {
      setError(describeError(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <header><h1 className="font-display text-4xl text-card-50">Create a group</h1><p className="mt-1 text-sm text-card-50/70">Set the table’s starting stakes.</p></header>
      <Card className="p-5">
        <form className="space-y-4" onSubmit={submit}>
          <label className="block"><span className="text-xs font-medium text-ink-700">Group name</span><input value={name} onChange={(event) => setName(event.target.value)} required className="mt-1 w-full rounded-md border border-card-200 bg-card-50 px-3 py-2 text-sm" placeholder="Friday night poker" /><span className="mt-1 block text-xs text-ink-500">/g/{slug || "your-group"}</span></label>
          <label className="block"><span className="text-xs font-medium text-ink-700">Default buy-in ($)</span><input inputMode="decimal" value={buyIn} onChange={(event) => setBuyIn(event.target.value)} required className="mt-1 w-full rounded-md border border-card-200 bg-card-50 px-3 py-2 text-sm" /></label>
          <label className="block"><span className="text-xs font-medium text-ink-700">Reconcile threshold ($)</span><input inputMode="decimal" value={threshold} onChange={(event) => setThreshold(event.target.value)} required className="mt-1 w-full rounded-md border border-card-200 bg-card-50 px-3 py-2 text-sm" /></label>
          {error && <div className="rounded-md bg-crimson-500/10 px-3 py-2 text-xs text-crimson-700">{error}</div>}
          <Button type="submit" disabled={saving}>{saving ? "Creating…" : "Create group"}</Button>
        </form>
      </Card>
    </div>
  );
}
