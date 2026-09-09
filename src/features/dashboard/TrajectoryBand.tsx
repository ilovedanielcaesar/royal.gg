import { useMemo, useState } from "react";
import Band from "../../components/Band";
import CumulativeChart from "../../components/CumulativeChart";
import { cumulativeDomain } from "../../lib/chartDomain";
import type { CumulativePoint, Player, Session } from "../../lib/stats";

type Series = { playerId: string; name: string; points: CumulativePoint[] };

type Props = {
  sessions: Session[];
  /** Your own line. Empty when you have no roster row or no nights. */
  yourSeries: Series[];
  /** Top-3 winners and top-3 losers, lifetime. */
  leagueSeries: Series[];
  colorOf: (playerId: string) => string | undefined;
  legend: {
    winners: Array<{ player: Player; color: string }>;
    losers: Array<{ player: Player; color: string }>;
  };
};

type View = "you" | "league";

/**
 * Band 3 — one chart, two subjects.
 *
 * The tabs switch **subject, not time window**: `You` draws your cumulative
 * net, `League` overlays the lifetime top three winners and bottom three
 * losers. An `All time / Season / Last 10` control was considered and
 * dropped — it switches time window, which needs a "season" the app has no
 * concept of.
 */
export default function TrajectoryBand({
  sessions,
  yourSeries,
  leagueSeries,
  colorOf,
  legend,
}: Props) {
  const [view, setView] = useState<View>("you");

  // ONE domain, computed across both views. Neither view narrows it to its
  // own data, so switching tabs leaves the gridlines, the zero line and the
  // money labels exactly where they were — otherwise the toggle reads as two
  // different charts rather than one chart filtered. The cost is real and
  // accepted: a single player's line uses only part of the height, because
  // the domain has to hold the biggest winner and the biggest loser at once.
  const domain = useMemo(
    () =>
      cumulativeDomain(
        [...yourSeries, ...leagueSeries].map((s) => s.points)
      ),
    [yourSeries, leagueSeries]
  );

  const active = view === "you" ? yourSeries : leagueSeries;
  const hasAnything = yourSeries.length > 0 || leagueSeries.length > 0;

  return (
    <Band
      title="Your trajectory"
      caption="Cumulative net, night by night"
      action={
        <div
          role="tablist"
          aria-label="Chart subject"
          className="inline-flex rounded-full bg-card-100/70 p-0.5"
        >
          <Tab
            label="You"
            selected={view === "you"}
            onSelect={() => setView("you")}
          />
          <Tab
            label="League"
            selected={view === "league"}
            onSelect={() => setView("league")}
          />
        </div>
      }
    >
      {!hasAnything ? (
        <p className="mt-4 text-sm text-ink-500">
          Once a few nights are logged, trajectories draw here.
        </p>
      ) : (
        <div className="mt-4">
          <CumulativeChart
            series={active}
            sessions={sessions}
            colorOf={colorOf}
            domain={domain}
            tooltip={view === "you" ? "single" : "multi"}
            height={340}
          />
          {view === "league" && <Legend {...legend} />}
        </div>
      )}
    </Band>
  );
}

function Tab({
  label,
  selected,
  onSelect,
}: {
  label: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      onClick={onSelect}
      className={[
        "min-h-9 rounded-full px-4 text-xs font-medium transition",
        selected
          ? "bg-card-50 text-ink-900 shadow-[0_1px_0_rgba(0,0,0,0.12)]"
          : "text-ink-500 hover:text-ink-900",
      ].join(" ")}
    >
      {label}
    </button>
  );
}

function Legend({
  winners,
  losers,
}: {
  winners: Array<{ player: Player; color: string }>;
  losers: Array<{ player: Player; color: string }>;
}) {
  if (winners.length === 0 && losers.length === 0) return null;
  const all = [...winners, ...losers];
  return (
    <ul className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5">
      {all.map((entry) => (
        <li
          key={entry.player.id}
          className="inline-flex items-center gap-1.5 text-xs text-ink-700"
        >
          <span
            aria-hidden="true"
            className="inline-block h-2 w-3.5 rounded-sm"
            style={{ backgroundColor: entry.color }}
          />
          {entry.player.display_name ?? entry.player.name}
        </li>
      ))}
    </ul>
  );
}
