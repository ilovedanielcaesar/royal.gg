import type { ReactNode } from "react";

type Props = {
  title: string;
  /** One muted line. What the page is, not a sales pitch for it. */
  subtitle?: ReactNode;
  /** `FeltButton`s, right-aligned and baseline-aligned with the title. */
  actions?: ReactNode;
};

/**
 * The page title and its actions, on the felt, ABOVE the sheet.
 *
 * This placement is the rule the redesign is built on: the sheet is a record
 * of results and carries no controls except its own tabs, so anything that
 * changes something lives up here. A button that has migrated into a band is
 * a bug.
 *
 * `items-end` so a two-line title and a one-line button still share a
 * baseline.
 */
export default function PageHeading({ title, subtitle, actions }: Props) {
  return (
    <div className="mb-[18px] flex flex-wrap items-end justify-between gap-6">
      <div>
        <h1 className="font-display text-[40px] leading-none tracking-[-0.015em] max-[720px]:text-[32px]">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-[7px] text-[13px] text-card-50/60">{subtitle}</p>
        )}
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  );
}
