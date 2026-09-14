import type { ChartSeries } from "../../components/cumulativeChartTypes";
import type { Rank, Suit } from "../../lib/playerSuit";

/**
 * The sample league the landing page is built on.
 *
 * It is invented, but it is not decorative: the figures reconcile the way the
 * app insists real ones do, so a visitor reading closely finds a consistent
 * ledger rather than lorem ipsum with dollar signs. Every amount here is in
 * integer cents, same as the rest of the app — a landing page is no excuse to
 * start doing money in floats.
 */

export const SAMPLE_NIGHT_COUNT = 24;

/** 24 weekly nights, 27 Mar – 4 Sep 2026. */
const FIRST_NIGHT = new Date(2026, 2, 27);

function isoDate(d: Date): string {
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}

export const SAMPLE_SESSIONS = Array.from(
  { length: SAMPLE_NIGHT_COUNT },
  (_, i) => ({
    id: `sample-night-${i}`,
    played_at: isoDate(new Date(FIRST_NIGHT.getTime() + i * 7 * 864e5)),
  })
);

type SampleLine = {
  playerId: string;
  /** Surname: two of the six are Phils, and the chart labels lines by name. */
  name: string;
  color: string;
  /** Lifetime net in cents — where this player's line has to finish. */
  finalCents: number;
  seed: number;
  /** Nights missed at the start; a member who joined the game late. */
  startNight: number;
};

const LINES: SampleLine[] = [
  { playerId: "brunson", name: "Brunson", color: "var(--color-sage-700)", finalCents: 41200, seed: 29, startNight: 0 },
  { playerId: "hellmuth", name: "Hellmuth", color: "var(--color-teal-500)", finalCents: 28650, seed: 19, startNight: 2 },
  { playerId: "ivey", name: "Ivey", color: "var(--color-sky-500)", finalCents: 13400, seed: 31, startNight: 5 },
  { playerId: "negreanu", name: "Negreanu", color: "var(--color-amber-500)", finalCents: -14250, seed: 79, startNight: 1 },
  { playerId: "chan", name: "Chan", color: "var(--color-orange-500)", finalCents: -21150, seed: 61, startNight: 0 },
  { playerId: "seidel", name: "Seidel", color: "var(--color-crimson-600)", finalCents: -47850, seed: 43, startNight: 0 },
];

/**
 * A seeded random walk that lands exactly on the lifetime figure.
 *
 * The swing is deliberately wide. A poker night's net is far noisier than the
 * trend under it, and a line that only ever drifts upward is a lie about what
 * the game is like. A slow second wave runs beneath the noise so form lasts a
 * few weeks rather than alternating every night.
 */
function walk(seed: number, nights: number, finalCents: number): number[] {
  let h = (seed * 2654435761) >>> 0;
  const swing = Math.max(9000, (Math.abs(finalCents) / nights) * 7.5);
  const cumulative: number[] = [];
  let acc = 0;
  for (let i = 0; i < nights; i += 1) {
    h = (h * 1103515245 + 12345) >>> 0;
    const r = h / 4294967296 - 0.5;
    const wave = Math.sin((i / nights) * Math.PI * 2.6 + seed) * swing * 0.42;
    acc += finalCents / nights + r * swing + wave;
    cumulative.push(acc);
  }
  // Spread the rounding drift back across the walk so the last point is the
  // lifetime figure to the cent, not near it.
  const drift = finalCents - cumulative[nights - 1]!;
  return cumulative.map((v, i) =>
    Math.round(v + (drift * (i + 1)) / nights)
  );
}

export const SAMPLE_SERIES: ChartSeries[] = LINES.map((line) => {
  const nights = SAMPLE_NIGHT_COUNT - line.startNight;
  const cumulative = walk(line.seed, nights, line.finalCents);
  return {
    playerId: line.playerId,
    name: line.name,
    points: cumulative.map((cumulativeCents, i) => {
      const sessionIndex = line.startNight + i;
      return {
        sessionIndex,
        sessionId: SAMPLE_SESSIONS[sessionIndex]!.id,
        playedAt: SAMPLE_SESSIONS[sessionIndex]!.played_at,
        netCents: cumulativeCents - (i === 0 ? 0 : cumulative[i - 1]!),
        cumulativeCents,
      };
    }),
  };
});

