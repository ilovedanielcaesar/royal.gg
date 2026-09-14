import Band from "../../components/Band";
import GoldPill from "../../components/GoldPill";
import PlayerAvatar from "../../components/PlayerAvatar";
import Sheet from "../../components/Sheet";
import { formatCents } from "../../lib/money";
import HomeNote from "./HomeNote";
import HomeSectionHead from "./HomeSectionHead";
import Reveal from "./Reveal";
import {
  SAMPLE_LEDGER,
  SAMPLE_LEDGER_IN_CENTS,
  SAMPLE_LEDGER_OUT_CENTS,
} from "./sampleLeague";

const ROW = "grid grid-cols-[1fr_96px_96px] items-center gap-3 py-2.5";

export default function HomeLogSection() {
  const offByCents = SAMPLE_LEDGER_IN_CENTS - SAMPLE_LEDGER_OUT_CENTS;

  return (
    <section id="log" className="px-6 pt-10 pb-[120px]">
      <div className="mx-auto w-[min(1152px,calc(100%-32px))]">
        <HomeSectionHead num="01" title="Log the night in one pass" />

        <div className="mt-9 grid grid-cols-[repeat(auto-fit,minmax(320px,1fr))] items-start gap-9">
          <Reveal>
            <Sheet>
              <Band title="Thu 4 Sep 2026" action={<GoldPill>Draft</GoldPill>} />

              <Band>
                <div
                  className={`${ROW} text-[10px] font-semibold tracking-[0.1em] text-ink-500 uppercase`}
                  aria-hidden="true"
                >
                  <span>Player</span>
                  <span className="text-center">Buy-ins</span>
                  <span className="text-right">Cash out</span>
                </div>

                {SAMPLE_LEDGER.map((row) => (
                  <div
                    key={row.playerId}
                    className={`${ROW} border-t border-card-100`}
                  >
                    <span className="flex min-w-0 items-center gap-2.5">
                      <PlayerAvatar
                        size="sm"
                        player={{
                          id: row.playerId,
                          name: row.name,
                          is_guest: row.isGuest ?? false,
                          chosen_suit: row.suit,
                          chosen_rank: row.rank,
                        }}
                      />
                      <span className="truncate text-sm font-medium">
                        {row.name}
                        {row.isGuest && (
                          <span className="ml-1.5 text-[10px] font-semibold tracking-[0.08em] text-ink-500">
                            GUEST
                          </span>
                        )}
                      </span>
                    </span>
                    <span className="flex items-center justify-center gap-2 rounded-[9px] bg-card-100/70 p-[5px]">
                      <span className="text-[13px] text-ink-500">−</span>
                      <span className="tabular text-sm font-semibold">
                        {row.buyIns}
                      </span>
                      <span className="text-[13px] text-ink-500">+</span>
                    </span>
                    <span className="tabular rounded-[9px] bg-card-100/70 px-2 py-1.5 text-right text-sm">
                      {formatCents(row.cashOutCents)}
                    </span>
                  </div>
                ))}

                <div className="border-t border-card-100 pt-2.5 text-xs text-ink-500">
                  + Add player from roster
                </div>
              </Band>

              <Band className="bg-card-100/50">
                <div className="flex flex-wrap items-center justify-between gap-3 text-[13px] text-ink-500">
                  <span>
                    In{" "}
                    <b className="tabular font-semibold text-ink-900">
                      {formatCents(SAMPLE_LEDGER_IN_CENTS)}
                    </b>
                  </span>
                  <span>
                    Out{" "}
                    <b className="tabular font-semibold text-ink-900">
                      {formatCents(SAMPLE_LEDGER_OUT_CENTS)}
                    </b>
                  </span>
                  <GoldPill>Off by {formatCents(offByCents)}</GoldPill>
                </div>
                {/* A still picture of the two controls the reconcile banner
                    offers. They do nothing here — this is a sheet on a
                    marketing page, and a button that pretends to save is
                    worse than one that plainly does not. */}
                <div className="mt-3.5 flex gap-2.5" aria-hidden="true">
                  <span className="flex-1 rounded-[11px] bg-felt-900 px-4 py-3 text-center text-[13px] font-semibold text-card-50">
                    Distribute the miscount
                  </span>
                  <span className="rounded-[11px] px-4 py-3 text-[13px] font-medium text-ink-700 shadow-[inset_0_0_0_1px_var(--color-card-200)]">
                    Flag for review
                  </span>
                </div>
              </Band>
            </Sheet>
          </Reveal>

          <Reveal>
            <div className="flex flex-col gap-[26px] pt-2">
              <HomeNote suit="spade" title="Chips never balance. That’s fine.">
                When the count comes in $4.50 short, royal.gg spreads the
                difference across that night’s winners by the rules your table
                agreed — or parks the night for review when it’s too big to
                wave through. The reported numbers are kept beside the adjusted
                ones, so nothing is ever quietly rewritten.
              </HomeNote>
              <HomeNote
                suit="heart"
                title="Set the buy-in your table actually plays"
              >
                $40 is only the default. Pick the amount your group uses, change
                it when the stakes change, and let anyone rebuy as many times as
                the night demands — four buy-ins, five, a single one all
                evening. The count is a number on the row, not a workaround.
              </HomeNote>
              <HomeNote suit="diamond" title="Guests welcome, permanently">
                Add the friend who came once, with no account and no setup. If
                they join properly later, their history links to the account —
                the ledger doesn’t fork.
              </HomeNote>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
