import { useCallback, useEffect, useState } from "react";
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

/**
 * Reads the Supabase session and the matching player row.
 *
 * The two effects below are deliberately kept apart. Supabase invokes the
 * onAuthStateChange callback while holding its internal auth lock and awaits
 * it, so calling supabase.from() (or getSession()) inside that callback
 * deadlocks the client: the query waits for the lock, the lock waits for the
 * callback. It hangs on tab refocus, because returning to a hidden tab is what
 * triggers the catch-up token refresh. So the listener only records the
 * session, and the player row is fetched by a second effect, outside the lock.
 */
export function useCurrentUser(): CurrentUser {
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  // Player row stored together with the user id it was fetched for, so a
  // stale row can never be shown against a different user, and so "no player
  // row" is distinguishable from "haven't looked yet" (no flash of the
  // signed-out UI in between).
  const [loaded, setLoaded] = useState<{
    forUserId: string | null;
    player: Player | null;
  }>({ forUserId: null, player: null });

  const userId = session?.user?.id ?? null;
  const player = loaded.forUserId === userId ? loaded.player : null;

  // 1. Auth state. This callback MUST stay synchronous — see the note above.
  useEffect(() => {
    let cancelled = false;
    const supabase = requireSupabase();

    void supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      setSession(data.session);
      setAuthReady(true);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      if (cancelled) return;
      setSession(s);
      setAuthReady(true);
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  // 2. Player row for the current session, fetched outside the auth lock.
  useEffect(() => {
    // Signed out needs no work: `player` above already derives to null.
    if (!userId) return;

    let cancelled = false;
    void (async () => {
      try {
        const supabase = requireSupabase();
        const { data, error } = await supabase
          .from("players")
          .select("*")
          .eq("user_id", userId)
          .maybeSingle();
        if (cancelled) return;
        if (error) throw error;
        setLoaded({ forUserId: userId, player: data });
      } catch (e) {
        if (cancelled) return;
        console.error("Failed to load player row:", e);
        // Mark the lookup done so the app doesn't hang on "loading", but keep
        // an already-known row for this same user rather than signing them
        // out of the UI over one failed request.
        setLoaded((prev) =>
          prev.forUserId === userId ? prev : { forUserId: userId, player: null }
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  /**
   * Re-read session + player on demand. Safe to await from event handlers
   * (sign-in, profile save) — never call it from inside onAuthStateChange.
   */
  const refresh = useCallback(async () => {
    const supabase = requireSupabase();
    const { data } = await supabase.auth.getSession();
    const s = data.session;
    setSession(s);
    setAuthReady(true);

    if (!s?.user) {
      setLoaded({ forUserId: null, player: null });
      return;
    }
    const { data: row, error } = await supabase
      .from("players")
      .select("*")
      .eq("user_id", s.user.id)
      .maybeSingle();
    if (error) {
      console.error("Failed to refresh player row:", error);
      return;
    }
    setLoaded({ forUserId: s.user.id, player: row });
  }, []);

  const user = session?.user ?? null;
  const isAdmin = !!player && player.username === ADMIN_USERNAME;
  const isPending = !!player && player.status === "pending";
  const isApproved = isAdmin || (!!player && player.status === "active");
  // Signed in but the player lookup hasn't come back yet.
  const loading =
    !authReady || (userId !== null && loaded.forUserId !== userId);

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
