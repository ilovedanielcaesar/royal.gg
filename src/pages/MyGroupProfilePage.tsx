import Band from "../components/Band";
import ErrorNote from "../components/ErrorNote";
import LoadingState from "../components/LoadingState";
import PageHeading from "../components/PageHeading";
import Sheet from "../components/Sheet";
import AccountBand from "../features/profile/AccountBand";
import LeaveGroupBand from "../features/profile/LeaveGroupBand";
import NightsChartBand from "../features/profile/NightsChartBand";
import NightsLedgerBand from "../features/profile/NightsLedgerBand";
import ProfileCardBand from "../features/profile/ProfileCardBand";
import TrackRecordBand from "../features/profile/TrackRecordBand";
import { useProfileData } from "../features/profile/useProfileData";
import { useCurrentUser } from "../lib/auth";
import { useGroup } from "../lib/groupContext";

export default function MyGroupProfilePage() {
  const { user, profile } = useCurrentUser();
  const { group, path } = useGroup();
  const { data, error, reload } = useProfileData();

  if (!user || !group) {
    return <LoadingState tone="felt" full />;
  }

  if (!data) {
    return (
      <>
        <PageHeading
          title={profile?.display_name ?? "Your profile"}
          subtitle={`${group.name} member profile`}
        />
        <Sheet>
          <Band>
            <ErrorNote>
              {error ?? "Your league record could not be loaded."}
            </ErrorNote>
          </Band>
          <AccountBand email={user.email ?? null} />
          <LeaveGroupBand />
        </Sheet>
      </>
    );
  }

  const { player, stats, rating } = data;
  const displayName =
    player?.display_name ??
    player?.name ??
    profile?.display_name ??
    "Your profile";

  return (
    <>
      {/* No page action. The one that was here — "Session detail view" —
          linked to whichever night happened to be most recent, which is not
          a thing anybody comes to their own profile to do. The ledger below
          links every night, including that one. */}
      <PageHeading
        title={displayName}
        subtitle={`${group.name} member profile · ${stats?.sessionsPlayed ?? 0} sessions logged`}
      />

      <Sheet>
        {error && (
          <Band>
            <ErrorNote>{error}</ErrorNote>
          </Band>
        )}

        {player && stats && rating ? (
          <>
            <ProfileCardBand
              player={player}
              groupId={group.id}
              stats={stats}
              rating={rating}
              ratingHref={path(`/players/${player.id}/rating`)}
              reload={reload}
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
          </>
        ) : (
          <Band
            title="No player profile yet"
            caption="Ask a league admin to add or link your roster entry."
          />
        )}

        <AccountBand email={user.email ?? null} />
        <LeaveGroupBand />
      </Sheet>
    </>
  );
}
