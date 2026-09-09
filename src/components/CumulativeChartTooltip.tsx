import { formatSignedCents } from "../lib/money";
import { playerSuit, suitColor } from "../lib/playerSuit";
import type { CumulativePoint } from "../lib/stats";

type Props = {
  /** The session column being hovered — one night, not one vertex. */
  hoveredCol: number;
  series: Array<{ playerId: string; name: string; points: CumulativePoint[] }>;
  sessions: { id: string; played_at: string }[];
  colorOf?: (playerId: string) => string | null | undefined;
  /** See `CumulativeChart`'s `tooltip` prop. */
  mode: "multi" | "single";
  /** SVG x of the hovered column. */
  colX: number;
  /** Right edge of the plot area. The box flips to the left of the column
   *  rather than overflowing past this. */
  maxX: number;
  /** SVG y of the top of the plot area. */
  top: number;
};

/**
 * The hover readout for `CumulativeChart`.
 *
 * Its own file because the chart was 460 lines with this inline, and Stage 4
 * adds a bar mode to that same file. Nothing here is chart-agnostic — it is
 * split for size, not for reuse.
 */
export default function CumulativeChartTooltip({
  hoveredCol,
  series,
  sessions,
  colorOf,
  mode,
  colX,
  maxX,
  top,
}: Props) {
  const session = sessions[hoveredCol];
  const dateLabel = (() => {
    if (!session) return `Session #${hoveredCol + 1}`;
    const date = new Date(session.played_at + "T12:00:00");
    const dd = String(date.getDate()).padStart(2, "0");
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const yy = String(date.getFullYear()).slice(-2);
    return `${dd}/${mm}/${yy}`;
  })();

  const rows = series
    .map((s) => {
      const exact = s.points.find((p) => p.sessionIndex === hoveredCol);
      const carried =
        exact ??
        [...s.points].reverse().find((p) => p.sessionIndex <= hoveredCol);
      if (!carried) return null;
      const override = colorOf ? colorOf(s.playerId) : null;
      const { suit } = playerSuit(s.playerId);
      return {
        name: s.name,
        color:
          override ??
          (suitColor(suit) === "red"
            ? "var(--color-crimson-600)"
            : "var(--color-ink-900)"),
        cumulativeCents: carried.cumulativeCents,
        // Null when the player did not play this night — their line is flat
        // here and there is no result to report.
        nightNetCents: exact ? exact.netCents : null,
      };
    })
    .filter((r): r is NonNullable<typeof r> => Boolean(r))
    // Ordered by standing on THAT night, not today's. The point of hovering
    // an old game is seeing who was ahead then.
    .sort((a, b) => b.cumulativeCents - a.cumulativeCents)
    .slice(0, 6);

  if (rows.length === 0) return null;

  const single = mode === "single";
  const boxW = single ? 152 : 186;
  const boxH = single ? 62 : 20 + rows.length * 15 + 6;
  const placeRight = colX < maxX - boxW - 8;
  const tx = placeRight ? colX + 8 : colX - boxW - 8;
  const ty = top + 6;

  const toneOf = (cents: number) =>
    cents > 0
      ? "var(--color-sage-700)"
      : cents < 0
        ? "var(--color-crimson-700)"
        : "var(--color-ink-500)";

  return (
    <g pointerEvents="none">
      <rect
        x={tx}
        y={ty}
        width={boxW}
        height={boxH}
        rx={8}
        ry={8}
        fill="var(--color-card-50)"
        stroke="var(--color-card-200)"
      />
      <text
        x={tx + 10}
        y={ty + 15}
        fontSize={9}
        fontWeight={600}
        letterSpacing="0.08em"
        fill="var(--color-ink-500)"
      >
        {dateLabel}
      </text>

      {single ? (
        <SingleRow
          row={rows[0]!}
          x={tx + 10}
          y={ty}
          toneOf={toneOf}
        />
      ) : (
        rows.map((r, i) => (
          <g key={r.name}>
            <rect
              x={tx + 10}
              y={ty + 22 + i * 15}
              width={8}
              height={8}
              rx={2}
              fill={r.color}
            />
            <text
              x={tx + 23}
              y={ty + 30 + i * 15}
              fontSize={10}
              fill="var(--color-ink-900)"
            >
              {r.name}
            </text>
            <text
              x={tx + boxW - 10}
              y={ty + 30 + i * 15}
              fontSize={10}
              textAnchor="end"
              fill={toneOf(r.cumulativeCents)}
              className="tabular"
            >
              {formatSignedCents(r.cumulativeCents)}
            </text>
          </g>
        ))
      )}
    </g>
  );
}

/**
 * The one-player readout: cumulative as the headline, that night's own result
 * beneath it. The line plots cumulative, so the night's net is the difference
 * from the night before — and that difference is what you hover a point to
 * find out.
 */
function SingleRow({
  row,
  x,
  y,
  toneOf,
}: {
  row: { cumulativeCents: number; nightNetCents: number | null };
  x: number;
  y: number;
  toneOf: (cents: number) => string;
}) {
  return (
    <>
      <text
        x={x}
        y={y + 36}
        fontSize={16}
        fill={toneOf(row.cumulativeCents)}
        className="tabular"
      >
        {formatSignedCents(row.cumulativeCents)}
      </text>
      <text
        x={x}
        y={y + 52}
        fontSize={10}
        fill="var(--color-ink-500)"
        className="tabular"
      >
        {row.nightNetCents === null
          ? "did not play"
          : `this night ${formatSignedCents(row.nightNetCents)}`}
      </text>
    </>
  );
}
