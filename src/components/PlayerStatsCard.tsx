import { Link } from "react-router-dom";
import { formatPlayedAt } from "../lib/format";
import { formatSignedCents } from "../lib/money";
import {
  netStats,
  playerRating,
  playerSessionNets,
  playerStats,
  type BuyIn,
  type CashOut,
  type Player,
  type Session,
} from "../lib/stats";
import Card from "./Card";

type Props = {
  player: Player;
  sessions: Session[];
  buyIns: BuyIn[];
  cashOuts: CashOut[];
  /** How many recent sessions to surface in the right-hand list. */
  recentCount?: number;
  /** When true, surface lifetime net + rating as the two big standout stats. */
  highlightHero?: boolean;
  /** All-time rank by lifetime net (1 = #1). Optional. */
  rankAllTime?: number | null;
  /** All-time rank by player rating (1 = #1). Optional. */
  rankRating?: number | null;
  /** Group-aware rating URL. Omitted on the global profile route. */
  ratingHref?: string;
};

export default function PlayerStatsCard({
  player,
  sessions,
  buyIns,
  cashOuts,
  recentCount = 10,
  highlightHero = false,
  rankAllTime = null,
  rankRating = null,
  ratingHref,
}: Props) {
  const stats = playerStats(player.id, sessions, buyIns, cashOuts);
  const nets = playerSessionNets(player.id, sessions, buyIns, cashOuts);
  const recent = nets.slice(-recentCount).reverse();
  const { mean } = netStats(nets.map((n) => n.netCents));
  const rating = playerRating(player.id, sessions, buyIns, cashOuts);

  const netClass =
    stats.totalNetCents > 0
      ? "text-sage-700"
      : stats.totalNetCents < 0
        ? "text-crimson-700"
        : "text-ink-700";

  if (highlightHero) {
    return (
      <div className="space-y-4">
        {/* Two big standout stats */}
        <div className="grid gap-4 sm:grid-cols-2">
          <Card className="p-5" accent={stats.totalNetCents > 0 ? "sage" : stats.totalNetCents < 0 ? "crimson" : "neutral"}>
            <div className="text-xs font-medium uppercase tracking-wide text-ink-500">
              Lifetime winnings
            </div>
            <div className={`mt-2 font-display text-5xl tabular ${netClass}`}>
              {formatSignedCents(stats.totalNetCents)}
            </div>
            {rankAllTime != null && (
              <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-card-100 px-2 py-0.5 text-xs text-ink-700">
                #{rankAllTime} all-time
              </div>
            )}
          </Card>
          <Card className="p-5" accent="gold">
            <div className="flex items-center justify-between">
              <div className="text-xs font-medium uppercase tracking-wide text-ink-500">
                Player rating
              </div>
              {rating.rating != null && ratingHref && (
                <Link
                  to={ratingHref}
                  className="text-xs text-sage-700 underline"
                >
                  How is this calculated?
                </Link>
              )}
            </div>
            <div className="mt-2 font-display text-5xl tabular text-ink-900">
              {rating.rating == null ? "—" : (
                <>
                  {rating.rating.toFixed(1)}
                  <span className="text-2xl text-ink-500">/10</span>
                </>
              )}
            </div>
            {rating.rating != null && rankRating != null && (
              <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-card-100 px-2 py-0.5 text-xs text-ink-700">
                #{rankRating} all-time
              </div>
            )}
            {rating.rating == null && (
              <div className="mt-2 text-xs text-ink-500">
                Need at least 3 sessions for a rating.
              </div>
            )}
          </Card>
        </div>

        {/* Detail row + recent sessions */}
        <div className="grid gap-4 sm:grid-cols-2">
          <Card className="p-5">
            <div className="text-xs font-medium uppercase tracking-wide text-ink-500">
              Track record
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <Stat label="Sessions" value={stats.sessionsPlayed.toString()} />
              <Stat label="Wins" value={stats.wins.toString()} accent="sage" />
              <Stat
                label="Losses"
                value={stats.losses.toString()}
                accent="crimson"
              />
            </div>
            <div className="mt-3">
              <Stat
                label="E(X)/session"
                value={mean == null ? "—" : formatSignedCents(Math.round(mean))}
              />
            </div>
          </Card>

          <Card className="p-5">
            <div className="text-xs font-medium uppercase tracking-wide text-ink-500">
              Last {recentCount} sessions
            </div>
            <RecentList recent={recent} />
          </Card>
        </div>
      </div>
    );
  }

  // Default compact layout (used on /profile)
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Card className="p-5">
        <div className="text-xs font-medium uppercase tracking-wide text-ink-500">
          Lifetime
        </div>
        <div className={`mt-1 font-display text-3xl tabular ${netClass}`}>
          {formatSignedCents(stats.totalNetCents)}
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          <Stat label="Sessions" value={stats.sessionsPlayed.toString()} />
          <Stat label="Wins" value={stats.wins.toString()} accent="sage" />
          <Stat
            label="Losses"
            value={stats.losses.toString()}
            accent="crimson"
          />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 text-center">
          <Stat
            label="E(X)/session"
            value={mean == null ? "—" : formatSignedCents(Math.round(mean))}
          />
          {rating.rating != null && ratingHref ? (
            <Link
              to={ratingHref}
              className="rounded-md bg-card-100/60 px-2 py-1.5 text-center transition hover:bg-card-100"
            >
              <div className="text-[10px] font-medium uppercase tracking-wide text-ink-500">
                Rating
              </div>
              <div className="font-display text-base tabular text-ink-900">
                {rating.rating.toFixed(1)}/10
              </div>
            </Link>
          ) : rating.rating != null ? (
            <div className="rounded-md bg-card-100/60 px-2 py-1.5 text-center">
              <div className="text-[10px] font-medium uppercase tracking-wide text-ink-500">
                Rating
              </div>
              <div className="font-display text-base tabular text-ink-900">
                {rating.rating.toFixed(1)}/10
              </div>
            </div>
          ) : (
            <Stat label="Rating" value="—" />
          )}
        </div>
      </Card>

      <Card className="p-5">
        <div className="text-xs font-medium uppercase tracking-wide text-ink-500">
          Last {recentCount} sessions
        </div>
        <RecentList recent={recent} />
      </Card>
    </div>
  );
}

