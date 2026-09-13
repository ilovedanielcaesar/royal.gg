import { cloneElement, useId, type ReactElement, type ReactNode } from "react";

type DescribedControlProps = {
  "aria-describedby"?: string;
};

type Props = {
  label: ReactNode;
  /** Set after the label in `ink-500`, e.g. "(optional)". */
  optional?: boolean;
  /** The muted line UNDER the control — what the value means, not a repeat
   *  of the label. */
  hint?: ReactNode;
  /** The labelable control itself. A radio group needs a fieldset and legend. */
  children: ReactElement<DescribedControlProps>;
  className?: string;
};

/**
 * A labelled form control.
 *
 * A `<label>` wraps its control, while a hint sits beside the label and is
 * associated to the control with `aria-describedby`.
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
  const hintId = useId();
  const describedControl = hint
    ? cloneElement(children, {
        "aria-describedby": [children.props["aria-describedby"], hintId]
          .filter(Boolean)
          .join(" "),
      })
    : children;

  return (
    <div className={`block ${className}`}>
      <label className="block">
        <span className="text-xs font-medium text-ink-700">
          {label}
          {optional && (
            <span className="font-normal text-ink-500"> (optional)</span>
          )}
        </span>
        <div className="mt-1">{describedControl}</div>
      </label>
      {hint && (
        <span id={hintId} className="mt-1.5 block text-xs text-ink-500">
          {hint}
        </span>
      )}
    </div>
  );
}
