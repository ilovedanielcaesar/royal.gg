import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Band from "../../components/Band";
import ConfirmButton from "../../components/ConfirmButton";
import { describeError } from "../../lib/errors";
import { useGroup } from "../../lib/groupContext";
import { leaveGroup } from "../../lib/leaveGroup";

export default function LeaveGroupBand() {
  const { group, isGroupAdmin } = useGroup();
  const navigate = useNavigate();
  const [leaving, setLeaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!group) return null;

  async function onLeave() {
    if (!group || leaving) return;
    setLeaving(true);
    setError(null);
    try {
      await leaveGroup(group.id);
      navigate("/groups", { replace: true });
    } catch (caught) {
      setError(describeError(caught));
      setLeaving(false);
    }
  }

  return (
    <Band className="bg-crimson-500/[0.06]">
      <div className="flex flex-wrap items-center justify-between gap-5">
        <div>
          <h2 className="font-display text-[23px] leading-[1.1] text-crimson-700">
            Leave {group.name}
          </h2>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-ink-500">
            Your results remain in the permanent ledger, but you leave the
            active roster.
            {isGroupAdmin &&
              " If you are the group's only admin, promote someone else first."}
          </p>
        </div>
        <ConfirmButton
          label="Leave league…"
          confirmLabel="Yes, leave league"
          consequence="You will need an invite to rejoin."
          onConfirm={() => void onLeave()}
          busy={leaving}
          busyLabel="Leaving…"
        />
      </div>
      {error && (
        <p className="mt-3 rounded-md bg-crimson-500/10 px-3 py-2 text-xs text-crimson-700">
          {error}
        </p>
      )}
    </Band>
  );
}
