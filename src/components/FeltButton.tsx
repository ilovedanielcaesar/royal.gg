import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Link } from "react-router-dom";

type Variant = "primary" | "ghost";

type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className"> & {
  variant?: Variant;
  /** Render as a router link rather than a button. Button-only attributes
   *  are dropped in that case — a navigation is not a button. */
  to?: string;
  className?: string;
  children: ReactNode;
};

/**
 * A page action, sitting on the felt.
 *
 * Distinct from `Button`, which lives inside a cream sheet or card and is
 * styled for ink on cream. This one is styled for cream on felt and is bigger
 * — it is the `Settings` / `+ New session` class of control, and it only ever
 * appears in a `PageHeading`.
 */
const BASE =
  "inline-flex min-h-10 items-center justify-center rounded-[11px] px-4 text-[13px] font-semibold " +
  "transition-[transform,background] duration-150 hover:-translate-y-px " +
  "motion-reduce:hover:translate-y-0 disabled:pointer-events-none disabled:opacity-50";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-card-50 text-ink-900 shadow-[0_2px_0_rgba(0,0,0,0.22)]",
  ghost:
    "bg-card-50/[0.08] text-card-50 shadow-[inset_0_0_0_1px_rgba(247,241,222,0.14)]",
};

export default function FeltButton({
  variant = "primary",
  to,
  className = "",
  children,
  "aria-label": ariaLabel,
  ...rest
}: Props) {
  const classes = [BASE, VARIANTS[variant], className].join(" ");

  if (to) {
    return (
      <Link to={to} className={classes} aria-label={ariaLabel}>
        {children}
      </Link>
    );
  }

  return (
    <button {...rest} aria-label={ariaLabel} className={classes}>
      {children}
    </button>
  );
}
