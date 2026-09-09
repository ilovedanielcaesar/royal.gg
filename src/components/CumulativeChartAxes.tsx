import { formatSignedCents } from "../lib/money";

type Props = {
  sessions: { id: string; played_at: string }[];
  height: number;
  width: number;
  padLeft: number;
  padRight: number;
  padTop: number;
  padBottom: number;
  yMin: number;
  yMax: number;
  hoveredCol: number | null;
  xOf: (sessionIndex: number) => number;
  yOf: (cents: number) => number;
};

export default function CumulativeChartAxes({
  sessions,
  height,
  width,
  padLeft,
  padRight,
  padTop,
  padBottom,
  yMin,
  yMax,
  hoveredCol,
  xOf,
  yOf,
}: Props) {
  const gridLines = Array.from({ length: 5 }, (_, index) => {
    const ratio = index / 4;
    return {
      y: padTop + ratio * (height - padTop - padBottom),
      cents: yMin + (yMax - yMin) * (1 - ratio),
    };
  });
  const tickCount = Math.min(sessions.length, 6);
  const ticks = Array.from({ length: tickCount }, (_, index) =>
    tickCount === 1
      ? 0
      : Math.floor((index / (tickCount - 1)) * (sessions.length - 1))
  );

  return (
    <>
      {gridLines.map((line, index) => (
        <g key={index}>
          <line
            x1={padLeft}
            y1={line.y}
            x2={width - padRight}
            y2={line.y}
            stroke="var(--color-ink-500)"
            strokeOpacity={0.18}
            strokeDasharray={index === 0 || index === 4 ? "0" : "2 4"}
          />
          <text
            x={padLeft - 8}
            y={line.y + 3}
            textAnchor="end"
            fontSize={10}
            fill="var(--color-ink-500)"
            className="tabular"
          >
            {formatSignedCents(Math.round(line.cents))}
          </text>
        </g>
      ))}
      {yMin < 0 && yMax > 0 && (
        <line
          x1={padLeft}
          y1={yOf(0)}
          x2={width - padRight}
          y2={yOf(0)}
          stroke="var(--color-gold-500)"
          strokeOpacity={0.6}
        />
      )}
      {ticks.map((index) => {
        const session = sessions[index];
        if (!session) return null;
        const date = new Date(`${session.played_at}T12:00:00`);
        return (
          <text
            key={session.id}
            x={xOf(index)}
            y={height - 6}
            textAnchor="middle"
            fontSize={10}
            fill="var(--color-ink-500)"
          >
            {String(date.getDate()).padStart(2, "0")}/
            {String(date.getMonth() + 1).padStart(2, "0")}/
            {String(date.getFullYear()).slice(-2)}
          </text>
        );
      })}
      {hoveredCol !== null && (
        <line
          x1={xOf(hoveredCol)}
          y1={padTop}
          x2={xOf(hoveredCol)}
          y2={height - padBottom}
          stroke="var(--color-ink-500)"
          strokeOpacity={0.28}
        />
      )}
    </>
  );
}
