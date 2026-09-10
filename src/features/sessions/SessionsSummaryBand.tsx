import Band from "../../components/Band";
import MiniStat from "../../components/MiniStat";
import { formatCents } from "../../lib/money";
import SummaryStatFilter from "./SummaryStatFilter";
import type { SessionFilter, SessionsSummary } from "./useSessionsData";

type Props = {
  summary: SessionsSummary;
  activeFilter: SessionFilter;
  onFilter: (filter: SessionFilter) => void;
};

export default function SessionsSummaryBand({
  summary,
  activeFilter,
  onFilter,
}: Props) {
  return (
    <Band className="py-7">
      <div className="grid grid-cols-2 gap-y-5 sm:grid-cols-4 sm:gap-y-0">
        <div className="pr-4 sm:pr-6">
          <MiniStat
            label="Nights logged"
            value={summary.nights}
            caption={summary.dateRange}
            size="lg"
          />
        </div>
        <SummaryStatFilter
          label="Reconciled"
          value={summary.reconciled}
          caption={`Auto-balanced to ${formatCents(0)}`}
          filter="reconciled"
          active={activeFilter === "reconciled"}
          onFilter={onFilter}
        />
        <SummaryStatFilter
          label="Drafted and balanced"
          value={summary.drafted}
          caption="Pending approval"
          filter="draft"
          active={activeFilter === "draft"}
          onFilter={onFilter}
          className="border-t border-card-100 pt-5 sm:border-t-0 sm:pt-0"
        />
        <SummaryStatFilter
          label="Needs review"
          value={summary.review}
          caption="Flagged records"
          filter="review"
          active={activeFilter === "review"}
          onFilter={onFilter}
          className="border-t border-card-100 pt-5 sm:border-t-0 sm:pt-0"
        />
      </div>
    </Band>
  );
}
