import {
  countForSessionFilter,
  SESSION_FILTERS,
} from "./sessionLedger";
import type {
  SessionFilter,
  SessionSort,
  SessionsSummary,
} from "./useSessionsData";

type Props = {
  sort: SessionSort;
  onSort: (sort: SessionSort) => void;
  activeFilter: SessionFilter;
  onFilter: (filter: SessionFilter) => void;
  counts: SessionsSummary;
};

export default function SessionLedgerControls({
  sort,
  onSort,
  activeFilter,
  onFilter,
  counts,
}: Props) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <label className="flex items-center gap-2 text-xs font-medium text-ink-500">
        Sort by
        <select
          value={sort}
          onChange={(event) => onSort(event.target.value as SessionSort)}
          className="min-h-9 rounded-[9px] border border-card-200 bg-card-50 px-3 text-xs font-semibold text-ink-900"
          aria-label="Sort sessions"
        >
          <option value="latest">Latest</option>
          <option value="oldest">Oldest</option>
          <option value="action">Highest action score</option>
          <option value="biggest-win">Individual highest win</option>
        </select>
      </label>

      <div
        className="flex flex-wrap gap-0.5 rounded-full bg-card-100 p-1"
        role="tablist"
        aria-label="Filter sessions"
      >
        {SESSION_FILTERS.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={activeFilter === value}
            onClick={() => onFilter(value)}
            className={`min-h-8 rounded-full px-3.5 text-xs font-medium transition ${
              activeFilter === value
                ? "bg-card-50 font-semibold text-ink-900 shadow-sm"
                : "text-ink-500 hover:text-ink-900"
            }`}
          >
            {label} {countForSessionFilter(counts, value)}
          </button>
        ))}
      </div>
    </div>
  );
}
