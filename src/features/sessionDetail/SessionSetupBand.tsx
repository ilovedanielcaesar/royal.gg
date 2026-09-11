import Band from "../../components/Band";
import DatePicker from "../../components/DatePicker";
import { todayIsoDate } from "../../lib/format";
import type { SessionFormPlayer } from "../../lib/sessionForm";
import GuestSearchField from "./GuestSearchField";
import TableMembersPicker from "./TableMembersPicker";

type Props = {
  playedAt: string;
  onPlayedAtChange: (iso: string) => void;
  notes: string;
  onNotesChange: (notes: string) => void;
  /** The whole roster. Split here, because only this band cares how. */
  roster: SessionFormPlayer[];
  selectedIds: Set<string>;
  onToggleMember: (playerId: string) => void;
  onSeatGuest: (guest: SessionFormPlayer) => void;
  onCreateGuest: (name: string) => void;
  canCreateGuest: boolean;
  busy: boolean;
};

export default function SessionSetupBand({
  playedAt,
  onPlayedAtChange,
  notes,
  onNotesChange,
  roster,
  selectedIds,
  onToggleMember,
  onSeatGuest,
  onCreateGuest,
  canCreateGuest,
  busy,
}: Props) {
  const active = roster.filter((player) => player.status === "active");
  const members = active.filter((player) => !player.is_guest);
  const guests = active.filter((player) => player.is_guest);

  return (
    <Band
      title="The night"
      caption="When it was played, and who sat down. Everything below follows from this."
    >
      <div className="mt-4 grid gap-5 min-[861px]:grid-cols-2 min-[861px]:gap-8">
        <div>
          <label
            htmlFor="session-date"
            className="text-[10px] font-semibold tracking-[0.13em] text-ink-500 uppercase"
          >
            Date of session
          </label>
          <div className="mt-1">
            <DatePicker
              id="session-date"
              value={playedAt}
              onChange={onPlayedAtChange}
              max={todayIsoDate()}
            />
          </div>

          <GuestSearchField
            guests={guests}
            seatedIds={selectedIds}
            onSeat={onSeatGuest}
            onCreate={onCreateGuest}
            canCreate={canCreateGuest}
            busy={busy}
          />

          <label
            htmlFor="session-notes"
            className="mt-3.5 block text-[10px] font-semibold tracking-[0.13em] text-ink-500 uppercase"
          >
            Notes
          </label>
          <textarea
            id="session-notes"
            value={notes}
            rows={2}
            onChange={(event) => onNotesChange(event.target.value)}
            placeholder="Anything worth remembering about the night."
            className="mt-1 w-full rounded-[9px] bg-card-50 px-3 py-2 text-[12.5px] text-ink-900 ring-1 ring-card-200 outline-none transition focus:ring-gold-ink"
          />
        </div>

        <div>
          <span className="text-[10px] font-semibold tracking-[0.13em] text-ink-500 uppercase">
            Who's at the table
          </span>
          <TableMembersPicker
            members={members}
            selectedIds={selectedIds}
            onToggle={onToggleMember}
          />
          <p className="mt-2.5 text-xs text-ink-500">
            Registered members only. Adding one seats them with a single
            buy-in in and the same value out, so the discrepancy starts at
            $0.00. Guests come in through the field on the left.
          </p>
        </div>
      </div>
    </Band>
  );
}
