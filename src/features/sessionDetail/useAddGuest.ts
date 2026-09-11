import { useState } from "react";
import { describeError } from "../../lib/errors";
import type { SessionFormPlayer } from "../../lib/sessionForm";
import { requireSupabase } from "../../lib/supabase";

type Options = {
  groupId: string;
  onAdded: (player: SessionFormPlayer) => void;
  onError: (message: string | null) => void;
};

/**
 * Creating a new guest row from the guest field.
 *
 * Writes immediately rather than waiting for the night to save, because the
 * row has to exist before a buy-in can point at it. That makes it the one
 * thing on this page that touches the database before Save — worth knowing,
 * because a guest added and then abandoned stays in the roster.
 *
 * `players_insert_admin` is the policy behind it: adding a guest is
 * admin-only at the database. The field offers creation only to an admin for
 * that reason, and this hook still surfaces the refusal if it is reached any
 * other way.
 */
export default function useAddGuest({ groupId, onAdded, onError }: Options) {
  const [busy, setBusy] = useState(false);

  async function addGuest(rawName: string) {
    const name = rawName.trim();
    if (!name) return;
    setBusy(true);
    onError(null);
    try {
      const sb = requireSupabase();
      const { data, error } = await sb
        .from("players")
        .insert({ name, is_guest: true, status: "active", group_id: groupId })
        .select()
        .single();
      if (error) throw error;
      onAdded(data);
    } catch (error) {
      onError(describeError(error));
    } finally {
      setBusy(false);
    }
  }

  return { busy, addGuest };
}
