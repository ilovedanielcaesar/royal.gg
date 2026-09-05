import { useMemo, useState } from "react";
import Card from "../components/Card";
import PlayerStatsCard from "../components/PlayerStatsCard";
import SuitRankPicker from "../components/SuitRankPicker";
import { useCurrentUser } from "../lib/auth";
import { describeError } from "../lib/errors";
import { useGroup } from "../lib/groupContext";
import type { Rank, Suit } from "../lib/playerSuit";
import { requireSupabase } from "../lib/supabase";
import { EMPTY_LEAGUE_DATA, useLeagueData } from "../lib/useLeagueData";

export default function MyGroupProfilePage() {
  const { user } = useCurrentUser();
  const { group } = useGroup();
  const { data, loading } = useLeagueData();
  const { players, sessions, buyIns, cashOuts } = data ?? EMPTY_LEAGUE_DATA;
  const player = players.find((row) => row.profile_id === user?.id) ?? null;
  if (loading) return <p className="text-sm text-card-50/60">Dealing in…</p>;
  if (!player) return <Card className="p-6"><p className="text-sm text-ink-500">You do not have a roster row in this group yet.</p></Card>;
  return <div className="space-y-6"><header><h1 className="font-display text-4xl text-card-50">Your group profile</h1><p className="mt-1 text-sm text-card-50/70">Your card at this table.</p></header>
    <GroupCardPicker key={player.id} player={player} groupId={group!.id} players={players} />
    <PlayerStatsCard player={player} sessions={sessions} buyIns={buyIns} cashOuts={cashOuts} />
  </div>;
}

function GroupCardPicker({ player, groupId, players }: { player: typeof players[number]; groupId: string; players: typeof players }) {
  const [suit, setSuit] = useState<Suit | null>(player.chosen_suit);
  const [rank, setRank] = useState<Rank | null>(player.chosen_rank);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const taken = useMemo(() => new Set(players.filter((row) => row.id !== player.id && row.chosen_suit && row.chosen_rank).map((row) => `${row.chosen_suit}:${row.chosen_rank}`)), [player.id, players]);
  async function save() {
    setSaving(true); setError(null);
    try {
      const { error: updateError } = await requireSupabase().from("players").update({ chosen_suit: suit, chosen_rank: rank }).eq("id", player.id).eq("group_id", groupId);
      if (updateError) throw updateError;
    } catch (e) { setError(describeError(e)); } finally { setSaving(false); }
  }
  return <Card className="p-5" accent="sage"><h2 className="font-display text-xl text-ink-900">Your card</h2><p className="mt-1 text-xs text-ink-500">Cards are unique within this group.</p><div className="mt-4"><SuitRankPicker suit={suit} rank={rank} taken={taken} onChange={(nextSuit, nextRank) => { setSuit(nextSuit); setRank(nextRank); }} /></div>{error && <p className="mt-3 text-xs text-crimson-700">{error}</p>}<button type="button" onClick={() => void save()} disabled={saving} className="mt-4 rounded-md bg-felt-700 px-4 py-2 text-sm font-medium text-card-50 hover:bg-felt-600 disabled:opacity-50">{saving ? "Saving…" : "Save card"}</button></Card>;
}
