import type { ReactNode, CSSProperties } from "react";
import SuitBadge from "./SuitBadge";
import type { Suit } from "../lib/playerSuit";

type Props = {
  children: ReactNode;
  className?: string;
  watermarkSuit?: Suit;
  rankLabel?: string;
  dealIn?: number;
  as?: "div" | "article";
  interactive?: boolean;
  accent?: "neutral" | "sage" | "crimson" | "gold";
};

const ACCENT_BAR: Record<NonNullable<Props["accent"]>, string> = {
  neutral: "bg-card-200",
  sage: "bg-sage-600",
  crimson: "bg-crimson-600",
  gold: "bg-gold-500",
};

export default function Card({
  children,
  className = "",
  watermarkSuit,
  rankLabel,
  dealIn,
  as = "div",
  interactive = false,
  accent = "neutral",
}: Props) {
  const Tag = as;
  const style: CSSProperties = dealIn
    ? {
        animation: "var(--animate-deal-in)",
        animationDelay: `${dealIn}ms`,
      }
    : {};
  const baseClass = [
    "relative overflow-hidden rounded-xl bg-card-50 text-ink-900",
    "shadow-[0_2px_0_0_rgba(0,0,0,0.18),0_18px_40px_-20px_rgba(0,0,0,0.6)]",
    "ring-1 ring-card-100",
    interactive
      ? "transition will-change-transform hover:-translate-y-1 hover:rotate-[0.4deg] hover:shadow-[0_4px_0_0_rgba(0,0,0,0.18),0_28px_50px_-22px_rgba(0,0,0,0.7)] cursor-pointer"
      : "",
    className,
  ].join(" ");

  return (
    <Tag data-cream className={baseClass} style={style}>
      <div className={`absolute inset-x-0 top-0 h-1 ${ACCENT_BAR[accent]}`} />
      {rankLabel && (
        <div className="pointer-events-none absolute left-3 top-3 font-display text-xs leading-none text-ink-700">
          {rankLabel}
        </div>
      )}
      {watermarkSuit && (
        <div className="pointer-events-none absolute -right-2 -bottom-2 opacity-[0.07]">
          <SuitBadge suit={watermarkSuit} size={120} />
        </div>
      )}
      <div className="relative">{children}</div>
    </Tag>
  );
}
