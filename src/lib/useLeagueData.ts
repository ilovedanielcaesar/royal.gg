import { useCallback, useEffect, useState } from "react";
import type { Player } from "./authContext";
import { describeError } from "./errors";
import type { BuyIn, CashOut, Payout, Session } from "./stats";
import { requireSupabase } from "./supabase";
import { useGroup } from "./groupContext";

export type LeagueData = {
  players: Player[];
  sessions: Session[];
  buyIns: BuyIn[];
  cashOuts: CashOut[];
  payouts: Payout[];
};

/**
 * Stable empty set for consumers to fall back on before the first load.
 * Must be module-level: `data?.sessions ?? []` mints a new array every render,
 * which changes the identity of every useMemo dependency downstream.
 */
export const EMPTY_LEAGUE_DATA: LeagueData = {
  players: [],
  sessions: [],
  buyIns: [],
  cashOuts: [],
  payouts: [],
};

export function useLeagueData(): {
  data: LeagueData | null;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
} {
  const { group, loading: groupLoading } = useGroup();
  const [loaded, setLoaded] = useState<{ groupId: string; data: LeagueData } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!group) return;
    setLoading(true);
    setError(null);
    try {
      const supabase = requireSupabase();
      const [playersResult, sessionsResult, payoutsResult] = await Promise.all([
        supabase.from("players").select("*").eq("group_id", group.id),
        supabase.from("sessions").select("*").eq("group_id", group.id),
        supabase.from("payouts").select("*").eq("group_id", group.id),
      ]);
      if (playersResult.error) throw playersResult.error;
      if (sessionsResult.error) throw sessionsResult.error;
      if (payoutsResult.error) throw payoutsResult.error;
      const sessionIds = (sessionsResult.data ?? []).map((session) => session.id);
      const [buyInsResult, cashOutsResult] = sessionIds.length === 0
        ? [{ data: [], error: null }, { data: [], error: null }]
        : await Promise.all([
            supabase.from("buy_ins").select("*").in("session_id", sessionIds),
            supabase.from("cash_outs").select("*").in("session_id", sessionIds),
          ]);
      if (buyInsResult.error) throw buyInsResult.error;
      if (cashOutsResult.error) throw cashOutsResult.error;
      setLoaded({ groupId: group.id, data: {
        players: playersResult.data ?? [],
        sessions: sessionsResult.data ?? [],
        buyIns: buyInsResult.data ?? [],
        cashOuts: cashOutsResult.data ?? [],
        payouts: payoutsResult.data ?? [],
      }});
    } catch (e) {
      console.error(e);
      setError(describeError(e));
    } finally {
      setLoading(false);
    }
  }, [group]);

  useEffect(() => {
    if (group) void reload();
    else { setLoading(false); setError(null); }
  }, [group, reload]);

  const data = group ? (loaded?.groupId === group.id ? loaded.data : null) : EMPTY_LEAGUE_DATA;
  return { data, loading: groupLoading || loading, error, reload };
}
