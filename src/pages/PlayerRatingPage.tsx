import { useParams } from "react-router-dom";
import Band from "../components/Band";
import FeltButton from "../components/FeltButton";
import LoadingState from "../components/LoadingState";
import PageHeading from "../components/PageHeading";
import PlayerAvatar from "../components/PlayerAvatar";
import Sheet from "../components/Sheet";
import StatFigure from "../components/StatFigure";
import { useGroup } from "../lib/groupContext";
import { formatCents, formatSignedCents } from "../lib/money";
import { playerRating } from "../lib/stats";
import { EMPTY_LEAGUE_DATA, useLeagueData } from "../lib/useLeagueData";

export default function PlayerRatingPage() {
  const { id } = useParams();
  const { path } = useGroup();
  const { data, loading, error } = useLeagueData();
  const { players, sessions, buyIns, cashOuts } = data ?? EMPTY_LEAGUE_DATA;
  const player = players.find((candidate) => candidate.id === id) ?? null;

  if (loading) return <LoadingState tone="felt" full />;

  if (error || !player) {
    return (
      <>
        <PageHeading
          title="No such player"
          subtitle={error ?? "Nobody on this roster has that id."}
          actions={<FeltButton to={path("/league")}>← League</FeltButton>}
        />
        <Sheet>
          <Band title="Try the league table">
            <p className="mt-2 max-w-[60ch] text-sm text-ink-500">
              Every player with a roster row is listed there, guests included.
            </p>
          </Band>
        </Sheet>
      </>
    );
  }

  const rating = playerRating(player.id, sessions, buyIns, cashOuts);
  const c = rating.components;
  const display = player.display_name ?? player.name;

  return (
    <>
      <PageHeading
        title="Player rating"
        subtitle={`A 1–10 score combining four signals into how ${display} is doing right now.`}
        actions={
          <FeltButton variant="ghost" to={path(`/players/${player.id}`)}>
            ← {display}
          </FeltButton>
        }
      />

      <Sheet>
        <Band>
          <div className="flex flex-wrap items-end justify-between gap-8">
            <div className="flex items-center gap-4">
              <PlayerAvatar player={player} size="lg" />
              <div>
                <p className="font-display text-2xl leading-tight text-ink-900">
                  {display}
                </p>
                <p className="text-xs text-ink-500">
                  Based on {rating.sessionsPlayed} session
                  {rating.sessionsPlayed === 1 ? "" : "s"} played.
                </p>
              </div>
            </div>
            {/* A rating is not money, so no tone — StatFigure defaults to
                ink-900 for exactly this case. */}
            <StatFigure
              label="Rating"
              value={rating.rating == null ? "—" : rating.rating.toFixed(1)}
              suffix={rating.rating == null ? undefined : "/10"}
              caption={
                rating.rating == null
                  ? "Needs 3 or more nights before a rating means anything."
                  : undefined
              }
            />
          </div>
        </Band>

        <Band
          kicker="Method"
          title="What it represents"
          caption="Four ingredients, each scored 0–1 and weighted. The weighted total is rescaled to 1–10, so 5 is roughly average."
        >
          <ul className="mt-4 max-w-[74ch] space-y-2 text-sm text-ink-700">
            <li>
              <strong>Win rate (25%)</strong> — how often the player books a
              winning session.
            </li>
            <li>
              <strong>Consistency (20%)</strong> — lower session-to-session
              standard deviation is better. A player who's always close to flat
              scores higher than one who oscillates wildly.
            </li>
            <li>
              <strong>Recent trend (20%)</strong> — net P/L over the last 6
              sessions. Rewards momentum.
            </li>
            <li>
              <strong>Lifetime winnings (35%)</strong> — career net. The
              heaviest weight because it's the most stable signal of skill.
            </li>
          </ul>
        </Band>

        <Band kicker="Arithmetic" title={`${display}'s breakdown`}>
          {rating.rating == null ? (
            <p className="mt-2 text-sm text-ink-500">
              Not enough data yet — a rating shows up after 3 sessions.
            </p>
          ) : (
            <div className="mt-5 overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="text-left text-[10px] font-semibold tracking-[0.13em] text-ink-500 uppercase">
                    <th className="pb-2 pr-3">Component</th>
                    <th className="pb-2 pr-3 text-right">Raw value</th>
                    <th className="pb-2 pr-3 text-right">Sub-score</th>
                    <th className="pb-2 pr-3 text-right">Weight</th>
                    <th className="pb-2 text-right">Contribution</th>
                  </tr>
                </thead>
                <tbody>
                  <Row
                    label="Win rate"
                    raw={`${(c.winRate.value * 100).toFixed(0)}%`}
                    sub={c.winRate.subscore}
                    weight={c.winRate.weight}
                  />
                  <Row
                    label="Consistency"
                    raw={
                      c.consistency.stdevCents == null
                        ? "—"
                        : `σ ${formatCents(
                            Math.round(c.consistency.stdevCents)
                          )}`
                    }
                    sub={c.consistency.subscore}
                    weight={c.consistency.weight}
                  />
                  <Row
                    label="Recent trend (last 6)"
                    raw={formatSignedCents(c.trend.last6NetCents)}
                    sub={c.trend.subscore}
                    weight={c.trend.weight}
                  />
                  <Row
                    label="Lifetime winnings"
                    raw={formatSignedCents(c.lifetime.totalNetCents)}
                    sub={c.lifetime.subscore}
                    weight={c.lifetime.weight}
                  />
                  <tr className="border-t-2 border-card-200">
                    <td className="py-3 font-medium text-ink-900">Final</td>
                    <td />
                    <td />
                    <td className="py-3 text-right text-xs text-ink-500">
                      raw {rating.rawScore.toFixed(2)} → 1 + 9 ×{" "}
                      {rating.rawScore.toFixed(2)}
                    </td>
                    <td className="tabular py-3 text-right font-display text-2xl text-ink-900">
                      {rating.rating.toFixed(1)}/10
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </Band>
      </Sheet>
    </>
  );
}

function Row({
  label,
  raw,
  sub,
  weight,
}: {
  label: string;
  raw: string;
  sub: number;
  weight: number;
}) {
  const contribution = sub * weight;
  return (
    <tr className="border-t border-card-100">
      <td className="py-3 pr-3 font-medium text-ink-900">{label}</td>
      <td className="tabular py-3 pr-3 text-right text-ink-700">{raw}</td>
      <td className="tabular py-3 pr-3 text-right text-ink-700">
        {sub.toFixed(2)}
      </td>
      <td className="tabular py-3 pr-3 text-right text-ink-500">
        {(weight * 100).toFixed(0)}%
      </td>
      <td className="tabular py-3 text-right text-ink-900">
        {contribution.toFixed(2)}
      </td>
    </tr>
  );
}
