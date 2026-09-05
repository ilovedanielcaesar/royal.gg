import { createContext, useContext } from "react";
import type { Session, User } from "@supabase/supabase-js";
import type { Database } from "../types/database";

export type Player = Database["public"]["Tables"]["players"]["Row"];

export type CurrentUser = {
  loading: boolean;
  session: Session | null;
  user: User | null;
  player: Player | null;
  isAdmin: boolean;
  isPending: boolean;
  isApproved: boolean;
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
