import { useState } from "react";
import Button from "./Button";

type Props = {
  /** The resting label, e.g. "Revert". */
  label: string;
  /** The armed label. Says what will happen, not "OK". */
  confirmLabel: string;
  /** Shown beside the armed buttons — the consequence, in one line. */
  consequence?: string;
  onConfirm: () => void;
  busy?: boolean;
  busyLabel?: string;
  /** Hover text for the resting button, including why it is disabled. */
  title?: string;
  /** Another row of the same list is mid-action. Arming is pointless while
   *  the handler would refuse, and a confirm click that silently no-ops is
   *  worse than a disabled button. */
  disabled?: boolean;
  size?: "sm" | "md";
};

/**
 * A destructive action that takes two clicks, in place.
 *
 * Deliberately not `window.confirm()`. The native dialog is the one piece of
 * chrome the redesign cannot style, it reads as a browser error rather than
 * as part of the table, and its message is the only place the consequence
 * gets explained — so on a phone it is a grey box quoting a sentence nobody
 * reads. Arming in place keeps the consequence next to the button that causes
 * it.
 *
 * Arming is per-button state, so two of these on one page cannot both be hot
 * at once by accident — each one disarms itself on cancel and on confirm.
 */
export default function ConfirmButton({
  label,
  confirmLabel,
  consequence,
  onConfirm,
  busy = false,
  busyLabel,
  title,
  disabled = false,
  size = "sm",
}: Props) {
  const [armed, setArmed] = useState(false);

  if (armed && disabled) setArmed(false);

  if (busy) {
    return (
      <Button variant="danger" size={size} disabled>
        {busyLabel ?? "Working…"}
      </Button>
    );
  }

  if (!armed) {
    return (
      <Button
        variant="danger"
        size={size}
        disabled={disabled}
        title={title}
        onClick={() => setArmed(true)}
      >
        {label}
      </Button>
    );
  }

  return (
    <span className="inline-flex flex-wrap items-center justify-end gap-2">
      {consequence && (
        <span className="text-xs text-ink-500">{consequence}</span>
      )}
      <Button
        variant="danger"
        size={size}
        disabled={disabled}
        onClick={() => {
          setArmed(false);
          onConfirm();
        }}
      >
        {confirmLabel}
      </Button>
      {/* `subtle`, not `ghost` — ghost is cream-on-cream inside a sheet. */}
      <Button variant="subtle" size={size} onClick={() => setArmed(false)}>
        Cancel
      </Button>
    </span>
  );
}
