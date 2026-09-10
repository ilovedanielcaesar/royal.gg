import { Link } from "react-router-dom";
import Band from "../../components/Band";
import PlayerAvatar from "../../components/PlayerAvatar";
import Sparkline from "../../components/Sparkline";
import { formatSignedCents } from "../../lib/money";
import { moneyToneClass } from "../../lib/moneyTone";
import type { GroupMemberStatus } from "../../lib/useGroupMemberStatus";
import type {
  LeagueRankingRow,
  LeagueSort,
} from "./useLeaguePageData";

type Props = {
  rows: LeagueRankingRow[];
  sort: LeagueSort;
  onSortChange: (sort: LeagueSort) => void;
  myPlayerId: string | null;
  playerHref: (id: string) => string;
};

const GRID =
  "grid min-w-[760px] grid-cols-[32px_minmax(180px,2fr)_90px_100px_96px_120px] items-center gap-3.5";

export default function RankingsBand({
  rows,
  sort,
  onSortChange,
  myPlayerId,
  playerHref,
}: Props) {
  return (
    <Band
      title="All-time rankings"
      caption="Lifetime net · never reset by a payout"
      action={
        <label className="flex items-center gap-2 text-xs font-medium text-ink-500">
          Sort by
          <select
            value={sort}
            onChange={(event) =>
              onSortChange(event.target.value as LeagueSort)
            }
            className="min-h-9 rounded-[9px] border border-card-200 bg-card-50 px-3 text-xs font-semibold text-ink-900"
            aria-label="Sort rankings"
          >
            <option value="pl-desc">P/L high→low</option>
            <option value="pl-asc">P/L low→high</option>
            <option value="rating-desc">Player score</option>
            <option value="consistency-desc">Consistency score</option>
            <option value="nights-desc">Most games played</option>
          </select>
        </label>
      }
    >
      {rows.length === 0 ? (
        <p className="mt-4 text-sm text-ink-500">
          No one has three nights yet.
        </p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          {/* Hidden from readers on purpose: a CSS grid of spans is not a
              table, so these headers are not programmatically tied to the
              cells below them. Each row carries its own aria-label instead,
              which is what stops a reader hearing six bare numbers. Change
              one and you have to change the other. */}
          <div
            className={`${GRID} px-2.5 py-2 text-[9.5px] font-semibold tracking-[0.08em] text-ink-500 uppercase`}
            aria-hidden="true"
          >
            <span className="text-center">#</span>
            <span>Player</span>
            <span className="text-right">Score</span>
            <span className="text-right">Consistency</span>
            <span className="text-center">Last 5</span>
            <span className="text-right">Lifetime P/L</span>
          </div>
          <ol className="min-w-[760px] divide-y divide-card-100">
            {rows.map((row, index) => {
              const name = row.player.display_name ?? row.player.name;
              return (
                <li key={row.playerId}>
                  <Link
                    to={playerHref(row.playerId)}
                    aria-label={`#${index + 1} ${name}${
                      formerMemberLabel(row.memberStatus)
                        ? `, ${formerMemberLabel(row.memberStatus)} the league`
                        : ""
                    }. ${row.sessionsPlayed} nights, ${row.wins} wins, ${
                      row.losses
                    } losses. Player score ${
                      row.rating?.toFixed(1) ?? "not yet rated"
                    }. Consistency ${(row.consistency * 10).toFixed(
                      1
                    )} out of 10. Lifetime ${formatSignedCents(
                      row.totalNetCents
                    )}.`}
                    className={`${GRID} rounded-[10px] px-2.5 py-2.5 transition hover:bg-card-100/60 ${
                      // Your own row is a faint tint and NO label, matching
                      // the dashboard's standings exactly. Two lists ranking
                      // one league cannot mark you two different ways. The
                      // mock draws a gold YOU pill here; it predates the
                      // Stage 1 browser pass that dropped the same pill from
                      // TableBand for being louder than the sheet wants, and
                      // Will re-confirmed that call for this page.
                      row.playerId === myPlayerId ? "bg-card-100/60" : ""
                    }`}
                  >
                    <span className="tabular text-center font-display text-[17px] text-ink-500">
                      {index + 1}
                    </span>
                    <span className="flex min-w-0 items-center gap-3">
                      <PlayerAvatar player={row.player} size="sm" />
                      <span className="min-w-0">
                        <span className="flex items-center gap-1.5">
                          <span className="truncate text-[13.5px] font-medium">
                            {name}
                          </span>
                          {formerMemberLabel(row.memberStatus) && (
                            <span className="text-[10px] font-medium text-ink-500">
                              {formerMemberLabel(row.memberStatus)}
                            </span>
                          )}
                        </span>
                        <span className="block text-[10.5px] text-ink-500">
                          {row.sessionsPlayed} nights · {row.wins}W {row.losses}L
                        </span>
                      </span>
                    </span>
                    <span className="tabular text-right text-[13px] font-semibold text-ink-900">
                      {row.rating?.toFixed(1) ?? "—"}
                    </span>
                    <span className="tabular text-right text-[13px] font-semibold text-ink-900">
                      {(row.consistency * 10).toFixed(1)}
                    </span>
                    <span className="flex justify-center">
                      <Sparkline
                        nets={row.lastFiveNets}
                        width={88}
                        height={26}
                        label={`${name}: five-night trajectory (${formatSignedCents(
                          row.lastFiveNets.reduce((sum, net) => sum + net, 0)
                        )})`}
                      />
                    </span>
                    <span
                      className={`tabular text-right font-display text-lg ${moneyToneClass(
                        row.totalNetCents
                      )}`}
                    >
                      {formatSignedCents(row.totalNetCents)}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </Band>
  );
}

/**
 * The word for a membership that has ended, or null while it is current.
 *
 * `left` and `removed` are both former members and both must be marked: an
 * admin removing someone does not make them a current member. They stay in
 * the standings either way — leaving does not erase your results — so this is
 * the only thing that distinguishes them, and it keeps the two words apart
 * because being removed and walking away are not the same fact.
 */
function formerMemberLabel(status: GroupMemberStatus | null): string | null {
  if (status === "left") return "left";
  if (status === "removed") return "removed";
  return null;
}
