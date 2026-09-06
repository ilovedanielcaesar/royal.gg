import { Link } from "react-router-dom";
import { formatPlayedAt } from "../lib/format";
import { formatSignedCents } from "../lib/money";
import {
  periodNets,
  type BuyIn,
  type CashOut,
  type Player,
  type Session,
} from "../lib/stats";
import PlayerAvatar from "./PlayerAvatar";

type Props = {
  players: Player[];
  sessions: Session[];
  buyIns: BuyIn[];
  cashOuts: CashOut[];
  /** null = open/current period; otherwise pin to a closed period. */
  startAfter: string | null;
  endOn: string;
  /** When provided, players are clickable links to /players/:id. */
  linkProfiles?: boolean;
};

/**
 * Tightly-packed table of every player's net P/L over a date window.
 * Sorted top-to-bottom by net (winners up). Designed to fit on a single
 * screen so a settle-up at a glance is possible.
 */
export default function PayoutSummary({
  players,
  sessions,
  buyIns,
  cashOuts,
  startAfter,
  endOn,
  linkProfiles = false,
}: Props) {
  const rows = periodNets(players, sessions, buyIns, cashOuts, startAfter, endOn);

  if (rows.length === 0) {
    return (
      <p className="mt-3 text-sm text-ink-500">
        No sessions played yet
        {startAfter ? ` since ${formatPlayedAt(startAfter)}` : ""}.
      </p>
    );
  }

  return (
    <ul className="mt-3 divide-y divide-card-100">
      {rows.map((r) => {
        const className = [
          "tabular text-sm font-medium",
          r.netCents > 0
            ? "text-sage-700"
            : r.netCents < 0
              ? "text-crimson-700"
              : "text-ink-500",
        ].join(" ");
        const inner = (
          <>
            <PlayerAvatar player={r.player} size="sm" />
            <div className="flex-1 truncate text-sm text-ink-900">
              {r.player.display_name ?? r.player.name}
              {r.player.is_guest && (
                <span className="ml-2 text-[10px] uppercase tracking-wide text-ink-500">
                  guest
                </span>
              )}
            </div>
            <div className={className}>{formatSignedCents(r.netCents)}</div>
          </>
        );
        return (
          <li key={r.player.id}>
            {linkProfiles ? (
              <Link
                to={`/players/${r.player.id}`}
                className="flex items-center gap-3 py-2 hover:bg-card-100/40"
              >
                {inner}
              </Link>
            ) : (
              <div className="flex items-center gap-3 py-2">{inner}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
