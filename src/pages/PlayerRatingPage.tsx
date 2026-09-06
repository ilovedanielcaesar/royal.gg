import { Link, useParams } from "react-router-dom";
import Card from "../components/Card";
import PlayerAvatar from "../components/PlayerAvatar";
import { useGroup } from "../lib/groupContext";
import { formatSignedCents } from "../lib/money";
import { playerRating } from "../lib/stats";
import { EMPTY_LEAGUE_DATA, useLeagueData } from "../lib/useLeagueData";

export default function PlayerRatingPage() {
  const { id } = useParams();
  const { path } = useGroup();
  const { data, loading, error } = useLeagueData();
  const { players, sessions, buyIns, cashOuts } = data ?? EMPTY_LEAGUE_DATA;
  const player = players.find((candidate) => candidate.id === id) ?? null;

  if (loading) return <div className="text-sm text-card-50/60">Dealing in…</div>;
  if (error || !player) {
    return (
      <Card className="p-6">
        <p className="text-sm text-crimson-700">
          {error ?? "Player not found."}
        </p>
      </Card>
    );
  }

  const rating = playerRating(player.id, sessions, buyIns, cashOuts);
  const c = rating.components;
  const display = player.display_name ?? player.name;

  return (
    <div className="space-y-6">
      <div>
        <Link
          to={path(`/players/${player.id}`)}
          className="text-xs text-card-50/60 hover:text-card-50"
        >
          ← Back to {display}
        </Link>
        <h1 className="mt-1 font-display text-4xl text-card-50">
          Player rating
        </h1>
        <p className="mt-1 text-sm text-card-50/70">
          A 1–10 score combining four signals to summarize how a player is
          doing right now.
        </p>
      </div>

      <Card className="p-5" accent="gold">
        <div className="flex items-center gap-4">
          <PlayerAvatar player={player} size="lg" />
          <div className="flex-1">
            <div className="font-display text-2xl text-ink-900">
              {display}'s rating
            </div>
            <div className="text-xs text-ink-500">
              Based on {rating.sessionsPlayed} session
              {rating.sessionsPlayed === 1 ? "" : "s"} played.
            </div>
          </div>
          <div className="text-right">
            <div className="font-display text-6xl tabular text-ink-900">
              {rating.rating == null ? "—" : rating.rating.toFixed(1)}
              {rating.rating != null && (
                <span className="text-2xl text-ink-500">/10</span>
              )}
            </div>
            {rating.rating == null && (
              <div className="text-xs text-ink-500">
                Need 3+ sessions for a rating.
              </div>
            )}
          </div>
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="font-display text-xl text-ink-900">
          What it represents
        </h2>
        <p className="mt-2 text-sm text-ink-700">
          A rating combines four ingredients, each scored 0–1 and weighted.
          The weighted total is rescaled to 1–10 (so 5 ≈ "fully average").
        </p>
        <ul className="mt-3 space-y-2 text-sm text-ink-700">
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
      </Card>

      <Card className="p-5">
        <h2 className="font-display text-xl text-ink-900">
          {display}'s breakdown
        </h2>
        {rating.rating == null ? (
          <p className="mt-2 text-sm text-ink-500">
            Not enough data yet — a rating shows up after 3 sessions.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-ink-500">
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
                      : `σ ${formatSignedCents(
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
                <tr className="border-t-2 border-ink-900/20">
                  <td className="py-3 font-medium text-ink-900">
                    Final
                  </td>
                  <td />
                  <td />
                  <td className="py-3 text-right text-xs text-ink-500">
                    raw {rating.rawScore.toFixed(2)} → 1 + 9 × {rating.rawScore.toFixed(2)}
                  </td>
                  <td className="py-3 text-right font-display text-2xl tabular text-ink-900">
                    {rating.rating!.toFixed(1)}/10
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
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
      <td className="py-3 pr-3 text-right tabular text-ink-700">{raw}</td>
      <td className="py-3 pr-3 text-right tabular text-ink-700">
        {sub.toFixed(2)}
      </td>
      <td className="py-3 pr-3 text-right tabular text-ink-500">
        {(weight * 100).toFixed(0)}%
      </td>
      <td className="py-3 text-right tabular text-ink-900">
        {contribution.toFixed(2)}
      </td>
    </tr>
  );
}
