import { useState, type Dispatch, type FormEvent, type SetStateAction } from "react";
import { useNavigate } from "react-router-dom";
import { useCurrentUser } from "./authContext";
import { describeError } from "./errors";
import { useGroup } from "./groupContext";
import type { ReconcileSummary } from "./reconcile";
import { parseCount, type SessionFormRow } from "./sessionForm";
import { requireSupabase } from "./supabase";

type Props = {
  id?: string;
  groupId: string;
  isEdit: boolean;
  canEdit: boolean;
  playedAt: string;
  notes: string;
  rows: SessionFormRow[];
  summary: ReconcileSummary | null;
  /**
   * The stake to write on every buy-in row: the SESSION's stamped value for an
   * existing night, the group's default for a new one. Undefined until the
   * group loads, and a save is refused while it is.
   */
  buyInCents: number | undefined;
  setError: Dispatch<SetStateAction<string | null>>;
  reload: () => Promise<void>;
};

export default function useSessionFormSave({
  id,
  groupId,
  isEdit,
  canEdit,
  playedAt,
  notes,
  rows,
  summary,
  buyInCents,
  setError,
  reload,
}: Props) {
  const navigate = useNavigate();
  const { user } = useCurrentUser();
  const { path } = useGroup();
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canEdit) return;
    if (rows.length === 0) {
      setError("Pick at least one player.");
      return;
    }
    if (!summary) return;
    if (buyInCents === undefined) return;
    if (!user) {
      setError("Sign in before saving a game log.");
      return;
    }
    const submitter = (e.nativeEvent as SubmitEvent)
      .submitter as HTMLButtonElement | null;
    const shouldSubmit = submitter?.value === "submit";
    setBusy(true);
    setError(null);
    try {
      const sb = requireSupabase();

      let sessionId = id;
      if (isEdit && sessionId) {
        const { error: sErr } = await sb
          .from("sessions")
          .update({
            played_at: playedAt,
            notes: notes.trim() || null,
            reconciled: !summary.needsReview,
            needs_review: summary.needsReview,
            discrepancy_cents: summary.discrepancyCents,
          })
          .eq("id", sessionId)
          .eq("group_id", groupId);
        if (sErr) throw sErr;
        const { error: delBiErr } = await sb
          .from("buy_ins")
          .delete()
          .eq("session_id", sessionId);
        if (delBiErr) throw delBiErr;
      } else {
        const { data: session, error: sErr } = await sb
          .from("sessions")
          .insert({
            group_id: groupId,
            status: "draft",
            created_by: user.id,
            played_at: playedAt,
            // Stated, not left to the trigger. The trigger would stamp the
            // group's default AT SAVE TIME, so an admin changing the stakes
            // while this form was open would price the buy_ins rows below at
            // what the user saw and the session at something else. Sending it
            // keeps the two agreeing on the number that was on screen.
            buy_in_cents: buyInCents,
            notes: notes.trim() || null,
            reconciled: !summary.needsReview,
            needs_review: summary.needsReview,
            discrepancy_cents: summary.discrepancyCents,
          })
          .select()
          .single();
        if (sErr) throw sErr;
        sessionId = session.id;
      }

      const buyRows: Array<{
        session_id: string;
        player_id: string;
        amount_cents: number;
      }> = [];
      rows.forEach((r) => {
        const count = parseCount(r.buyInCount);
        for (let i = 0; i < count; i += 1) {
          buyRows.push({
            session_id: sessionId!,
            player_id: r.playerId,
            amount_cents: buyInCents,
          });
        }
      });
      if (buyRows.length > 0) {
        const { error: biErr } = await sb.from("buy_ins").insert(buyRows);
        if (biErr) throw biErr;
      }

      const { error: delCoErr } = await sb
        .from("cash_outs")
        .delete()
        .eq("session_id", sessionId!);
      if (delCoErr) throw delCoErr;

      const cashRows = summary.results.map((r) => ({
        session_id: sessionId!,
        player_id: r.playerId,
        reported_amount_cents: r.reportedCashOutCents,
        adjusted_amount_cents: r.adjustedCashOutCents,
      }));
      if (cashRows.length > 0) {
        const { error: coErr } = await sb.from("cash_outs").insert(cashRows);
        if (coErr) throw coErr;
      }

      if (shouldSubmit) {
        const { error: submitError } = await sb
          .from("sessions")
          .update({ status: "submitted" })
          .eq("id", sessionId!)
          .eq("group_id", groupId);
        if (submitError) throw submitError;
      }

      navigate(path(`/sessions/${sessionId}`));
      if (isEdit) {
        await reload();
      }
    } catch (e) {
      console.error(e);
      setError(describeError(e));
    } finally {
      setBusy(false);
    }
  }

  return { busy, handleSubmit };
}
