import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useCurrentUser } from "../lib/auth";

export default function RequireAppOwner({ children }: { children: ReactNode }) {
  const { loading, isAppOwner } = useCurrentUser();

  if (loading) {
    return <div className="text-sm text-card-50/60">Dealing in…</div>;
  }
  if (!isAppOwner) return <Navigate to="/" replace />;
  return <>{children}</>;
}
