import { requireSupabase } from "./supabase";

export type JoinGroupResult = {
  slug: string;
  groupName: string;
  status: "active" | "pending";
  alreadyMember: boolean;
};

type JoinGroupResponse = {
  slug: string;
  group_name: string;
  status: "active" | "pending";
  already_member: boolean;
};

export async function joinGroup(code: string): Promise<JoinGroupResult> {
  const { data, error } = await requireSupabase().rpc("join_group", {
    p_code: code.trim(),
  });
  if (error) throw error;

  const result = data as JoinGroupResponse;
  return {
    slug: result.slug,
    groupName: result.group_name,
    status: result.status,
    alreadyMember: result.already_member,
  };
}
