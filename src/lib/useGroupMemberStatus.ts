import { useEffect, useState } from "react";
import type { Database } from "../types/database";
import { describeError } from "./errors";
import { useGroup } from "./groupContext";
import { requireSupabase } from "./supabase";

export type GroupMemberStatus =
  Database["public"]["Tables"]["group_members"]["Row"]["status"];

type State = {
  groupId: string | null;
  statuses: ReadonlyMap<string, GroupMemberStatus>;
  loading: boolean;
  error: string | null;
};

const EMPTY_STATUSES = new Map<string, GroupMemberStatus>();

/** Membership state keyed by profile id for the current group roster. */
export function useGroupMemberStatus(): State {
  const { group, loading: groupLoading } = useGroup();
  const groupId = group?.id ?? null;
  const [state, setState] = useState<State>({
    groupId: null,
    statuses: EMPTY_STATUSES,
    loading: true,
    error: null,
  });

  useEffect(() => {
    if (!groupId || groupLoading) return;
    let cancelled = false;

    void (async () => {
      setState((current) => ({
        groupId,
        statuses:
          current.groupId === groupId ? current.statuses : EMPTY_STATUSES,
        loading: true,
        error: null,
      }));
      try {
        const { data, error } = await requireSupabase()
          .from("group_members")
          .select("profile_id,status")
          .eq("group_id", groupId);
        if (error) throw error;

        const statuses = new Map<string, GroupMemberStatus>();
        (data ?? []).forEach((member) => {
          statuses.set(member.profile_id, member.status);
        });
        if (!cancelled) {
          setState({ groupId, statuses, loading: false, error: null });
        }
      } catch (error) {
        if (!cancelled) {
          setState({
            groupId,
            statuses: EMPTY_STATUSES,
            loading: false,
            error: describeError(error),
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [groupId, groupLoading]);

  if (!groupId || groupLoading || state.groupId !== groupId) {
    return {
      groupId,
      statuses: EMPTY_STATUSES,
      loading: true,
      error: null,
    };
  }
  return state;
}
