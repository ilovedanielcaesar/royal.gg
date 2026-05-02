import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import {
  ADMIN_USERNAME,
  requireSupabase,
  syntheticEmail,
} from "./supabase";
import type { Database } from "../types/database";

export type Player = Database["public"]["Tables"]["players"]["Row"];

const USERNAME_RE = /^[a-z0-9_-]{3,20}$/i;

function normalizeUsername(u: string): string {
  return u.trim().toLowerCase();
}

/**
 * Sign up directly with username + password. Creates the auth user and the
 * matching player row. Admin (matching ADMIN_USERNAME) is auto-active;
 * everyone else lands as 'pending' until the admin approves.
 */
export async function signUp(input: {
  username: string;
  displayName: string;
  password: string;
}): Promise<void> {
  const supabase = requireSupabase();
  const username = normalizeUsername(input.username);
  const displayName = input.displayName.trim();

  if (!USERNAME_RE.test(username)) {
    throw new Error(
      "Username must be 3–20 chars, letters/numbers/underscore/dash."
    );
  }
  if (displayName.length < 2) {
    throw new Error("Display name is too short.");
  }
  if (input.password.length < 6) {
    throw new Error("Password must be at least 6 characters.");
  }

  // Reject if username already in use.
  const { data: existing, error: existingErr } = await supabase
    .from("players")
    .select("id")
    .eq("username", username)
    .maybeSingle();
  if (existingErr) throw existingErr;
  if (existing) {
    throw new Error("That username is taken.");
  }

  const email = syntheticEmail(username);
  const { data, error } = await supabase.auth.signUp({
    email,
    password: input.password,
  });
  if (error) throw error;
  const user = data.user;
  if (!user) {
    throw new Error(
      "Signup didn't return a user. Disable 'Confirm email' in Supabase Auth settings."
    );
  }

  const isAdminUsername = username === ADMIN_USERNAME;
  const status: "active" | "pending" = isAdminUsername ? "active" : "pending";

  const { error: insErr } = await supabase.from("players").insert({
    user_id: user.id,
    name: displayName,
    display_name: displayName,
    username,
    status,
    is_guest: false,
  });
  if (insErr) throw insErr;
}

/**
 * Sign in with username + password.
 */
export async function signIn(input: {
  username: string;
  password: string;
}): Promise<void> {
  const supabase = requireSupabase();
  const username = normalizeUsername(input.username);
  if (!username) throw new Error("Enter your username.");
  const { error } = await supabase.auth.signInWithPassword({
    email: syntheticEmail(username),
    password: input.password,
  });
  if (error) throw error;
}

export async function signOut(): Promise<void> {
  const supabase = requireSupabase();
  await supabase.auth.signOut();
}

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

export function useCurrentUser(): CurrentUser {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [player, setPlayer] = useState<Player | null>(null);

  async function loadPlayer(userId: string): Promise<Player | null> {
    const supabase = requireSupabase();
    const { data } = await supabase
      .from("players")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    return data;
  }

  async function refresh() {
    const supabase = requireSupabase();
    const { data } = await supabase.auth.getSession();
    setSession(data.session);
    if (data.session?.user) {
      setPlayer(await loadPlayer(data.session.user.id));
    } else {
      setPlayer(null);
    }
    setLoading(false);
  }

  useEffect(() => {
    let cancelled = false;
    const supabase = requireSupabase();

    void (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (cancelled) return;
        setSession(data.session);
        if (data.session?.user) {
          const p = await loadPlayer(data.session.user.id);
          if (!cancelled) setPlayer(p);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    const { data: sub } = supabase.auth.onAuthStateChange(async (_e, s) => {
      if (cancelled) return;
      setSession(s);
      if (s?.user) {
        // Hold loading=true while we re-fetch the player row so route
        // guards don't bounce on the brief moment between session-set and
        // player-loaded.
        setLoading(true);
        try {
          const p = await loadPlayer(s.user.id);
          if (!cancelled) setPlayer(p);
        } catch {
          // ignore — keep last known player
        } finally {
          if (!cancelled) setLoading(false);
        }
      } else {
        setPlayer(null);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  const user = session?.user ?? null;
  const isAdmin = !!player && player.username === ADMIN_USERNAME;
  const isPending = !!player && player.status === "pending";
  const isApproved =
    isAdmin || (!!player && player.status === "active");

  return {
    loading,
    session,
    user,
    player,
    isAdmin,
    isPending,
    isApproved,
    refresh,
  };
}
