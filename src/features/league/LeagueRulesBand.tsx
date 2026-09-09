import { Link } from "react-router-dom";
import Band from "../../components/Band";
import type { Group } from "../../lib/groupContext";
import { formatCents } from "../../lib/money";

type Props = {
  group: Group;
  settingsHref: string | null;
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
      <dl className="mt-[18px] grid overflow-hidden rounded-xl border border-card-100 bg-card-100 sm:grid-cols-3 sm:gap-px">
        <div className="bg-card-50 p-3.5">
          <dt className="text-[9.5px] font-semibold tracking-[0.08em] text-ink-500 uppercase">
            Stakes
          </dt>
          <dd className="tabular mt-1.5 text-[13px] font-medium">
            {group.stakes_label ?? "Not set"}
          </dd>
        </div>
        <div className="border-t border-card-100 bg-card-50 p-3.5 sm:border-t-0">
          <dt className="text-[9.5px] font-semibold tracking-[0.08em] text-ink-500 uppercase">
            Default buy-in
          </dt>
          <dd className="tabular mt-1.5 text-[13px] font-medium">
            {formatCents(group.default_buy_in_cents)}
          </dd>
        </div>
        <div className="border-t border-card-100 bg-card-50 p-3.5 sm:border-t-0">
          <dt className="text-[9.5px] font-semibold tracking-[0.08em] text-ink-500 uppercase">
            Reconcile threshold
          </dt>
          <dd className="tabular mt-1.5 text-[13px] font-medium">
            {formatCents(group.reconcile_threshold_cents)}
          </dd>
        </div>
      </dl>
    </Band>
  );
}
