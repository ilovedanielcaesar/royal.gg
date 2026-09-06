import { useEffect, useState, type FormEvent } from "react";
import Button from "./Button";
import Card from "./Card";
import InviteLinkRow from "./InviteLinkRow";
import { useCurrentUser } from "../lib/auth";
import { describeError } from "../lib/errors";
import { generateInviteToken } from "../lib/joinCode";
import { requireSupabase } from "../lib/supabase";
import type { Database } from "../types/database";

type GroupInvite = Database["public"]["Tables"]["group_invites"]["Row"];
type ExpiryChoice = "1" | "7" | "never";

async function fetchInvites(groupId: string): Promise<GroupInvite[]> {
  const { data, error } = await requireSupabase()
    .from("group_invites")
    .select("*")
    .eq("group_id", groupId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export default function InviteLinksCard({ groupId }: { groupId: string }) {
  const { user } = useCurrentUser();
  const [invites, setInvites] = useState<GroupInvite[] | null>(null);
  const [expiry, setExpiry] = useState<ExpiryChoice>("7");
  const [maxUses, setMaxUses] = useState("");
  const [minting, setMinting] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchInvites(groupId)
      .then((rows) => {
        if (!cancelled) setInvites(rows);
      })
      .catch((caught) => {
        if (!cancelled) {
          setInvites([]);
          setError(describeError(caught));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [groupId]);

  async function mintInvite(event: FormEvent) {
    event.preventDefault();
    if (!user || minting) return;
    setMinting(true);
    setError(null);
    try {
      const parsedMaxUses = maxUses.trim() === "" ? null : Number(maxUses);
      if (
        parsedMaxUses !== null &&
        (!Number.isSafeInteger(parsedMaxUses) || parsedMaxUses <= 0)
      ) {
        throw new Error("Max uses must be a positive whole number.");
      }
      const expiresAt =
        expiry === "never"
          ? null
          : new Date(Date.now() + Number(expiry) * 86_400_000).toISOString();
      const { data, error: insertError } = await requireSupabase()
        .from("group_invites")
        .insert({
          group_id: groupId,
          token: generateInviteToken(),
          expires_at: expiresAt,
          max_uses: parsedMaxUses,
          created_by: user.id,
        })
        .select("*")
        .single();
      if (insertError) throw insertError;
      setInvites((current) => [data, ...(current ?? [])]);
      setMaxUses("");
    } catch (caught) {
      setError(describeError(caught));
    } finally {
      setMinting(false);
    }
  }

  async function revokeInvite(invite: GroupInvite) {
    if (revokingId || !confirm("Revoke this invite link?")) return;
    setRevokingId(invite.id);
    setError(null);
    try {
      const { error: deleteError } = await requireSupabase()
        .from("group_invites")
        .delete()
        .eq("id", invite.id)
        .eq("group_id", groupId);
      if (deleteError) throw deleteError;
      setInvites((current) =>
        current?.filter((row) => row.id !== invite.id) ?? []
      );
    } catch (caught) {
      setError(describeError(caught));
    } finally {
      setRevokingId(null);
    }
  }

  return (
    <Card accent="gold">
      <div className="p-5">
        <h2 className="font-display text-2xl text-ink-900">Invite links</h2>
        <form
          className="mt-4 flex flex-wrap items-end gap-3"
          onSubmit={mintInvite}
        >
          <label>
            <span className="block text-xs font-medium text-ink-700">Expiry</span>
            <select
              value={expiry}
              onChange={(event) => setExpiry(event.target.value as ExpiryChoice)}
              className={[
                "mt-1 rounded-md bg-card-50 px-3 py-2 text-sm text-ink-900",
                "ring-1 ring-card-200 focus:outline-none focus:ring-2 focus:ring-gold-500",
              ].join(" ")}
            >
              <option value="1">1 day</option>
              <option value="7">7 days</option>
              <option value="never">never</option>
            </select>
          </label>
          <label>
            <span className="block text-xs font-medium text-ink-700">
              Max uses <span className="font-normal text-ink-500">(optional)</span>
            </span>
            <input
              type="number"
              min="1"
              step="1"
              value={maxUses}
              onChange={(event) => setMaxUses(event.target.value)}
              className={[
                "mt-1 w-28 rounded-md bg-card-50 px-3 py-2 text-sm text-ink-900",
                "ring-1 ring-card-200 focus:outline-none focus:ring-2 focus:ring-gold-500",
              ].join(" ")}
            />
          </label>
          <Button type="submit" variant="secondary" disabled={minting}>
            {minting ? "Creating…" : "Create link"}
          </Button>
        </form>
        {error && (
          <p className="mt-3 rounded-md bg-crimson-500/10 px-3 py-2 text-xs text-crimson-700">
            {error}
          </p>
        )}
      </div>
      <div className="border-t border-card-200">
        {invites === null ? (
          <p className="p-5 text-sm text-ink-500">Dealing…</p>
        ) : invites.length === 0 ? (
          <p className="p-5 text-sm text-ink-500">No invite links yet.</p>
        ) : (
          <div className="divide-y divide-card-200">
            {invites.map((invite) => (
              <InviteLinkRow
                key={invite.id}
                invite={invite}
                busy={revokingId === invite.id}
                locked={revokingId !== null}
                onRevoke={() => void revokeInvite(invite)}
              />
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}
