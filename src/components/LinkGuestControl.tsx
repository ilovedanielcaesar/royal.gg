import { useState } from "react";
import {
  guestName,
  type LinkableGuest,
} from "../lib/membership";
import Button from "./Button";

type Props = {
  guests: LinkableGuest[];
  busy: boolean;
  locked: boolean;
  onLink: (guestId: string) => void;
};

export default function LinkGuestControl({
  guests,
  busy,
  locked,
  onLink,
}: Props) {
  const [chosenGuestId, setChosenGuestId] = useState("");
  const validGuestId = guests.some((guest) => guest.id === chosenGuestId)
    ? chosenGuestId
    : "";

  if (guests.length === 0) return null;

  return (
    <div className="flex flex-wrap items-end gap-2">
      <label>
        <span className="block text-xs font-medium text-ink-700">
          Already plays here as…
        </span>
        <select
          value={validGuestId}
          disabled={locked}
          onChange={(event) => setChosenGuestId(event.target.value)}
          className={[
            "mt-1 min-h-9 rounded-md bg-card-50 px-3 py-1.5 text-sm text-ink-900",
            "ring-1 ring-card-200",
            "disabled:pointer-events-none disabled:opacity-50",
          ].join(" ")}
        >
          <option value="">Choose a guest</option>
          {guests.map((guest) => (
            <option key={guest.id} value={guest.id}>
              {guestName(guest)}
            </option>
          ))}
        </select>
      </label>
      <Button
        type="button"
        size="sm"
        variant="secondary"
        disabled={locked || !validGuestId}
        onClick={() => onLink(validGuestId)}
      >
        {busy ? "Linking…" : "Link"}
      </Button>
    </div>
  );
}
