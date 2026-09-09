import { Link } from "react-router-dom";
import Band from "../../components/Band";
import MiniStat from "../../components/MiniStat";
import { formatCents, formatSignedCents } from "../../lib/money";
import { moneyToneClass } from "../../lib/moneyTone";
import type { PlayerRating, PlayerStats } from "../../lib/stats";

type Props = {
  stats: PlayerStats;
  rating: PlayerRating;
  leagueRank: number | null;
  meanCents: number | null;
  varianceCentsSquared: number | null;
  stdevCents: number | null;
  ratingHref: string;
};

const squaredDollars = new Intl.NumberFormat(undefined, {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export default function TrackRecordBand({
  stats,
  rating,
  leagueRank,
  meanCents,
  varianceCentsSquared,
  stdevCents,
  ratingHref,
}: Props) {
  const winRate =
    stats.sessionsPlayed === 0
      ? "—"
      : `${((stats.wins / stats.sessionsPlayed) * 100).toFixed(1)}%`;
  const rankLabel =
    leagueRank === 1
      ? "All-time league leader"
      : leagueRank
        ? `#${leagueRank} all-time in this league`
        : undefined;

  return (
    <Band title="Track record" kicker={rankLabel}>
      <div className="mt-5 grid grid-cols-2 gap-x-5 gap-y-6 sm:grid-cols-3 lg:grid-cols-4">
        <MiniStat
          label="Player score"
          value={
            rating.rating == null ? (
              "—"
            ) : (
              <Link to={ratingHref} className="hover:underline">
                {rating.rating.toFixed(1)}
                <span className="text-sm text-ink-500">/10</span>
              </Link>
            )
          }
        />
        <MiniStat label="Nights played" value={stats.sessionsPlayed} />
        <MiniStat label="Record" value={`${stats.wins}W ${stats.losses}L`} />
        <MiniStat
          label="Lifetime net"
          value={formatSignedCents(stats.totalNetCents)}
          toneClass={moneyToneClass(stats.totalNetCents)}
        />
        <MiniStat label="Win rate" value={winRate} />
        <MiniStat
          label="Expected value E(X)"
          value={
            meanCents == null
              ? "—"
              : formatSignedCents(Math.round(meanCents))
          }
          toneClass={meanCents == null ? undefined : moneyToneClass(meanCents)}
        />
        <MiniStat
          label="Sample variance Var(X)"
          value={
            varianceCentsSquared == null
              ? "—"
              : `${squaredDollars.format(varianceCentsSquared / 10_000)} dollars²`
          }
        />
        <MiniStat
          label="Standard deviation σ"
          value={stdevCents == null ? "—" : formatCents(Math.round(stdevCents))}
        />
        <MiniStat
          label="Best night"
          value={formatSignedCents(stats.best)}
          toneClass={moneyToneClass(stats.best)}
        />
      </div>
    </Band>
  );
}
