import { useState } from "react";
import Band from "../../components/Band";
import CumulativeChart from "../../components/CumulativeChart";
import type { CumulativePoint, Session } from "../../lib/stats";

type Mode = "line" | "bar";

type Props = {
  sessions: Session[];
  series: Array<{
    playerId: string;
    name: string;
    points: CumulativePoint[];
  }>;
};

export default function NightsChartBand({ sessions, series }: Props) {
  const [mode, setMode] = useState<Mode>("line");

  return (
    <Band
      title={`Your ${sessions.length} ${sessions.length === 1 ? "night" : "nights"}`}
      kicker="Results chart"
      action={
        <div
          role="tablist"
          aria-label="Chart mode"
          className="inline-flex rounded-full bg-card-100 p-[3px]"
        >
          {(["line", "bar"] as const).map((candidate) => (
            <button
              key={candidate}
              type="button"
              role="tab"
              aria-selected={mode === candidate}
              onClick={() => setMode(candidate)}
              className={[
                "min-h-9 rounded-full px-3.5 text-xs font-medium transition",
                mode === candidate
                  ? "bg-card-50 text-ink-900 shadow-sm"
                  : "text-ink-500 hover:text-ink-900",
              ].join(" ")}
            >
              {candidate === "line" ? "Cumulative line" : "Per-night bar"}
            </button>
          ))}
        </div>
      }
    >
      <div className="mt-5">
        <CumulativeChart
          series={series}
          sessions={sessions}
          mode={mode}
          colorOf={() => "var(--color-ink-900)"}
          tooltip="single"
          height={300}
        />
      </div>
    </Band>
  );
}
