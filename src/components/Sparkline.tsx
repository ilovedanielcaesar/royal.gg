type Props = {
  /**
   * Per-night nets in cents, oldest first. The line drawn is their running
   * total, because that is what a trajectory is — a row of independent bars
   * says how each night went, a rising line says the player is climbing.
   */
  nets: number[];
  width?: number;
  height?: number;
  /** Accessible description. Required — a bare line means nothing to a reader. */
  label: string;
};

/**
 * A small hand-rolled trajectory. No chart library, per contract rule 7.
 *
 * Coloured by the sign of the WINDOW's total, not by the last step: the
 * question a sparkline in a standings row answers is "which way is this
 * player going lately", and one good night at the end of five bad ones is not
 * an up arrow.
 */
export default function Sparkline({
  nets,
  width = 68,
  height = 22,
  label,
}: Props) {
  if (nets.length === 0) {
    return <span className="text-xs text-ink-500">—</span>;
  }

  // A loop, not `nets.map(n => running += n)`. Reassigning a captured
  // variable from inside a callback during render is what
  // react-hooks/set-state-in-effect's sibling rule flags, and rightly: the
  // accumulator's lifetime is not obviously one render.
  const cumulative: number[] = [];
  let running = 0;
  for (const n of nets) {
    running += n;
    cumulative.push(running);
  }
  const total = running;

  // The domain always includes 0, so the baseline is meaningful and a line
  // that never goes negative visibly sits above it.
  const lo = Math.min(0, ...cumulative);
  const hi = Math.max(0, ...cumulative);
  const span = hi - lo || 1;

  const pad = 2;
  const innerW = width - pad * 2;
  const innerH = height - pad * 2;
  const xOf = (i: number) =>
    pad + (cumulative.length === 1 ? innerW / 2 : (i / (cumulative.length - 1)) * innerW);
  const yOf = (c: number) => pad + (1 - (c - lo) / span) * innerH;

  const stroke =
    total > 0
      ? "var(--color-sage-600)"
      : total < 0
        ? "var(--color-crimson-600)"
        : "var(--color-ink-500)";

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      role="img"
      aria-label={label}
      className="overflow-visible"
    >
      <line
        x1={pad}
        y1={yOf(0)}
        x2={width - pad}
        y2={yOf(0)}
        stroke="var(--color-ink-500)"
        strokeOpacity={0.22}
        strokeDasharray="2 3"
      />
      {cumulative.length === 1 ? (
        <circle cx={xOf(0)} cy={yOf(cumulative[0]!)} r={2.2} fill={stroke} />
      ) : (
        <polyline
          points={cumulative.map((c, i) => `${xOf(i)},${yOf(c)}`).join(" ")}
          fill="none"
          stroke={stroke}
          strokeWidth={1.6}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      )}
    </svg>
  );
}
