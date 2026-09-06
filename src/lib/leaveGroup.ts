import { requireSupabase } from "./supabase";

/**
 * Leave a group. Sets your own membership to 'left' — distinct from 'removed',
 * so you can rejoin with the code later (migration 0014).
 *
 * Goes through an RPC rather than a table update on purpose: a member has no
 * UPDATE policy on group_members at all, precisely so nothing but the status
 * column can move. Errors are written to be shown to a person — including the
 * last-admin guard, "This is the group's only admin. Promote someone else
 * first." — so surface them unchanged.
 */
export async function leaveGroup(groupId: string): Promise<void> {
  const { error } = await requireSupabase().rpc("leave_group", {
    p_group_id: groupId,
  });
  if (error) throw error;
}
