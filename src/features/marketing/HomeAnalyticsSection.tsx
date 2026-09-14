import Band from "../../components/Band";
import CumulativeChart from "../../components/CumulativeChart";
import MiniStat from "../../components/MiniStat";
import Sheet from "../../components/Sheet";
import { moneyToneClass } from "../../lib/moneyTone";
import HomeSectionHead from "./HomeSectionHead";
import Reveal from "./Reveal";
import {
  SAMPLE_SERIES,
  SAMPLE_SESSIONS,
  sampleColorOf,
} from "./sampleLeague";

export default function HomeAnalyticsSection() {
  return (
    <section id="analytics" className="px-6 pb-[120px]">
      <div className="mx-auto w-[min(1152px,calc(100%-32px))]">
        <HomeSectionHead
          num="03"
          title="See whether you’re actually good"
          blurb="Cumulative net per player, expected value, variance. Enough nights and the noise separates from the edge."
        />

        <Reveal className="mt-9">
          {/* The real dashboard chart, handed sample series — not a drawing of
              one. Hovering a night gives the same tooltip the app does. */}
          <Sheet>
            <Band
              title="Cumulative net"
              caption="The whole league drawn on one axis, every line a member of the group, so you can see the swings rather than just the final figure — who ran hot in June, who has been climbing since, and where two lines crossed and the table changed hands."
              action={
                <span className="text-xs text-ink-500">
                  the whole table · 24 nights
                </span>
              }
            >
              <div className="mt-4 overflow-x-auto">
                <div className="min-w-[600px]">
                  <CumulativeChart
                    series={SAMPLE_SERIES}
                    sessions={SAMPLE_SESSIONS}
                    height={360}
                    colorOf={sampleColorOf}
                    emphasizedPlayerId="brunson"
                  />
                </div>
              </div>
            </Band>

            <Band className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-6 bg-card-100/45">
              <MiniStat
                size="lg"
                label="Per night, expected"
                value="+$17.17"
                toneClass={moneyToneClass(1717)}
              />
              <MiniStat size="lg" label="Std deviation" value="$86.40" />
              <MiniStat size="lg" label="Win rate" value="63%" />
              <MiniStat
                size="lg"
                label="Best night"
                value="+$212.00"
                toneClass={moneyToneClass(21200)}
              />
            </Band>
          </Sheet>
        </Reveal>

        <Reveal>
          <p className="mt-[18px] max-w-[74ch] text-[11.5px] leading-relaxed text-card-50/40">
            Sample league, shown so the page has something real in it. 24
            weekly nights, 27&nbsp;Mar&nbsp;–&nbsp;4&nbsp;Sep&nbsp;2026. The
            four figures above are Doyle’s: +$412.00 over 24 nights is +$17.17 a
            night, 15 wins of 24 is 63%. The six players’ lifetime nets sum to
            exactly $0.00, as a reconciled league must — nobody wins a dollar
            that somebody else did not lose.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
