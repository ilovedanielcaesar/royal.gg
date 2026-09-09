import Card from "../components/Card";
import FeltButton from "../components/FeltButton";
import PageHeading from "../components/PageHeading";
import Sheet from "../components/Sheet";
import HeroBand from "../features/dashboard/HeroBand";
import RecentFiveBand from "../features/dashboard/RecentFiveBand";
import SeasonalLeadersBand from "../features/dashboard/SeasonalLeadersBand";
import TableBand from "../features/dashboard/TableBand";
import TrajectoryBand from "../features/dashboard/TrajectoryBand";
import { useDashboardData } from "../features/dashboard/useDashboardData";
import { useGroup } from "../lib/groupContext";

/**
 * One cream sheet, five bands: hero, recent five, trajectory, the table, and
 * seasonal leaders last.
 *
 * The arithmetic is in `useDashboardData`; this file is composition. The
 * heading and its actions sit on the felt ABOVE the sheet — the sheet is a
 * record of results and holds no controls.
 */
export default function DashboardPage() {
  const { path } = useGroup();
  const { data, error } = useDashboardData();

  if (error && !data) {
    return (
      <Card accent="crimson">
        <p className="p-4 text-sm text-crimson-700">{error}</p>
      </Card>
    );
  }
  if (!data) {
    // No spinners, per contract rule 6 — the chrome plus a muted line.
    return <p className="text-card-50/60">Dealing…</p>;
  }

  const { league, me, you } = data;

  return (
    <>
      <PageHeading
        title="Dashboard"
        subtitle={`Welcome back, ${me?.display_name ?? me?.name ?? "friend"}.`}
        actions={
          <>
            <FeltButton variant="ghost" to={path("/settings")}>
              Settings
            </FeltButton>
            <FeltButton to={path("/sessions/new")}>+ New session</FeltButton>
          </>
        }
      />

      <Sheet>
        {me && you ? (
          <HeroBand
            stats={you.stats}
            rating={you.rating}
            netsOldestFirst={you.netsOldestFirst}
            profileHref={path(`/players/${me.id}`)}
          />
        ) : (
          <NoRosterRowBand />
        )}

        {you && (
          <RecentFiveBand
            nets={you.sessionNets}
            sessionHref={(id) => path(`/sessions/${id}`)}
            allSessionsHref={path("/sessions")}
          />
        )}

        <TrajectoryBand
          sessions={league.sessions}
          yourSeries={data.yourSeries}
          leagueSeries={data.leagueSeries}
          colorOf={data.colorOf}
          legend={data.legend}
        />

        <TableBand
          rows={data.tableRows}
          myPlayerId={me?.id ?? null}
          totals={data.totals}
          playerHref={(id) => path(`/players/${id}`)}
          sessionHref={(id) => path(`/sessions/${id}`)}
        />

        <SeasonalLeadersBand
          players={data.eligiblePlayers}
          windowSessions={data.seasonWindow}
          buyIns={league.buyIns}
          cashOuts={league.cashOuts}
        />
      </Sheet>
    </>
  );
}

/**
 * The hero needs a roster row to be about anybody. An admin who created the
 * group but never added themselves has none, and neither does a brand-new
 * member before their first night.
 */
function NoRosterRowBand() {
  return (
    <div className="px-9 py-[26px] max-[720px]:px-5">
      <p className="font-display text-[23px] leading-[1.1]">
        You're not on the roster yet
      </p>
      <p className="mt-2 text-sm text-ink-500">
        Add yourself on the League page and your score, streak and record will
        appear here.
      </p>
    </div>
  );
}
