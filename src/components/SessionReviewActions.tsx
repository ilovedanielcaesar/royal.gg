import { useState } from "react";
import { useGroup } from "../lib/groupContext";
import type { SessionFormSession } from "../lib/sessionForm";
import useSessionReview from "../lib/useSessionReview";
import Button from "./Button";
import Card from "./Card";

type Props = {
  session: SessionFormSession;
  groupId: string;
  onError: (message: string) => void;
  reload: () => Promise<void>;
};

export default function SessionReviewActions({
  session,
  groupId,
  onError,
  reload,
}: Props) {
  const { isGroupAdmin } = useGroup();
  const [showSendBack, setShowSendBack] = useState(false);
  const [reviewNote, setReviewNote] = useState("");
  const { busy, approve, sendBack, reopen } = useSessionReview({
    sessionId: session.id,
    groupId,
    onError,
    reload,
  });

  if (!isGroupAdmin || session.status === "draft") return null;

  if (session.status === "approved") {
    return (
      <div>
        <Button
          type="button"
          variant="secondary"
          disabled={busy}
          onClick={() => {
            if (
              confirm(
                "Reopen this game? It goes back to a draft and the approval is cleared."
              )
            ) {
              void reopen();
            }
          }}
        >
          {busy ? "Reopening…" : "Reopen"}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="primary"
          disabled={busy || session.needs_review}
          onClick={() => void approve()}
        >
          {busy ? "Reviewing…" : "Approve"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={busy}
          onClick={() => setShowSendBack((visible) => !visible)}
        >
          Send back
        </Button>
      </div>

      {session.needs_review && (
        <p className="text-sm text-gold-400">
          These books do not balance. Fix the counts, or send this back, before
          approving.
        </p>
      )}

      {showSendBack && (
        <Card accent="crimson">
          <div className="p-5">
            <label
              htmlFor="session-review-note"
              className="text-sm font-medium text-ink-900"
            >
              What needs fixing?
            </label>
            <textarea
              id="session-review-note"
              value={reviewNote}
              onChange={(event) => setReviewNote(event.target.value)}
              rows={4}
              disabled={busy}
              className="mt-2 w-full rounded-md bg-card-50 px-3 py-2 text-sm text-ink-900 ring-1 ring-card-200 outline-none transition focus:ring-crimson-600 disabled:opacity-50"
            />
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                type="button"
                variant="danger"
                size="sm"
                disabled={busy}
                onClick={() => void sendBack(reviewNote)}
              >
                {busy ? "Sending…" : "Confirm send back"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={busy}
                onClick={() => {
                  setShowSendBack(false);
                  setReviewNote("");
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
