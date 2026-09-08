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

/**
 * players_group_card_unique is (group_id, chosen_suit, chosen_rank). The
 * picker greys out taken cards, but that list is a snapshot: two people
 * setting up at the same time can both see the same card free. The index is
 * what actually decides, and its raw message is not for a human to read.
 * Mirrors isDuplicateSlug() in CreateGroupPage.
 */
function isCardTaken(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const details = error as Record<string, unknown>;
  if (details.code !== "23505") return false;
  return [details.message, details.details, details.hint]
    .filter((value): value is string => typeof value === "string")
    .some((value) => value.includes("players_group_card_unique"));
}

export default function MyGroupProfilePage() {
  const { user } = useCurrentUser();
  const { group, path } = useGroup();
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
    if (!playerRow || !group) return;
    setSaving(true);
    setSaveError(null);
    setSavedAt(null);
    try {
      const supabase = requireSupabase();
      const { data: updated, error } = await supabase
        .from("players")
        .update({ chosen_suit: suit, chosen_rank: rank })
        .eq("id", playerRow.id)
        .eq("group_id", group.id)
        .select("id");
      if (error) throw error;
      // An update refused by RLS comes back as zero rows and NO error, so
      // without this the form would say "Saved." over a card it never wrote.
      if (!updated || updated.length === 0) {
        throw new Error("That card could not be saved. Try reloading the page.");
      }
      await reload();
      setSelection(null);
      setSavedAt(Date.now());
    } catch (error) {
      if (isCardTaken(error)) {
        // Someone claimed it between this page loading and Save. Reloading is
        // what makes the picker grey it out, so do that rather than leave a
        // message contradicted by the grid underneath it.
        setSaveError("Someone in this group just took that card. Pick another.");
        setSelection(null);
        await reload();
      } else {
        setSaveError(describeError(error));
      }
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
