import { useState } from "react";
import { describeError } from "./errors";
import { requireSupabase } from "./supabase";

type Options = {
  sessionId: string;
  groupId: string;
  onError: (message: string) => void;
  reload: () => Promise<void>;
};

type ReviewUpdate =
  | { status: "approved" }
  | { status: "draft"; review_note: string | null };

export default function useSessionReview({
  sessionId,
  groupId,
  onError,
  reload,
}: Options) {
  const [busy, setBusy] = useState(false);

  async function updateSession(values: ReviewUpdate) {
    setBusy(true);
    try {
      const sb = requireSupabase();
      const { data, error } = await sb
        .from("sessions")
        .update(values)
        .eq("id", sessionId)
        .eq("group_id", groupId)
        .select("id");
      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error(
          "That game log could not be reviewed. It may have changed, or you may not have permission."
        );
      }
      await reload();
    } catch (error) {
      onError(describeError(error));
    } finally {
      setBusy(false);
    }
  }

  async function approve() {
    await updateSession({ status: "approved" });
  }

  async function sendBack(note: string) {
    const trimmedNote = note.trim();
    if (!trimmedNote) {
      onError("Say what needs fixing.");
      return;
    }
    await updateSession({ status: "draft", review_note: trimmedNote });
  }

  async function reopen() {
    await updateSession({ status: "draft", review_note: null });
  }

  return { busy, approve, sendBack, reopen };
}
