import { Navigate } from "react-router-dom";
import { useCurrentUser } from "../lib/auth";
import DashboardPage from "../pages/DashboardPage";
import LoginPage from "../pages/LoginPage";

export default function IndexRoute() {
  const { loading, user, player, isAdmin, isPending } = useCurrentUser();

  if (loading) {
    return <div className="text-sm text-card-50/60">Dealing in…</div>;
  }
  if (!user) return <LoginPage />;
  if (!isAdmin && !player) return <LoginPage />;
  if (!isAdmin && isPending) return <Navigate to="/pending" replace />;
  return <DashboardPage />;
}
