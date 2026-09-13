import { Link } from "react-router-dom";
import Band from "../../components/Band";
import MiniStat from "../../components/MiniStat";
import PlayerAvatar from "../../components/PlayerAvatar";
import StatFigure from "../../components/StatFigure";
import { formatSignedCents } from "../../lib/money";
import { moneyToneClass } from "../../lib/moneyTone";
import type { PlayerRating, PlayerStats, Player } from "../../lib/stats";

type Props = {
  player: Player;
  stats: PlayerStats;
  rating: PlayerRating;
  ratingRank: number | null;
  ratingHref: string;
};

/**
 * Who they are and the two figures worth leading with.
 *
 * Lifetime net is the only money here, so it is the only thing that carries a
 * tone — `moneyToneClass`, not the hand-written sage/crimson ternary this
 * replaces. The rating stays `ink-900`: it is a score out of ten, and a
 * sage-tinted one reads as a dollar amount. The old card also tinted the WIN
 * and LOSS counts sage and crimson, which is the same mistake on a figure
 * that is not even a rating.
 */
export default function PlayerHeroBand({
  player,
  stats,
  rating,
  ratingRank,
  ratingHref,
}: Props) {
  return (
    <Band>
      <div className="flex flex-wrap items-center gap-4">
        <PlayerAvatar player={player} size="lg" />
        <div>
          <p className="font-display text-2xl leading-tight text-ink-900">
            {player.display_name ?? player.name}
          </p>
          <p className="text-xs text-ink-500">
            {player.username
              ? `@${player.username}`
              : player.is_guest
                ? "Guest — no account"
                : "Member"}
          </p>
        </div>
      </div>

      <div className="mt-7 flex flex-wrap items-end gap-x-14 gap-y-6">
        <StatFigure
          label="Lifetime winnings"
          value={formatSignedCents(stats.totalNetCents)}
          toneClass={moneyToneClass(stats.totalNetCents)}
        />
        <MiniStat
          size="lg"
          label="Player rating"
          value={rating.rating == null ? "—" : `${rating.rating.toFixed(1)}/10`}
          caption={
            <>
              {ratingRank === 1
                ? "Rating leader in this league"
                : ratingRank
                  ? `#${ratingRank} by player rating in this league`
                  : "Not ranked yet"}
              {rating.rating == null ? (
                " · Needs 3 nights"
              ) : (
                <>
                  {" · "}
                  <Link
                    to={ratingHref}
                    className="font-medium underline hover:text-ink-900"
                  >
                    How is this calculated?
                  </Link>
                </>
              )}
            </>
          }
        />
      </div>
    </Band>
  );
}
