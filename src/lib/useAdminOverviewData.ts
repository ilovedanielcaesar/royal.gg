// ⚠ THE ONLY THREE TABLES THIS FILE MAY EVER TOUCH: groups, profiles,
// group_members. 0015 confines is_app_owner() to those three and asserts it
// appears on no money table, so a superadmin selecting from players, sessions,
// buy_ins, cash_outs or payouts gets zero rows — SILENTLY, with no error. A
// query added here would not fail; it would render an empty column that looks
// like an answer. GROUPS.md decision 6 is the promise; this is where it is
// kept. smoke-rls.mjs proves the database half.

import { useEffect, useState } from "react";
import type { Database } from "../types/database";
import { describeError } from "./errors";
import { requireSupabase } from "./supabase";

type GroupRow = Pick<
  Database["public"]["Tables"]["groups"]["Row"],
  "id" | "name" | "slug" | "join_policy" | "created_at"
>;
type ProfileRow = Pick<
  Database["public"]["Tables"]["profiles"]["Row"],
  "id" | "display_name" | "username" | "created_at"
>;
type MembershipRow = Pick<
  Database["public"]["Tables"]["group_members"]["Row"],
  "group_id" | "profile_id" | "role" | "status"
>;
type AdminOverviewData = {
  groups: GroupRow[];
  profiles: ProfileRow[];
  memberships: MembershipRow[];
};
type LoadedAdminOverviewData = AdminOverviewData & {
  userId: string;
  error: string | null;
};

async function fetchAdminOverviewData(): Promise<AdminOverviewData> {
  const supabase = requireSupabase();
  const [groupsResult, profilesResult, membershipsResult] = await Promise.all([
    supabase
      .from("groups")
      .select("id, name, slug, join_policy, created_at"),
    supabase
      .from("profiles")
      .select("id, display_name, username, created_at"),
    supabase
      .from("group_members")
      .select("group_id, profile_id, role, status"),
  ]);
  if (groupsResult.error) throw groupsResult.error;
  if (profilesResult.error) throw profilesResult.error;
  if (membershipsResult.error) throw membershipsResult.error;

  return {
    groups: (groupsResult.data ?? []).sort((a, b) =>
      a.name.localeCompare(b.name)
    ),
    profiles: (profilesResult.data ?? []).sort((a, b) =>
      a.display_name.localeCompare(b.display_name)
    ),
    memberships: membershipsResult.data ?? [],
  };
}

export default function useAdminOverviewData(userId: string | undefined) {
  const [state, setState] = useState<LoadedAdminOverviewData | null>(null);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    void fetchAdminOverviewData()
      .then((data) => {
        if (!cancelled) setState({ userId, ...data, error: null });
      })
      .catch((caught) => {
        if (!cancelled) {
          setState({
            userId,
            groups: [],
            profiles: [],
            memberships: [],
            error: describeError(caught),
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return state?.userId === userId ? state : null;
}
