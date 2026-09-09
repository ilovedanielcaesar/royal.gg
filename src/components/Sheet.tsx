import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  className?: string;
};

/**
 * The one cream playing-card each page is laid out on.
 *
 * The central move of the redesign: a page is ONE sheet divided into `Band`s
 * by hairline rules, not a scattered grid of small `Card`s. There is one of
 * these per page. If a second one is going in, the bands inside the first are
 * the answer instead.
 *
 * `overflow-hidden` is what lets a band's own background reach the sheet's
 * edge without escaping its 22px corner radius.
 */
export default function Sheet({ children, className = "" }: Props) {
  return (
    <div
      data-cream
      className={[
        "overflow-hidden rounded-[22px] bg-card-50 text-ink-900",
        // Three shadows doing three jobs: the card's own thickness, the cast
        // shadow that lifts it off the felt, and a hairline edge so the cream
        // never bleeds into the cream of a band.
        "shadow-[0_2px_0_rgba(0,0,0,0.14),0_30px_70px_-28px_rgba(0,0,0,0.65),0_0_0_1px_var(--color-card-100)]",
        "animate-settle motion-reduce:animate-none",
        className,
      ].join(" ")}
    >
      {children}
    </div>
  );
}
