type Props = {
  label: string;
  value: string;
  tone?: "neutral" | "sage" | "crimson" | "gold";
};

export default function SessionReconciliationStat({
  label,
  value,
  tone = "neutral",
}: Props) {
  const toneClass = {
    neutral: "text-ink-900",
    sage: "text-sage-600",
    crimson: "text-crimson-600",
    gold: "text-gold-500",
  }[tone];
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-ink-500">
        {label}
      </div>
      <div className={`tabular mt-0.5 font-display text-2xl ${toneClass}`}>
        {value}
      </div>
    </div>
  );
}
