import { useMemo } from "react";
import { useParams } from "react-router-dom";
import Band from "../components/Band";
import ErrorNote from "../components/ErrorNote";
import LoadingState from "../components/LoadingState";
import PageHeading from "../components/PageHeading";
import Sheet from "../components/Sheet";
import LedgerEditorBand from "../features/sessionDetail/LedgerEditorBand";
import SessionHeaderActions from "../features/sessionDetail/SessionHeaderActions";
import SessionSetupBand from "../features/sessionDetail/SessionSetupBand";
import SettledLedgerBand from "../features/sessionDetail/SettledLedgerBand";
import {
  isEditable,
  sessionState,
  stateSubtitle,
} from "../features/sessionDetail/sessionState";
import useAddGuest from "../features/sessionDetail/useAddGuest";
import { useCurrentUser } from "../lib/authContext";
import { fullIsoDate } from "../lib/calendar";
import { useGroup } from "../lib/groupContext";
import { reconcile, type ReconcileInput } from "../lib/reconcile";
import {
  parseCount,
  parseDraftCents,
  resolveBuyInCents,
} from "../lib/sessionForm";
import useSessionFormData from "../lib/useSessionFormData";
import useSessionFormSave from "../lib/useSessionFormSave";
import useSessionReview from "../lib/useSessionReview";

const FORM_ID = "session-form";

export default function SessionFormPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useCurrentUser();
  const { path, group, isGroupAdmin } = useGroup();
  const groupId = group?.id ?? "";
  const isEdit = Boolean(id);
  const form = useSessionFormData(groupId, id);
  const { session, rows } = form;

  // 0020 left two statuses. A night is editable while it is a draft, by any
  // member — the one admin-only write is reopening an approved one.
  const state = sessionState(
    session?.status ?? null,
    session?.needs_review ?? false
  );
  const canEdit = isEditable(state);

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

  const review = useSessionReview({
    sessionId: session?.id ?? "",
    groupId,
    onError: form.setError,
    reload: form.load,
  });

  const guest = useAddGuest({
    groupId,
    onAdded: form.addPlayer,
    onError: form.setError,
  });

  // Narrows both to number for everything below, so no call site needs a
  // fallback and none can quietly get the wrong one.
  if (
    form.loading ||
    !group ||
    buyInCents === undefined ||
    thresholdCents === undefined
  ) {
    return <LoadingState tone="felt" full />;
  }

  const selectedIds = new Set(rows.map((row) => row.playerId));
  const anyAdjusted = form.settled.some(
    (r) => r.adjustedCashOutCents !== r.reportedCashOutCents
  );

  // Built once and placed inside whichever branch renders, rather than above
  // both: `Band`'s divider is `first:border-t-0`, which is scoped to its
  // parent, so a notice outside the <form> would leave the form's first band
  // with no rule under the notice.
  const notices = (
    <>
      {form.error && (
        <Band>
          <ErrorNote>{form.error}</ErrorNote>
        </Band>
      )}
      {session?.review_note && (
        <Band kicker="Left by an admin" className="bg-crimson-600/[0.04]">
          <p className="mt-1 text-sm text-ink-900">{session.review_note}</p>
        </Band>
      )}
    </>
  );

  return (
    <div>
      <PageHeading
        title={isEdit ? fullIsoDate(form.playedAt) : "New night"}
        subtitle={stateSubtitle(state)}
        actions={
          <SessionHeaderActions
            state={state}
            formId={FORM_ID}
            isGroupAdmin={isGroupAdmin}
            canDelete={
              Boolean(id) &&
              canEdit &&
              (isGroupAdmin || session?.created_by === user?.id)
            }
            canApprove={Boolean(reconcileSummary && !reconcileSummary.needsReview)}
            busy={busy || review.busy}
            rowCount={rows.length}
            sessionId={id}
            groupId={groupId}
            sessionsHref={path("/sessions")}
            onApprove={() => void review.approve()}
            onReopen={() => void review.reopen()}
            onError={form.setError}
          />
        }
      />

      <Sheet>
        {canEdit ? (
          <form id={FORM_ID} onSubmit={handleSubmit}>
            {notices}
            <SessionSetupBand
              playedAt={form.playedAt}
              onPlayedAtChange={form.setPlayedAt}
              notes={form.notes}
              onNotesChange={form.setNotes}
              roster={form.allPlayers}
              selectedIds={selectedIds}
              onToggleMember={form.togglePlayer}
              onSeatGuest={(g) => form.togglePlayer(g.id)}
              onCreateGuest={(name) => void guest.addGuest(name)}
              canCreateGuest={isGroupAdmin}
              busy={guest.busy}
            />
            <LedgerEditorBand
              rows={rows}
              playersById={playersById}
              buyInCents={buyInCents}
              onRowChange={form.updateRow}
              onRemove={form.togglePlayer}
              summary={reconcileSummary}
              state={state}
              thresholdCents={thresholdCents}
            />
          </form>
        ) : (
          <>
            {notices}
            <SettledLedgerBand
              results={form.settled}
              playersById={playersById}
              adjusted={anyAdjusted}
            />
          </>
        )}
      </Sheet>
    </div>
  );
}
