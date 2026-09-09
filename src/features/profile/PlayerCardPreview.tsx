import {
  cardFullName,
  suitColor,
  type Rank,
  type Suit,
} from "../../lib/playerSuit";
import SuitBadge from "../../components/SuitBadge";

type Props = {
  rank: Rank;
  suit: Suit;
  dirty?: boolean;
};

export default function PlayerCardPreview({ rank, suit, dirty }: Props) {
  const tone =
    suitColor(suit) === "red" ? "text-crimson-600" : "text-ink-900";

  return (
    <div className="flex flex-col items-center gap-3">
      <div
        className={[
          "relative flex h-[248px] w-44 items-center justify-center rounded-[14px] bg-card-50",
          "shadow-[0_0_0_1px_var(--color-card-200),0_24px_48px_-20px_rgba(0,0,0,0.45)]",
          dirty ? "ring-2 ring-gold-500 ring-offset-4 ring-offset-card-50" : "",
          tone,
        ].join(" ")}
        aria-label={cardFullName(rank, suit)}
      >
        <span className="absolute top-2.5 left-3 font-display text-[26px] leading-none">
          {rank}
        </span>
        <SuitBadge suit={suit} size={64} />
        <span className="absolute right-3 bottom-2.5 rotate-180 font-display text-[26px] leading-none">
          {rank}
        </span>
      </div>
      <p className="text-center text-[13px] font-semibold text-ink-700">
        {cardFullName(rank, suit)}
      </p>
    </div>
  );
}
