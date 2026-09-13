import type { InputHTMLAttributes } from "react";

type Props = InputHTMLAttributes<HTMLInputElement>;

/**
 * The one text input in the app.
 *
 * It exists because there were two of them. The older shape (`border
 * border-card-200 focus:border-sage-600 focus:outline-none`) killed the focus
 * outline and replaced it with a border tint, so keyboard focus was invisible
 * — and it used sage, which means money won. The newer shape kept a ring but
 * hardcoded `focus:ring-gold-500`, which is the exact pairing `index.css`
 * swaps away from on cream: gold-500 on card-50 is ~2.1:1.
 *
 * So this sets no focus styling at all. The global `:focus-visible` rule in
 * `index.css` already draws a gold ring, and `[data-cream] :focus-visible`
 * already swaps it to `gold-ink` (5.4:1) on any surface inside a `Sheet` or
 * `Card`. Letting it through is both less code and the only version that is
 * readable on both surfaces.
 */
export default function TextInput({ className = "", ...rest }: Props) {
  return (
    <input
      {...rest}
      className={[
        "w-full rounded-md bg-card-50 px-3 py-2 text-sm text-ink-900",
        "ring-1 ring-card-200 placeholder:text-ink-500/70",
        "disabled:opacity-60",
        className,
      ].join(" ")}
    />
  );
}
