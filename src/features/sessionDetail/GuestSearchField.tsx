import { useState } from "react";
import type { SessionFormPlayer } from "../../lib/sessionForm";

type Props = {
  /** Every guest the group has ever logged, seated or not. */
  guests: SessionFormPlayer[];
  /** Guests already at the table — suggested, but shown as seated. */
  seatedIds: Set<string>;
  onSeat: (guest: SessionFormPlayer) => void;
  onCreate: (name: string) => void;
  /** Creating a new guest row is admin-only at the database (players RLS). */
  canCreate: boolean;
  busy?: boolean;
};

/**
 * The only way a guest reaches the table.
 *
 * Typing matches against guests the group has seen before; a name that
 * matches nothing offers to create one. That split is the point — a regular
 * guest should not become a second row every time they visit, and the
 * suggestion list is what stops it.
 */
export default function GuestSearchField({
  guests,
  seatedIds,
  onSeat,
  onCreate,
  canCreate,
  busy = false,
}: Props) {
  const [query, setQuery] = useState("");
  const trimmed = query.trim();

  const matches = trimmed
    ? guests.filter((guest) =>
        (guest.display_name ?? guest.name)
          .toLowerCase()
          .includes(trimmed.toLowerCase())
      )
    : [];
  const exact = guests.some(
    (guest) =>
      (guest.display_name ?? guest.name).toLowerCase() === trimmed.toLowerCase()
  );

  function seat(guest: SessionFormPlayer) {
    setQuery("");
    onSeat(guest);
  }

  function create() {
    setQuery("");
    onCreate(trimmed);
  }

  return (
    <div className="relative mt-3.5">
      <label
        htmlFor="guest-search"
        className="text-[10px] font-semibold tracking-[0.13em] text-ink-500 uppercase"
      >
        Add a guest
      </label>
      <input
        id="guest-search"
        type="text"
        value={query}
        autoComplete="off"
        disabled={busy}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Start typing a name"
        className="mt-1 min-h-10 w-full rounded-[9px] bg-card-50 px-3 text-[12.5px] text-ink-900 ring-1 ring-card-200 outline-none transition focus:ring-gold-ink disabled:opacity-60"
      />

      {trimmed !== "" && (
        <div className="absolute top-full right-0 left-0 z-40 mt-1 rounded-[9px] bg-card-50 p-1.5 shadow-[0_0_0_1px_var(--color-card-200),0_12px_28px_-8px_rgba(0,0,0,0.35)]">
          {matches.map((guest) => {
            const seated = seatedIds.has(guest.id);
            return (
              <button
                key={guest.id}
                type="button"
                disabled={seated}
                onClick={() => seat(guest)}
                className="flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left text-xs text-ink-900 transition hover:bg-card-100 disabled:opacity-50 disabled:hover:bg-transparent"
              >
                <span>{guest.display_name ?? guest.name}</span>
                <span className="text-ink-500">
                  {seated ? "already at the table" : "guest"}
                </span>
              </button>
            );
          })}

          {!exact &&
            (canCreate ? (
              <button
                type="button"
                onClick={create}
                className="flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left text-xs text-ink-900 transition hover:bg-card-100"
              >
                <span>Add “{trimmed}” as a new guest</span>
                <span className="text-ink-500">new</span>
              </button>
            ) : (
              <p className="px-2.5 py-2 text-xs text-ink-500">
                No guest by that name. Only an admin can add a new one.
              </p>
            ))}
        </div>
      )}
    </div>
  );
}
