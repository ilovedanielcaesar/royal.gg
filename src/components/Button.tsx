import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "subtle" | "danger";
type Size = "sm" | "md";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
};

/**
 * `ghost` is FELT-ONLY. Its text is `card-50`, so on a cream sheet it is cream
 * on cream and invisible; both of its call sites are page-level, on the felt,
 * which is correct. The quiet button for the inside of a sheet is `subtle`.
 * (`FeltButton` is the felt-level *page action* — bigger, and only ever in a
 * `PageHeading`.)
 */
const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-card-50 text-ink-900 ring-1 ring-card-200 hover:bg-card-100 active:translate-y-px shadow-[0_2px_0_0_rgba(0,0,0,0.25)]",
  secondary:
    "bg-felt-700 text-card-50 ring-1 ring-felt-600 hover:bg-felt-600 active:translate-y-px",
  ghost:
    "bg-transparent text-card-50 ring-1 ring-card-50/20 hover:bg-card-50/10",
  subtle:
    "bg-card-100 text-ink-700 ring-1 ring-card-200 hover:bg-card-200/60 hover:text-ink-900",
  danger:
    "bg-crimson-600 text-card-50 ring-1 ring-crimson-700 hover:bg-crimson-500 active:translate-y-px shadow-[0_2px_0_0_rgba(0,0,0,0.3)]",
};

const SIZES: Record<Size, string> = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-4 py-2 text-sm",
};

export default function Button({
  variant = "primary",
  size = "md",
  className = "",
  children,
  ...rest
}: Props) {
  return (
    <button
      {...rest}
      className={[
        "inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition disabled:opacity-50 disabled:pointer-events-none",
        VARIANTS[variant],
        SIZES[size],
        className,
      ].join(" ")}
    >
      {children}
    </button>
  );
}
