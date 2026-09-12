import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useCurrentUser } from "../lib/auth";
import LoadingState from "./LoadingState";

/**
 * Signed in, with an account. Nothing more — belonging to a group is a
 * separate question, answered by RequireGroupMember inside /g/:slug.
 */
export default function RequireAuth({ children }: { children: ReactNode }) {
  const { loading, user, profile } = useCurrentUser();
  const loc = useLocation();

  if (loading) {
    return <LoadingState tone="felt" label="Dealing in…" full />;
  }
  if (!user) {
    return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  }
  // Authed with no profile row: an auth user created before the trigger
  // existed, or one whose profile was deleted. Nothing in the app works
  // without it, so send them back to the door.
  if (!profile) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}
