import { NavLink, Outlet } from "react-router-dom";
import { useCurrentUser } from "../lib/auth";
import { isSupabaseConfigured } from "../lib/supabase";
import ErrorBoundary from "./ErrorBoundary";
import GroupNav from "./GroupNav";
import GroupSwitcher from "./GroupSwitcher";
import SetupNotice from "./SetupNotice";
import SuitBadge from "./SuitBadge";
import UserMenu from "./UserMenu";

/**
 * `min(1152px, 100% - 32px)` rather than `max-w-6xl px-4`.
 *
 * They are not the same: with padding the content narrows to 1120px on a wide
 * screen, and the contract's 1152px is the content width. The gutter is in the
 * calc so it only exists when the viewport is actually narrow.
 */
const WRAP = "mx-auto w-[min(1152px,calc(100%-32px))]";

export default function AppLayout() {
  const { user } = useCurrentUser();

  return (
    <div className="min-h-full">
      <header className="border-b border-card-50/10 bg-felt-900/[0.76] backdrop-blur-[14px]">
        <div
          className={`${WRAP} flex min-h-[66px] flex-wrap items-center gap-x-5`}
        >
          <NavLink to="/" className="flex items-center gap-[9px]">
            {/* Cream and crimson-500, the contract's brand fills. Left to
                its defaults, SuitBadge paints the spade ink-900 — which is
                #1a1614 on #0d3324 felt, i.e. an invisible spade. */}
            <span className="flex gap-0.5">
              <SuitBadge
                suit="spade"
                size={15}
                fill="var(--color-card-50)"
              />
              <SuitBadge
                suit="heart"
                size={15}
                fill="var(--color-crimson-500)"
              />
            </span>
            <span className="font-display text-2xl tracking-[-0.02em] text-card-50">
              royal<span className="text-crimson-500">.gg</span>
            </span>
          </NavLink>
          {/* Two `ml-auto`s on purpose. The first free-space eater wins, so
              the nav is pushed right and this cluster sits directly after it —
              the contract's order. When the nav renders nothing (outside a
              group) the cluster's own `ml-auto` still holds it right, which one
              `ml-auto` on the nav alone would not. */}
          <GroupNav />
          <div className="ml-auto flex items-center gap-5">
            {user && <GroupSwitcher />}
            {user && <UserMenu />}
          </div>
        </div>
      </header>
      <main className={`${WRAP} pt-[30px] pb-14`}>
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
