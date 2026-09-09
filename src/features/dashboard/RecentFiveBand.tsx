import { Link } from "react-router-dom";
import Band from "../../components/Band";
import { moneyToneClass } from "../../lib/moneyTone";
import { formatSignedCents } from "../../lib/money";
import type { Session } from "../../lib/stats";

type Props = {
  /** Oldest-first nets; this band shows the last five, newest first. */
  nets: Array<{ session: Session; netCents: number }>;
  sessionHref: (id: string) => string;
  allSessionsHref: string;
};

/**
 * Band 2 — the last five nights as chips: date, net, won or lost.
 *
 * Scannable, with no per-session detail. A single "last night" card was
 * considered and rejected: five outcomes at a glance beats one night in
 * depth, and the depth already exists on the session page.
 */
export default function RecentFiveBand({
  nets,
  sessionHref,
  allSessionsHref,
}: Props) {
  const recent = nets.slice(-5).reverse();

  return (
    <Band
      title="Recent five"
      action={
        <Link
          to={allSessionsHref}
          className="text-xs font-medium text-ink-500 hover:text-ink-900 hover:underline"
        >
          All sessions →
        </Link>
      }
    >
      {recent.length === 0 ? (
        <p className="mt-4 text-sm text-ink-500">
          You haven't played a night yet.
        </p>
      ) : (
        <ul className="mt-4 flex flex-wrap gap-3">
          {recent.map(({ session, netCents }) => (
            <li key={session.id} className="flex-1 basis-32">
              <Link
                to={sessionHref(session.id)}
                className="flex flex-col gap-1 rounded-xl bg-card-100/60 px-4 py-3 transition hover:bg-card-100"
              >
                <span className="text-[10px] font-semibold tracking-[0.13em] text-ink-500 uppercase">
                  {shortDate(session.played_at)}
                </span>
                <span
                  className={`tabular font-display text-xl ${moneyToneClass(
                    netCents
                  )}`}
                >
                  {formatSignedCents(netCents)}
                </span>
                <span className="text-[11px] text-ink-500">
                  {netCents > 0 ? "Win" : netCents < 0 ? "Loss" : "Even"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Band>
  );
}

// Midday, not midnight: `new Date("2026-09-04")` is parsed as UTC and a
// browser west of Greenwich renders it as the 3rd.
function shortDate(playedAt: string): string {
  const date = new Date(playedAt + "T12:00:00");
  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  });
}
