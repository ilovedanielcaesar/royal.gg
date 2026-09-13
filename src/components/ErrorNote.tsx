import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  /**
   * Which surface it sits on. `cream` is inside a `Sheet` or `Card`; `felt`
   * is out on the table.
   */
  tone?: "cream" | "felt";
  /** Renders the message in mono — for a raw error string, not a sentence. */
  mono?: boolean;
  className?: string;
};

/**
 * The one error banner. Eleven verbatim copies of it preceded this.
 *
 * The two tones are a contrast fix, not a style choice, and the felt one is
 * the reason this component exists at all. All eleven copies used
 * `text-crimson-700` on a `crimson-500/10` ground — correct on cream, and
 * **1.5:1 on felt**, which is an error message you cannot read. Two of them
 * (`GroupMembersPage`, `GroupSettingsPage`) were rendering exactly that,
 * out on the table.
 *
 * On felt the text goes cream and the crimson moves into the ground and the
 * ring, which is the same trade `GoldPill` makes for the same reason: the
 * colour carries the meaning, the cream carries the legibility.
 */
const TONES = {
  cream: "bg-crimson-500/10 text-crimson-700",
  felt: "bg-crimson-600/20 text-card-50 ring-1 ring-crimson-500/45",
} as const;

export default function ErrorNote({
  children,
  tone = "cream",
  mono = false,
  className = "",
}: Props) {
  return (
    <p
      role="alert"
      className={[
        "rounded-md px-3 py-2 text-xs",
        TONES[tone],
        mono ? "font-mono break-words" : "",
        className,
      ].join(" ")}
    >
      {children}
    </p>
  );
}
