import SuitBadge from "../../components/SuitBadge";
import type { Suit } from "../../lib/playerSuit";
import { sessionDateParts, shortSessionDate } from "./sessionDates";

const DATE_SUITS: Suit[] = ["spade", "heart", "diamond", "club"];

type Props = {
  playedAt: string;
};

export default function SessionDateCard({ playedAt }: Props) {
  const { day } = sessionDateParts(playedAt);
  const suit = DATE_SUITS[day % DATE_SUITS.length]!;

  return (
    <span className="relative flex h-[45px] w-[54px] items-center justify-center overflow-hidden rounded-[7px] bg-card-50 shadow-[0_0_0_1px_var(--color-card-200),0_2px_4px_rgba(0,0,0,0.09)]">
      <span className="relative z-10 whitespace-nowrap font-display text-[15px] leading-none text-ink-900">
        {shortSessionDate(playedAt)}
      </span>
      <span
        aria-hidden="true"
        className="absolute -right-2 -bottom-2.5 opacity-[0.07]"
      >
        <SuitBadge suit={suit} size={45} />
      </span>
    </span>
  );
}