function RecentList({
  recent,
}: {
  recent: Array<{ session: Session; netCents: number }>;
}) {
  if (recent.length === 0) {
    return <p className="mt-2 text-sm text-ink-500">No sessions played yet.</p>;
  }
  return (
    <ul className="mt-2 divide-y divide-card-100">
      {recent.map((n) => (
        <li
          key={n.session.id}
          className="flex items-center justify-between py-2 text-sm"
        >
          <span className="text-ink-700">
            {formatPlayedAt(n.session.played_at)}
          </span>
          <span
            className={[
              "rounded px-2 py-0.5 text-xs font-medium tabular",
              n.netCents > 0
                ? "bg-sage-500/15 text-sage-700"
                : n.netCents < 0
                  ? "bg-crimson-500/15 text-crimson-700"
                  : "bg-card-100 text-ink-700",
            ].join(" ")}
          >
            {formatSignedCents(n.netCents)}
          </span>
        </li>
      ))}
    </ul>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: "sage" | "crimson";
}) {
  const valColor =
    accent === "sage"
      ? "text-sage-700"
      : accent === "crimson"
        ? "text-crimson-700"
        : "text-ink-900";
  return (
    <div className="rounded-md bg-card-100/60 px-2 py-1.5">
      <div className="text-[10px] font-medium uppercase tracking-wide text-ink-500">
        {label}
      </div>
      <div className={`font-display text-base tabular ${valColor}`}>
        {value}
      </div>
    </div>
  );
}
