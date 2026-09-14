import Band from "../../components/Band";
import PlayerAvatar from "../../components/PlayerAvatar";
import Sheet from "../../components/Sheet";
import Sparkline from "../../components/Sparkline";
import { formatSignedCents } from "../../lib/money";
import { moneyToneClass } from "../../lib/moneyTone";
import HomeNote from "./HomeNote";
import HomeSectionHead from "./HomeSectionHead";
import Reveal from "./Reveal";
import { SAMPLE_STANDINGS } from "./sampleLeague";

/**
 * The name column is capped rather than left to eat every spare pixel: a `1fr`
 * name pushed the score most of a sheet-width away from the player it belonged
 * to. The slack sits in the empty gutter column before the numbers instead, so
 * name and score read as one row.
 */
const ROW =
  "grid grid-cols-[18px_28px_auto_minmax(8px,1fr)_44px_62px_88px] items-center gap-[9px] rounded-xl px-2.5 py-[11px]";

export default function HomeStandingsSection() {
  return (
    <section id="standings" className="px-6 pb-[120px]">
      <div className="mx-auto w-[min(1152px,calc(100%-32px))]">
        <HomeSectionHead
          num="02"
          title="The table, ranked forever"
          blurb="Lifetime standings that survive every payout. Settling up moves money, not the record."
        />

        <div className="mt-9 grid grid-cols-[repeat(auto-fit,minmax(320px,1fr))] items-start gap-9">
          <Reveal>
            <Sheet>
              <Band
                title="All-time rankings"
                action={
                  <span className="inline-flex min-h-[34px] items-center gap-[7px] rounded-[9px] bg-card-100 px-3 text-xs font-semibold">
                    Sort by: P/L high→low <span aria-hidden="true">▾</span>
                  </span>
                }
              />

              <Band>
                <div
                  className={`${ROW} text-[9.5px] font-semibold tracking-[0.06em] text-ink-500 uppercase`}
                  aria-hidden="true"
                >
                  <span className="text-center">#</span>
                  <span />
                  <span>Player</span>
                  <span />
                  <span className="text-right">Score</span>
                  <span className="text-center">Last 5</span>
                  <span className="text-right">P/L</span>
                </div>

                {SAMPLE_STANDINGS.map((row) => (
                  <div
                    key={row.playerId}
                    className={`${ROW} ${
                      row.isYou
                        ? "bg-felt-900 text-card-50"
                        : "border-t border-card-100"
                    }`}
                  >
                    <span
                      className={`text-center font-display text-[17px] leading-none ${
                        row.isYou ? "text-card-50/60" : "text-ink-500"
                      }`}
                    >
                      {row.position}
                    </span>
                    <PlayerAvatar
                      size="sm"
                      player={{
                        id: row.playerId,
                        name: row.name,
                        chosen_suit: row.suit,
                        chosen_rank: row.rank,
                      }}
                    />
                    <span
                      className={`truncate text-[13.5px] ${
                        row.isYou ? "font-semibold" : ""
                      }`}
                    >
                      {row.name}
                    </span>
                    <span />
                    {/* A score is not money, so it never takes a money tone. */}
                    <span className="tabular text-right text-[13px] font-semibold">
                      {row.score}
                    </span>
                    <Sparkline
                      nets={row.lastFive}
                      width={62}
                      height={20}
                      label={`${row.name}: last five nights`}
                    />
                    <span
                      className={`tabular text-right font-display text-base whitespace-nowrap ${
                        row.isYou && row.netCents > 0
                          ? "text-sage-500"
                          : moneyToneClass(row.netCents)
                      }`}
                    >
                      {formatSignedCents(row.netCents)}
                    </span>
                  </div>
                ))}
              </Band>

              <Band className="bg-card-100/50">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="text-xs text-ink-500">
                    Three nights before you rank. A payout never resets a number
                    here.
                  </span>
                  <span className="text-xs font-semibold text-ink-700">
                    Records →
                  </span>
                </div>
              </Band>
            </Sheet>
          </Reveal>

          <Reveal>
            <div className="flex flex-col gap-[26px] pt-2">
              <HomeNote
                suit="spade"
                title="Sort it by whatever you’re arguing about"
              >
                Lifetime P/L high to low, or low to high when someone wants the
                wooden spoon named. Or by player score, consistency, or nights
                played. The order changes; the record underneath it doesn’t.
              </HomeNote>
              <HomeNote suit="club" title="A score that isn’t only the money">
                Player score weighs win rate, consistency and recent form
                together, so one enormous Thursday doesn’t buy a rank.
                Consistency gets its own column beside it — grinding out small
                wins and spiking once look different, and the table shows which
                you are.
              </HomeNote>
              <HomeNote
                suit="heart"
                title="Last five nights, right there in the row"
              >
                A sparkline beside every name, so form reads at a glance without
                opening anyone’s profile. Your own row is picked out on the
                felt. Guests sit in the list too, and nobody ranks until they’ve
                played three nights — one lucky evening shouldn’t crown anyone.
              </HomeNote>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
