import { Link } from "react-router-dom";
import SuitBadge from "../../components/SuitBadge";
import type { Suit } from "../../lib/playerSuit";
import MarketingButton from "../../components/MarketingButton";
import Reveal from "./Reveal";

const SUITS: Suit[] = ["spade", "heart", "club", "diamond"];

export default function HomeCtaSection() {
  return (
    <section id="signup" className="px-6 pb-[120px]">
      <div className="mx-auto w-[min(1152px,calc(100%-32px))]">
        <Reveal>
          <div className="flex flex-col items-center overflow-hidden rounded-3xl bg-gradient-to-b from-card-50/[0.07] to-card-50/[0.02] px-8 py-16 text-center shadow-[inset_0_0_0_1px_rgba(247,241,222,0.12)] max-[780px]:px-5 max-[780px]:py-12">
            <div className="flex items-center gap-1 opacity-85" aria-hidden="true">
              {SUITS.map((suit) => (
                <SuitBadge
                  key={suit}
                  suit={suit}
                  size={16}
                  fill={
                    suit === "heart" || suit === "diamond"
                      ? "var(--color-crimson-500)"
                      : "var(--color-card-50)"
                  }
                />
              ))}
            </div>
            <h2 className="mt-6 max-w-[22ch] font-display text-[clamp(30px,4.4vw,54px)] leading-[1.08] font-normal text-card-50">
              Start the ledger before your next session
            </h2>
            <p className="mt-4 max-w-[46ch] text-[15px] leading-relaxed text-card-50/65">
              Create a group, invite the table with one link, log the last night
              you played. Ten minutes and the spreadsheet is retired.
            </p>
            <div className="mt-8">
              <MarketingButton to="/signup" size="xl">
                Sign up
              </MarketingButton>
            </div>
            <p className="mt-4 text-xs text-card-50/45">
              Or continue with Google. Already have an account?{" "}
              <Link to="/login" className="text-card-50/75 underline">
                Sign in
              </Link>
              .
            </p>
          </div>
        </Reveal>

        <footer className="mt-9 flex flex-wrap items-center justify-between gap-4 text-xs text-card-50/40">
          <span className="font-display text-lg text-card-50/70">
            royal<span className="text-crimson-500">.gg</span>
          </span>
          <span>
            Buy-ins, cash-outs, and lifetime records for home games.
          </span>
        </footer>
      </div>
    </section>
  );
}
