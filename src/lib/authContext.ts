import { createContext, useContext } from "react";
import type { Session, User } from "@supabase/supabase-js";
import type { Database } from "../types/database";

/** A roster entry inside one group. Not an account — see Profile. */
export type Player = Database["public"]["Tables"]["players"]["Row"];

/** An account. Global: it exists independently of any group. */
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];

export type CurrentUser = {
  loading: boolean;
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  /**
   * Superadmin (profiles.is_app_owner). Sees accounts and groups and NEVER
   * money — see GROUPS.md §6. This is not "admin of the group you're looking
   * at": that is `isGroupAdmin` from useGroup().
   */
  isAppOwner: boolean;
  refresh: () => Promise<void>;
};

export const AuthContext = createContext<CurrentUser | null>(null);

export function useCurrentUser(): CurrentUser {
  const currentUser = useContext(AuthContext);
  if (!currentUser) {
    throw new Error("useCurrentUser must be used within an AuthProvider.");
  }
  return currentUser;
}
