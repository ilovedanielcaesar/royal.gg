import type { ReactNode } from "react";

type Props = {
  label: ReactNode;
  /** Set after the label in `ink-500`, e.g. "(optional)". */
  optional?: boolean;
  /** The muted line UNDER the control — what the value means, not a repeat
   *  of the label. */
  hint?: ReactNode;
  /** The control itself: `TextInput`, `CurrencyInput`, a `select`, a group
   *  of radios. Anything a label can own. */
  children: ReactNode;
  className?: string;
};

/**
 * A labelled form control.
 *
 * A `<label>` wrapping its control rather than an `htmlFor`/`id` pair: the
 * children are arbitrary, so there is no id to point at without making every
 * caller invent one. Wrapping associates them with no id at all.
 *
 * The label/hint typography was copy-pasted across fourteen call sites before
 * this existed, and had drifted into three variants (`text-xs`, `text-[11px]`,
 * and one with no hint slot at all). It is one shape now.
 */
export default function Field({
  label,
  optional = false,
  hint,
  children,
  className = "",
}: Props) {
  return (
    <label className={`block ${className}`}>
      <span className="text-xs font-medium text-ink-700">
        {label}
        {optional && <span className="font-normal text-ink-500"> (optional)</span>}
      </span>
      <div className="mt-1">{children}</div>
      {hint && <span className="mt-1.5 block text-xs text-ink-500">{hint}</span>}
    </label>
  );
}
