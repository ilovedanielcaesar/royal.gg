import { NavLink, Outlet } from "react-router-dom";
import { useCurrentUser } from "../lib/auth";
import { isSupabaseConfigured } from "../lib/supabase";
import SetupNotice from "./SetupNotice";
import SuitBadge from "./SuitBadge";
import UserMenu from "./UserMenu";

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  [
    "rounded-md px-3 py-1.5 text-sm font-medium transition",
    isActive
      ? "bg-card-50 text-ink-900 shadow-[0_2px_0_0_rgba(0,0,0,0.2)]"
      : "text-card-50/70 hover:bg-card-50/10 hover:text-card-50",
  ].join(" ");

export default function AppLayout() {
  const { user, isApproved } = useCurrentUser();
  const showAppNav = isSupabaseConfigured && !!user && isApproved;

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
            {showAppNav && (
              <nav className="flex items-center gap-1">
                <NavLink to="/" end className={navLinkClass}>
                  Dashboard
                </NavLink>
                <NavLink to="/sessions" className={navLinkClass}>
                  Sessions
                </NavLink>
                <NavLink to="/players" className={navLinkClass}>
                  League
                </NavLink>
              </nav>
            )}
            {user && <UserMenu />}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">
        {isSupabaseConfigured ? <Outlet /> : <SetupNotice />}
      </main>
    </div>
  );
}
