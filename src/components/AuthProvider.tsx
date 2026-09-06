import { useCallback, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import {
  AuthContext,
  type CurrentUser,
  type Profile,
} from "../lib/authContext";
import { isSupabaseConfigured, requireSupabase } from "../lib/supabase";

const unconfiguredCurrentUser: CurrentUser = {
  loading: false,
  session: null,
  user: null,
  profile: null,
  isAppOwner: false,
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
 * Reads the Supabase session and the matching profile row.
 *
 * Identity is the ACCOUNT (profiles), not a roster entry. An account exists
 * on its own and belongs to no group until it joins one, so nothing here can
 * answer "are you approved?" — that is per-group, and lives in useGroup().
 *
 * The two effects below are deliberately kept apart. Supabase invokes the
 * onAuthStateChange callback while holding its internal auth lock and awaits
 * it, so calling supabase.from() (or getSession()) inside that callback
 * deadlocks the client: the query waits for the lock, the lock waits for the
 * callback. It hangs on tab refocus, because returning to a hidden tab is what
 * triggers the catch-up token refresh. So the listener only records the
 * session, and the profile row is fetched by a second effect, outside the lock.
 */
function ConfiguredAuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  // Profile stored together with the user id it was fetched for, so a stale
  // row can never be shown against a different user, and so "no profile row"
  // is distinguishable from "haven't looked yet" (no flash of the signed-out
  // UI in between).
  const [loaded, setLoaded] = useState<{
    forUserId: string | null;
    profile: Profile | null;
  }>({ forUserId: null, profile: null });

  const userId = session?.user?.id ?? null;
  const profile = loaded.forUserId === userId ? loaded.profile : null;

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

  // 2. Profile row for the current session, fetched outside the auth lock.
  useEffect(() => {
    // Signed out needs no work: `profile` above already derives to null.
    if (!userId) return;

    let cancelled = false;
    void (async () => {
      try {
        const supabase = requireSupabase();
        const { data, error } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", userId)
          .maybeSingle();
        if (cancelled) return;
        if (error) throw error;
        setLoaded({ forUserId: userId, profile: data });
      } catch (e) {
        if (cancelled) return;
        console.error("Failed to load profile row:", e);
        // Mark the lookup done so the app doesn't hang on "loading", but keep
        // an already-known row for this same user rather than signing them
        // out of the UI over one failed request.
        setLoaded((prev) =>
          prev.forUserId === userId
            ? prev
            : { forUserId: userId, profile: null }
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  /**
   * Re-read session + profile on demand. Safe to await from event handlers
   * (sign-in, profile save) — never call it from inside onAuthStateChange.
   */
  const refresh = useCallback(async () => {
    const supabase = requireSupabase();
    const { data } = await supabase.auth.getSession();
    const s = data.session;
    setSession(s);
    setAuthReady(true);

    if (!s?.user) {
      setLoaded({ forUserId: null, profile: null });
      return;
    }
    const { data: row, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", s.user.id)
      .maybeSingle();
    if (error) {
      console.error("Failed to refresh profile row:", error);
      return;
    }
    setLoaded({ forUserId: s.user.id, profile: row });
  }, []);

  const user = session?.user ?? null;
  const isAppOwner = profile?.is_app_owner === true;
  // Signed in but the profile lookup hasn't come back yet.
  const loading =
    !authReady || (userId !== null && loaded.forUserId !== userId);

  const currentUser: CurrentUser = {
    loading,
    session,
    user,
    profile,
    isAppOwner,
    refresh,
  };

  return (
    <AuthContext.Provider value={currentUser}>{children}</AuthContext.Provider>
  );
}
