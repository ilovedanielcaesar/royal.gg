import { useCallback, useEffect, useState } from "react";
import { describeError } from "./errors";
import fetchSessionFormData, {
  type LoadedSessionForm,
  type SettledRow,
} from "./fetchSessionFormData";
import { todayIsoDate } from "./format";
import {
  type SessionFormPlayer,
  type SessionFormRow,
  type SessionFormSession,
} from "./sessionForm";

export type { SettledRow };

export default function useSessionFormData(groupId: string, id?: string) {
  const requestKey = `${groupId}:${id ?? "new"}`;
  const [allPlayers, setAllPlayers] = useState<SessionFormPlayer[]>([]);
  const [session, setSession] = useState<SessionFormSession | null>(null);
  const [playedAt, setPlayedAt] = useState(todayIsoDate());
  const [notes, setNotes] = useState("");
  const [rows, setRows] = useState<SessionFormRow[]>([]);
  const [settled, setSettled] = useState<SettledRow[]>([]);
  const [loading, setLoading] = useState(Boolean(id));
  const [loadedKey, setLoadedKey] = useState<string | null>(
    id ? null : requestKey
  );
  const [error, setError] = useState<string | null>(null);

  const applyLoadedData = useCallback((data: LoadedSessionForm, key: string) => {
    setAllPlayers(data.players);
    setSession(data.session);
    setPlayedAt(data.playedAt);
    setNotes(data.notes);
    setRows(data.rows);
    setSettled(data.settled);
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
      // No confirm. Nothing has been written yet — the page saves as a whole
      // — and re-seating a player is one click that restores the balanced
      // default. A modal for an undoable in-memory edit is the kind of
      // friction that gets clicked through without reading.
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
    settled,
    loading: loading || loadedKey !== requestKey,
    error,
    setError,
    load,
    togglePlayer,
    updateRow,
    addPlayer,
  };
}
