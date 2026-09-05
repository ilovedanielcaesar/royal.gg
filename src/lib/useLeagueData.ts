import { useCallback, useEffect, useState } from "react";
import type { Player } from "./authContext";
import { describeError } from "./errors";
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
  const [data, setData] = useState<LeagueData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const supabase = requireSupabase();
      const [playersResult, sessionsResult, buyInsResult, cashOutsResult, payoutsResult] =
        await Promise.all([
          supabase.from("players").select("*"),
          supabase.from("sessions").select("*"),
          supabase.from("buy_ins").select("*"),
          supabase.from("cash_outs").select("*"),
          supabase.from("payouts").select("*"),
        ]);
      if (playersResult.error) throw playersResult.error;
      if (sessionsResult.error) throw sessionsResult.error;
      if (buyInsResult.error) throw buyInsResult.error;
      if (cashOutsResult.error) throw cashOutsResult.error;
      if (payoutsResult.error) throw payoutsResult.error;
      setData({
        players: playersResult.data ?? [],
        sessions: sessionsResult.data ?? [],
        buyIns: buyInsResult.data ?? [],
        cashOuts: cashOutsResult.data ?? [],
        payouts: payoutsResult.data ?? [],
      });
    } catch (e) {
      console.error(e);
      setError(describeError(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { data, loading, error, reload };
}
