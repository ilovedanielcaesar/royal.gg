import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useCurrentUser } from "../lib/auth";

export default function RequireAdmin({ children }: { children: ReactNode }) {
  const { loading, isAdmin } = useCurrentUser();
  if (loading) return <div className="text-sm text-card-50/60">Dealing in…</div>;
  if (!isAdmin) return <Navigate to="/" replace />;
  return <>{children}</>;
}
