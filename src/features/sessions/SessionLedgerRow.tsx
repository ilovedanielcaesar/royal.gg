import { Link } from "react-router-dom";
import SessionStatusBadge from "../../components/SessionStatusBadge";
import { formatSignedCents } from "../../lib/money";
import { moneyToneClass } from "../../lib/moneyTone";
import SessionDateCard from "./SessionDateCard";
import SessionPlayerAvatars from "./SessionPlayerAvatars";
import { fullSessionDate } from "./sessionDates";
import type { SessionLedgerRow as Row } from "./useSessionsData";

type Props = {
  row: Row;
  href: string;
};

export default function SessionLedgerRow({ row, href }: Props) {
  const { session } = row;
  const yourNet =
    row.yourNetCents === null
      ? "you did not play"
      : `your net ${formatSignedCents(row.yourNetCents)}`;

  return (
    <Link
      to={href}
      aria-label={`Night ${row.nightNumber}, ${fullSessionDate(session.played_at)}. ${row.playerCount} players: ${row.participantNames.join(", ")}. Action score ${row.actionScore.toFixed(1)} out of 10. ${yourNet}.`}
      className="grid min-h-[65px] grid-cols-[54px_minmax(130px,1fr)_90px] items-center gap-x-2 rounded-[10px] px-2.5 py-2 transition-[background,transform] hover:translate-x-0.5 hover:bg-card-100/60 min-[481px]:grid-cols-[54px_minmax(130px,1fr)_120px_90px] min-[721px]:grid-cols-[62px_minmax(180px,2fr)_minmax(140px,1.2fr)_130px_80px_110px] min-[721px]:gap-x-3.5"
    >
      <SessionDateCard playedAt={session.played_at} />

      <span className="min-w-0">
        <span className="block truncate text-[13.5px] font-medium text-ink-900">
          Night {row.nightNumber} · {fullSessionDate(session.played_at)}
        </span>
        {session.notes && (
          <span className="mt-0.5 block text-[11px] leading-[1.4] text-ink-500">
            {session.notes}
          </span>
        )}
      </span>

      <span className="hidden min-[721px]:block">
        <SessionPlayerAvatars
          players={row.players}
          playerCount={row.playerCount}
          overflow={row.avatarOverflow}
        />
      </span>

      <span className="hidden text-center min-[481px]:block">
        <SessionStatusBadge
          status={session.status}
          reconciled={session.reconciled}
          needsReview={session.needs_review}
        />
      </span>

      <span className="tabular hidden text-right text-[13px] font-semibold text-ink-900 min-[721px]:block">
        {row.actionScore.toFixed(1)}
        <span className="text-xs font-normal text-ink-500">/10</span>
      </span>

      <span
        className={`tabular text-right font-display text-base min-[721px]:text-lg ${
          row.yourNetCents === null
            ? "text-ink-500"
            : moneyToneClass(row.yourNetCents)
        }`}
      >
        {row.yourNetCents === null
          ? "—"
          : formatSignedCents(row.yourNetCents)}
      </span>
    </Link>
  );
}
