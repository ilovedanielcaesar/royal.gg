import type { ReactNode } from "react";
import { Link, Navigate } from "react-router-dom";
import { useGroup } from "../lib/groupContext";
import Card from "./Card";

export default function RequireGroupMember({ children }: { children: ReactNode }) {
  const { loading, membership, notFound } = useGroup();
  if (loading) return <div className="text-sm text-card-50/60">Dealing in…</div>;
  if (notFound) {
    return (
      <Card className="p-6 text-center" accent="crimson">
        <h1 className="font-display text-2xl text-ink-900">Group not found</h1>
        <Link to="/groups" className="mt-2 inline-block text-sm text-sage-700 underline">
          Back to your groups
        </Link>
      </Card>
    );
  }
  if (!membership) return <Navigate to="/groups" replace />;
  return <>{children}</>;
}
