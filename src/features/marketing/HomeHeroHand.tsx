import SuitBadge from "../../components/SuitBadge";
import type { Suit } from "../../lib/playerSuit";

/** A royal flush, dealt left to right, with the deck's back closing the hand. */
const HAND: { rank: string; suit: Suit }[] = [
  { rank: "A", suit: "spade" },
  { rank: "K", suit: "heart" },
  { rank: "Q", suit: "club" },
  { rank: "J", suit: "diamond" },
  { rank: "10", suit: "spade" },
];

const CARD = [
  "absolute left-0 top-0 -ml-[86px] flex h-[244px] w-[172px] items-center justify-center",
  "rounded-[14px] transition-transform duration-[120ms] ease-linear",
  "max-[780px]:-ml-[66px] max-[780px]:h-[188px] max-[780px]:w-[132px]",
].join(" ");

const FACE =
  "bg-card-50 shadow-[0_0_0_1px_var(--color-card-200),0_26px_50px_-22px_rgba(0,0,0,0.75)]";

const CORNER = "absolute font-display text-2xl leading-none";

/**
 * The six cards the hero fans out. Positioning is entirely the caller's —
 * every element here carries `data-fan` and nothing else, and `HomeHero`'s
 * scroll driver writes the transforms.
 */
export default function HomeHeroHand() {
  return (
    <div
      className="absolute bottom-0 left-1/2 z-[5] h-0 w-0"
      aria-hidden="true"
    >
      {HAND.map((card, i) => {
        const isRed = card.suit === "heart" || card.suit === "diamond";
        const ink = isRed ? "text-crimson-600" : "text-ink-900";
        return (
          <div key={card.rank + card.suit} data-fan={i} className={`${CARD} ${FACE}`}>
            <span className={`${CORNER} top-[9px] left-3 ${ink}`}>
              {card.rank}
            </span>
            <SuitBadge suit={card.suit} size={60} />
            <span className={`${CORNER} right-3 bottom-[9px] rotate-180 ${ink}`}>
              {card.rank}
            </span>
          </div>
        );
      })}

      <div
        data-fan={HAND.length}
        className={`${CARD} bg-felt-800 shadow-[0_0_0_1px_rgba(247,241,222,0.35),0_26px_50px_-22px_rgba(0,0,0,0.75)]`}
      >
        <span className="flex flex-col items-center gap-1.5 opacity-55">
          <SuitBadge suit="diamond" size={34} fill="var(--color-card-50)" />
          <span className="text-[9px] tracking-[0.2em] text-card-50">
            ROYAL.GG
          </span>
        </span>
      </div>
    </div>
  );
}
