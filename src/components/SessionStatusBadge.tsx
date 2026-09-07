type Props = {
  status: string;
  className?: string;
};

const STATUS_DETAILS: Record<string, { label: string; colors: string }> = {
  draft: {
    label: "Draft",
    colors: "bg-card-200/50 text-ink-500",
  },
  submitted: {
    label: "Waiting on admin",
    colors: "bg-gold-500/15 text-gold-700",
  },
  approved: {
    label: "Approved",
    colors: "bg-sage-600/15 text-sage-700",
  },
};

export default function SessionStatusBadge({ status, className = "" }: Props) {
  const details = STATUS_DETAILS[status] ?? STATUS_DETAILS.draft;

  return (
    <div
      className={`inline-flex w-max items-center gap-1 rounded-full px-2 py-0.5 text-xs ${details.colors} ${className}`}
    >
      {details.label}
    </div>
  );
}
