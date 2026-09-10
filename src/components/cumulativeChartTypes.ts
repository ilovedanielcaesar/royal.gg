import type { CumulativePoint } from "../lib/stats";

export type ChartSeries = {
  playerId: string;
  name: string;
  points: CumulativePoint[];
};

export type ChartCoordinates = {
  xOf: (sessionIndex: number) => number;
  yOf: (cents: number) => number;
};
