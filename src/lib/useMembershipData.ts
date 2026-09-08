import { useCallback, useEffect, useState } from "react";
import { describeError } from "./errors";
import type { LinkableGuest, Membership } from "./membership";
import { requireSupabase } from "./supabase";

type LoadedMembershipData = {
  groupId: string;
  members: Membership[];
  guests: LinkableGuest[];
  error: string | null;
};

async function fetchMembershipData(groupId: string) {
  const supabase = requireSupabase();
  const [membersResult, guestsResult] = await Promise.all([
    supabase
      .from("group_members")
      .select("id, role, status, created_at, profiles(id, username, display_name)")
      .eq("group_id", groupId),
    supabase
      .from("players")
      .select("id, name, display_name")
      .eq("group_id", groupId)
      .is("profile_id", null)
      .order("name"),
  ]);
  if (membersResult.error) throw membersResult.error;
  if (guestsResult.error) throw guestsResult.error;
  return {
    members: (membersResult.data ?? []) as unknown as Membership[],
    guests: guestsResult.data ?? [],
  };
}

export default function useMembershipData(groupId: string | undefined) {
  const [state, setState] = useState<LoadedMembershipData | null>(null);

  useEffect(() => {
    if (!groupId) return;
    let cancelled = false;
    void fetchMembershipData(groupId)
      .then((data) => {
        if (!cancelled) setState({ groupId, ...data, error: null });
      })
      .catch((caught) => {
        if (!cancelled) {
          setState({
            groupId,
            members: [],
            guests: [],
            error: describeError(caught),
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [groupId]);

  const refresh = useCallback(async () => {
    if (!groupId) return;
    const data = await fetchMembershipData(groupId);
    setState({ groupId, ...data, error: null });
  }, [groupId]);

  const setError = useCallback(
    (error: string | null) => {
      if (!groupId) return;
      setState((current) => ({
        groupId,
        members: current?.groupId === groupId ? current.members : [],
        guests: current?.groupId === groupId ? current.guests : [],
        error,
      }));
    },
    [groupId]
  );

  const current = state?.groupId === groupId ? state : null;
  return {
    members: current?.members ?? null,
    guests: current?.guests ?? [],
    error: current?.error ?? null,
    refresh,
    setError,
  };
}
