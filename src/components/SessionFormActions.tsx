import { useNavigate } from "react-router-dom";
import { useGroup } from "../lib/groupContext";
import Button from "./Button";
import DeleteSessionButton from "./DeleteSessionButton";

type Props = {
  canEdit: boolean;
  isDraft: boolean;
  busy: boolean;
  rowCount: number;
  canDelete: boolean;
  sessionId?: string;
  groupId: string;
  onError: (message: string) => void;
};

export default function SessionFormActions({
  canEdit,
  isDraft,
  busy,
  rowCount,
  canDelete,
  sessionId,
  groupId,
  onError,
}: Props) {
  const navigate = useNavigate();
  const { path } = useGroup();

  return (
    <div className="flex flex-wrap gap-2">
      {canEdit && (
        <Button type="submit" disabled={busy || rowCount === 0}>
          Save
        </Button>
      )}
      {isDraft && canEdit && (
        <Button
          type="submit"
          name="intent"
          value="submit"
          variant="secondary"
          disabled={busy || rowCount === 0}
        >
          Submit for approval
        </Button>
      )}
      <Button
        type="button"
        variant="ghost"
        onClick={() => navigate(path("/sessions"))}
      >
        {canEdit ? "Cancel" : "Back"}
      </Button>
      {canDelete && sessionId && (
        <div className="ml-auto">
          <DeleteSessionButton
            sessionId={sessionId}
            groupId={groupId}
            onError={onError}
          />
        </div>
      )}
    </div>
  );
}