const COLORS = new Map(LINES.map((line) => [line.playerId, line.color]));
export function sampleColorOf(playerId: string): string | undefined {
  return COLORS.get(playerId);
}

export type SampleStanding = {
  position: number;
  playerId: string;
  name: string;
  suit: Suit;
  rank: Rank;
  /** Player score, 0–10. Not money, so it is never money-toned. */
  score: string;
  /** Per-night nets in cents for the last five nights, oldest first. */
  lastFive: number[];
  netCents: number;
  /** The row picked out on the felt — the visitor's stand-in. */
  isYou?: boolean;
};

/**
 * The same six players the chart draws, so a visitor comparing the two
 * sections finds the same league in both. Their lifetime nets sum to exactly
 * $0.00 — which is not decoration: money only moves between players, so a
 * league whose column does not sum to zero has lost track of some of it.
 */
export const SAMPLE_STANDINGS: SampleStanding[] = [
  { position: 1, playerId: "brunson", name: "Doyle Brunson", suit: "spade", rank: "A", score: "8.1", lastFive: [-2400, 6800, 3100, -4200, 7400], netCents: 41200, isYou: true },
  { position: 2, playerId: "hellmuth", name: "Phil Hellmuth", suit: "heart", rank: "Q", score: "7.6", lastFive: [1500, -2200, 5600, -900, 4800], netCents: 28650 },
  { position: 3, playerId: "ivey", name: "Phil Ivey", suit: "club", rank: "K", score: "6.9", lastFive: [4200, -5100, 1800, -3900, 4100], netCents: 13400 },
  { position: 4, playerId: "negreanu", name: "Daniel Negreanu", suit: "diamond", rank: "9", score: "5.4", lastFive: [3200, -4100, 2600, -3900, 2200], netCents: -14250 },
  { position: 5, playerId: "chan", name: "Johnny Chan", suit: "heart", rank: "J", score: "4.3", lastFive: [-1800, 2400, -3600, 1200, -2900], netCents: -21150 },
  { position: 6, playerId: "seidel", name: "Erik Seidel", suit: "spade", rank: "8", score: "3.2", lastFive: [2600, -1400, 900, -5200, -6800], netCents: -47850 },
];

export const SAMPLE_BUY_IN_CENTS = 4000;

export type SampleLedgerRow = {
  playerId: string;
  name: string;
  suit: Suit;
  rank: Rank | null;
  isGuest?: boolean;
  buyIns: number;
  cashOutCents: number;
};

/**
 * The draft night. It is $4.50 short, which is the whole point of the section
 * — and it is short by exactly that once you add the rows up, because a demo
 * of reconciliation that does not itself reconcile teaches the wrong thing.
 */
export const SAMPLE_LEDGER: SampleLedgerRow[] = [
  { playerId: "brunson", name: "Doyle Brunson", suit: "spade", rank: "A", buyIns: 4, cashOutCents: 24550 },
  { playerId: "hellmuth", name: "Phil Hellmuth", suit: "heart", rank: "Q", buyIns: 3, cashOutCents: 16450 },
  { playerId: "seidel", name: "Erik Seidel", suit: "spade", rank: "8", buyIns: 5, cashOutCents: 10450 },
  { playerId: "mo", name: "Mo", suit: "spade", rank: null, isGuest: true, buyIns: 2, cashOutCents: 4100 },
];

export const SAMPLE_LEDGER_IN_CENTS = SAMPLE_LEDGER.reduce(
  (sum, row) => sum + row.buyIns * SAMPLE_BUY_IN_CENTS,
  0
);
export const SAMPLE_LEDGER_OUT_CENTS = SAMPLE_LEDGER.reduce(
  (sum, row) => sum + row.cashOutCents,
  0
);
