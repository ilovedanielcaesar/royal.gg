import { useMemo, useState } from "react";
import { cumulativeDomain, type Domain } from "../lib/chartDomain";
import CumulativeBarSeries from "./CumulativeBarSeries";
import CumulativeChartAxes from "./CumulativeChartAxes";
import CumulativeChartTooltip from "./CumulativeChartTooltip";
import CumulativeLineSeries from "./CumulativeLineSeries";
import type { ChartSeries } from "./cumulativeChartTypes";

type Props = {
  series: ChartSeries[];
  sessions: { id: string; played_at: string }[];
  height?: number;
  mode?: "line" | "bar";
  colorOf?: (playerId: string) => string | null | undefined;
  domain?: Domain;
  tooltip?: "multi" | "single";
  emphasizedPlayerId?: string | null;
};

const WIDTH = 800;
const PAD_LEFT = 54;
const PAD_RIGHT = 64;
const PAD_TOP = 16;
const PAD_BOTTOM = 24;

function perNightDomain(series: ChartSeries[]): Domain {
  const values = series.flatMap((entry) =>
    entry.points.map((point) => Math.abs(point.netCents))
  );
  const maxAbs = Math.max(1000, ...values);
  const padded = maxAbs * 1.12;
  return { yMinCents: -padded, yMaxCents: padded };
}

export default function CumulativeChart({
  series,
  sessions,
  height = 400,
  mode = "line",
  colorOf,
  domain,
  tooltip = "multi",
  emphasizedPlayerId,
}: Props) {
  const [hoverX, setHoverX] = useState<number | null>(null);
  const sortedSessions = useMemo(
    () =>
      [...sessions].sort((a, b) => {
        const dateOrder = a.played_at.localeCompare(b.played_at);
        return dateOrder || a.id.localeCompare(b.id);
      }),
    [sessions]
  );
  const activeDomain = useMemo(
    () =>
      mode === "bar"
        ? perNightDomain(series)
        : (domain ?? cumulativeDomain(series.map((entry) => entry.points))),
    [domain, mode, series]
  );
  const innerWidth = WIDTH - PAD_LEFT - PAD_RIGHT;
  const innerHeight = height - PAD_TOP - PAD_BOTTOM;
  const xOf = (sessionIndex: number) =>
    mode === "bar"
      ? PAD_LEFT + ((sessionIndex + 0.5) / sortedSessions.length) * innerWidth
      : PAD_LEFT +
        (sessionIndex / Math.max(sortedSessions.length - 1, 1)) * innerWidth;
  const yOf = (cents: number) =>
    PAD_TOP +
    (1 -
      (cents - activeDomain.yMinCents) /
        (activeDomain.yMaxCents - activeDomain.yMinCents)) *
      innerHeight;
  const hoveredCol = (() => {
    if (hoverX === null || sortedSessions.length === 0) return null;
    const position = (hoverX - PAD_LEFT) / innerWidth;
    const index =
      mode === "bar"
        ? Math.floor(position * sortedSessions.length)
        : Math.round(position * Math.max(sortedSessions.length - 1, 1));
    return Math.max(0, Math.min(sortedSessions.length - 1, index));
  })();
  const isEmpty =
    series.length === 0 || series.every((entry) => entry.points.length === 0);

  if (isEmpty) {
    return (
      <div
        className="flex items-center justify-center text-sm text-ink-500"
        style={{ height }}
      >
        No sessions yet — once you log a few nights, results draw here.
      </div>
    );
  }

  return (
    <div className="w-full">
      <svg
        viewBox={`0 0 ${WIDTH} ${height}`}
        width="100%"
        role="img"
        onPointerMove={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          setHoverX(((event.clientX - rect.left) / rect.width) * WIDTH);
        }}
        onPointerLeave={() => setHoverX(null)}
        className="overflow-visible"
      >
        <title>
          {mode === "bar"
            ? "Per-night net results"
            : "Cumulative net results"}
        </title>
        <CumulativeChartAxes
          sessions={sortedSessions}
          height={height}
          width={WIDTH}
          padLeft={PAD_LEFT}
          padRight={PAD_RIGHT}
          padTop={PAD_TOP}
          padBottom={PAD_BOTTOM}
          yMin={activeDomain.yMinCents}
          yMax={activeDomain.yMaxCents}
          hoveredCol={hoveredCol}
          xOf={xOf}
          yOf={yOf}
        />
        {mode === "bar" ? (
          <CumulativeBarSeries
            series={series}
            sessionsCount={sortedSessions.length}
            plotWidth={innerWidth}
            xOf={xOf}
            yOf={yOf}
          />
        ) : (
          <CumulativeLineSeries
            series={series}
            hoveredCol={hoveredCol}
            colorOf={colorOf}
            emphasizedPlayerId={emphasizedPlayerId}
            xOf={xOf}
            yOf={yOf}
          />
        )}
        {hoveredCol !== null && (
          <CumulativeChartTooltip
            hoveredCol={hoveredCol}
            series={series}
            sessions={sortedSessions}
            colorOf={colorOf}
            mode={mode === "bar" ? "bar" : tooltip}
            colX={xOf(hoveredCol)}
            maxX={WIDTH - PAD_RIGHT}
            top={PAD_TOP}
          />
        )}
      </svg>
    </div>
  );
}
