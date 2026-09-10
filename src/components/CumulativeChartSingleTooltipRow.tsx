import { formatSignedCents } from "../lib/money";
import { moneyToneClass } from "../lib/moneyTone";

type Props = {
  row: { cumulativeCents: number; nightNetCents: number | null };
  x: number;
  y: number;
  bar: boolean;
};

export default function CumulativeChartSingleTooltipRow({
  row,
  x,
  y,
  bar,
}: Props) {
  const headlineCents = bar
    ? (row.nightNetCents ?? 0)
    : row.cumulativeCents;

  return (
    <>
      <text
        x={x}
        y={y + 36}
        fontSize={16}
        className={`tabular fill-current ${moneyToneClass(headlineCents)}`}
      >
        {formatSignedCents(headlineCents)}
      </text>
      <text
        x={x}
        y={y + 52}
        fontSize={10}
        fill="var(--color-ink-500)"
        className="tabular"
      >
        {bar
          ? "per-night net"
          : row.nightNetCents === null
            ? "did not play"
            : `this night ${formatSignedCents(row.nightNetCents)}`}
      </text>
    </>
  );
}
