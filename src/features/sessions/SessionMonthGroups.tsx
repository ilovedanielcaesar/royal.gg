import { formatSignedCents } from "../../lib/money";
import { moneyToneClass } from "../../lib/moneyTone";
import SessionLedgerRow from "./SessionLedgerRow";
import { sessionMonthKey, sessionMonthLabel } from "./sessionDates";
import type { SessionLedgerRow as Row } from "./useSessionsData";

type Props = {
  rows: Row[];
  sessionHref: (id: string) => string;
};

export default function SessionMonthGroups({ rows, sessionHref }: Props) {
  const groups = new Map<string, Row[]>();
  rows.forEach((row) => {
    const key = sessionMonthKey(row.session.played_at);
    groups.set(key, [...(groups.get(key) ?? []), row]);
  });

  return [...groups.values()].map((monthRows) => {
    const availableNets = monthRows
      .map((row) => row.yourNetCents)
      .filter((net): net is number => net !== null);
    const monthNet = availableNets.reduce((sum, net) => sum + net, 0);

    return (
      <section key={sessionMonthKey(monthRows[0]!.session.played_at)}>
        <div className="sticky top-0 z-[3] flex min-h-9 items-center justify-between gap-4 border-y border-card-100 bg-card-50/95 px-2.5 py-2 backdrop-blur-sm">
          <span className="text-[10px] font-semibold tracking-[0.13em] text-ink-500 uppercase">
            {sessionMonthLabel(monthRows[0]!.session.played_at)}
          </span>
          <span className="tabular text-xs text-ink-500">
            {monthRows.length} {monthRows.length === 1 ? "night" : "nights"}
            {" · you "}
            {availableNets.length === 0 ? (
              "—"
            ) : (
              <span className={moneyToneClass(monthNet)}>
                {formatSignedCents(monthNet)}
              </span>
            )}
          </span>
        </div>
        <div className="divide-y divide-card-100">
          {monthRows.map((row) => (
            <SessionLedgerRow
              key={row.session.id}
              row={row}
              href={sessionHref(row.session.id)}
            />
          ))}
        </div>
      </section>
    );
  });
}
