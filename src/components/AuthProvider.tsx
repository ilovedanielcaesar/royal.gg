import { useCallback, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { AuthContext, type CurrentUser, type Player } from "../lib/authContext";
import {
  ADMIN_USERNAME,
  isSupabaseConfigured,
  requireSupabase,
} from "../lib/supabase";

const unconfiguredCurrentUser: CurrentUser = {
  loading: false,
  session: null,
  user: null,
  player: null,
  isAdmin: false,
  isPending: false,
  isApproved: false,
  refresh: async () => {},
};

export default function AuthProvider({ children }: { children: ReactNode }) {
  if (!isSupabaseConfigured) {
    return (
      <AuthContext.Provider value={unconfiguredCurrentUser}>
        {children}
      </AuthContext.Provider>
    );
  }

  return <ConfiguredAuthProvider>{children}</ConfiguredAuthProvider>;
}

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
function ConfiguredAuthProvider({ children }: { children: ReactNode }) {
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

  const currentUser: CurrentUser = {
    loading,
    session,
    user,
    player,
    isAdmin,
    isPending,
    isApproved,
    refresh,
  };

  return (
    <AuthContext.Provider value={currentUser}>{children}</AuthContext.Provider>
  );
}
