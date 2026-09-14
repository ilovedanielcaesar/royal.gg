import Reveal from "./Reveal";

type Props = {
  /** The section's number, set in the display face beside the title. */
  num: string;
  title: string;
  /** The line to the right of the title. Omit it for a title on its own. */
  blurb?: string;
};

export default function HomeSectionHead({ num, title, blurb }: Props) {
  return (
    <Reveal>
      <div className="flex flex-wrap items-baseline justify-between gap-4 border-b border-card-50/[0.12] pb-7">
        <div className="flex items-baseline gap-[14px]">
          <span className="font-display text-[15px] text-gold-500">{num}</span>
          <h2 className="font-display text-[clamp(29px,3.6vw,46px)] font-normal tracking-[-0.01em] text-card-50">
            {title}
          </h2>
        </div>
        {blurb && (
          <p className="max-w-[38ch] text-sm leading-relaxed text-card-50/65">
            {blurb}
          </p>
        )}
      </div>
    </Reveal>
  );
}
