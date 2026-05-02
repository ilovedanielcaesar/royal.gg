import { useEffect, useMemo, useState } from "react";
import Button from "../components/Button";
import Card from "../components/Card";
import PlayerAvatar from "../components/PlayerAvatar";
import PlayerStatsCard from "../components/PlayerStatsCard";
import SuitRankPicker from "../components/SuitRankPicker";
import { useCurrentUser, type Player } from "../lib/auth";
import { describeError } from "../lib/errors";
import type { Rank, Suit } from "../lib/playerSuit";
import { requireSupabase } from "../lib/supabase";
import type { BuyIn, CashOut, Session } from "../lib/stats";

export default function ProfilePage() {
  const { player, refresh } = useCurrentUser();
  const [allPlayers, setAllPlayers] = useState<Player[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [buyIns, setBuyIns] = useState<BuyIn[]>([]);
  const [cashOuts, setCashOuts] = useState<CashOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [suit, setSuit] = useState<Suit | null>(null);
  const [rank, setRank] = useState<Rank | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    if (!player) return;
    setDisplayName(player.display_name ?? player.name);
    setUsername(player.username ?? "");
    setSuit(player.chosen_suit);
    setRank(player.chosen_rank);
  }, [player]);

  useEffect(() => {
    void (async () => {
      try {
        const supabase = requireSupabase();
        const [pRes, sRes, bRes, cRes] = await Promise.all([
          supabase.from("players").select("*"),
          supabase.from("sessions").select("*"),
          supabase.from("buy_ins").select("*"),
          supabase.from("cash_outs").select("*"),
        ]);
        if (pRes.error) throw pRes.error;
        if (sRes.error) throw sRes.error;
        if (bRes.error) throw bRes.error;
        if (cRes.error) throw cRes.error;
        setAllPlayers(pRes.data ?? []);
        setSessions(sRes.data ?? []);
        setBuyIns(bRes.data ?? []);
        setCashOuts(cRes.data ?? []);
      } catch (e) {
        setError(describeError(e));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const taken = useMemo(() => {
    const t = new Set<string>();
    for (const p of allPlayers) {
      if (
        p.id !== player?.id &&
        p.status === "active" &&
        p.chosen_suit &&
        p.chosen_rank
      ) {
        t.add(`${p.chosen_suit}:${p.chosen_rank}`);
      }
    }
    return t;
  }, [allPlayers, player?.id]);

  if (!player) {
    return <div className="text-sm text-card-50/60">Dealing in…</div>;
  }

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    if (!player) return;
    setSaving(true);
    setError(null);
    try {
      const supabase = requireSupabase();
      const { error } = await supabase
        .from("players")
        .update({
          display_name: displayName.trim(),
          username: username.trim() || null,
          chosen_suit: suit,
          chosen_rank: rank,
        })
        .eq("id", player.id);
      if (error) throw error;
      await refresh();
      setSavedAt(Date.now());
    } catch (e) {
      setError(describeError(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-4">
        <PlayerAvatar
          player={{ ...player, chosen_suit: suit, chosen_rank: rank }}
          size="lg"
        />
        <div>
          <h1 className="font-display text-3xl text-card-50">
            {displayName || player.name}
          </h1>
          <p className="text-sm text-card-50/70">@{username || "—"}</p>
        </div>
      </header>

      <Card className="p-5" accent="sage">
        <h2 className="font-display text-xl text-ink-900">Your card</h2>
        <p className="mt-1 text-xs text-ink-500">
          Pick the suit and rank that represent you across the app.
        </p>
        <div className="mt-4">
          <SuitRankPicker
            suit={suit}
            rank={rank}
            taken={taken}
            onChange={(s, r) => {
              setSuit(s);
              setRank(r);
            }}
          />
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="font-display text-xl text-ink-900">Profile</h2>
        <form className="mt-3 space-y-3" onSubmit={onSave}>
          <label className="block">
            <span className="text-xs font-medium text-ink-700">
              Display name
            </span>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="mt-1 w-full rounded-md border border-card-200 bg-card-50 px-3 py-2 text-sm focus:border-sage-600 focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-ink-700">Username</span>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="mt-1 w-full rounded-md border border-card-200 bg-card-50 px-3 py-2 text-sm focus:border-sage-600 focus:outline-none"
            />
          </label>
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

      {!loading && (
        <PlayerStatsCard
          player={player}
          sessions={sessions}
          buyIns={buyIns}
          cashOuts={cashOuts}
        />
      )}
    </div>
  );
}
