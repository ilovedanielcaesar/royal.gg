import { NavLink, Outlet } from "react-router-dom";
import { useCurrentUser } from "../lib/auth";
import { isSupabaseConfigured } from "../lib/supabase";
import ErrorBoundary from "./ErrorBoundary";
import GroupNav from "./GroupNav";
import GroupSwitcher from "./GroupSwitcher";
import SetupNotice from "./SetupNotice";
import SuitBadge from "./SuitBadge";
import UserMenu from "./UserMenu";

export default function AppLayout() {
  const { user } = useCurrentUser();

  return (
    <div className="min-h-full">
      <header className="border-b border-card-50/10 bg-felt-900/70 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <NavLink to="/" className="flex items-center gap-2">
            <div className="flex items-center gap-0.5">
              <SuitBadge suit="spade" size={14} className="opacity-90" />
              <SuitBadge suit="heart" size={14} className="opacity-90" />
            </div>
            <span className="font-display text-2xl tracking-tight text-card-50">
              royal<span className="text-crimson-500">.gg</span>
            </span>
          </NavLink>
          <div className="flex items-center gap-3">
            <GroupNav />
            {user && <GroupSwitcher />}
            {user && <UserMenu />}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">
        {isSupabaseConfigured ? (
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        ) : (
          <SetupNotice />
        )}
      </main>
    </div>
  );
}
