import MiniStat from "../../components/MiniStat";
import type { SessionFilter } from "./useSessionsData";

type Props = {
  label: string;
  value: number;
  caption: string;
  filter: SessionFilter;
  active: boolean;
  onFilter: (filter: SessionFilter) => void;
  className?: string;
};

export default function SummaryStatFilter({
  label,
  value,
  caption,
  filter,
  active,
  onFilter,
  className = "",
}: Props) {
  return (
    <div className={`border-l border-card-100 pl-4 sm:pl-6 ${className}`}>
      <button
        type="button"
        aria-pressed={active}
        onClick={() => onFilter(filter)}
        className="min-h-9 w-full rounded-md text-left transition hover:opacity-75"
      >
        <MiniStat
          label={label}
          value={value}
          caption={caption}
          size="lg"
        />
      </button>
    </div>
  );
}
