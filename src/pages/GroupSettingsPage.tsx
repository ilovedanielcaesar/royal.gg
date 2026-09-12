import { useState } from "react";
import { Link } from "react-router-dom";
import Band from "../components/Band";
import Button from "../components/Button";
import ConfirmButton from "../components/ConfirmButton";
import ErrorNote from "../components/ErrorNote";
import FeltButton from "../components/FeltButton";
import GoldPill from "../components/GoldPill";
import InviteLinksBand from "../components/InviteLinksBand";
import LoadingState from "../components/LoadingState";
import PageHeading from "../components/PageHeading";
import Sheet from "../components/Sheet";
import StakesBand, { type StakesUpdate } from "../components/StakesBand";
import { publicAppUrl } from "../lib/appUrl";
import { describeError } from "../lib/errors";
import { useGroup, type Group } from "../lib/groupContext";
import { generateJoinCode } from "../lib/joinCode";
import { requireSupabase } from "../lib/supabase";

type JoinPolicy = "code" | "code_approve";
type GroupSettingsUpdate = Partial<
  Pick<Group, "join_code" | "join_policy"> & StakesUpdate
>;

const POLICIES: Array<[JoinPolicy, string]> = [
  ["code", "Anyone with the code joins straight away."],
  ["code_approve", "Anyone with the code has to be approved first."],
];

export default function GroupSettingsPage() {
  const { group, isGroupAdmin, path, reload } = useGroup();
  const [regenerating, setRegenerating] = useState(false);
  const [savingPolicy, setSavingPolicy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!group) return <LoadingState tone="felt" full />;

  const groupId = group.id;
  const joinUrl = publicAppUrl(`/join/${group.join_code}`);

  /**
   * Every save re-reads the group through reload() rather than mirroring the
   * new value into local state. The context is what the rest of the page (and
   * a later remount of it) reads, so a local copy would drift: rotate the
   * code, navigate to members and back, and the stale context would show the
   * old code — one that has genuinely stopped working.
   */
  async function save(update: GroupSettingsUpdate) {
    setError(null);
    try {
      // .select() so a refusal is visible. RLS turns "you are no longer an
      // admin here" into zero matched rows with no error, and without this the
      // form would report success, reload(), and quietly show the old values
      // back. Reachable without any foul play: be demoted or leave the group
      // in another tab while this page is open, and every save silently stops
      // working. Same shape as DeleteSessionButton and useSessionReview.
      const { data, error: updateError } = await requireSupabase()
        .from("groups")
        .update(update)
        .eq("id", groupId)
        .select("id");
      if (updateError) throw updateError;
      if (!data || data.length === 0) {
        throw new Error(
          "Those settings could not be saved. You may no longer be an admin of this group."
        );
      }
      await reload();
    } catch (caught) {
      setError(describeError(caught));
    }
  }

  // No confirm() — the Regenerate button arms in place and states the
  // consequence beside itself. The native dialog was the only place that
  // consequence was written down, which on a phone is a grey box nobody reads.
  async function regenerateJoinCode() {
    if (!isGroupAdmin || regenerating) return;
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
    <>
      {/* The ADMIN marker lives here, not on the link that got you here. This
          is the page where the privilege is actually exercised, and the one
          place a member and an admin see visibly different controls — so it
          is the one place saying which you are earns its space. Felt tone:
          gold-ink is unreadable on the table. */}
      <PageHeading
        title="Settings"
        subtitle={
          isGroupAdmin
            ? `Manage ${group.name}'s table and membership settings.`
            : `${group.name}'s table settings. Admins can change these.`
        }
        actions={
          isGroupAdmin ? (
            <>
              <GoldPill tone="felt">ADMIN</GoldPill>
              <FeltButton variant="ghost" to={path("/members")}>
                Members
              </FeltButton>
            </>
          ) : undefined
        }
      />

      {/* On the felt, so the felt tone: crimson-700 out here is 1.5:1 and
          this banner was unreadable. */}
      {error && (
        <ErrorNote tone="felt" className="mb-4">
          {error}
        </ErrorNote>
      )}

      <Sheet>
        <Band
          kicker="Standing code"
          title="Join code"
          caption="The standing code. Anyone with it can ask to join."
          action={
            isGroupAdmin && (
              <ConfirmButton
                label="Regenerate"
                confirmLabel="Regenerate code"
                consequence="The old code stops working."
                busy={regenerating}
                busyLabel="Regenerating…"
                onConfirm={() => void regenerateJoinCode()}
              />
            )
          }
        >
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <code className="font-mono text-3xl font-semibold tracking-widest text-ink-900">
              {group.join_code}
            </code>
            <Button
              size="sm"
              variant="subtle"
              onClick={() => void navigator.clipboard.writeText(joinUrl)}
            >
              Copy link
            </Button>
          </div>
          <p className="mt-3 break-all font-mono text-sm text-ink-700">
            {joinUrl}
          </p>
          {isGroupAdmin && (
            <p className="mt-3 max-w-[70ch] text-xs text-ink-500">
              Regenerating invalidates the old code and any link built from
              it. Invite links below are separate and keep working.
            </p>
          )}
        </Band>

        <Band
          kicker="Access"
          title="Join policy"
          caption="What happens when someone redeems the code."
        >
          <div className="mt-4 space-y-3">
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
                  disabled={savingPolicy || !isGroupAdmin}
                  onChange={() => void saveJoinPolicy(value)}
                  className="mt-1 accent-felt-700 disabled:opacity-60"
                />
                <span className="text-sm text-ink-700">{description}</span>
              </label>
            ))}
          </div>
          {isGroupAdmin && (
            <p className="mt-4 text-xs text-ink-500">
              Approve pending requests on the{" "}
              <Link
                className="font-medium underline hover:text-ink-900"
                to={path("/members")}
              >
                members page
              </Link>
              .
            </p>
          )}
        </Band>

        <StakesBand
          key={`${group.stakes_label}:${group.default_buy_in_cents}:${group.reconcile_threshold_cents}`}
          group={group}
          isGroupAdmin={isGroupAdmin}
          save={save}
        />

        {/* Both admin-only, and for the same reason: they are doors a member
            cannot walk through. `group_invites` has no member select policy
            (0010_group_join.sql:12), so the band would render an empty list
            and a create button that fails. A member's invite is the standing
            join code above. The members page is admin-gated too, which is why
            its link is in the heading only for an admin. */}
        {isGroupAdmin && <InviteLinksBand key={groupId} groupId={groupId} />}
      </Sheet>
    </>
  );
}
