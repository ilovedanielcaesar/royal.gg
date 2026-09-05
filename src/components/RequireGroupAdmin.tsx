import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useGroup } from "../lib/groupContext";

export default function RequireGroupAdmin({ children }: { children: ReactNode }) {
  const { loading, isGroupAdmin, path } = useGroup();
  if (loading) return <div className="text-sm text-card-50/60">Dealing in…</div>;
  if (!isGroupAdmin) return <Navigate to={path("/")} replace />;
  return <>{children}</>;
}
