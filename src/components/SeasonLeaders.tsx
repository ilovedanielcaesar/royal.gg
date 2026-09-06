import { Link } from "react-router-dom";
import { useGroup } from "../lib/groupContext";
import { formatSignedCents } from "../lib/money";
import { seasonLeaders, type BuyIn, type CashOut, type Player, type Session } from "../lib/stats";
import PlayerAvatar from "./PlayerAvatar";

type Props = {
  players: Player[];
  sessions: Session[];
  buyIns: BuyIn[];
  cashOuts: CashOut[];
  monthsBack?: number;
};

export default function SeasonLeaders({
  players,
  sessions,
  buyIns,
  cashOuts,
  monthsBack = 3,
}: Props) {
  const { path } = useGroup();
  const since = new Date();
  since.setMonth(since.getMonth() - monthsBack);
  const ranked = seasonLeaders(players, sessions, buyIns, cashOuts, since);
  const winners = ranked.filter((r) => r.netCents > 0).slice(0, 3);
  const losers = ranked
    .filter((r) => r.netCents < 0)
    .slice(-3)
    .reverse();

  if (ranked.length === 0) {
    return (
      <p className="mt-3 text-sm text-ink-500">
        No sessions in the last {monthsBack} months yet.
      </p>
    );
  }

  return (
    <div className="mt-3 grid gap-4 sm:grid-cols-2">
      <RankList
        title="Biggest wins"
        rows={winners}
        empty="No winners this window."
        positive
        path={path}
      />
      <RankList
        title="Biggest losses"
        rows={losers}
        empty="No losers this window."
        path={path}
      />
    </div>
  );
}

function RankList({
  title,
  rows,
  empty,
  positive,
  path,
}: {
  title: string;
  rows: Array<{ player: Player; netCents: number }>;
  empty: string;
  positive?: boolean;
  path: (sub: string) => string;
}) {
  return (
    <div>
      <div className="text-xs font-medium uppercase tracking-wide text-ink-500">
        {title}
      </div>
      {rows.length === 0 ? (
        <p className="mt-2 text-xs text-ink-500">{empty}</p>
      ) : (
        <ul className="mt-2 divide-y divide-card-100">
          {rows.map((r) => (
            <li key={r.player.id}>
              <Link
                to={path(`/players/${r.player.id}`)}
                className="flex items-center gap-3 py-2 hover:bg-card-100/40"
              >
                <PlayerAvatar player={r.player} size="sm" />
                <div className="flex-1 truncate text-sm text-ink-900">
                  {r.player.display_name ?? r.player.name}
                </div>
                <div
                  className={`tabular text-sm font-medium ${
                    positive ? "text-sage-700" : "text-crimson-700"
                  }`}
                >
                  {formatSignedCents(r.netCents)}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
