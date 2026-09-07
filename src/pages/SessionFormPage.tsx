import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import Card from "../components/Card";
import SessionAmountsCard from "../components/SessionAmountsCard";
import SessionDetailsCard from "../components/SessionDetailsCard";
import SessionFormActions from "../components/SessionFormActions";
import SessionPlayerPicker from "../components/SessionPlayerPicker";
import SessionReconciliationSummary from "../components/SessionReconciliationSummary";
import SessionReviewActions from "../components/SessionReviewActions";
import { useCurrentUser } from "../lib/authContext";
import { formatPlayedAt } from "../lib/format";
import { useGroup } from "../lib/groupContext";
import { reconcile, type ReconcileInput } from "../lib/reconcile";
import {
  parseCount,
  parseDraftCents,
  resolveBuyInCents,
} from "../lib/sessionForm";
import useSessionFormData from "../lib/useSessionFormData";
import useSessionFormSave from "../lib/useSessionFormSave";

export default function SessionFormPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useCurrentUser();
  const { path, group, isGroupAdmin } = useGroup();
  const groupId = group?.id ?? "";
  const isEdit = Boolean(id);
  const form = useSessionFormData(groupId, id);
  const { session, rows } = form;
  const isDraft = session?.status === "draft" || session === null;
  const canEdit =
    isDraft || (isGroupAdmin && session?.status === "submitted");

  // See resolveBuyInCents — an existing night keeps the stake it was played at.
  const buyInCents = resolveBuyInCents(session, group);
  const thresholdCents = group?.reconcile_threshold_cents;

  const playersById = useMemo(
    () => new Map(form.allPlayers.map((player) => [player.id, player])),
    [form.allPlayers]
  );

  const reconcileSummary = useMemo(() => {
    if (rows.length === 0) return null;
    if (buyInCents === undefined || thresholdCents === undefined) return null;
    const inputs: ReconcileInput[] = rows.map((r) => ({
      playerId: r.playerId,
      buyInCents: parseCount(r.buyInCount) * buyInCents,
      reportedCashOutCents: parseDraftCents(r.cashOut) ?? 0,
    }));
    return reconcile(inputs, thresholdCents);
  }, [rows, buyInCents, thresholdCents]);

  const { busy, handleSubmit } = useSessionFormSave({
    id,
    groupId,
    isEdit,
    canEdit,
    playedAt: form.playedAt,
    notes: form.notes,
    rows,
    summary: reconcileSummary,
    buyInCents,
    setError: form.setError,
    reload: form.load,
  });

  // Narrows both to number for everything below, so no call site needs a
  // fallback and none can quietly get the wrong one.
  if (
    form.loading ||
    !group ||
    buyInCents === undefined ||
    thresholdCents === undefined
  ) {
    return <p className="text-card-50/60">Dealing…</p>;
  }

  const canDelete =
    Boolean(id) &&
    isDraft &&
    (isGroupAdmin || session?.created_by === user?.id);

  return (
    <div className="space-y-6">
      <div>
        <Link
          to={path("/sessions")}
          className="text-xs text-card-50/60 hover:text-card-50"
        >
          ← Sessions
        </Link>
        <h1 className="mt-1 font-display text-4xl text-card-50">
          {isEdit ? (canEdit ? "Edit session" : "Session") : "New session"}
        </h1>
        <p className="mt-1 text-sm text-card-50/70">
          {isEdit
            ? `Logged ${formatPlayedAt(form.playedAt)}.`
            : "Tap who played, then enter buy-ins and cash-outs."}
        </p>
        {session?.status === "submitted" && (
          <p className="mt-2 text-sm text-gold-400">
            This game is waiting for an admin to approve it.
          </p>
        )}
        {session?.status === "approved" && (
          <p className="mt-2 text-sm text-card-50/70">
            This game is approved. An admin must reopen it before anything can
            be changed.
          </p>
        )}
      </div>

      {isDraft && session?.review_note && (
        <Card accent="crimson">
          <div className="p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-crimson-700">
              Sent back by an admin
            </p>
            <p className="mt-1 text-sm text-ink-900">
              {session.review_note}
            </p>
          </div>
        </Card>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <SessionDetailsCard
          canEdit={canEdit}
          playedAt={form.playedAt}
          notes={form.notes}
          onPlayedAtChange={form.setPlayedAt}
          onNotesChange={form.setNotes}
        />
        {canEdit && (
          <SessionPlayerPicker
            players={form.allPlayers}
            rows={rows}
            groupId={groupId}
            canAddGuest={isGroupAdmin}
            onToggle={form.togglePlayer}
            onGuestAdded={form.addPlayer}
            setError={form.setError}
          />
        )}
        {rows.length > 0 && (
          <SessionAmountsCard
            rows={rows}
            buyInCents={buyInCents}
            playersById={playersById}
            summary={reconcileSummary}
            canEdit={canEdit}
            onRowChange={form.updateRow}
          />
        )}
        {reconcileSummary && rows.length > 0 && (
          <SessionReconciliationSummary
            summary={reconcileSummary}
            thresholdCents={thresholdCents}
          />
        )}
        {form.error && (
          <Card accent="crimson">
            <p className="p-4 text-sm text-crimson-700">{form.error}</p>
          </Card>
        )}
        {session && (
          <Card accent={session.needs_review ? "crimson" : "sage"}>
            <p className="p-4 text-sm text-ink-700">
              {session.needs_review
                ? "This session is currently flagged for review."
                : canEdit
                  ? "This session was previously reconciled. Saving will overwrite."
                  : "This session is reconciled."}
            </p>
          </Card>
        )}
        {session && isGroupAdmin && (
          <SessionReviewActions
            session={session}
            groupId={groupId}
            onError={form.setError}
            reload={form.load}
          />
        )}
        <SessionFormActions
          canEdit={canEdit}
          isDraft={isDraft}
          busy={busy}
          rowCount={rows.length}
          canDelete={canDelete}
          sessionId={id}
          groupId={groupId}
          onError={form.setError}
        />
      </form>
    </div>
  );
}
