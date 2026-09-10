import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  /**
   * Which surface it sits on. `cream` is inside a sheet or card; `felt` is
   * out on the table, beside a page heading.
   */
  tone?: "cream" | "felt";
};

/**
 * Gold at 16%, in the one readable pairing for each surface.
 *
 * The two tones are not a style choice, they are a contrast one. `gold-500`
 * on cream is about 1.9:1 and unreadable, so cream uses `gold-ink`. On
 * `felt-900` the reverse holds — `gold-ink` is dark on dark — so felt uses
 * `gold-500`, which is what that token is for.
 */
const TONES = {
  cream: "bg-gold-500/[0.16] text-gold-ink",
  felt: "bg-gold-500/[0.14] text-gold-500 ring-1 ring-gold-500/25",
} as const;

export default function GoldPill({ children, tone = "cream" }: Props) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${TONES[tone]}`}
    >
      {children}
    </span>
  );
}
