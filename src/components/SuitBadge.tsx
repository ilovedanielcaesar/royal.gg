import type { Suit } from "../lib/playerSuit";

type Props = {
  suit: Suit;
  size?: number;
  className?: string;
};

const PATHS: Record<Suit, string> = {
  spade:
    "M50 8c-7 14-30 28-30 47a18 18 0 0 0 27 16c-2 6-7 12-13 17h32c-6-5-11-11-13-17a18 18 0 0 0 27-16c0-19-23-33-30-47Z",
  heart:
    "M50 88C28 72 8 56 8 35a20 20 0 0 1 36-12 20 20 0 0 1 36 12c0 21-20 37-30 53Z",
  diamond: "M50 6 88 50 50 94 12 50Z",
  club:
    "M50 6a17 17 0 0 0-13 28 17 17 0 1 0-9 28 17 17 0 0 0 16-3c-1 7-6 14-13 19h38c-7-5-12-12-13-19a17 17 0 0 0 16 3 17 17 0 1 0-9-28A17 17 0 0 0 50 6Z",
};

export default function SuitBadge({ suit, size = 16, className }: Props) {
  const isRed = suit === "heart" || suit === "diamond";
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      aria-label={suit}
      className={className}
      style={{ display: "inline-block" }}
    >
      <path
        d={PATHS[suit]}
        fill={isRed ? "var(--color-crimson-600)" : "var(--color-ink-900)"}
      />
    </svg>
  );
}
