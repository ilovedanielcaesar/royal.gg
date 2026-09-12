import { useState, type FormEvent } from "react";
import { describeError } from "../lib/errors";
import type { SessionFormPlayer } from "../lib/sessionForm";
import { requireSupabase } from "../lib/supabase";
import Button from "./Button";
import Field from "./Field";
import TextInput from "./TextInput";

type Props = {
  groupId: string;
  onAdded: (player: SessionFormPlayer) => void;
  onError: (message: string | null) => void;
};

export default function AddGuestForm({ groupId, onAdded, onError }: Props) {
  const [guestName, setGuestName] = useState("");
  const [guestAdding, setGuestAdding] = useState(false);

  async function addGuest(event: FormEvent) {
    event.preventDefault();
    const name = guestName.trim();
    if (!name) return;
    setGuestAdding(true);
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
      setGuestName("");
    } catch (error) {
      onError(describeError(error));
    } finally {
      setGuestAdding(false);
    }
  }

  return (
    <div className="mt-4 flex flex-wrap items-end gap-2 border-t border-card-100 pt-4">
      <Field label="Add a guest (one-off player)" className="flex-1">
        <TextInput
          value={guestName}
          onChange={(event) => setGuestName(event.target.value)}
          placeholder="Name"
        />
      </Field>
      <Button
        type="button"
        variant="secondary"
        onClick={(event) => void addGuest(event)}
        disabled={guestAdding || !guestName.trim()}
      >
        {guestAdding ? "Adding…" : "+ Add guest"}
      </Button>
    </div>
  );
}
