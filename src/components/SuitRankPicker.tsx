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

type Props = {
  suit: Suit | null;
  rank: Rank | null;
  taken: Set<string>; // "suit:rank"
  onChange: (suit: Suit | null, rank: Rank | null) => void;
};

function key(s: Suit, r: Rank) {
  return `${s}:${r}`;
}

export default function SuitRankPicker({
  suit,
  rank,
  taken,
  onChange,
}: Props) {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-[auto_repeat(13,minmax(0,1fr))] gap-1">
        <div />
        {RANKS.map((r) => (
          <div
            key={r}
            className="text-center text-[10px] font-medium text-ink-500"
          >
            {r}
          </div>
        ))}
        {SUITS.map((s) => (
          <div className="contents" key={s}>
            <div className="flex items-center justify-center pr-1">
              <SuitBadge suit={s} size={14} />
            </div>
            {RANKS.map((r) => {
              const isSelected = suit === s && rank === r;
              const isTaken = taken.has(key(s, r)) && !isSelected;
              return (
                <button
                  type="button"
                  key={r}
                  disabled={isTaken}
                  onClick={() =>
                    onChange(isSelected ? null : s, isSelected ? null : r)
                  }
                  className={[
                    "aspect-[2/3] rounded-sm font-display text-[10px] leading-none ring-1 transition",
                    isSelected
                      ? "bg-sage-600 text-card-50 ring-sage-700"
                      : isTaken
                        ? "bg-card-100 text-ink-500/40 ring-card-200 line-through"
                        : "bg-card-50 text-ink-900 ring-card-200 hover:bg-card-100",
                  ].join(" ")}
                  aria-label={`${r} of ${s}${isTaken ? " (taken)" : ""}`}
                >
                  {r}
                </button>
              );
            })}
          </div>
        ))}
      </div>
      <p className="text-[11px] text-ink-500">
        Pick the card that represents you. Greyed cards are taken.
      </p>
    </div>
  );
}
