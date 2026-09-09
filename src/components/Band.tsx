import { useId, type ReactNode } from "react";

type Props = {
  /** The band's heading. Omit it for a band that is pure content. */
  title?: string;
  /** The muted line under the title — what the figures mean, not commentary. */
  caption?: ReactNode;
  /** The eyebrow above the title. Uppercase; rendered letterspaced. */
  kicker?: string;
  /** Controls that belong to this band, right-aligned in its head. */
  action?: ReactNode;
  children?: ReactNode;
  className?: string;
};

/**
 * One horizontal division of a `Sheet`.
 *
 * The divider is `border-t` on every band but the first rather than
 * `border-b` on every band but the last: a sheet whose last band is
 * conditional would otherwise end on a rule with nothing under it.
 *
 * A band holds no controls except its own — page-level actions live in
 * `PageHeading`, out on the felt. The sheet is a record of results.
 */
export default function Band({
  title,
  caption,
  kicker,
  action,
  children,
  className = "",
}: Props) {
  const headingId = useId();

  return (
    <section
      className={[
        // 720px, not Tailwind's sm — the contract breaks the nav, the band
        // padding and the h1 size at one width, and they have to agree.
        "border-t border-card-100 px-9 py-[26px] first:border-t-0 max-[720px]:px-5",
        className,
      ].join(" ")}
      aria-labelledby={title ? headingId : undefined}
    >
      {(title || caption || action) && (
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <div>
            {kicker && (
              <p className="text-[10px] font-semibold tracking-[0.13em] text-ink-500 uppercase">
                {kicker}
              </p>
            )}
            {title && (
              <h2
                id={headingId}
                className="font-display text-[23px] leading-[1.1] font-normal"
              >
                {title}
              </h2>
            )}
            {caption && (
              <p className="mt-1 text-xs text-ink-500">{caption}</p>
            )}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}
