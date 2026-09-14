import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useCurrentUser } from "../lib/auth";
import { isSupabaseConfigured } from "../lib/supabase";
import ErrorBoundary from "./ErrorBoundary";
import GroupNav from "./GroupNav";
import GroupSwitcher from "./GroupSwitcher";
import MarketingButton from "./MarketingButton";
import MarketingNav from "./MarketingNav";
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
export const WRAP = "mx-auto w-[min(1152px,calc(100%-32px))]";

export default function AppLayout() {
  const { loading, user } = useCurrentUser();
  const { pathname } = useLocation();

  /**
   * The landing page is the one route that is not laid out on the 1152px
   * column: its hero is full-bleed and pins for the height of the screen, so
   * `main` steps out of the way and the page owns its own gutters.
   *
   * `loading` is in the test to stop the sign-in buttons flashing up for a
   * member whose session is still being restored — a moment later
   * `IndexRoute` will have sent them to their group.
   */
  const isLanding = pathname === "/" && !loading && !user;
  const fullBleed = isLanding && isSupabaseConfigured;

  return (
    <div className="min-h-full">
      {/* `relative z-50` is load-bearing, not decoration. `backdrop-blur`
          makes this header a stacking context, which traps every z-index
          inside it — so the group switcher's open menu could not rise above
          the page. Meanwhile `Sheet`'s settle animation transforms, which
          makes IT a stacking context too, and it comes later in the document.
          Without a z-index here the header loses to the page body no matter
          what the menu asks for. Raise the header, not the menu. */}
      <header
        className={`${
          // Sticky only on the landing page, where the hero scrolls beneath it
          // for two screens and a header that left would take the brand and
          // both doors with it.
          isLanding ? "sticky top-0" : "relative"
        } z-50 border-b border-card-50/10 bg-felt-900/[0.76] backdrop-blur-[14px]`}
      >
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
          {/* The group nav follows the brand on the left. The account cluster
              absorbs the remaining space, so it stays hard right whether the
              nav is present or not. */}
          {isLanding ? <MarketingNav /> : <GroupNav />}
          <div className="ml-auto flex items-center gap-5">
            {/* Sign in and sign up are two doors onto the same account, so
                they are one control split in two rather than a button beside
                a bare text link. */}
            {isLanding && (
              <div className="flex items-center gap-2">
                <MarketingButton to="/login" variant="ghost">
                  Sign in
                </MarketingButton>
                <MarketingButton to="/signup">Sign up</MarketingButton>
              </div>
            )}
            {user && <GroupSwitcher />}
            {user && <UserMenu />}
          </div>
        </div>
      </header>
      <main className={fullBleed ? "" : `${WRAP} pt-[30px] pb-14`}>
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
