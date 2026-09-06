import { useState } from "react";
import { Link } from "react-router-dom";
import Button from "../components/Button";
import Card from "../components/Card";
import InviteLinksCard from "../components/InviteLinksCard";
import { describeError } from "../lib/errors";
import { useGroup } from "../lib/groupContext";
import { generateJoinCode } from "../lib/joinCode";
import { requireSupabase } from "../lib/supabase";

type JoinPolicy = "code" | "code_approve";

const POLICIES: Array<[JoinPolicy, string]> = [
  ["code", "Anyone with the code joins straight away."],
  ["code_approve", "Anyone with the code has to be approved first."],
];

export default function GroupSettingsPage() {
  const { group, isGroupAdmin, path, reload } = useGroup();
  const [regenerating, setRegenerating] = useState(false);
  const [savingPolicy, setSavingPolicy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!group) return <p className="text-card-50/60">Dealing…</p>;

  const groupId = group.id;
  const joinUrl = `${window.location.origin}/join/${group.join_code}`;

  /**
   * Every save re-reads the group through reload() rather than mirroring the
   * new value into local state. The context is what the rest of the page (and
   * a later remount of it) reads, so a local copy would drift: rotate the
   * code, navigate to members and back, and the stale context would show the
   * old code — one that has genuinely stopped working.
   */
  async function save(update: { join_code?: string; join_policy?: JoinPolicy }) {
    setError(null);
    try {
      const { error: updateError } = await requireSupabase()
        .from("groups")
        .update(update)
        .eq("id", groupId);
      if (updateError) throw updateError;
      await reload();
    } catch (caught) {
      setError(describeError(caught));
    }
  }

  async function regenerateJoinCode() {
    if (
      !isGroupAdmin ||
      regenerating ||
      !confirm("Regenerate the join code? The old code will stop working.")
    ) {
      return;
    }
    setRegenerating(true);
    await save({ join_code: generateJoinCode() });
    setRegenerating(false);
  }

  async function saveJoinPolicy(joinPolicy: JoinPolicy) {
    if (!isGroupAdmin || savingPolicy || joinPolicy === group?.join_policy) {
      return;
    }
    setSavingPolicy(true);
    await save({ join_policy: joinPolicy });
    setSavingPolicy(false);
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-4xl text-card-50">Settings</h1>
        <p className="mt-1 text-sm text-card-50/60">
          Manage how people join {group.name}.
        </p>
      </header>

      {error && (
        <p className="rounded-md bg-crimson-500/10 px-3 py-2 text-xs text-crimson-700">
          {error}
        </p>
      )}

      <Card accent="gold">
        <div className="p-5">
          <h2 className="font-display text-2xl text-ink-900">Join code</h2>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <code className="font-mono text-3xl font-semibold tracking-widest text-ink-900">
              {group.join_code}
            </code>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => void navigator.clipboard.writeText(joinUrl)}
            >
              Copy link
            </Button>
          </div>
          <p className="mt-3 break-all font-mono text-sm text-ink-700">
            {joinUrl}
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-ink-500">
              Regenerating invalidates the old code and any link built from it.
              Invite links below are separate and keep working.
            </p>
            <Button
              size="sm"
              variant="danger"
              disabled={regenerating}
              onClick={() => void regenerateJoinCode()}
            >
              {regenerating ? "Regenerating…" : "Regenerate"}
            </Button>
          </div>
        </div>
      </Card>

      <Card>
        <div className="p-5">
          <h2 className="font-display text-2xl text-ink-900">Join policy</h2>
          <div className="mt-3 space-y-3">
            {POLICIES.map(([value, description]) => (
              <label
                key={value}
                className="flex cursor-pointer items-start gap-3"
              >
                <input
                  type="radio"
                  name="join-policy"
                  value={value}
                  checked={group.join_policy === value}
                  disabled={savingPolicy}
                  onChange={() => void saveJoinPolicy(value)}
                  className="mt-1 accent-felt-700"
                />
                <span className="text-sm text-ink-700">{description}</span>
              </label>
            ))}
          </div>
          <p className="mt-4 text-xs text-ink-500">
            Approve pending requests on the{" "}
            <Link className="underline hover:text-ink-900" to={path("/members")}>
              members page
            </Link>
            .
          </p>
        </div>
      </Card>

      <InviteLinksCard key={groupId} groupId={groupId} />

      <Card>
        <div className="p-5">
          <h2 className="font-display text-2xl text-ink-900">Members</h2>
          <Link
            className="mt-2 inline-block text-sm text-sage-700 underline hover:text-sage-600"
            to={path("/members")}
          >
            Approve requests, change roles, and remove members →
          </Link>
        </div>
      </Card>
    </div>
  );
}
