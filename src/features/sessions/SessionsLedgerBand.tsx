import { useMemo, useState } from "react";
import Band from "../../components/Band";
import SessionLedgerControls from "./SessionLedgerControls";
import SessionLedgerRow from "./SessionLedgerRow";
import SessionMonthGroups from "./SessionMonthGroups";
import {
  compareSessionRows,
  matchesSessionFilter,
} from "./sessionLedger";
import type {
  SessionFilter,
  SessionLedgerRow as Row,
  SessionSort,
  SessionsSummary,
} from "./useSessionsData";

type Props = {
  rows: Row[];
  counts: SessionsSummary;
  activeFilter: SessionFilter;
  onFilter: (filter: SessionFilter) => void;
  sessionHref: (id: string) => string;
};

export default function SessionsLedgerBand({
  rows,
  counts,
  activeFilter,
  onFilter,
  sessionHref,
}: Props) {
  const [sort, setSort] = useState<SessionSort>("latest");
  const visibleRows = useMemo(
    () =>
      rows
        .filter((row) => matchesSessionFilter(row, activeFilter))
        .sort((a, b) => compareSessionRows(a, b, sort)),
    [activeFilter, rows, sort]
  );
  const chronological = sort === "latest" || sort === "oldest";

  return (
    <Band
      title="The ledger"
      caption={`${visibleRows.length} ${visibleRows.length === 1 ? "session" : "sessions"}`}
      action={
        <SessionLedgerControls
          sort={sort}
          onSort={setSort}
          activeFilter={activeFilter}
          onFilter={onFilter}
          counts={counts}
        />
      }
    >
      <div className="mt-5">
        <div
          aria-hidden="true"
          className="grid grid-cols-[54px_minmax(130px,1fr)_90px] gap-x-2 px-2.5 pb-2 text-[9.5px] font-semibold tracking-[0.09em] text-ink-500 uppercase min-[481px]:grid-cols-[54px_minmax(130px,1fr)_120px_90px] min-[721px]:grid-cols-[62px_minmax(180px,2fr)_minmax(140px,1.2fr)_130px_80px_110px] min-[721px]:gap-x-3.5"
        >
          <span>Date</span>
          <span>Night</span>
          <span className="hidden min-[721px]:block">Players</span>
          <span className="hidden text-center min-[481px]:block">State</span>
          <span className="hidden text-right min-[721px]:block">Action score</span>
          <span className="text-right">Your net</span>
        </div>

        {visibleRows.length === 0 ? (
          <p className="px-2.5 py-8 text-center text-sm text-ink-500">
            No sessions match this filter view.
          </p>
        ) : chronological ? (
          <SessionMonthGroups rows={visibleRows} sessionHref={sessionHref} />
        ) : (
          <div className="divide-y divide-card-100">
            {visibleRows.map((row) => (
              <SessionLedgerRow
                key={row.session.id}
                row={row}
                href={sessionHref(row.session.id)}
              />
            ))}
          </div>
        )}
      </div>
    </Band>
  );
}
