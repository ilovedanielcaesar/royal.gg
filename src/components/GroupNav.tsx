import { NavLink, useLocation } from "react-router-dom";

/**
 * Four tabs, and only `aria-current` moves between pages.
 *
 * The active tab is a translucent cream wash, not the solid cream pill it used
 * to be: a solid pill in the topbar reads as a small playing card, which is
 * the language the sheet and the avatars own. The chrome stays quiet.
 */
const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  [
    "inline-flex min-h-9 items-center rounded-[10px] px-[13px] text-[13px] font-medium",
    "transition-[background,color] duration-150",
    isActive
      ? "bg-card-50/10 text-card-50"
      : "text-card-50/[0.62] hover:bg-card-50/[0.08] hover:text-card-50",
  ].join(" ");

export default function GroupNav() {
  // This header sits above GroupProvider, so the URL is the source of its slug.
  const match = useLocation().pathname.match(/^\/g\/([^/]+)/);
  const slug = match?.[1] ?? null;

  if (!slug) return null;

  return (
    // The contract hides this below 720px. Taken literally that leaves the
    // app with no navigation at all on a phone — and a phone at the table is
    // the case the app exists for. The responsive section says "extend as
    // needed", so instead of hiding it the nav wraps onto its own full-width
    // row and centres. Desktop is untouched. If Phase 3 wants a real mobile
    // pattern this is the seam to replace.
    <nav
      className={[
        "ml-auto flex gap-1",
        "max-[720px]:order-last max-[720px]:ml-0 max-[720px]:w-full",
        "max-[720px]:justify-center max-[720px]:pb-3",
      ].join(" ")}
      aria-label="Main"
    >
      <NavLink to={`/g/${slug}`} end className={navLinkClass}>
        Dashboard
      </NavLink>
      <NavLink to={`/g/${slug}/sessions`} className={navLinkClass}>
        Sessions
      </NavLink>
      <NavLink to={`/g/${slug}/players`} className={navLinkClass}>
        League
      </NavLink>
      {/* Your card, your stats in this group, and Leave. Needs no role, so
          this nav can link it without reaching into GroupProvider. */}
      <NavLink to={`/g/${slug}/profile`} className={navLinkClass}>
        You
      </NavLink>
    </nav>
  );
}
