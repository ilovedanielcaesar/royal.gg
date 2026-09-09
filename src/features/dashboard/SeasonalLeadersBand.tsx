import Band from "../../components/Band";
import SeasonLeaders from "../../components/SeasonLeaders";
import type { BuyIn, CashOut, Player, Session } from "../../lib/stats";

type Props = {
  /** Already filtered to the ranking-eligible set. */
  players: Player[];
  /** The window: the most recent N group sessions. */
  windowSessions: Session[];
  buyIns: BuyIn[];
  cashOuts: CashOut[];
};

/**
 * Band 5 — recent form, placed last.
 *
 * The lifetime record is the league's primary ordering and earns the higher
 * slot; recent form is the qualifier you read afterwards.
 *
 * The heading says "seasonal" and the app has no season — nothing in the data
 * defines when one starts or ends. The subtitle is what keeps that honest: it
 * states the window in terms the data actually knows. Do not let the heading
 * tempt the window back into months, and do not add a season-scoped figure
 * elsewhere on the strength of the word.
 */
export default function SeasonalLeadersBand({
  players,
  windowSessions,
  buyIns,
  cashOuts,
}: Props) {
  const games =
    windowSessions.length === 1 ? "last game" : `last ${windowSessions.length} games`;
  const range = describeRange(windowSessions);

  return (
    <Band
      title="Seasonal leaders"
      caption={range ? `${games} · ${range}` : games}
    >
      <SeasonLeaders
        players={players}
        windowSessions={windowSessions}
        buyIns={buyIns}
        cashOuts={cashOuts}
      />
    </Band>
  );
}

/**
 * "7 Aug – 4 Sep". Part of the subtitle, not decoration: "last five games"
 * alone doesn't say whether that means the last five weeks or the last five
 * months, and the window shifts every time a night is logged.
 */
function describeRange(windowSessions: Session[]): string | null {
  if (windowSessions.length === 0) return null;
  const first = windowSessions[0]!.played_at;
  const last = windowSessions[windowSessions.length - 1]!.played_at;
  if (first === last) return dayMonth(first);
  return `${dayMonth(first)} – ${dayMonth(last)}`;
}

function dayMonth(playedAt: string): string {
  return new Date(playedAt + "T12:00:00").toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  });
}
