import { moneyToneClass } from "../lib/moneyTone";
import type {
  ChartCoordinates,
  ChartSeries,
} from "./cumulativeChartTypes";

type Props = ChartCoordinates & {
  series: ChartSeries[];
  sessionsCount: number;
  plotWidth: number;
};

export default function CumulativeBarSeries({
  series,
  sessionsCount,
  plotWidth,
  xOf,
  yOf,
}: Props) {
  const seriesCount = Math.max(series.length, 1);
  const slotWidth = plotWidth / Math.max(sessionsCount, 1);
  const groupWidth = Math.min(22, slotWidth * 0.62);
  const barWidth = groupWidth / seriesCount;
  const zeroY = yOf(0);

  return series.flatMap((entry, seriesIndex) =>
    entry.points.map((point) => {
      const valueY = yOf(point.netCents);
      const height = Math.max(2, Math.abs(zeroY - valueY));
      const x =
        xOf(point.sessionIndex) - groupWidth / 2 + seriesIndex * barWidth;

      return (
        <rect
          key={`${entry.playerId}-${point.sessionId}`}
          x={x}
          y={point.netCents >= 0 ? zeroY - height : zeroY}
          width={Math.max(barWidth - 1, 1)}
          height={height}
          rx={Math.min(3, barWidth / 3)}
          className={`fill-current ${moneyToneClass(point.netCents)}`}
          opacity={0.9}
        />
      );
    })
  );
}
