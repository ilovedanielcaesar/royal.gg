import type { ReactNode } from "react";
import SuitBadge from "../../components/SuitBadge";
import type { Suit } from "../../lib/playerSuit";

type Props = {
  /** The pip that marks the note. Red suits are drawn crimson, black cream. */
  suit: Suit;
  title: string;
  children: ReactNode;
};

/** One point in the column of prose beside a section's mock sheet. */
export default function HomeNote({ suit, title, children }: Props) {
  const isRed = suit === "heart" || suit === "diamond";
  return (
    <div>
      <h3 className="flex items-center gap-2.5 text-base font-semibold text-card-50">
        <SuitBadge
          suit={suit}
          size={13}
          fill={
            isRed ? "var(--color-crimson-500)" : "var(--color-card-50)"
          }
        />
        {title}
      </h3>
      <p className="mt-2 text-sm leading-[1.65] text-card-50/65">{children}</p>
    </div>
  );
}
