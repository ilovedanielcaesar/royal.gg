import { NavLink, useLocation } from "react-router-dom";

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  [
    "rounded-md px-3 py-1.5 text-sm font-medium transition",
    isActive
      ? "bg-card-50 text-ink-900 shadow-[0_2px_0_0_rgba(0,0,0,0.2)]"
      : "text-card-50/70 hover:bg-card-50/10 hover:text-card-50",
  ].join(" ");

export default function GroupNav() {
  // This header sits above GroupProvider, so the URL is the source of its slug.
  const match = useLocation().pathname.match(/^\/g\/([^/]+)/);
  const slug = match?.[1] ?? null;

  if (!slug) return null;

  return (
    <nav className="flex items-center gap-1">
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
