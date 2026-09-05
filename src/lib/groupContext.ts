import { createContext, useContext } from "react";
import type { Database } from "../types/database";

export type GroupRole = "admin" | "member" | null;
export type Group = Database["public"]["Tables"]["groups"]["Row"];
export type GroupMembership =
  Database["public"]["Tables"]["group_members"]["Row"];

export type GroupContextValue = {
  loading: boolean;
  group: Group | null;
  membership: GroupMembership | null;
  role: GroupRole;
  isGroupAdmin: boolean;
  notFound: boolean;
  path: (sub: string) => string;
};

export const GroupContext = createContext<GroupContextValue | null>(null);

export function useGroup(): GroupContextValue {
  const group = useContext(GroupContext);
  if (!group) {
    throw new Error("useGroup must be used within a GroupProvider.");
  }
  return group;
}
