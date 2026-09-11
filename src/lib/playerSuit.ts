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

const RANK_NAMES: Record<Rank, string> = {
  A: "Ace",
  "2": "Two",
  "3": "Three",
  "4": "Four",
  "5": "Five",
  "6": "Six",
  "7": "Seven",
  "8": "Eight",
  "9": "Nine",
  "10": "Ten",
  J: "Jack",
  Q: "Queen",
  K: "King",
};

const SUIT_NAMES: Record<Suit, string> = {
  spade: "Spades",
  heart: "Hearts",
  diamond: "Diamonds",
  club: "Clubs",
};

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
 *
 * A guest who has not picked one is the exception, and `rank: null` is how
 * it is said: a BLANK SPADE, per `_FEEDBACK_V2.md` → Individual session page.
 * The hashed fallback gives a member an identity to recognise across the
 * league and grow attached to. A guest has not claimed one, and dealing them
 * the Queen of Hearts on their first night asserts something about them that
 * nobody chose.
 */
export function effectiveSuit(player: {
  id: string;
  is_guest?: boolean | null;
  chosen_suit?: Suit | null;
  chosen_rank?: Rank | null;
}): { suit: Suit; rank: Rank | null } {
  if (player.chosen_suit && player.chosen_rank) {
    return { suit: player.chosen_suit, rank: player.chosen_rank };
  }
  if (player.is_guest) return { suit: "spade", rank: null };
  return playerSuit(player.id);
}

export function suitColor(suit: Suit): "ink" | "red" {
  return suit === "spade" || suit === "club" ? "ink" : "red";
}

export function cardFullName(rank: Rank | null, suit: Suit): string {
  if (rank === null) return `blank ${SUIT_NAMES[suit].slice(0, -1)} card`;
  return `${RANK_NAMES[rank]} of ${SUIT_NAMES[suit]}`;
}
