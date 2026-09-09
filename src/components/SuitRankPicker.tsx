import type { Rank, Suit } from "../lib/playerSuit";
import SuitBadge from "./SuitBadge";

const SUITS: Suit[] = ["spade", "heart", "diamond", "club"];
const RANKS: Rank[] = [
  "A",
  "K",
  "Q",
  "J",
  "10",
  "9",
  "8",
  "7",
  "6",
  "5",
  "4",
  "3",
  "2",
];

const SUIT_NAMES: Record<Suit, string> = {
  spade: "Spades",
  heart: "Hearts",
  diamond: "Diamonds",
  club: "Clubs",
};

type Props = {
  suit: Suit | null;
  rank: Rank | null;
  onChange: (suit: Suit | null, rank: Rank | null) => void;
};

/**
 * Two rows — four suits, thirteen ranks — rather than the 4x13 grid of all 52
 * cards this used to be. The grid only existed to show which cards were
 * already claimed; 0019 dropped players_group_card_unique, so nothing is
 * claimed and nothing needs greying out. Picking a suit and a rank
 * independently is 17 targets instead of 52.
 */
export default function SuitRankPicker({ suit, rank, onChange }: Props) {
  return (
    <div className="space-y-3">
      <div
        className="flex flex-wrap gap-1.5"
        role="group"
        aria-label="Suit"
      >
        {SUITS.map((s) => {
          const isSelected = suit === s;
          return (
            <button
              type="button"
              key={s}
              aria-pressed={isSelected}
              onClick={() => onChange(isSelected ? null : s, rank)}
              className={[
                "inline-flex min-h-9 items-center gap-2 rounded-md px-3 text-xs font-medium transition",
                // The pip keeps its own suit color in both states, so the
                // selected chip stays light and marks itself with a ring
                // instead of a fill. A sage fill would put an ink-900 spade
                // on green.
                isSelected
                  ? "bg-card-50 text-ink-900 ring-2 ring-sage-600"
                  : "bg-card-100/60 text-ink-700 ring-1 ring-card-200 hover:bg-card-100",
              ].join(" ")}
            >
              <SuitBadge suit={s} size={14} />
              {SUIT_NAMES[s]}
            </button>
          );
        })}
      </div>

      <div
        className="flex flex-wrap gap-1.5"
        role="group"
        aria-label="Rank"
      >
        {RANKS.map((r) => {
          const isSelected = rank === r;
          return (
            <button
              type="button"
              key={r}
              aria-pressed={isSelected}
              onClick={() => onChange(suit, isSelected ? null : r)}
              className={[
                "min-h-9 min-w-9 rounded-md px-2 font-display text-sm leading-none ring-1 transition",
                isSelected
                  ? "bg-sage-600 text-card-50 ring-sage-700"
                  : "bg-card-50 text-ink-900 ring-card-200 hover:bg-card-100",
              ].join(" ")}
            >
              {r}
            </button>
          );
        })}
      </div>

      <p className="text-[11px] text-ink-500">
        Pick the suit and rank that represent you. Two people in a group can
        hold the same card.
      </p>
    </div>
  );
}
