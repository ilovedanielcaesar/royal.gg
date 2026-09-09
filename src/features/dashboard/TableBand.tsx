import { Link } from "react-router-dom";
import Band from "../../components/Band";
import MiniStat from "../../components/MiniStat";
import PlayerAvatar from "../../components/PlayerAvatar";
import Sparkline from "../../components/Sparkline";
import { moneyToneClass } from "../../lib/moneyTone";
import { formatPlayedAt } from "../../lib/format";
import { formatCents, formatSignedCents } from "../../lib/money";
import type { Player, PlayerStats } from "../../lib/stats";

/** Nights in a standings-row sparkline. */
const SPARK_NIGHTS = 8;

type Row = PlayerStats & {
  player: Player;
  /** Per-night nets, oldest first. Trimmed to the last SPARK_NIGHTS here. */
  netsOldestFirst: number[];
};

type Props = {
  rows: Row[];
  /** Your own roster row id in this group, or null. */
  myPlayerId: string | null;
  totals: {
    sessionCount: number;
    totalPotCents: number;
    biggestWinCents: number;
    biggestWinDate: string | null;
    biggestWinSessionId: string | null;
    biggestLossCents: number;
    biggestLossDate: string | null;
    biggestLossSessionId: string | null;
  };
  playerHref: (id: string) => string;
  sessionHref: (id: string) => string;
};

/**
 * Band 4 — who is at the table, and the group's records beside them.
 *
 * Every player is listed, not just the ranked ones: this is the table, and
 * eligibility is a rule about standings. The consequence is that the band has
 * no fixed height and grows with the roster, which is correct — eliding the
 * middle of a nine-person table to save vertical space hides most of the
 * league.
 *
 * The stats panel is top-aligned rather than stretched. The list outgrows the
 * panel as players are added, and whitespace under four figures is the right
 * answer to that, not four figures spread over 700px.
 */
export default function TableBand({
  rows,
  myPlayerId,
  totals,
  playerHref,
  sessionHref,
}: Props) {
  return (
    <Band title="At the table" caption="Lifetime, every player">
      <div className="mt-4 grid gap-8 lg:grid-cols-[1.6fr_1fr]">
        {rows.length === 0 ? (
          <p className="text-sm text-ink-500">No players on the roster yet.</p>
        ) : (
          <ol className="divide-y divide-card-100">
            {rows.map((row, idx) => (
              <li key={row.playerId}>
                <Link
                  to={playerHref(row.playerId)}
                  className={[
                    "flex items-center gap-3 px-2 py-2.5 transition hover:bg-card-100/60",
                    // Your own row gets a faint tint and NO label. The card
                    // avatar already identifies you; a gold "YOU" tag was
                    // louder than the sheet wants.
                    row.playerId === myPlayerId ? "bg-card-100/70" : "",
                  ].join(" ")}
                >
                  <span className="tabular w-5 text-right font-display text-sm text-ink-500">
                    {idx + 1}
                  </span>
                  <PlayerAvatar player={row.player} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-ink-900">
                      {row.player.display_name ?? row.player.name}
                    </span>
                    <span className="block text-[11px] text-ink-500">
                      {row.sessionsPlayed} nights · {row.wins}W {row.losses}L
                    </span>
                  </span>
                  <Sparkline
                    nets={row.netsOldestFirst.slice(-SPARK_NIGHTS)}
                    label={`Last ${SPARK_NIGHTS} nights for ${
                      row.player.display_name ?? row.player.name
                    }`}
                  />
                  <span
                    className={`tabular w-24 text-right font-display text-lg ${moneyToneClass(
                      row.totalNetCents
                    )}`}
                  >
                    {formatSignedCents(row.totalNetCents)}
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        )}

        <div className="flex flex-col gap-5 self-start">
          <RecordStat
            label="Biggest win"
            cents={totals.biggestWinCents}
            playedAt={totals.biggestWinDate}
            href={
              totals.biggestWinSessionId
                ? sessionHref(totals.biggestWinSessionId)
                : null
            }
            toneClass="text-sage-700"
          />
          <RecordStat
            label="Biggest loss"
            cents={totals.biggestLossCents}
            playedAt={totals.biggestLossDate}
            href={
              totals.biggestLossSessionId
                ? sessionHref(totals.biggestLossSessionId)
                : null
            }
            toneClass="text-crimson-700"
          />
          {/* Aggregates over every night, so they have nowhere to go. That is
              exactly why the two above have to look clickable. */}
          <MiniStat label="Nights played" value={totals.sessionCount} />
          <MiniStat
            label="Table volume"
            value={formatCents(totals.totalPotCents)}
          />
        </div>
      </div>
    </Band>
  );
}

/**
 * A record that happened on one identifiable night, so it links to it.
 *
 * The two linked figures sit beside two that cannot be, so these have to
 * announce themselves: a hover background, an underlined caption and a
 * trailing arrow.
 */
function RecordStat({
  label,
  cents,
  playedAt,
  href,
  toneClass,
}: {
  label: string;
  cents: number;
  playedAt: string | null;
  href: string | null;
  toneClass: string;
}) {
  const value = cents === 0 ? "—" : formatCents(Math.abs(cents));
  const body = (
    <>
      <p className="text-[10px] font-semibold tracking-[0.13em] text-ink-500 uppercase">
        {label}
      </p>
      <p className={`tabular font-display text-[22px] ${toneClass}`}>{value}</p>
      {playedAt && (
        <p className="text-xs text-ink-500 underline decoration-ink-500/40">
          {formatPlayedAt(playedAt)} →
        </p>
      )}
    </>
  );

  if (!href) return <div>{body}</div>;

  return (
    <Link
      to={href}
      className="-mx-2 block rounded-lg px-2 py-1 transition hover:bg-card-100/60"
    >
      {body}
    </Link>
  );
}
