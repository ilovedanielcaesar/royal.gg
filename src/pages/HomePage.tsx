import HomeAnalyticsSection from "../features/marketing/HomeAnalyticsSection";
import HomeCtaSection from "../features/marketing/HomeCtaSection";
import HomeHero from "../features/marketing/HomeHero";
import HomeLogSection from "../features/marketing/HomeLogSection";
import HomeStandingsSection from "../features/marketing/HomeStandingsSection";

/**
 * royal.gg's front door: what `/` serves to anyone who is not signed in.
 *
 * A member never lands here — `IndexRoute` sends them on to their group — so
 * this page only ever renders in the signed-out state and carries no app
 * chrome of its own. `AppLayout` drops its 1152px wrapper for this route,
 * because the hero is full-bleed and pins for the height of the screen.
 */
export default function HomePage() {
  return (
    <>
      <HomeHero />
      <HomeLogSection />
      <HomeStandingsSection />
      <HomeAnalyticsSection />
      <HomeCtaSection />
    </>
  );
}
