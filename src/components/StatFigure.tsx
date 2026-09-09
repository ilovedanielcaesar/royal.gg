import type { ReactNode } from "react";

type Props = {
  /** The figure itself. Pre-formatted — this does no money formatting. */
  value: ReactNode;
  /** Set small in `ink-500` immediately after the value, e.g. `/10`. */
  suffix?: ReactNode;
  label: string;
  /** Muted line under the label — the caveat, not a second label. */
  caption?: ReactNode;
  /** Defaults to `ink-900`. Pass a money tone only for actual money. */
  toneClass?: string;
};

/**
 * The one display-scale figure on a page — the headline a band is built
 * around.
 *
 * Defaults to `ink-900` on purpose. Sage and crimson mean won and lost, so a
 * rating or a count tinted sage reads as a dollar amount; only money passes a
 * `toneClass`.
 */
export default function StatFigure({
  value,
  suffix,
  label,
  caption,
  toneClass = "text-ink-900",
}: Props) {
  return (
    <div>
      <p className="text-[10px] font-semibold tracking-[0.13em] text-ink-500 uppercase">
        {label}
      </p>
      <p className="mt-1 flex items-baseline gap-1">
        <span
          className={`tabular font-display text-[52px] leading-none ${toneClass}`}
        >
          {value}
        </span>
        {suffix && (
          <span className="text-lg leading-none text-ink-500">{suffix}</span>
        )}
      </p>
      {caption && <p className="mt-2 text-xs text-ink-500">{caption}</p>}
    </div>
  );
}
