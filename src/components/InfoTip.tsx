import { useId, useState, type ReactNode } from "react";

type Props = {
  /** What the figure means. One or two sentences — this is not documentation. */
  children: ReactNode;
  /** Names the figure for a reader, e.g. "About rebuy success rate". */
  label: string;
};

/**
 * A small ⓘ beside a figure whose definition is not self-evident.
 *
 * Hover is NOT the only trigger, deliberately. This app is used on a phone at
 * the table, and a phone has no hover — a tooltip that only appears on
 * mouseover is invisible to every reader who most needs it. So it opens on
 * hover, on focus and on click, and the click state persists until dismissed,
 * which is the only one of the three a thumb can drive.
 *
 * It is a `<button>` rather than a styled `<span>` for the same reason: a
 * button is reachable by keyboard and announced as interactive. `aria-expanded`
 * carries the open state, and the bubble is tied to it by id.
 */
export default function InfoTip({ children, label }: Props) {
  const tipId = useId();
  const [pinned, setPinned] = useState(false);
  const [hovered, setHovered] = useState(false);
  const open = pinned || hovered;

  return (
    <span className="relative inline-flex align-middle">
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-describedby={open ? tipId : undefined}
        onClick={() => setPinned((was) => !was)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onFocus={() => setHovered(true)}
        onBlur={() => {
          setHovered(false);
          setPinned(false);
        }}
        className={[
          "flex h-[15px] w-[15px] items-center justify-center rounded-full",
          "text-[10px] font-semibold transition",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-ink",
          open
            ? "bg-ink-900 text-card-50"
            : "bg-card-200 text-ink-500 hover:bg-ink-900 hover:text-card-50",
        ].join(" ")}
      >
        i
      </button>
      {open && (
        <span
          id={tipId}
          role="tooltip"
          // Above rather than below: these sit in a grid of stats, and a
          // bubble opening downwards covers the next row of figures.
          className={[
            "absolute bottom-full left-1/2 z-20 mb-2 w-56 -translate-x-1/2",
            "rounded-lg bg-ink-900 px-3 py-2 text-[11px] leading-[1.45] font-normal",
            "text-card-50 normal-case shadow-[0_12px_28px_-10px_rgba(0,0,0,0.55)]",
          ].join(" ")}
        >
          {children}
        </span>
      )}
    </span>
  );
}
