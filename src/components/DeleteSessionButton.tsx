import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { describeError } from "../lib/errors";
import { useGroup } from "../lib/groupContext";
import { requireSupabase } from "../lib/supabase";
import ConfirmButton from "./ConfirmButton";

type Props = {
  sessionId: string;
  groupId: string;
  onError: (message: string) => void;
};

export default function DeleteSessionButton({
  sessionId,
  groupId,
  onError,
}: Props) {
  const navigate = useNavigate();
  const { path } = useGroup();
  const [busy, setBusy] = useState(false);

  async function deleteSession() {
    setBusy(true);
    try {
      const sb = requireSupabase();
      // .select() so a refusal is visible. RLS turns "you may not delete this"
      // into zero matched rows with no error, and navigating away on that
      // would report success for a session still sitting in the database.
      const { data, error } = await sb
        .from("sessions")
        .delete()
        .eq("id", sessionId)
        .eq("group_id", groupId)
        .select("id");
      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error(
          "That game log could not be deleted. Only a draft can be deleted, and only by its author or an admin."
        );
      }
      navigate(path("/sessions"));
    } catch (error) {
      onError(describeError(error));
      setBusy(false);
    }
  }

  // Arming in place rather than window.confirm: the native dialog is the one
  // piece of chrome the redesign cannot style, and it is the only place the
  // consequence was ever explained. See ConfirmButton.
  return (
    <ConfirmButton
      label="Delete"
      confirmLabel="Delete this night"
      consequence="Every buy-in and cash-out on it goes too."
      busy={busy}
      busyLabel="Deleting…"
      size="md"
      onConfirm={() => void deleteSession()}
    />
  );
}
