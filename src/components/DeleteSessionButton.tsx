import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { describeError } from "../lib/errors";
import { useGroup } from "../lib/groupContext";
import { requireSupabase } from "../lib/supabase";
import Button from "./Button";

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
    if (
      !confirm(
        "Are you sure you want to delete this session? This will permanently wipe all buy-in and cash-out records for this date."
      )
    ) {
      return;
    }
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

  return (
    <Button
      type="button"
      variant="danger"
      disabled={busy}
      onClick={() => void deleteSession()}
    >
      Delete session
    </Button>
  );
}
