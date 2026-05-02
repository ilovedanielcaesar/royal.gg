import { useEffect, useState } from "react";
import Button from "../components/Button";
import Card from "../components/Card";
import { describeError } from "../lib/errors";
import { requireSupabase } from "../lib/supabase";
import type { Player } from "../lib/auth";

export default function AdminApprovalsPage() {
  const [pending, setPending] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const supabase = requireSupabase();
      const { data, error } = await supabase
        .from("players")
        .select("*")
        .eq("status", "pending")
        .order("created_at", { ascending: true });
      if (error) throw error;
      setPending(data ?? []);
    } catch (e) {
      setError(describeError(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function setStatus(id: string, status: "active" | "rejected") {
    setBusyId(id);
    setError(null);
    try {
      const supabase = requireSupabase();
      const { error } = await supabase
        .from("players")
        .update({ status })
        .eq("id", id);
      if (error) throw error;
      setPending((p) => p.filter((x) => x.id !== id));
    } catch (e) {
      setError(describeError(e));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl text-card-50">Approvals</h1>
        <p className="mt-1 text-sm text-card-50/70">
          New signups waiting to join the table.
        </p>
      </header>

      {error && (
        <div className="rounded-md bg-crimson-500/10 px-3 py-2 text-xs text-crimson-300">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-sm text-card-50/60">Dealing in…</div>
      ) : pending.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-sm text-ink-500">No pending requests.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {pending.map((p) => (
            <Card key={p.id} className="flex items-center gap-4 p-4">
              <div className="flex-1">
                <div className="font-display text-lg text-ink-900">
                  {p.display_name ?? p.name}
                </div>
                <div className="text-xs text-ink-500">@{p.username}</div>
              </div>
              <Button
                variant="secondary"
                size="sm"
                disabled={busyId === p.id}
                onClick={() => void setStatus(p.id, "rejected")}
              >
                Reject
              </Button>
              <Button
                size="sm"
                disabled={busyId === p.id}
                onClick={() => void setStatus(p.id, "active")}
              >
                {busyId === p.id ? "Working…" : "Approve"}
              </Button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
