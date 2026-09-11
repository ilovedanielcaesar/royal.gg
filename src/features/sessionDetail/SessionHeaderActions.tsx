import ConfirmButton from "../../components/ConfirmButton";
import DeleteSessionButton from "../../components/DeleteSessionButton";
import FeltButton from "../../components/FeltButton";
import type { SessionState } from "./sessionState";

type Props = {
  state: SessionState;
  /** The `<form id>` the save button submits, since it sits outside it. */
  formId: string;
  isGroupAdmin: boolean;
  canDelete: boolean;
  canApprove: boolean;
  busy: boolean;
  rowCount: number;
  sessionId?: string;
  groupId: string;
  sessionsHref: string;
  onApprove: () => void;
  onReopen: () => void;
  onError: (message: string) => void;
};

/**
 * Every control that changes this night, on the felt, above the sheet.
 *
 * That placement is the redesign's rule, not a layout preference: the sheet
 * is the record and carries no page-level controls. The save button reaches
 * the form it is outside of through `form=`, which is what that attribute is
 * for and is cheaper than lifting the submit handler out of the form.
 */
export default function SessionHeaderActions({
  state,
  formId,
  isGroupAdmin,
  canDelete,
  canApprove,
  busy,
  rowCount,
  sessionId,
  groupId,
  sessionsHref,
  onApprove,
  onReopen,
  onError,
}: Props) {
  if (state === "approved") {
    return (
      <>
        <FeltButton variant="ghost" to={sessionsHref}>
          ← Sessions
        </FeltButton>
        {isGroupAdmin && (
          <ConfirmButton
            label="Reopen"
            confirmLabel="Reopen this night"
            consequence="It goes back to a draft and the approval is cleared."
            busy={busy}
            busyLabel="Reopening…"
            size="md"
            onConfirm={onReopen}
          />
        )}
      </>
    );
  }

  return (
    <>
      <FeltButton variant="ghost" to={sessionsHref}>
        Cancel
      </FeltButton>
      {canDelete && sessionId && (
        <DeleteSessionButton
          sessionId={sessionId}
          groupId={groupId}
          onError={onError}
        />
      )}
      {isGroupAdmin && state !== "new" && (
        <FeltButton
          variant="ghost"
          onClick={onApprove}
          disabled={busy || !canApprove}
          title={
            canApprove
              ? undefined
              : "The books have to balance before this can be approved."
          }
        >
          Approve
        </FeltButton>
      )}
      <FeltButton form={formId} type="submit" disabled={busy || rowCount === 0}>
        {busy ? "Saving…" : "Save night"}
      </FeltButton>
    </>
  );
}
