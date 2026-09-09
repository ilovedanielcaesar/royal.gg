import { Link } from "react-router-dom";
import { useGroup } from "../lib/groupContext";
import { moneyToneClass } from "../lib/moneyTone";
import { formatSignedCents } from "../lib/money";
import {
  seasonLeaders,
  type BuyIn,
  type CashOut,
  type Player,
  type Session,
} from "../lib/stats";
import PlayerAvatar from "./PlayerAvatar";

type Props = {
  /**
   * Already filtered to the ranking-eligible set by the caller — active,
   * non-guest, three or more LIFETIME nights. Eligibility needs every
   * session to compute, and this component only ever sees the window, so
   * deciding it here would need a second copy of the rule.
   */
  players: Player[];
  /** The window: the most recent N group sessions, from `recentSessions`. */
  windowSessions: Session[];
  buyIns: BuyIn[];
  cashOuts: CashOut[];
};

/**
 * Winners and losers over a window of games — three each side.
 *
 * The window counts GROUP sessions, not the player's. Someone who showed up
 * for one of the last five appears with a one-night sample, which is not
 * form, so every row carries `n of 5` beside its net to say so.
 */
export default function SeasonLeaders({
  players,
  windowSessions,
  buyIns,
  cashOuts,
}: Props) {
  const { path } = useGroup();
  const windowSize = windowSessions.length;
  const ranked = seasonLeaders(players, windowSessions, buyIns, cashOuts);
  const winners = ranked.filter((r) => r.netCents > 0).slice(0, 3);
  const losers = ranked
    .filter((r) => r.netCents < 0)
    .slice(-3)
    .reverse();

  if (ranked.length === 0) {
    return (
      <p className="mt-4 text-sm text-ink-500">
        No ranked players in this window yet.
      </p>
    );
  }

  return (
    <div className="mt-4 grid gap-6 sm:grid-cols-2">
      <RankList
        title="Up"
        rows={winners}
        empty="Nobody is up over this window."
        windowSize={windowSize}
        path={path}
      />
      <RankList
        title="Down"
        rows={losers}
        empty="Nobody is down over this window."
        windowSize={windowSize}
        path={path}
      />
    </div>
  );
}

function RankList({
  title,
  rows,
  empty,
  windowSize,
  path,
}: {
  title: string;
  rows: Array<{ player: Player; netCents: number; sessionsPlayed: number }>;
  empty: string;
  windowSize: number;
  path: (sub: string) => string;
}) {
  return (
    <div>
      <p className="text-[10px] font-semibold tracking-[0.13em] text-ink-500 uppercase">
        {title}
      </p>
      {rows.length === 0 ? (
        <p className="mt-2 text-xs text-ink-500">{empty}</p>
      ) : (
        <ul className="mt-2 divide-y divide-card-100">
          {rows.map((r) => (
            <li key={r.player.id}>
              <Link
                to={path(`/players/${r.player.id}`)}
                className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-2 transition hover:bg-card-100/60"
              >
                <PlayerAvatar player={r.player} size="sm" />
                <span className="flex-1 truncate text-sm text-ink-900">
                  {r.player.display_name ?? r.player.name}
                </span>
                <span className="text-[11px] text-ink-500 tabular">
                  {r.sessionsPlayed} of {windowSize}
                </span>
                <span
                  className={`tabular text-sm font-medium ${moneyToneClass(
                    r.netCents
                  )}`}
                >
                  {formatSignedCents(r.netCents)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
