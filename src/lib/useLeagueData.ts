import { useCallback, useEffect, useRef, useState } from "react";
import type { Player } from "./authContext";
import { describeError } from "./errors";
import { useGroup } from "./groupContext";
import type { BuyIn, CashOut, Payout, Session } from "./stats";
import { requireSupabase } from "./supabase";

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
  const groupId = group?.id ?? null;
  const latestRequest = useRef(0);
  const [state, setState] = useState<{
    groupId: string | null;
    data: LeagueData | null;
    loading: boolean;
    error: string | null;
  }>({ groupId: null, data: null, loading: true, error: null });

  const reload = useCallback(async () => {
    const requestId = ++latestRequest.current;
    if (!groupId || groupLoading) return;

    setState((current) => ({
      groupId,
      data: current.groupId === groupId ? current.data : null,
      loading: true,
      error: null,
    }));
    try {
      const supabase = requireSupabase();
      const sessionsResult = await supabase
        .from("sessions")
        .select("*")
        .eq("group_id", groupId);
      if (sessionsResult.error) throw sessionsResult.error;

      const sessionIds = (sessionsResult.data ?? []).map((session) => session.id);
      const [playersResult, payoutsResult, buyInsResult, cashOutsResult] =
        await Promise.all([
          supabase.from("players").select("*").eq("group_id", groupId),
          supabase.from("payouts").select("*").eq("group_id", groupId),
          sessionIds.length > 0
            ? supabase.from("buy_ins").select("*").in("session_id", sessionIds)
            : Promise.resolve({ data: [] as BuyIn[], error: null }),
          sessionIds.length > 0
            ? supabase.from("cash_outs").select("*").in("session_id", sessionIds)
            : Promise.resolve({ data: [] as CashOut[], error: null }),
        ]);
      if (playersResult.error) throw playersResult.error;
      if (payoutsResult.error) throw payoutsResult.error;
      if (buyInsResult.error) throw buyInsResult.error;
      if (cashOutsResult.error) throw cashOutsResult.error;
      if (latestRequest.current === requestId) {
        setState({
          groupId,
          data: {
            players: playersResult.data ?? [],
            sessions: sessionsResult.data ?? [],
            buyIns: buyInsResult.data ?? [],
            cashOuts: cashOutsResult.data ?? [],
            payouts: payoutsResult.data ?? [],
          },
          loading: false,
          error: null,
        });
      }
    } catch (e) {
      console.error(e);
      if (latestRequest.current === requestId) {
        setState((current) => ({
          groupId,
          data: current.groupId === groupId ? current.data : null,
          loading: false,
          error: describeError(e),
        }));
      }
    }
  }, [groupId, groupLoading]);

  useEffect(() => {
    void reload();
  }, [reload]);

  if (!groupId || groupLoading || state.groupId !== groupId) {
    return { data: null, loading: true, error: null, reload };
  }

  return {
    data: state.data,
    loading: state.loading,
    error: state.error,
    reload,
  };
}
