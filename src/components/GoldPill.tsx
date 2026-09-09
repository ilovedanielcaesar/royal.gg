import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
};

/**
 * `gold-500` at 16% on cream, with `gold-ink` text.
 *
 * The fill is the contract's; the text is not `gold-500`, which on cream is
 * about 1.9:1 and unreadable. `gold-ink` is the token for gold that has to
 * carry text on a card.
 */
export default function GoldPill({ children }: Props) {
  return (
    <span className="inline-flex items-center rounded-full bg-gold-500/[0.16] px-3 py-1 text-xs font-medium text-gold-ink">
      {children}
    </span>
  );
}
