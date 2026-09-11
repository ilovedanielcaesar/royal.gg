import { useEffect, useRef } from "react";
import {
  WEEKDAY_INITIALS,
  fromIsoDate,
  fullIsoDate,
  monthGrid,
  monthTitle,
  shiftIsoDate,
  shiftIsoMonth,
} from "../lib/calendar";

type Props = {
  /** The roving cursor's date. Also decides which month is drawn. */
  cursor: string;
  /** The selected date. */
  value: string;
  max?: string;
  onCursorChange: (iso: string) => void;
  onPick: (iso: string) => void;
  onClose: () => void;
};

/**
 * The month grid `DatePicker` opens. Split out because the two do different
 * jobs — the trigger owns open/closed and focus return, this owns the grid.
 *
 * The focused cell is whichever one the cursor is on, so the browser's own
 * focus ring IS the cursor and there is nothing to keep in sync. That is also
 * why exactly one cell is ever `tabIndex={0}`: a month of 31 tab stops
 * between the date field and the next one is how a keyboard user learns to
 * avoid a form.
 */
export default function CalendarPopover({
  cursor,
  value,
  max,
  onCursorChange,
  onPick,
  onClose,
}: Props) {
  const gridRef = useRef<HTMLDivElement>(null);
  const { year, month } = fromIsoDate(cursor);
  const cells = monthGrid(year, month);
  // en-CA is YYYY-MM-DD in local time, which is what played_at is.
  const todayIso = new Date().toLocaleDateString("en-CA");

  useEffect(() => {
    gridRef.current
      ?.querySelector<HTMLButtonElement>('[data-cursor="true"]')
      ?.focus();
  }, [cursor]);

  function onKeyDown(event: React.KeyboardEvent) {
    const moves: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -7,
      ArrowDown: 7,
    };
    if (event.key in moves) {
      event.preventDefault();
      onCursorChange(shiftIsoDate(cursor, moves[event.key]));
    } else if (event.key === "PageUp" || event.key === "PageDown") {
      event.preventDefault();
      onCursorChange(shiftIsoMonth(cursor, event.key === "PageUp" ? -1 : 1));
    } else if (event.key === "Escape") {
      event.preventDefault();
      onClose();
    }
  }

  return (
    <div
      role="dialog"
      aria-label="Select session date"
      className="absolute z-50 mt-1.5 w-[280px] rounded-xl bg-card-50 p-3.5 shadow-[0_0_0_1px_var(--color-card-200),0_16px_36px_-12px_rgba(0,0,0,0.5)]"
    >
      <div className="mb-2.5 flex items-center justify-between">
        <CalNav
          label="Previous month"
          glyph="‹"
          onClick={() => onCursorChange(shiftIsoMonth(cursor, -1))}
        />
        <span className="font-display text-sm">{monthTitle(year, month)}</span>
        <CalNav
          label="Next month"
          glyph="›"
          onClick={() => onCursorChange(shiftIsoMonth(cursor, 1))}
        />
      </div>

      <div
        aria-hidden="true"
        className="mb-1 grid grid-cols-7 gap-0.5 text-center text-[10px] font-semibold text-ink-500"
      >
        {WEEKDAY_INITIALS.map((initial) => (
          <span key={initial}>{initial}</span>
        ))}
      </div>

      <div
        ref={gridRef}
        role="grid"
        aria-label={monthTitle(year, month)}
        onKeyDown={onKeyDown}
        className="grid grid-cols-7 gap-[3px]"
      >
        {cells.map((cell, index) => {
          if (!cell.iso) return <span key={`pad-${index}`} />;
          const iso = cell.iso;
          const selected = iso === value;
          const blocked = max !== undefined && iso > max;
          return (
            <button
              key={iso}
              type="button"
              role="gridcell"
              aria-selected={selected}
              aria-label={fullIsoDate(iso)}
              data-cursor={iso === cursor}
              tabIndex={iso === cursor ? 0 : -1}
              disabled={blocked}
              onClick={() => onPick(iso)}
              className={[
                "flex aspect-square items-center justify-center rounded-[5px] text-[11px] font-medium transition",
                selected
                  ? "bg-sage-600 font-bold text-card-50"
                  : "text-ink-900 hover:bg-card-100",
                iso === todayIso && !selected
                  ? "shadow-[inset_0_0_0_1.5px_var(--color-gold-500)]"
                  : "",
                blocked
                  ? "cursor-not-allowed text-card-200 hover:bg-transparent"
                  : "",
              ].join(" ")}
            >
              {cell.day}
            </button>
          );
        })}
      </div>

      <div className="mt-2.5 flex items-center justify-between border-t border-card-100 pt-2 text-[10px] text-ink-500">
        <span>Arrows move · Enter picks</span>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md px-2 py-1 font-medium text-ink-700 hover:bg-card-100"
        >
          Close
        </button>
      </div>
    </div>
  );
}

function CalNav({
  label,
  glyph,
  onClick,
}: {
  label: string;
  glyph: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="flex h-7 w-7 items-center justify-center rounded-md bg-card-100 font-bold text-ink-900 transition hover:bg-card-200"
    >
      {glyph}
    </button>
  );
}
