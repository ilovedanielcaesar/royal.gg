import { useParams } from "react-router-dom";
import Band from "../components/Band";
import FeltButton from "../components/FeltButton";
import LoadingState from "../components/LoadingState";
import PageHeading from "../components/PageHeading";
import Sheet from "../components/Sheet";
import PlayerHeroBand from "../features/player/PlayerHeroBand";
import NightsChartBand from "../features/profile/NightsChartBand";
import NightsLedgerBand from "../features/profile/NightsLedgerBand";
import TrackRecordBand from "../features/profile/TrackRecordBand";
import { usePlayerProfileData } from "../features/profile/useProfileData";
import { useGroup } from "../lib/groupContext";

/**
 * Somebody else's record, in the same bands as your own profile.
 *
 * It used to be one `PlayerStatsCard` — four small cards in a 2×2 grid, with
 * its own money-tone ternary and its own idea of which figures matter. That
 * component's other layout had no callers left, so the whole thing is gone
 * and this page reads through the profile bands instead. One shape to keep
 * correct rather than two.
 */
export default function PlayerProfilePage() {
  const { id } = useParams();
  const { group, path } = useGroup();
  const { data, error } = usePlayerProfileData(id);

  if (!data) {
    return <LoadingState tone="felt" full />;
  }

  const { player, stats, rating } = data;

  if (error || !player || !stats || !rating) {
    return (
      <>
        <PageHeading
          title="No such player"
          subtitle={error ?? "Nobody on this roster has that id."}
          actions={
            <FeltButton to={path("/league")}>← League</FeltButton>
          }
        />
        <Sheet>
          <Band title="Try the league table">
            <p className="mt-2 max-w-[60ch] text-sm text-ink-500">
              Every player with a roster row is listed there, guests included.
              A link that lands here usually points at a roster row from a
              different group.
            </p>
          </Band>
        </Sheet>
      </>
    );
  }

  return (
    <>
      <PageHeading
        title={player.display_name ?? player.name}
        subtitle={`${group?.name ?? "This group"} · ${
          stats.sessionsPlayed
        } nights logged`}
        actions={
          <FeltButton variant="ghost" to={path("/league")}>
            ← League
          </FeltButton>
        }
      />

      <Sheet>
        <PlayerHeroBand
          player={player}
          stats={stats}
          rating={rating}
          leagueRank={data.leagueRank}
          ratingHref={path(`/players/${player.id}/rating`)}
        />
        <TrackRecordBand
          stats={stats}
          rebuy={data.rebuy}
          leagueRank={data.leagueRank}
          meanCents={data.meanCents}
          varianceCentsSquared={data.varianceCentsSquared}
          stdevCents={data.stdevCents}
        />
        <NightsChartBand
          sessions={data.chartSessions}
          series={data.chartSeries}
        />
        <NightsLedgerBand
          rows={data.ledgerRows}
          sessionHref={(sessionId) => path(`/sessions/${sessionId}`)}
        />
      </Sheet>
    </>
  );
}
