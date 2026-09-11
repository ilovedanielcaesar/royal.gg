import { useEffect, useRef, useState } from "react";
import { fullIsoDate } from "../lib/calendar";
import CalendarPopover from "./CalendarPopover";

type Props = {
  /** `YYYY-MM-DD`. */
  value: string;
  onChange: (iso: string) => void;
  /** The latest selectable day, inclusive. Later days are drawn disabled. */
  max?: string;
  disabled?: boolean;
  id?: string;
};

/**
 * A calendar drawn in the card language, because `<input type="date">` is not.
 *
 * The native control is the one field on this page the redesign cannot style:
 * it renders as the operating system's, not as cream on a sheet, and on a
 * phone it takes over the screen with a spinner nobody asked for. That is the
 * whole reason this exists — see `_FEEDBACK_V2.md`, Individual session page.
 *
 * The keyboard grid is a roving cursor, not a tab stop per day: arrows move
 * it, Enter and Space pick, Escape closes and returns focus to the trigger.
 * A month of 31 tab stops between the date and the next field is how a
 * keyboard user learns to avoid a form.
 */
export default function DatePicker({
  value,
  onChange,
  max,
  disabled = false,
  id,
}: Props) {
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(value);
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  function close() {
    setOpen(false);
    triggerRef.current?.focus();
  }

  function pick(iso: string) {
    onChange(iso);
    close();
  }

  return (
    <div ref={wrapRef} className="relative">
      <button
        ref={triggerRef}
        id={id}
        type="button"
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`Date of session, currently ${fullIsoDate(value)}`}
        onClick={() => {
          // The cursor resets here rather than in an effect on `open`:
          // reopening on a different month than the one holding the value
          // would be a small constant irritation, and CI's lint ratchet is
          // at zero, which rules out setState in an effect body.
          if (!open) setCursor(value);
          setOpen((was) => !was);
        }}
        className="flex min-h-11 w-full items-center justify-between rounded-[10px] bg-card-50 px-3.5 text-[13.5px] font-semibold text-ink-900 ring-1 ring-card-200 transition hover:bg-card-100 disabled:pointer-events-none disabled:opacity-60"
      >
        <span>{fullIsoDate(value)}</span>
        <span aria-hidden="true" className="text-ink-500">
          ▾
        </span>
      </button>

      {open && (
        <CalendarPopover
          cursor={cursor}
          value={value}
          max={max}
          onCursorChange={setCursor}
          onPick={pick}
          onClose={close}
        />
      )}
    </div>
  );
}
