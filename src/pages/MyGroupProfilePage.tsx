import Band from "../components/Band";
import FeltButton from "../components/FeltButton";
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
    return <p className="text-sm text-card-50/60">Dealing…</p>;
  }

  if (!data) {
    return (
      <>
        <PageHeading
          title={profile?.display_name ?? "Your profile"}
          subtitle={`${group.name} member profile`}
        />
        <Sheet>
          <Band className="bg-crimson-500/[0.06]">
            <p className="text-sm text-crimson-700">
              {error ?? "Your league record could not be loaded."}
            </p>
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
  const latestSession = data.ledgerRows[0]?.session;

  return (
    <>
      <PageHeading
        title={displayName}
        subtitle={`${group.name} member profile · ${stats?.sessionsPlayed ?? 0} sessions logged`}
        actions={
          latestSession ? (
            <FeltButton
              variant="ghost"
              to={path(`/sessions/${latestSession.id}`)}
            >
              Session detail view →
            </FeltButton>
          ) : undefined
        }
      />

      <Sheet>
        {error && (
          <Band className="bg-crimson-500/[0.06]">
            <p className="text-sm text-crimson-700">{error}</p>
          </Band>
        )}

        {player && stats && rating ? (
          <>
            <ProfileCardBand
              player={player}
              groupId={group.id}
              reload={reload}
            />
            <TrackRecordBand
              stats={stats}
              rating={rating}
              leagueRank={data.leagueRank}
              meanCents={data.meanCents}
              varianceCentsSquared={data.varianceCentsSquared}
              stdevCents={data.stdevCents}
              ratingHref={path(`/players/${player.id}/rating`)}
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
