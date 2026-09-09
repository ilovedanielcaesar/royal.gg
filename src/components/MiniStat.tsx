import type { ReactNode } from "react";

type Props = {
  label: string;
  value: ReactNode;
  caption?: ReactNode;
  toneClass?: string;
};

/**
 * A secondary figure, subordinate to a `StatFigure`. Same typographic family,
 * a third of the size, so a row of them reads as a group rather than as three
 * competing headlines.
 */
export default function MiniStat({
  label,
  value,
  caption,
  toneClass = "text-ink-900",
}: Props) {
  return (
    <div>
      <p className="text-[10px] font-semibold tracking-[0.13em] text-ink-500 uppercase">
        {label}
      </p>
      <p className={`tabular mt-0.5 font-display text-[22px] ${toneClass}`}>
        {value}
      </p>
      {caption && <p className="text-xs text-ink-500">{caption}</p>}
    </div>
  );
}
