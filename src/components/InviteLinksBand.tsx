import { useEffect, useState, type FormEvent } from "react";
import Band from "./Band";
import Button from "./Button";
import ErrorNote from "./ErrorNote";
import Field from "./Field";
import InviteLinkRow from "./InviteLinkRow";
import LoadingState from "./LoadingState";
import TextInput from "./TextInput";
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

export default function InviteLinksBand({ groupId }: { groupId: string }) {
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
    // No confirm() — InviteLinkRow arms its own ConfirmButton in place.
    if (revokingId) return;
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
    <Band
      kicker="One-off links"
      title="Invite links"
      caption="A link is separate from the standing join code, and revoking one leaves the code working."
    >
      <form
        className="mt-4 flex flex-wrap items-end gap-3"
        onSubmit={mintInvite}
      >
        <Field label="Expiry">
          <select
            value={expiry}
            onChange={(event) => setExpiry(event.target.value as ExpiryChoice)}
            className="rounded-md bg-card-50 px-3 py-2 text-sm text-ink-900 ring-1 ring-card-200"
          >
            <option value="1">1 day</option>
            <option value="7">7 days</option>
            <option value="never">never</option>
          </select>
        </Field>
        {/* The width goes on the wrapper, not the input. `TextInput` is
            full-width by design — ten of its eleven call sites want that — so
            a narrower width set on the input itself loses to it on emission
            order, and forcing it with an importance modifier only hides that
            trap from the next caller. Sizing the box the input fills needs
            neither. (Spelling those classes here would also feed them to
            Tailwind's scanner and emit CSS nothing uses.) */}
        <Field label="Max uses" optional className="w-28">
          <TextInput
            type="number"
            min="1"
            step="1"
            value={maxUses}
            onChange={(event) => setMaxUses(event.target.value)}
          />
        </Field>
        <Button type="submit" variant="secondary" disabled={minting}>
          {minting ? "Creating…" : "Create link"}
        </Button>
      </form>
      {error && <ErrorNote className="mt-3">{error}</ErrorNote>}

      <div className="mt-5 border-t border-card-100 pt-1">
        {invites === null ? (
          <div className="py-4">
            <LoadingState />
          </div>
        ) : invites.length === 0 ? (
          <p className="py-4 text-sm text-ink-500">No invite links yet.</p>
        ) : (
          <div className="divide-y divide-card-100">
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
    </Band>
  );
}
