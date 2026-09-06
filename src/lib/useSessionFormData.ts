import { useCallback, useEffect, useState } from "react";
import { describeError } from "./errors";
import { todayIsoDate } from "./format";
import {
  parseCount,
  type SessionFormPlayer,
  type SessionFormRow,
  type SessionFormSession,
} from "./sessionForm";
import { requireSupabase } from "./supabase";
import type { Database } from "../types/database";

type BuyIn = Database["public"]["Tables"]["buy_ins"]["Row"];
type CashOut = Database["public"]["Tables"]["cash_outs"]["Row"];

type LoadedData = {
  players: SessionFormPlayer[];
  session: SessionFormSession | null;
  playedAt: string;
  notes: string;
  rows: SessionFormRow[];
};

export default function useSessionFormData(groupId: string, id?: string) {
  const requestKey = `${groupId}:${id ?? "new"}`;
  const [allPlayers, setAllPlayers] = useState<SessionFormPlayer[]>([]);
  const [session, setSession] = useState<SessionFormSession | null>(null);
  const [playedAt, setPlayedAt] = useState(todayIsoDate());
  const [notes, setNotes] = useState("");
  const [rows, setRows] = useState<SessionFormRow[]>([]);
  const [loading, setLoading] = useState(Boolean(id));
  const [loadedKey, setLoadedKey] = useState<string | null>(
    id ? null : requestKey
  );
  const [error, setError] = useState<string | null>(null);

  const applyLoadedData = useCallback((data: LoadedData, key: string) => {
    setAllPlayers(data.players);
    setSession(data.session);
    setPlayedAt(data.playedAt);
    setNotes(data.notes);
    setRows(data.rows);
    setLoadedKey(key);
  }, []);

  const load = useCallback(async () => {
    setError(null);
    try {
      applyLoadedData(await fetchSessionFormData(groupId, id), requestKey);
    } catch (e) {
      console.error(e);
      setError(describeError(e));
    } finally {
      setLoading(false);
    }
  }, [applyLoadedData, groupId, id, requestKey]);

  useEffect(() => {
    let cancelled = false;
    void fetchSessionFormData(groupId, id)
      .then((data) => {
        if (!cancelled) applyLoadedData(data, requestKey);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        console.error(e);
        setError(describeError(e));
        setLoadedKey(requestKey);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [applyLoadedData, groupId, id, requestKey]);

  function togglePlayer(playerId: string) {
    setRows((prev) => {
      const existing = prev.find((r) => r.playerId === playerId);
      if (!existing) {
        return [...prev, { playerId, buyInCount: "1", cashOut: "" }];
      }
      const hasData =
        existing.cashOut.trim() !== "" || parseCount(existing.buyInCount) > 1;
      if (
        hasData &&
        !confirm("Remove this player and discard their entered amounts?")
      ) {
        return prev;
      }
      return prev.filter((r) => r.playerId !== playerId);
    });
  }

  function updateRow(playerId: string, patch: Partial<SessionFormRow>) {
    setRows((prev) =>
      prev.map((row) =>
        row.playerId === playerId ? { ...row, ...patch } : row
      )
    );
  }

  function addPlayer(player: SessionFormPlayer) {
    setAllPlayers((prev) =>
      [...prev, player].sort((a, b) => a.name.localeCompare(b.name))
    );
    setRows((prev) => [
      ...prev,
      { playerId: player.id, buyInCount: "1", cashOut: "" },
    ]);
  }

  return {
    allPlayers,
    session,
    playedAt,
    setPlayedAt,
    notes,
    setNotes,
    rows,
    loading: loading || loadedKey !== requestKey,
    error,
    setError,
    load,
    togglePlayer,
    updateRow,
    addPlayer,
  };
}

async function fetchSessionFormData(
  groupId: string,
  id?: string
): Promise<LoadedData> {
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

  return {
    players: players ?? [],
    session,
    playedAt: session.played_at,
    notes: session.notes ?? "",
    rows,
  };
}
