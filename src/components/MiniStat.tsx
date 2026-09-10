import type { ReactNode } from "react";

type Props = {
  /** `ReactNode` so a figure whose definition needs a word can carry an
   *  `InfoTip` beside its label. Plain strings are still the common case. */
  label: ReactNode;
  value: ReactNode;
  caption?: ReactNode;
  toneClass?: string;
  size?: "md" | "lg";
};

/**
 * A secondary figure, subordinate to a `StatFigure`. Same typographic family,
 * well under the display scale, so a row of them reads as a group rather than
 * as three competing headlines.
 *
 * `lg` is for the hero band, where the trio sits beside the one display-scale
 * figure on the page and `md` read too quiet next to it. Everywhere else keeps
 * `md`.
 */
export default function MiniStat({
  label,
  value,
  caption,
  toneClass = "text-ink-900",
  size = "md",
}: Props) {
  return (
    <div>
      <p
        className={`${
          size === "lg" ? "text-[11px]" : "text-[10px]"
        } font-semibold tracking-[0.13em] text-ink-500 uppercase`}
      >
        {label}
      </p>
      <p
        className={`tabular mt-0.5 font-display ${
          size === "lg" ? "text-[28px]" : "text-[22px]"
        } ${toneClass}`}
      >
        {value}
      </p>
      {caption && <p className="text-xs text-ink-500">{caption}</p>}
    </div>
  );
}
