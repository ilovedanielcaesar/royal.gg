import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useCurrentUser } from "../lib/auth";
import LoadingState from "./LoadingState";

export default function RequireAppOwner({ children }: { children: ReactNode }) {
  const { loading, isAppOwner } = useCurrentUser();

  if (loading) {
    return <LoadingState tone="felt" label="Dealing in…" full />;
  }
  if (!isAppOwner) return <Navigate to="/" replace />;
  return <>{children}</>;
}
