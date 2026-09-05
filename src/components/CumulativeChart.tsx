import { useMemo, useState } from "react";
import { playerSuit, suitColor } from "../lib/playerSuit";
import { formatSignedCents } from "../lib/money";
import type { CumulativePoint } from "../lib/stats";

type Props = {
  series: Array<{
    playerId: string;
    name: string;
    points: CumulativePoint[];
  }>;
  sessions: { id: string; played_at: string }[];
  height?: number;
  /**
   * Returns a CSS color (e.g. "var(--color-sage-600)") for a series. If omitted,
   * the chart falls back to suit-derived ink/crimson colors.
   */
  colorOf?: (playerId: string) => string | null | undefined;
};

const PAD_LEFT = 44;
const PAD_RIGHT = 64;
const PAD_TOP = 16;
const PAD_BOTTOM = 24;

export default function CumulativeChart({
  series,
  sessions,
  height = 400,
  colorOf,
}: Props) {
  const [hoverX, setHoverX] = useState<number | null>(null);

  const { yMin, yMax, xMax } = useMemo(() => {
    let min = 0;
    let max = 0;
    series.forEach((s) =>
      s.points.forEach((p) => {
        if (p.cumulativeCents < min) min = p.cumulativeCents;
        if (p.cumulativeCents > max) max = p.cumulativeCents;
      })
    );
    if (min === max) {
      min = -1000;
      max = 1000;
    } else {
      const pad = (max - min) * 0.12;
      min -= pad;
      max += pad;
    }
    return { yMin: min, yMax: max, xMax: Math.max(sessions.length - 1, 1) };
  }, [series, sessions]);

  const width = 800; // viewBox width — chart scales with container
  const innerW = width - PAD_LEFT - PAD_RIGHT;
  const innerH = height - PAD_TOP - PAD_BOTTOM;

  function xOf(sessionIdx: number) {
    return PAD_LEFT + (sessionIdx / xMax) * innerW;
  }
  function yOf(cents: number) {
    return PAD_TOP + (1 - (cents - yMin) / (yMax - yMin)) * innerH;
  }

  const gridSteps = 4;
  const gridLines = Array.from({ length: gridSteps + 1 }, (_, i) => {
    const t = i / gridSteps;
    const cents = yMin + (yMax - yMin) * (1 - t);
    return { y: PAD_TOP + t * innerH, cents };
  });

  const zeroY = yOf(0);

  // Snap hoverX to a session column.
  const hoveredCol =
    hoverX === null
      ? null
      : Math.max(
          0,
          Math.min(
            sessions.length - 1,
            Math.round(((hoverX - PAD_LEFT) / innerW) * xMax)
          )
        );

  if (series.length === 0 || series.every((s) => s.points.length === 0)) {
    return (
      <div className="flex h-[400px] items-center justify-center text-sm text-ink-500">
        No sessions yet — once you log a few nights, lifetime trajectories
        will draw here.
      </div>
    );
  }

  return (
    <div className="w-full">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const px = e.clientX - rect.left;
          const svgX = (px / rect.width) * width;
          setHoverX(svgX);
        }}
        onMouseLeave={() => setHoverX(null)}
        className="overflow-visible"
      >
        {/* Y-axis grid */}
        {gridLines.map((g, i) => (
          <g key={i}>
            <line
              x1={PAD_LEFT}
              y1={g.y}
              x2={width - PAD_RIGHT}
              y2={g.y}
              stroke="var(--color-ink-500)"
              strokeOpacity={0.18}
              strokeDasharray={i === 0 || i === gridSteps ? "0" : "2 4"}
            />
            <text
              x={PAD_LEFT - 8}
              y={g.y + 3}
              textAnchor="end"
              fontSize={10}
              fill="var(--color-ink-500)"
              className="tabular"
            >
              {(() => {
                const dollars = Math.round(g.cents / 100);
                const sign = dollars > 0 ? "+" : dollars < 0 ? "-" : "";
                return `${sign}$${Math.abs(dollars)}`;
              })()}
            </text>
          </g>
        ))}

        {/* Zero line */}
        {yMin < 0 && yMax > 0 && (
          <line
            x1={PAD_LEFT}
            y1={zeroY}
            x2={width - PAD_RIGHT}
            y2={zeroY}
            stroke="var(--color-gold-500)"
            strokeOpacity={0.6}
          />
        )}

        {/* X-axis ticks (sparse, max 6) */}
        {sessions.length > 0 &&
          (() => {
            const numTicks = Math.min(sessions.length, 6);
            const ticks = [];
            if (numTicks === 1) {
              ticks.push(0);
            } else {
              for (let i = 0; i < numTicks; i++) {
                ticks.push(Math.floor((i / (numTicks - 1)) * (sessions.length - 1)));
              }
            }
            return ticks.map((i) => {
              const session = sessions[i];
              if (!session) return null;
              const date = new Date(session.played_at + "T12:00:00");
              const dd = String(date.getDate()).padStart(2, "0");
              const mm = String(date.getMonth() + 1).padStart(2, "0");
              const yy = String(date.getFullYear()).slice(-2);
              return (
                <text
                  key={i}
                  x={xOf(i)}
                  y={height - 6}
                  textAnchor="middle"
                  fontSize={10}
                  fill="var(--color-ink-500)"
                >
                  {dd}/{mm}/{yy}
                </text>
              );
            });
          })()}

        {/* Hover rule */}
        {hoveredCol !== null && (
          <line
            x1={xOf(hoveredCol)}
            y1={PAD_TOP}
            x2={xOf(hoveredCol)}
            y2={height - PAD_BOTTOM}
            stroke="var(--color-ink-500)"
            strokeOpacity={0.25}
          />
        )}

        {/* Series */}
        {series.map((s) => {
          if (s.points.length === 0) return null;
          const overrideColor = colorOf ? colorOf(s.playerId) : null;
          let color: string;
          if (overrideColor) {
            color = overrideColor;
          } else {
            const { suit } = playerSuit(s.playerId);
            color =
              suitColor(suit) === "red"
                ? "var(--color-crimson-600)"
                : "var(--color-ink-900)";
          }
          // Path: start at first point's session index, draw line through cumulative.
          const d = s.points
            .map((p, i) => {
              const x = xOf(p.sessionIndex);
              const y = yOf(p.cumulativeCents);
              return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
            })
            .join(" ");
          const last = s.points[s.points.length - 1]!;
          return (
            <g key={s.playerId}>
              <path
                d={d}
                fill="none"
                stroke={color}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              {/* End label */}
              <text
                x={xOf(last.sessionIndex) + 6}
                y={yOf(last.cumulativeCents) + 3}
                fontSize={10}
                fill={color}
                className="tabular"
              >
                {s.name}
              </text>
              {/* Hover dot */}
              {hoveredCol !== null &&
                (() => {
                  // Find the latest point ≤ hoveredCol
                  const pt = [...s.points]
                    .reverse()
                    .find((p) => p.sessionIndex <= hoveredCol);
                  if (!pt) return null;
                  return (
                    <circle
                      cx={xOf(hoveredCol)}
                      cy={yOf(pt.cumulativeCents)}
                      r={3}
                      fill={color}
                    />
                  );
                })()}
            </g>
          );
        })}

        {/* Hover tooltip — shows lifetime cumulative net P/L at that point in
            time so you can read each player's running total at a glance. */}
        {hoveredCol !== null &&
          (() => {
            const lines = series
              .map((s) => {
                const pt =
                  s.points.find((p) => p.sessionIndex === hoveredCol) ??
                  [...s.points]
                    .reverse()
                    .find((p) => p.sessionIndex <= hoveredCol);
                if (!pt) return null;
                return { name: s.name, cents: pt.cumulativeCents };
              })
              .filter((x): x is { name: string; cents: number } => Boolean(x))
              .sort((a, b) => b.cents - a.cents)
              .slice(0, 6);
            const x = xOf(hoveredCol);
            const tooltipW = 140;
            const placeRight = x < width - PAD_RIGHT - tooltipW - 8;
            const tx = placeRight ? x + 8 : x - tooltipW - 8;
            const ty = PAD_TOP + 6;
            const tooltipH = 14 + lines.length * 14 + 6;
            return (
              <g pointerEvents="none">
                <rect
                  x={tx}
                  y={ty}
                  width={tooltipW}
                  height={tooltipH}
                  rx={6}
                  ry={6}
                  fill="var(--color-card-50)"
                  stroke="var(--color-card-200)"
                />
                <text
                  x={tx + 8}
                  y={ty + 14}
                  fontSize={10}
                  fill="var(--color-ink-500)"
                  fontWeight={600}
                >
                  {(() => {
                    const session = sessions[hoveredCol];
                    if (!session) return `Session #${hoveredCol + 1}`;
                    const date = new Date(session.played_at + "T12:00:00");
                    const dd = String(date.getDate()).padStart(2, "0");
                    const mm = String(date.getMonth() + 1).padStart(2, "0");
                    const yy = String(date.getFullYear()).slice(-2);
                    return `Session: ${dd}/${mm}/${yy}`;
                  })()}
                </text>
                {lines.map((l, i) => (
                  <text
                    key={l.name}
                    x={tx + 8}
                    y={ty + 28 + i * 14}
                    fontSize={11}
                    fill={
                      l.cents > 0
                        ? "var(--color-sage-700)"
                        : l.cents < 0
                          ? "var(--color-crimson-700)"
                          : "var(--color-ink-900)"
                    }
                    className="tabular"
                  >
                    {l.name} {formatSignedCents(l.cents)}
                  </text>
                ))}
              </g>
            );
          })()}
      </svg>
    </div>
  );
}
