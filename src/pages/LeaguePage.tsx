import Band from "../components/Band";
import FeltButton from "../components/FeltButton";
import PageHeading from "../components/PageHeading";
import Sheet from "../components/Sheet";
import ExportBand from "../features/league/ExportBand";
import LeagueRulesBand from "../features/league/LeagueRulesBand";
import PayoutGuestsBand from "../features/league/PayoutGuestsBand";
import RankingsBand from "../features/league/RankingsBand";
import { useLeaguePageData } from "../features/league/useLeaguePageData";
import { useGroup } from "../lib/groupContext";

export default function LeaguePage() {
  const { group, isGroupAdmin, path } = useGroup();
  const { data, error, reload, sort, setSort } = useLeaguePageData();
  const subtitle = data
    ? `${data.memberCount} ${data.memberCount === 1 ? "player" : "players"}, ${
        data.league.sessions.length
      } ${data.league.sessions.length === 1 ? "night" : "nights"}.`
    : undefined;

  return (
    <>
      <PageHeading
        title="League"
        subtitle={subtitle}
        actions={
          isGroupAdmin && (
            <FeltButton variant="ghost" to={path("/settings")}>
              Settings
              <span className="ml-2 rounded bg-gold-500/20 px-1.5 py-0.5 text-[10px] font-bold tracking-[0.08em] text-gold-ink">
                ADMIN
              </span>
            </FeltButton>
          )
        }
      />

      <Sheet>
        {error && (
          <Band>
            <p className="text-sm text-crimson-700">{error}</p>
          </Band>
        )}

        {!data || !group ? (
          <Band>
            <p className="text-sm text-ink-500">Dealing…</p>
          </Band>
        ) : (
          <>
            <RankingsBand
              rows={data.rankings}
              sort={sort}
              onSortChange={setSort}
              myPlayerId={data.myPlayerId}
              playerHref={(id) => path(`/players/${id}`)}
            />
            <PayoutGuestsBand
              groupId={group.id}
              period={data.period}
              periodSessionCount={data.periodSessionCount}
              guests={data.guests}
              isGroupAdmin={isGroupAdmin}
              recordsHref={path("/records")}
              playerHref={(id) => path(`/players/${id}`)}
              reload={reload}
            />
            <LeagueRulesBand
              group={group}
              settingsHref={isGroupAdmin ? path("/settings") : null}
            />
            <ExportBand group={group} league={data.league} />
          </>
        )}
      </Sheet>
    </>
  );
}
