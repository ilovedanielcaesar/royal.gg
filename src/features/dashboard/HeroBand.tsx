import { Link } from "react-router-dom";
import Band from "../../components/Band";
import GoldPill from "../../components/GoldPill";
import MiniStat from "../../components/MiniStat";
import StatFigure from "../../components/StatFigure";
import { moneyToneClass } from "../../lib/moneyTone";
import { formatSignedCents } from "../../lib/money";
import type { PlayerRating, PlayerStats } from "../../lib/stats";
import { streakPillText } from "./streakPill";

type Props = {
  stats: PlayerStats;
  rating: PlayerRating;
  /** The player's session nets, oldest first — the streak pill's input. */
  netsOldestFirst: number[];
  profileHref: string;
};

/**
 * Band 1 — numbers only.
 *
 * Your player score at display scale, a gold streak pill, then wins, losses
 * and lifetime net as mini-stats.
 *
 * Wins and losses are shown rather than a win rate: 15 and 9 carry the sample
 * size that 62.5% hides, and nights played is their sum, so it needs no tile
 * of its own.
 *
 * There is no chart here. The page draws your cumulative net exactly once, in
 * band 3 — two renderings of one metric on one page is a redundancy, and
 * dropping the second lets band 3 be larger.
 */
export default function HeroBand({
  stats,
  rating,
  netsOldestFirst,
  profileHref,
}: Props) {
  const streak = streakPillText(netsOldestFirst);

  return (
    <Band>
      <div className="flex flex-wrap items-start justify-between gap-x-10 gap-y-6">
        <div className="flex flex-wrap items-center gap-5">
          {/* The score is not money, so it stays ink-900. Sage and crimson
              mean won and lost; a sage-tinted rating reads as a dollar
              figure. */}
          <StatFigure
            label="Player score"
            value={rating.rating ?? "—"}
            suffix={rating.rating === null ? undefined : "/10"}
            caption={
              rating.rating === null
                ? "Need 3+ sessions for a rating."
                : undefined
            }
          />
          {streak && <GoldPill>{streak}</GoldPill>}
        </div>

        <div className="flex items-start gap-8">
          <MiniStat label="Wins" value={stats.wins} size="lg" />
          <MiniStat label="Losses" value={stats.losses} size="lg" />
          <MiniStat
            label="Lifetime net"
            value={formatSignedCents(stats.totalNetCents)}
            toneClass={moneyToneClass(stats.totalNetCents)}
            size="lg"
          />
        </div>
      </div>

      <Link
        to={profileHref}
        className="mt-5 inline-block text-xs font-medium text-ink-500 hover:text-ink-900 hover:underline"
      >
        Open profile →
      </Link>
    </Band>
  );
}
