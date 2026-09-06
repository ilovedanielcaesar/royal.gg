import Card from "./Card";
import { formatPlayedAt } from "../lib/format";

type Props = {
  canEdit: boolean;
  playedAt: string;
  notes: string;
  onPlayedAtChange: (value: string) => void;
  onNotesChange: (value: string) => void;
};

export default function SessionDetailsCard({
  canEdit,
  playedAt,
  notes,
  onPlayedAtChange,
  onNotesChange,
}: Props) {
  return (
    <Card>
      <div className="grid gap-4 p-5 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-wide text-ink-500">
            Date
          </span>
          {canEdit ? (
            <input
              type="date"
              value={playedAt}
              onChange={(event) => onPlayedAtChange(event.target.value)}
              required
              className="rounded-md bg-card-50 px-3 py-2 text-sm text-ink-900 ring-1 ring-card-200 focus:outline-none focus:ring-2 focus:ring-gold-500"
            />
          ) : (
            <p className="py-2 text-sm text-ink-900">
              {formatPlayedAt(playedAt)}
            </p>
          )}
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-wide text-ink-500">
            Notes
          </span>
          {canEdit ? (
            <input
              value={notes}
              onChange={(event) => onNotesChange(event.target.value)}
              className="rounded-md bg-card-50 px-3 py-2 text-sm text-ink-900 ring-1 ring-card-200 focus:outline-none focus:ring-2 focus:ring-gold-500"
              placeholder="e.g. Daniel's place"
            />
          ) : (
            <p className="py-2 text-sm text-ink-900">{notes || "—"}</p>
          )}
        </div>
      </div>
    </Card>
  );
}
