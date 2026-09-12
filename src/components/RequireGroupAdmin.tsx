import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useGroup } from "../lib/groupContext";
import LoadingState from "./LoadingState";

export default function RequireGroupAdmin({ children }: { children: ReactNode }) {
  const { loading, isGroupAdmin, path } = useGroup();
  if (loading) {
    return <LoadingState tone="felt" label="Dealing in…" full />;
  }
  if (!isGroupAdmin) return <Navigate to={path("/")} replace />;
  return <>{children}</>;
}
