export type Suit = "spade" | "heart" | "diamond" | "club";
export type Rank =
  | "A"
  | "2"
  | "3"
  | "4"
  | "5"
  | "6"
  | "7"
  | "8"
  | "9"
  | "10"
  | "J"
  | "Q"
  | "K";

const SUITS: Suit[] = ["spade", "heart", "diamond", "club"];
const RANKS: Rank[] = [
  "A",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "J",
  "Q",
  "K",
];

function hashString(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i += 1) {
    h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

export function playerSuit(playerId: string): { suit: Suit; rank: Rank } {
  const h = hashString(playerId);
  return {
    suit: SUITS[h % 4],
    rank: RANKS[Math.floor(h / 4) % 13],
  };
}

/**
 * The card a player should be displayed as: their chosen card if set,
 * otherwise the deterministic fallback derived from their UUID.
 */
export function effectiveSuit(player: {
  id: string;
  chosen_suit?: Suit | null;
  chosen_rank?: Rank | null;
}): { suit: Suit; rank: Rank } {
  if (player.chosen_suit && player.chosen_rank) {
    return { suit: player.chosen_suit, rank: player.chosen_rank };
  }
  return playerSuit(player.id);
}

export function suitColor(suit: Suit): "ink" | "red" {
  return suit === "spade" || suit === "club" ? "ink" : "red";
}
