type Props = {
  status: string;
  reconciled?: boolean;
  needsReview?: boolean;
  className?: string;
};

const STATUS_DETAILS: Record<string, { label: string; colors: string }> = {
  draft: {
    label: "Draft",
    colors: "bg-card-200/50 text-ink-500",
  },
  approved: {
    label: "Approved",
    colors: "bg-sage-600/15 text-sage-700",
  },
};

export default function SessionStatusBadge({
  status,
  reconciled,
  needsReview,
  className = "",
}: Props) {
  const details = sessionStateDetails(status, reconciled, needsReview);

  return (
    <span
      className={`inline-flex w-max items-center justify-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold ${details.colors} ${className}`}
    >
      {details.label}
    </span>
  );
}

function sessionStateDetails(
  status: string,
  reconciled?: boolean,
  needsReview?: boolean
): { label: string; colors: string } {
  if (needsReview) {
    return {
      label: "Needs review",
      colors: "bg-crimson-600/10 text-crimson-700",
    };
  }
  if (needsReview === false && status !== "approved") {
    return {
      label: "Drafted and balanced",
      colors: "bg-gold-500/20 text-gold-ink",
    };
  }
  if (reconciled) {
    return {
      label: "Reconciled",
      colors: "bg-sage-600/15 text-sage-700",
    };
  }
  return STATUS_DETAILS[status] ?? STATUS_DETAILS.draft;
}
