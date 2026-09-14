import { useEffect, useRef, useState, type ReactNode } from "react";

type Props = {
  children: ReactNode;
  className?: string;
};

/**
 * Whether to skip the animation entirely and render the contents in place.
 *
 * Read once, as `useState`'s initialiser, rather than set from inside the
 * effect: flipping this in an effect body is a cascading render, and it is
 * not state that arrives late — the browser knows both answers before the
 * first paint.
 */
function rendersImmediately(): boolean {
  if (typeof window === "undefined") return true;
  if (typeof IntersectionObserver === "undefined") return true;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Lifts its contents into place the first time they scroll into view.
 *
 * The landing page is the one place in the app that animates on arrival —
 * `main` dropped its deal-in because repeating it on every navigation was
 * noise, but a marketing page is read once, downward, and the reveal is what
 * gives the sections their order. It never runs twice: once shown, the
 * observer lets go.
 */
export default function Reveal({ children, className = "" }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [shown, setShown] = useState(rendersImmediately);

  useEffect(() => {
    if (shown) return;
    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setShown(true);
          observer.disconnect();
        }
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.08 }
    );
    observer.observe(node);

    // Nothing stays invisible because an observer never fired — a section
    // already on screen at load, or one the browser scrolled to by hash.
    const failsafe = window.setTimeout(() => {
      if (node.getBoundingClientRect().top < window.innerHeight * 1.2) {
        setShown(true);
        observer.disconnect();
      }
    }, 900);

    return () => {
      observer.disconnect();
      window.clearTimeout(failsafe);
    };
  }, [shown]);

  return (
    <div
      ref={ref}
      className={[
        "transition-[opacity,transform] duration-700 ease-[cubic-bezier(0.2,0.8,0.2,1)]",
        "motion-reduce:transition-none",
        shown ? "opacity-100" : "translate-y-[26px] opacity-0",
        className,
      ].join(" ")}
    >
      {children}
    </div>
  );
}
