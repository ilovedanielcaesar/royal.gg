import { useMemo, useState } from "react";
import Button from "../components/Button";
import Card from "../components/Card";
import LeaveGroupCard from "../components/LeaveGroupCard";
import PlayerAvatar from "../components/PlayerAvatar";
import PlayerStatsCard from "../components/PlayerStatsCard";
import SuitRankPicker from "../components/SuitRankPicker";
import { useCurrentUser } from "../lib/auth";
import { describeError } from "../lib/errors";
import { useGroup } from "../lib/groupContext";
import type { Rank, Suit } from "../lib/playerSuit";
import { requireSupabase } from "../lib/supabase";
import { useLeagueData } from "../lib/useLeagueData";

export default function MyGroupProfilePage() {
  const { user } = useCurrentUser();
  const { path } = useGroup();
  const { data, error: loadError, reload } = useLeagueData();
  const playerRow = data?.players.find(
    (player) => player.profile_id === user?.id
  );
  const [selection, setSelection] = useState<{
    playerId: string;
    suit: Suit | null;
    rank: Rank | null;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const suit =
    selection && selection.playerId === playerRow?.id
      ? selection.suit
      : (playerRow?.chosen_suit ?? null);
  const rank =
    selection && selection.playerId === playerRow?.id
      ? selection.rank
      : (playerRow?.chosen_rank ?? null);

  const taken = useMemo(() => {
    const cards = new Set<string>();
    for (const player of data?.players ?? []) {
      if (
        player.id !== playerRow?.id &&
        player.chosen_suit &&
        player.chosen_rank
      ) {
        cards.add(`${player.chosen_suit}:${player.chosen_rank}`);
      }
    }
    return cards;
  }, [data?.players, playerRow?.id]);

  if (loadError && !data) {
    return (
      <Card accent="crimson">
        <p className="p-4 text-sm text-crimson-700">{loadError}</p>
      </Card>
    );
  }

  if (!user || !data) {
    return <div className="text-sm text-card-50/60">Dealing in…</div>;
  }

  if (!playerRow) {
    return (
      <div className="space-y-6">
        <Card className="p-5" accent="gold">
          <h1 className="font-display text-2xl text-ink-900">
            No player profile yet
          </h1>
          <p className="mt-2 text-sm text-ink-500">
            You do not have a roster entry in this group yet. Ask a group admin
            to add or link one for you.
          </p>
        </Card>
        <LeaveGroupCard />
      </div>
    );
  }

  async function onSave(event: React.FormEvent) {
    event.preventDefault();
    if (!playerRow) return;
    setSaving(true);
    setSaveError(null);
    try {
      const supabase = requireSupabase();
      const { error } = await supabase
        .from("players")
        .update({ chosen_suit: suit, chosen_rank: rank })
        .eq("id", playerRow.id);
      if (error) throw error;
      await reload();
      setSelection(null);
      setSavedAt(Date.now());
    } catch (error) {
      setSaveError(describeError(error));
    } finally {
      setSaving(false);
    }
  }

  const error = saveError ?? loadError;

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-4">
        <PlayerAvatar
          player={{ ...playerRow, chosen_suit: suit, chosen_rank: rank }}
          size="lg"
        />
        <div>
          <h1 className="font-display text-3xl text-card-50">
            {playerRow.display_name ?? playerRow.name}
          </h1>
          <p className="text-sm text-card-50/70">Your group profile</p>
        </div>
      </header>

      <Card className="p-5" accent="sage">
        <h2 className="font-display text-xl text-ink-900">Your card</h2>
        <p className="mt-1 text-xs text-ink-500">
          Pick the suit and rank that represent you in this group.
        </p>
        <form className="mt-4 space-y-3" onSubmit={onSave}>
          <SuitRankPicker
            suit={suit}
            rank={rank}
            taken={taken}
            onChange={(nextSuit, nextRank) => {
              setSelection({
                playerId: playerRow.id,
                suit: nextSuit,
                rank: nextRank,
              });
            }}
          />
          {error && (
            <div className="rounded-md bg-crimson-500/10 px-3 py-2 text-xs text-crimson-700">
              {error}
            </div>
          )}
          {savedAt && !error && (
            <div className="text-xs text-sage-700">Saved.</div>
          )}
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </form>
      </Card>

      <PlayerStatsCard
        player={playerRow}
        sessions={data.sessions}
        buyIns={data.buyIns}
        cashOuts={data.cashOuts}
        ratingHref={path(`/players/${playerRow.id}/rating`)}
      />

      <LeaveGroupCard />
    </div>
  );
}
