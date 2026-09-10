import Band from "../../components/Band";
import InfoTip from "../../components/InfoTip";
import MiniStat from "../../components/MiniStat";
import { formatCents, formatSignedCents } from "../../lib/money";
import { moneyToneClass } from "../../lib/moneyTone";
import {
  REBUY_MIN_BUY_INS,
  type PlayerStats,
  type RebuySuccess,
} from "../../lib/stats";

type Props = {
  stats: PlayerStats;
  rebuy: RebuySuccess;
  leagueRank: number | null;
  meanCents: number | null;
  varianceCentsSquared: number | null;
  stdevCents: number | null;
};

const squaredDollars = new Intl.NumberFormat(undefined, {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Everything about how you play that is not the two hero figures.
 *
 * Laid out in two named groups rather than one nine-cell grid. The old
 * version ran counts, money and statistics together in reading order, so
 * "Win rate" sat between "Record" and "E(X)" and the eye had to sort them
 * itself. Splitting them means each row answers one kind of question, and the
 * distribution figures — which are the ones that need a moment — are no
 * longer buried mid-grid.
 */
export default function TrackRecordBand({
  stats,
  rebuy,
  leagueRank,
  meanCents,
  varianceCentsSquared,
  stdevCents,
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
      <div className="mt-5 grid grid-cols-2 gap-x-6 gap-y-6 sm:grid-cols-4">
        <MiniStat label="Nights played" value={stats.sessionsPlayed} />
        <MiniStat label="Record" value={`${stats.wins}W ${stats.losses}L`} />
        <MiniStat label="Win rate" value={winRate} />
        <MiniStat
          label={
            <span className="inline-flex items-center gap-1.5">
              Rebuy success
              <InfoTip label="About rebuy success rate">
                Of the nights you bought in {REBUY_MIN_BUY_INS} or more times,
                the share you finished ahead on. Breaking even does not count.
              </InfoTip>
            </span>
          }
          value={
            rebuy.rate == null ? "—" : `${(rebuy.rate * 100).toFixed(0)}%`
          }
          caption={
            rebuy.rate == null
              ? "No nights with a rebuy yet"
              : `${rebuy.successes} of ${rebuy.qualifying} rebuy nights`
          }
        />
      </div>

      <div className="mt-7 border-t border-card-100 pt-6">
        <p className="text-[10px] font-semibold tracking-[0.13em] text-ink-500 uppercase">
          The shape of your results
        </p>
        <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-6 sm:grid-cols-4">
          <MiniStat
            label="Best night"
            value={formatSignedCents(stats.best)}
            toneClass={moneyToneClass(stats.best)}
          />
          <MiniStat
            label="Expected value E(X)"
            value={
              meanCents == null ? "—" : formatSignedCents(Math.round(meanCents))
            }
            toneClass={meanCents == null ? undefined : moneyToneClass(meanCents)}
            caption="Your average night"
          />
          <MiniStat
            label="Standard deviation σ"
            value={stdevCents == null ? "—" : formatCents(Math.round(stdevCents))}
            caption="How far a night typically strays"
          />
          <MiniStat
            label="Sample variance Var(X)"
            value={
              varianceCentsSquared == null
                ? "—"
                : `${squaredDollars.format(varianceCentsSquared / 10_000)}`
            }
            caption="Dollars², σ before the square root"
          />
        </div>
      </div>
    </Band>
  );
}
