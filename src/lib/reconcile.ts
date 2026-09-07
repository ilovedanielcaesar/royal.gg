export type ReconcileInput = {
  playerId: string;
  buyInCents: number;
  reportedCashOutCents: number;
};

export type ReconcileResult = {
  playerId: string;
  buyInCents: number;
  reportedCashOutCents: number;
  adjustedCashOutCents: number;
  netCents: number;
};

export type ReconcileSummary = {
  results: ReconcileResult[];
  discrepancyCents: number;
  needsReview: boolean;
  totalBuyInCents: number;
  totalReportedCents: number;
};

/**
 * `thresholdCents` is required on purpose. It used to default to a hardcoded
 * 500, which meant a call site that forgot to pass the group's threshold got
 * $5 and looked entirely correct. Every group now sets its own, and a missing
 * argument has to be a compile error rather than a silently wrong policy.
 */
export function reconcile(
  rows: ReconcileInput[],
  thresholdCents: number
): ReconcileSummary {
  const totalBuyInCents = rows.reduce((s, r) => s + r.buyInCents, 0);
  const totalReportedCents = rows.reduce(
    (s, r) => s + r.reportedCashOutCents,
    0
  );
  const discrepancyCents = totalBuyInCents - totalReportedCents;

  if (discrepancyCents === 0) {
    return {
      results: rows.map((r) => ({
        playerId: r.playerId,
        buyInCents: r.buyInCents,
        reportedCashOutCents: r.reportedCashOutCents,
        adjustedCashOutCents: r.reportedCashOutCents,
        netCents: r.reportedCashOutCents - r.buyInCents,
      })),
      discrepancyCents: 0,
      needsReview: false,
      totalBuyInCents,
      totalReportedCents,
    };
  }

  if (Math.abs(discrepancyCents) > thresholdCents) {
    return {
      results: rows.map((r) => ({
        playerId: r.playerId,
        buyInCents: r.buyInCents,
        reportedCashOutCents: r.reportedCashOutCents,
        adjustedCashOutCents: r.reportedCashOutCents,
        netCents: r.reportedCashOutCents - r.buyInCents,
      })),
      discrepancyCents,
      needsReview: true,
      totalBuyInCents,
      totalReportedCents,
    };
  }

  // Distribute the discrepancy proportionally among winners
  // (positive net before adjustment), weighted by their winnings.
  // Largest-remainder rounding so the integer-cent adjustments sum exactly to the discrepancy.
  const netsBefore = rows.map(
    (r) => r.reportedCashOutCents - r.buyInCents
  );
  const winnerIndices = netsBefore
    .map((n, i) => ({ n, i }))
    .filter((x) => x.n > 0)
    .map((x) => x.i);

  const adjustments = new Array<number>(rows.length).fill(0);

  if (winnerIndices.length === 0) {
    // Edge case: no winners to absorb the discrepancy. Flag for review.
    return {
      results: rows.map((r) => ({
        playerId: r.playerId,
        buyInCents: r.buyInCents,
        reportedCashOutCents: r.reportedCashOutCents,
        adjustedCashOutCents: r.reportedCashOutCents,
        netCents: r.reportedCashOutCents - r.buyInCents,
      })),
      discrepancyCents,
      needsReview: true,
      totalBuyInCents,
      totalReportedCents,
    };
  }

  const totalWinnings = winnerIndices.reduce(
    (s, i) => s + netsBefore[i],
    0
  );

  // Exact rational shares: discrepancy * winnings_i / totalWinnings.
  // Floor each, then distribute the remainder to the largest fractional parts.
  const exact = winnerIndices.map((i) => ({
    i,
    numerator: discrepancyCents * netsBefore[i],
  }));
  const floors = exact.map((e) => ({
    i: e.i,
    floor: Math.trunc(e.numerator / totalWinnings),
    remainder:
      ((e.numerator % totalWinnings) + totalWinnings) % totalWinnings,
  }));
  const allocated = floors.reduce((s, f) => s + f.floor, 0);
  let leftover = discrepancyCents - allocated;

  floors.forEach(({ i, floor }) => {
    adjustments[i] = floor;
  });

  // Distribute leftover ±1 cent at a time by largest remainder.
  const order = [...floors].sort((a, b) => b.remainder - a.remainder);
  let k = 0;
  while (leftover !== 0 && k < order.length * 2) {
    const slot = order[k % order.length];
    if (leftover > 0) {
      adjustments[slot.i] += 1;
      leftover -= 1;
    } else {
      adjustments[slot.i] -= 1;
      leftover += 1;
    }
    k += 1;
  }

  const results: ReconcileResult[] = rows.map((r, idx) => {
    const adjusted = r.reportedCashOutCents + adjustments[idx];
    return {
      playerId: r.playerId,
      buyInCents: r.buyInCents,
      reportedCashOutCents: r.reportedCashOutCents,
      adjustedCashOutCents: adjusted,
      netCents: adjusted - r.buyInCents,
    };
  });

  return {
    results,
    discrepancyCents,
    needsReview: false,
    totalBuyInCents,
    totalReportedCents,
  };
}
