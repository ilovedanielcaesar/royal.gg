import { useEffect, useRef } from "react";
import HomeHeroHand from "./HomeHeroHand";
import MarketingButton from "../../components/MarketingButton";

/** Where each card ends up once the hand is fully fanned: angle, x, y drop. */
const FAN = [
  { a: -30, x: -300, y: 44 },
  { a: -18, x: -180, y: 14 },
  { a: -6, x: -60, y: 0 },
  { a: 6, x: 60, y: 0 },
  { a: 18, x: 180, y: 14 },
  { a: 30, x: 300, y: 44 },
];

/**
 * The hand fans out as the hero scrolls.
 *
 * The section is taller than the screen and its contents are pinned, so the
 * scroll that would move the page instead deals the cards. Driven from a
 * single rAF reading `getBoundingClientRect` rather than from a scroll
 * listener: a scroll handler fires on a schedule the compositor does not
 * share, and the cards visibly lag the page.
 *
 * The hand sits IN FRONT of the copy, not behind it. Scrolling back up the
 * hero has to gather the cards over the headline and buttons — a button
 * printing through a card face is the one thing that breaks the illusion.
 */
export default function HomeHero() {
  const heroRef = useRef<HTMLElement | null>(null);
  const copyRef = useRef<HTMLDivElement | null>(null);
  const cueRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const hero = heroRef.current;
    const copy = copyRef.current;
    const cue = cueRef.current;
    if (!hero || !copy || !cue) return;

    const cards = Array.from(
      hero.querySelectorAll<HTMLElement>("[data-fan]")
    );
    let handle = 0;
    let lastProgress = -1;

    const frame = () => {
      const travel = Math.max(hero.offsetHeight - window.innerHeight, 1);
      const raw = Math.min(
        Math.max(-hero.getBoundingClientRect().top / travel, 0),
        1
      );
      // Only touch the DOM when the scroll actually moved. Writing the same
      // six transforms every frame of a still page is pure layout churn.
      if (Math.abs(raw - lastProgress) > 0.0015) {
        lastProgress = raw;
        const p =
          raw < 0.5 ? 2 * raw * raw : 1 - Math.pow(-2 * raw + 2, 2) / 2;
        // The fan is laid out for a wide screen; on a narrow one the whole
        // spread scales down rather than running off the sides.
        const fit = Math.min(window.innerWidth / 1180, 1);

        cards.forEach((el, i) => {
          const target = FAN[i] ?? FAN[FAN.length - 1]!;
          const stackAngle = (i - 2.5) * 1.4;
          const angle = stackAngle + (target.a - stackAngle) * p;
          const x = target.x * p * fit;
          const peek = Math.min(168, window.innerHeight * 0.26);
          const rise = Math.min(224, window.innerHeight * 0.34);
          const y = -peek + i * -1.5 - rise * p + target.y * p;
          const scale = (0.94 + 0.06 * p) * fit;
          el.style.zIndex = String(10 + i);
          el.style.transform =
            `translate(${x.toFixed(1)}px,${y.toFixed(1)}px) ` +
            `rotate(${angle.toFixed(2)}deg) scale(${scale.toFixed(3)})`;
        });

        copy.style.transform = `translateY(${(-46 * p).toFixed(1)}px)`;
        copy.style.opacity = String(
          Math.max(1 - Math.max(p - 0.74, 0) / 0.26, 0.14)
        );
        cue.style.opacity = String(Math.max(1 - p * 3, 0));
      }
      handle = requestAnimationFrame(frame);
    };

    handle = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(handle);
  }, []);

  return (
    <section
      id="top"
      ref={heroRef}
      className="relative h-[188vh] max-[780px]:h-[172vh]"
    >
      <div className="sticky top-0 h-screen overflow-hidden">
        <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
          <div ref={copyRef} className="relative z-[3] max-w-[720px]">
            <p className="text-[11px] font-semibold tracking-[0.22em] text-gold-500">
              HOME GAME · PROPERLY TRACKED
            </p>
            <h1 className="mt-5 font-display text-[clamp(40px,6.4vw,88px)] leading-[1.02] font-normal tracking-[-0.02em] text-card-50">
              Every night
              <br />
              goes on the record.
            </h1>
            <p className="mx-auto mt-[22px] max-w-[54ch] text-[17px] leading-relaxed text-card-50/70">
              Log the session after the cards are away. royal.gg reconciles the
              chips, settles who owes whom, and finds out who&rsquo;s actually
              the best player.
            </p>
            <div className="mt-[34px] flex flex-wrap justify-center gap-3">
              <MarketingButton to="/signup" size="lg">
                Create your group
              </MarketingButton>
              <MarketingButton to="#log" variant="ghost" size="lg">
                See a table
              </MarketingButton>
            </div>
          </div>

          <HomeHeroHand />

          <div
            ref={cueRef}
            aria-hidden="true"
            className="absolute bottom-[26px] left-1/2 z-[6] flex -translate-x-1/2 flex-col items-center gap-2"
          >
            <span className="text-[10px] tracking-[0.22em] text-card-50/45">
              SCROLL TO DEAL
            </span>
            <span className="h-[34px] w-px bg-gradient-to-b from-card-50/50 to-transparent" />
          </div>
        </div>
      </div>
    </section>
  );
}
