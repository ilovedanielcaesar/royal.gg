import { useState } from "react";
import { Link } from "react-router-dom";
import Band from "../../components/Band";
import Button from "../../components/Button";
import ErrorNote from "../../components/ErrorNote";
import StatFigure from "../../components/StatFigure";
import SuitRankPicker from "../../components/SuitRankPicker";
import { describeError } from "../../lib/errors";
import { formatSignedCents } from "../../lib/money";
import { moneyToneClass } from "../../lib/moneyTone";
import {
  cardFullName,
  effectiveSuit,
  playerSuit,
  type Rank,
  type Suit,
} from "../../lib/playerSuit";
import { requireSupabase } from "../../lib/supabase";
import type { Player, PlayerRating, PlayerStats } from "../../lib/stats";
import PlayerCardPreview from "./PlayerCardPreview";

type Props = {
  player: Player;
  groupId: string;
  stats: PlayerStats;
  rating: PlayerRating;
  ratingHref: string;
  reload: () => Promise<void>;
};

type Selection = { playerId: string; suit: Suit; rank: Rank };

/**
 * The hero: your card, and the two figures that answer "how am I doing".
 *
 * The picker is behind the card rather than beside it. Two reasons. It is
 * used about twice in the life of an account and then never again, so
 * seventeen buttons permanently occupying the widest part of the page bought
 * nothing; and the space they were occupying is the only place on this page a
 * display-scale figure fits. Clicking the card opens the picker underneath
 * it, which is where a hand of options belongs relative to the card it
 * changes.
 *
 * Player score and lifetime net are the two, and they moved out of `Track
 * record` rather than being copied into here — the same figure printed twice
 * on one page makes the reader check whether they disagree.
 */
export default function ProfileCardBand({
  player,
  groupId,
  stats,
  rating,
  ratingHref,
  reload,
}: Props) {
  // This band is a member picking their own card, so `rank` is never the
  // guest's blank spade here. The fallback keeps the picker typed as a real
  // card without a cast, and is unreachable in practice.
  const effective = effectiveSuit(player);
  const saved = {
    suit: effective.suit,
    rank: effective.rank ?? playerSuit(player.id).rank,
  };
  const [picking, setPicking] = useState(false);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState(false);
  const current =
    selection?.playerId === player.id
      ? selection
      : { playerId: player.id, ...saved };
  const dirty = current.suit !== saved.suit || current.rank !== saved.rank;

  function close() {
    setPicking(false);
    setSelection(null);
    setError(null);
  }

  async function saveCard() {
    if (saving || !dirty) return;
    setSaving(true);
    setError(null);
    setSavedMessage(false);
    try {
      const { data, error: updateError } = await requireSupabase()
        .from("players")
        .update({ chosen_suit: current.suit, chosen_rank: current.rank })
        .eq("id", player.id)
        .eq("group_id", groupId)
        .select("id");
      if (updateError) throw updateError;
      if (!data || data.length === 0) {
        throw new Error("That card could not be saved. Try reloading the page.");
      }
      await reload();
      setSelection(null);
      setPicking(false);
      setSavedMessage(true);
    } catch (caught) {
      setError(describeError(caught));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Band>
      <div className="grid items-start gap-9 md:grid-cols-[auto_1fr]">
        <div className="flex flex-col items-center gap-3">
          <PlayerCardPreview
            rank={current.rank}
            suit={current.suit}
            dirty={dirty}
            expanded={picking}
            onClick={() => {
              setSavedMessage(false);
              if (picking) close();
              else setPicking(true);
            }}
          />
          <p className="text-center text-[13px] font-semibold text-ink-700">
            {cardFullName(current.rank, current.suit)}
          </p>
          {!picking && (
            <p className="text-center text-[11px] text-ink-500">
              {savedMessage ? (
                <span className="text-sage-700">Card saved.</span>
              ) : (
                "Click the card to change it"
              )}
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-x-14 gap-y-6">
          <StatFigure
            label="Player score"
            value={
              rating.rating == null ? (
                "—"
              ) : (
                <Link to={ratingHref} className="hover:underline">
                  {rating.rating.toFixed(1)}
                </Link>
              )
            }
            suffix={rating.rating == null ? undefined : "/10"}
            caption={
              rating.rating == null
                ? "Three nights needed before this means anything"
                : "How the score is built →"
            }
          />
          <StatFigure
            label="Lifetime net"
            value={formatSignedCents(stats.totalNetCents)}
            toneClass={moneyToneClass(stats.totalNetCents)}
            caption={`${stats.sessionsPlayed} nights · never reset by a payout`}
          />
        </div>
      </div>

      {/* Under the card, not beside it, and full width so thirteen ranks fit
          on one line instead of wrapping into a block. */}
      {picking && (
        <div className="mt-7 border-t border-card-100 pt-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="min-w-0 flex-1">
              <p className="mb-3 text-[10px] font-semibold tracking-[0.13em] text-ink-500 uppercase">
                Choose your card
              </p>
              <SuitRankPicker
                suit={current.suit}
                rank={current.rank}
                onChange={(suit, rank) => {
                  setError(null);
                  setSavedMessage(false);
                  setSelection({
                    playerId: player.id,
                    suit: suit ?? current.suit,
                    rank: rank ?? current.rank,
                  });
                }}
              />
            </div>
            <div className="flex items-center gap-2">
              {dirty && (
                <span className="rounded-full bg-gold-500/20 px-2.5 py-1 text-[11px] font-semibold text-gold-ink">
                  Unsaved
                </span>
              )}
              <Button
                type="button"
                size="sm"
                disabled={saving || !dirty}
                onClick={() => void saveCard()}
              >
                {saving ? "Saving…" : "Save card"}
              </Button>
              <Button type="button" size="sm" variant="subtle" onClick={close}>
                Cancel
              </Button>
            </div>
          </div>
          {error && (
            <ErrorNote className="mt-3">{error}</ErrorNote>
          )}
        </div>
      )}
    </Band>
  );
}
