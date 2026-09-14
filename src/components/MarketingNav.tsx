/**
 * The landing page's section anchors, in the slot `GroupNav` takes inside the
 * app. Only ever rendered on `/` signed out, so it is the plain page nav a
 * visitor gets before there is a group to navigate.
 *
 * Real anchors rather than router links: these are positions on the page that
 * is already open, and handing them to the router would turn a scroll into a
 * navigation.
 */
const LINKS = [
  { href: "#log", label: "Log a night" },
  { href: "#standings", label: "Standings" },
  { href: "#analytics", label: "Analytics" },
];

export default function MarketingNav() {
  return (
    <nav
      // Hidden on a phone, unlike `GroupNav`: the app's nav is the only way
      // around the app, but these three only jump down a page you can scroll.
      className="flex gap-1 max-[780px]:hidden"
      aria-label="Sections"
    >
      {LINKS.map((link) => (
        <a
          key={link.href}
          href={link.href}
          className="inline-flex min-h-9 items-center rounded-[10px] px-[13px] text-[13px] font-medium text-card-50/[0.62] transition-[background,color] duration-150 hover:bg-card-50/[0.08] hover:text-card-50"
        >
          {link.label}
        </a>
      ))}
    </nav>
  );
}
