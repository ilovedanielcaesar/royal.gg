import {
  cardFullName,
  effectiveSuit,
  suitColor,
  type Rank,
  type Suit,
} from "../lib/playerSuit";
import SuitBadge from "./SuitBadge";

type PlayerLike = {
  id: string;
  name: string;
  display_name?: string | null;
  is_guest?: boolean | null;
  chosen_suit?: Suit | null;
  chosen_rank?: Rank | null;
};

type Props = {
  player: PlayerLike;
  size?: "sm" | "md" | "lg";
};

const SIZES = {
  sm: { box: "h-9 w-7", rank: "text-[11px]", suit: 16 },
  md: { box: "h-12 w-9", rank: "text-sm", suit: 22 },
  lg: { box: "h-16 w-12", rank: "text-lg", suit: 32 },
} as const;

export default function PlayerAvatar(props: Props) {
  const { player } = props;
  const { suit, rank } = effectiveSuit(player);
  const isRed = suitColor(suit) === "red";
  const sz = SIZES[props.size ?? "md"];
  const displayName = player.display_name ?? player.name;
  return (
    <div
      className={`${sz.box} relative flex shrink-0 items-center justify-center rounded-md bg-card-50 ring-1 ring-card-200 shadow-sm`}
      aria-label={`${displayName} card (${cardFullName(rank, suit)})`}
    >
      <div
        className={`absolute left-1 top-0.5 font-display leading-none ${sz.rank} ${
          isRed ? "text-crimson-600" : "text-ink-900"
        }`}
      >
        {/* A guest who has not picked a card has no rank — the corner is
            left empty, which is what makes it read as a blank card rather
            than as somebody's. */}
        {rank}
      </div>
      <SuitBadge suit={suit} size={sz.suit} />
    </div>
  );
}
