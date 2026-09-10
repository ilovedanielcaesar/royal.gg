import { Link } from "react-router-dom";
import Band from "../../components/Band";
import type { Group } from "../../lib/groupContext";
import { formatCents } from "../../lib/money";
import { PAYOUT_REMINDER_AFTER_SESSIONS } from "../../lib/stats";

type Props = {
  group: Group;
  settingsHref: string | null;
};

/**
 * The five facts the mock lists, all five of them.
 *
 * Three of these are read off the `groups` row and two are not: the join
 * policy is a column with a machine name that has to be said in English, and
 * the payout reminder is a constant. It is here because the band is called
 * "League rules" and "we nag you after eight nights" is one — leaving it out
 * meant the only place the number appeared was an inline literal in the band
 * above.
 */
const JOIN_POLICY_LABELS: Record<Group["join_policy"], string> = {
  code: "Code only",
  code_approve: "Code + admin approval",
};

export default function LeagueRulesBand({ group, settingsHref }: Props) {
  return (
    <Band
      title="League rules"
      caption="Active game parameters · League settings owns the rules"
      action={
        settingsHref && (
          <Link
            to={settingsHref}
            className="text-xs font-medium text-ink-500 hover:text-ink-900 hover:underline"
          >
            Configure settings →
          </Link>
        )
      }
    >
      {/* The hairlines are the card-100 ground showing through a 1px gap, per
          the mock. Five across at full width, three when there is not room —
          which is the one layout that leaves an empty cell, and it reads as a
          blank tile rather than a hole because the ground is a cream. */}
      <dl className="mt-[18px] grid gap-px overflow-hidden rounded-xl border border-card-100 bg-card-100 sm:grid-cols-3 lg:grid-cols-5">
        <Fact label="Stakes" value={group.stakes_label ?? "Not set"} />
        <Fact
          label="Default buy-in"
          value={formatCents(group.default_buy_in_cents)}
        />
        <Fact
          label="Reconcile threshold"
          value={formatCents(group.reconcile_threshold_cents)}
        />
        <Fact
          label="Payout reminder"
          value={`After ${PAYOUT_REMINDER_AFTER_SESSIONS} sessions`}
        />
        <Fact
          label="Join policy"
          value={JOIN_POLICY_LABELS[group.join_policy]}
        />
      </dl>
    </Band>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 bg-card-50 p-3.5">
      <dt className="text-[9.5px] font-semibold tracking-[0.08em] text-ink-500 uppercase">
        {label}
      </dt>
      {/* `tabular` on all five: three are figures and the two that are words
          sit in the same row, so a proportional face beside them reads as a
          different kind of value. */}
      <dd className="tabular mt-1.5 text-[13px] leading-[1.4] font-medium">
        {value}
      </dd>
    </div>
  );
}
