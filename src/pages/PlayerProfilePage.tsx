import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import Card from "../components/Card";
import PlayerAvatar from "../components/PlayerAvatar";
import PlayerStatsCard from "../components/PlayerStatsCard";
import { describeError } from "../lib/errors";
import {
  leaderboard,
  type BuyIn,
  type CashOut,
  type Player,
  type Session,
} from "../lib/stats";
import { requireSupabase } from "../lib/supabase";

export default function PlayerProfilePage() {
  const { id } = useParams();
  const [player, setPlayer] = useState<Player | null>(null);
  const [allPlayers, setAllPlayers] = useState<Player[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [buyIns, setBuyIns] = useState<BuyIn[]>([]);
  const [cashOuts, setCashOuts] = useState<CashOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    void (async () => {
      try {
        const supabase = requireSupabase();
        const [pSelfRes, pAllRes, sRes, bRes, cRes] = await Promise.all([
          supabase.from("players").select("*").eq("id", id).maybeSingle(),
          supabase.from("players").select("*"),
          supabase.from("sessions").select("*"),
          supabase.from("buy_ins").select("*"),
          supabase.from("cash_outs").select("*"),
        ]);
        if (pSelfRes.error) throw pSelfRes.error;
        if (pAllRes.error) throw pAllRes.error;
        if (sRes.error) throw sRes.error;
        if (bRes.error) throw bRes.error;
        if (cRes.error) throw cRes.error;
        setPlayer(pSelfRes.data);
        setAllPlayers(pAllRes.data ?? []);
        setSessions(sRes.data ?? []);
        setBuyIns(bRes.data ?? []);
        setCashOuts(cRes.data ?? []);
      } catch (e) {
        setError(describeError(e));
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const allTimeRank = useMemo(() => {
    if (!player) return null;
    const lb = leaderboard(allPlayers, sessions, buyIns, cashOuts).filter(
      (r) => r.sessionsPlayed > 0
    );
    const idx = lb.findIndex((r) => r.playerId === player.id);
    return idx === -1 ? null : idx + 1;
  }, [player, allPlayers, sessions, buyIns, cashOuts]);

  if (loading) {
    return <div className="text-sm text-card-50/60">Dealing in…</div>;
  }
  if (error || !player) {
    return (
      <Card className="p-6">
        <p className="text-sm text-crimson-700">
          {error ?? "Player not found."}
        </p>
        <Link to="/players" className="mt-2 inline-block text-xs text-sage-700 underline">
          Back to players
        </Link>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-4">
        <PlayerAvatar player={player} size="lg" />
        <div>
          <h1 className="font-display text-3xl text-card-50">
            {player.display_name ?? player.name}
          </h1>
          <p className="text-sm text-card-50/70">
            {player.username
              ? `@${player.username}`
              : player.is_guest
                ? "Guest"
                : "Member"}
          </p>
        </div>
      </header>
      <PlayerStatsCard
        player={player}
        sessions={sessions}
        buyIns={buyIns}
        cashOuts={cashOuts}
        recentCount={10}
        highlightHero
        rankAllTime={allTimeRank}
      />
    </div>
  );
}
