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
  /** Opens the picker. Omit and the card renders as a static object. */
  onClick?: () => void;
  /** Drives `aria-expanded`, so a reader knows the card is a disclosure. */
  expanded?: boolean;
};

/**
 * Your card, at display size.
 *
 * The resting tilt and the straighten-on-hover come from iteration 1
 * (`design_archetypes/profile_redesign.html:353`) and were lost in the v2
 * build. They are worth having: a card lying at −1.2° reads as an object on a
 * table rather than a div, and squaring up under the cursor is what says it
 * can be picked up. The whole motion is 2px and 1.2°, which is the point —
 * anything larger competes with the sheet settling in behind it.
 *
 * `motion-reduce` drops the transform entirely rather than shortening it; a
 * reader who has asked for no motion should get a card that simply sits
 * straight.
 */
export default function PlayerCardPreview({
  rank,
  suit,
  dirty,
  onClick,
  expanded,
}: Props) {
  const tone = suitColor(suit) === "red" ? "text-crimson-600" : "text-ink-900";
  const face = (
    <>
      <span className="absolute top-2.5 left-3 font-display text-[26px] leading-none">
        {rank}
      </span>
      <SuitBadge suit={suit} size={64} />
      <span className="absolute right-3 bottom-2.5 rotate-180 font-display text-[26px] leading-none">
        {rank}
      </span>
    </>
  );

  const shell = [
    "relative flex h-[248px] w-44 items-center justify-center rounded-[14px] bg-card-50",
    "shadow-[0_0_0_1px_var(--color-card-200),0_24px_48px_-20px_rgba(0,0,0,0.45)]",
    "-rotate-[1.2deg] transition-[transform,box-shadow] duration-[180ms] ease-out",
    "motion-reduce:rotate-0 motion-reduce:transition-none",
    dirty ? "ring-2 ring-gold-500 ring-offset-4 ring-offset-card-50" : "",
    tone,
  ];

  if (!onClick) {
    return (
      <div className={shell.join(" ")} aria-label={cardFullName(rank, suit)}>
        {face}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={expanded}
      aria-label={`${cardFullName(rank, suit)} — change your card`}
      className={[
        ...shell,
        "cursor-pointer hover:rotate-0 hover:-translate-y-0.5",
        "hover:shadow-[0_0_0_1px_var(--color-card-200),0_29px_54px_-22px_rgba(0,0,0,0.56)]",
        "motion-reduce:hover:translate-y-0",
        "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold-ink",
      ].join(" ")}
    >
      {face}
    </button>
  );
}
