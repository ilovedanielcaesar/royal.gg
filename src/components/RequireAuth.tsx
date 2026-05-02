import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useCurrentUser } from "../lib/auth";

export default function RequireAuth({ children }: { children: ReactNode }) {
  const { loading, user, player, isAdmin, isPending } = useCurrentUser();
  const loc = useLocation();

  if (loading) {
    return <div className="text-sm text-card-50/60">Dealing in…</div>;
  }
  if (!user) {
    return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  }
  // Authed but no player row (orphaned auth user) — kick to login.
  if (!isAdmin && !player) {
    return <Navigate to="/login" replace />;
  }
  if (!isAdmin && isPending) {
    return <Navigate to="/pending" replace />;
  }
  return <>{children}</>;
}
