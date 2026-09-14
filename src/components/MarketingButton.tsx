import type { ReactNode } from "react";
import { Link } from "react-router-dom";

type Variant = "primary" | "ghost";
type Size = "md" | "lg" | "xl";

type Props = {
  /** A route (`/signup`) or an in-page anchor (`#log`). */
  to: string;
  variant?: Variant;
  size?: Size;
  children: ReactNode;
};

/**
 * The landing page's own call to action.
 *
 * `FeltButton` is the app's felt-level action and this is deliberately not it:
 * a marketing page needs the same control at three sizes, and overriding
 * `FeltButton`'s height and padding from a `className` is a coin toss over
 * which utility wins. One component that owns its scale beats two that argue.
 */
const BASE =
  "inline-flex items-center justify-center rounded-[11px] font-semibold " +
  "transition-[transform,background] duration-150 hover:-translate-y-px " +
  "motion-reduce:hover:translate-y-0";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-card-50 text-ink-900 shadow-[0_2px_0_rgba(0,0,0,0.28)]",
  ghost:
    "bg-card-50/[0.06] text-card-50 shadow-[inset_0_0_0_1px_rgba(247,241,222,0.2)]",
};

const SIZES: Record<Size, string> = {
  md: "min-h-[38px] px-4 text-[13px]",
  lg: "min-h-[52px] rounded-xl px-7 text-[15px]",
  xl: "min-h-[60px] rounded-[14px] px-14 text-[17px] shadow-[0_4px_0_rgba(0,0,0,0.32)]",
};

export default function MarketingButton({
  to,
  variant = "primary",
  size = "md",
  children,
}: Props) {
  const classes = [BASE, VARIANTS[variant], SIZES[size]].join(" ");

  // An in-page anchor is the browser's job, not the router's — handing `#log`
  // to `Link` makes it a navigation to `/#log` and loses the native scroll.
  if (to.startsWith("#")) {
    return (
      <a href={to} className={classes}>
        {children}
      </a>
    );
  }

  return (
    <Link to={to} className={classes}>
      {children}
    </Link>
  );
}
