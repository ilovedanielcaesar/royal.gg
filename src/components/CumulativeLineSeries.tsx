import { playerSuit, suitColor } from "../lib/playerSuit";
import type {
  ChartCoordinates,
  ChartSeries,
} from "./cumulativeChartTypes";

type Props = ChartCoordinates & {
  series: ChartSeries[];
  hoveredCol: number | null;
  colorOf?: (playerId: string) => string | null | undefined;
  emphasizedPlayerId?: string | null;
};

export default function CumulativeLineSeries({
  series,
  hoveredCol,
  colorOf,
  emphasizedPlayerId,
  xOf,
  yOf,
}: Props) {
  const hasEmphasis = series.some(
    (entry) =>
      entry.playerId === emphasizedPlayerId && entry.points.length > 0
  );

  return series.map((entry) => {
    if (entry.points.length === 0) return null;
    const overrideColor = colorOf?.(entry.playerId);
    const { suit } = playerSuit(entry.playerId);
    const color =
      overrideColor ??
      (suitColor(suit) === "red"
        ? "var(--color-crimson-600)"
        : "var(--color-ink-900)");
    const isEmphasized = emphasizedPlayerId === entry.playerId;
    const path = entry.points
      .map((point, index) => {
        const command = index === 0 ? "M" : "L";
        return `${command}${xOf(point.sessionIndex).toFixed(1)},${yOf(
          point.cumulativeCents
        ).toFixed(1)}`;
      })
      .join(" ");
    const last = entry.points.at(-1)!;
    const hoveredPoint =
      hoveredCol === null
        ? null
        : [...entry.points]
            .reverse()
            .find((point) => point.sessionIndex <= hoveredCol);

    return (
      <g
        key={entry.playerId}
        opacity={hasEmphasis && !isEmphasized ? 0.22 : 1}
      >
        <path
          d={path}
          fill="none"
          stroke={color}
          strokeWidth={isEmphasized ? 3 : 2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <text
          x={xOf(last.sessionIndex) + 6}
          y={yOf(last.cumulativeCents) + 3}
          fontSize={10}
          fill={color}
        >
          {entry.name}
        </text>
        {hoveredPoint && hoveredCol !== null && (
          <g>
            <circle
              cx={xOf(hoveredCol)}
              cy={yOf(hoveredPoint.cumulativeCents)}
              r={6.5}
              fill={color}
              fillOpacity={0.18}
            />
            <circle
              cx={xOf(hoveredCol)}
              cy={yOf(hoveredPoint.cumulativeCents)}
              r={3.4}
              fill={color}
              stroke="var(--color-card-50)"
              strokeWidth={1.2}
            />
          </g>
        )}
      </g>
    );
  });
}
