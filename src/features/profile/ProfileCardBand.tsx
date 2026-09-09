import { useState } from "react";
import Band from "../../components/Band";
import Button from "../../components/Button";
import SuitRankPicker from "../../components/SuitRankPicker";
import { describeError } from "../../lib/errors";
import {
  effectiveSuit,
  type Rank,
  type Suit,
} from "../../lib/playerSuit";
import { requireSupabase } from "../../lib/supabase";
import type { Player } from "../../lib/stats";
import PlayerCardPreview from "./PlayerCardPreview";

type Props = {
  player: Player;
  groupId: string;
  reload: () => Promise<void>;
};

type Selection = { playerId: string; suit: Suit; rank: Rank };

export default function ProfileCardBand({ player, groupId, reload }: Props) {
  const saved = effectiveSuit(player);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState(false);
  const current =
    selection?.playerId === player.id
      ? selection
      : { playerId: player.id, ...saved };
  const dirty = current.suit !== saved.suit || current.rank !== saved.rank;

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
      setSavedMessage(true);
    } catch (caught) {
      setError(describeError(caught));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Band
      title="Your card"
      caption="Pick the card that represents you in this group."
    >
      <div className="mt-5 grid items-start gap-8 md:grid-cols-[240px_1fr]">
        <PlayerCardPreview rank={current.rank} suit={current.suit} dirty={dirty} />
        <div className="pt-1">
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
          {error && (
            <p className="mt-3 rounded-md bg-crimson-500/10 px-3 py-2 text-xs text-crimson-700">
              {error}
            </p>
          )}
          {savedMessage && !error && (
            <p className="mt-3 text-xs text-sage-700">Card saved.</p>
          )}
          {dirty && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-gold-500/20 px-2.5 py-1 text-[11px] font-semibold text-gold-ink">
                Unsaved
              </span>
              <Button type="button" size="sm" disabled={saving} onClick={() => void saveCard()}>
                {saving ? "Saving…" : "Save card"}
              </Button>
              <Button type="button" size="sm" variant="subtle" onClick={() => setSelection(null)}>
                Cancel
              </Button>
            </div>
          )}
        </div>
      </div>
    </Band>
  );
}
