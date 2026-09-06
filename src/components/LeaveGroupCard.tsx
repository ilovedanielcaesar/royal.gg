import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Button from "./Button";
import Card from "./Card";
import { describeError } from "../lib/errors";
import { useGroup } from "../lib/groupContext";
import { leaveGroup } from "../lib/leaveGroup";

export default function LeaveGroupCard() {
  const { group, isGroupAdmin } = useGroup();
  const navigate = useNavigate();
  const [leaving, setLeaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!group) return null;

  async function onLeave() {
    if (!group || leaving) return;
    if (
      !confirm(
        `Leave ${group.name}? Your results stay on the leaderboard, and you can rejoin with the code.`
      )
    ) {
      return;
    }
    setLeaving(true);
    setError(null);
    try {
      await leaveGroup(group.id);
      navigate("/groups", { replace: true });
    } catch (caught) {
      // Includes the last-admin guard, whose message is written to be read.
      setError(describeError(caught));
      setLeaving(false);
    }
  }

  return (
    <Card className="p-5">
      <h2 className="font-display text-xl text-ink-900">Leave this group</h2>
      <p className="mt-1 text-xs text-ink-500">
        You keep your place on the leaderboard and every game you played stays
        recorded. You can rejoin later with the group&rsquo;s code.
        {isGroupAdmin &&
          " If you are the group's only admin, promote someone else first — a group cannot be left without one."}
      </p>
      {error && (
        <div className="mt-3 rounded-md bg-crimson-500/10 px-3 py-2 text-xs text-crimson-700">
          {error}
        </div>
      )}
      <Button
        className="mt-4"
        variant="danger"
        size="sm"
        disabled={leaving}
        onClick={() => void onLeave()}
      >
        {leaving ? "Leaving…" : "Leave group"}
      </Button>
    </Card>
  );
}
