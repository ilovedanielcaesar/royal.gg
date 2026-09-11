import type { Database } from "../types/database";
import { todayIsoDate } from "./format";
import type { SessionFormPlayer } from "./sessionForm";
import { requireSupabase } from "./supabase";

type BuyIn = Database["public"]["Tables"]["buy_ins"]["Row"];
type CashOut = Database["public"]["Tables"]["cash_outs"]["Row"];

/**
 * What an approved night actually says, read back rather than recomputed.
 *
 * The editor re-runs `reconcile()` on every keystroke, which is right while
 * the numbers are still moving. A settled record must not: the adjusted
 * figures were written at approval time under the threshold in force THEN,
 * and re-deriving them would silently restate a settled night the day
 * somebody changes the group's threshold. CLAUDE.md is explicit that both
 * numbers are kept and neither is overwritten; this is the read side of it.
 */
export type SettledRow = {
  playerId: string;
  buyInCents: number;
  reportedCashOutCents: number;
  adjustedCashOutCents: number;
  netCents: number;
};

export type LoadedSessionForm = {
  players: SessionFormPlayer[];
  session: Database["public"]["Tables"]["sessions"]["Row"] | null;
  playedAt: string;
  notes: string;
  rows: { playerId: string; buyInCount: string; cashOut: string }[];
  settled: SettledRow[];
};

export default async function fetchSessionFormData(
  groupId: string,
  id?: string
): Promise<LoadedSessionForm> {
  const sb = requireSupabase();
  const { data: players, error: playerError } = await sb
    .from("players")
    .select("*")
    .eq("group_id", groupId)
    .neq("status", "rejected")
    .order("name");
  if (playerError) throw playerError;

  if (!id) {
    return {
      players: players ?? [],
      session: null,
      playedAt: todayIsoDate(),
      notes: "",
      rows: [],
      settled: [],
    };
  }

  const [
    { data: session, error: sessionError },
    { data: buyIns, error: buyInError },
    { data: cashOuts, error: cashOutError },
  ] = await Promise.all([
    sb.from("sessions").select("*").eq("id", id).eq("group_id", groupId).single(),
    sb.from("buy_ins").select("*").eq("session_id", id),
    sb.from("cash_outs").select("*").eq("session_id", id),
  ]);
  if (sessionError) throw sessionError;
  if (buyInError) throw buyInError;
  if (cashOutError) throw cashOutError;

  const playerIds = Array.from(
    new Set([
      ...(buyIns ?? []).map((buyIn: BuyIn) => buyIn.player_id),
      ...(cashOuts ?? []).map((cashOut: CashOut) => cashOut.player_id),
    ])
  );
  const rows = playerIds.map((playerId) => {
    const count = (buyIns ?? []).filter(
      (buyIn: BuyIn) => buyIn.player_id === playerId
    ).length;
    const cashOut = (cashOuts ?? []).find(
      (row: CashOut) => row.player_id === playerId
    );
    return {
      playerId,
      buyInCount: String(count || 1),
      cashOut: cashOut
        ? (cashOut.reported_amount_cents / 100).toFixed(2)
        : "",
    };
  });

  // Summed from the buy_in rows themselves, not count × the session's stake.
  // They agree today, and the stored amount is the one the money was taken
  // at either way.
  const settled: SettledRow[] = playerIds.map((playerId) => {
    const buyInCents = (buyIns ?? [])
      .filter((buyIn: BuyIn) => buyIn.player_id === playerId)
      .reduce((sum: number, buyIn: BuyIn) => sum + buyIn.amount_cents, 0);
    const cashOut = (cashOuts ?? []).find(
      (row: CashOut) => row.player_id === playerId
    );
    const adjustedCashOutCents = cashOut?.adjusted_amount_cents ?? 0;
    return {
      playerId,
      buyInCents,
      reportedCashOutCents: cashOut?.reported_amount_cents ?? 0,
      adjustedCashOutCents,
      netCents: adjustedCashOutCents - buyInCents,
    };
  });

  return {
    players: players ?? [],
    session,
    playedAt: session.played_at,
    notes: session.notes ?? "",
    rows,
    settled,
  };
}
