import type { CumulativePoint } from "./stats";

export type Domain = { yMinCents: number; yMaxCents: number };

/**
 * The y-domain that holds every point handed in, with 12% headroom.
 *
 * Its own module so a caller with two views' worth of series can compute ONE
 * domain across all of them and hand the same object to both — which is what
 * stops the gridlines moving when a chart's tabs are switched.
 */
export function cumulativeDomain(pointSets: CumulativePoint[][]): Domain {
  let min = 0;
  let max = 0;
  pointSets.forEach((points) =>
    points.forEach((p) => {
      if (p.cumulativeCents < min) min = p.cumulativeCents;
      if (p.cumulativeCents > max) max = p.cumulativeCents;
    })
  );
  if (min === max) return { yMinCents: -1000, yMaxCents: 1000 };
  const pad = (max - min) * 0.12;
  return { yMinCents: min - pad, yMaxCents: max + pad };
}
