type Props = {
  /**
   * `felt` is out on the table — a whole route waiting. `cream` is inside a
   * `Sheet` or `Card`, where only that band's data is missing.
   */
  tone?: "cream" | "felt";
  /**
   * Default `Dealing…`. Route guards pass `Dealing in…`, which is a different
   * sentence on purpose: the cards are not late, you are being seated.
   */
  label?: string;
  /**
   * A whole route is waiting, so give it the vertical space a page occupies.
   * Without this the felt states render as one small line jammed under the
   * chrome, which is how rows 17–22 looked before Stage A.
   */
  full?: boolean;
};

/**
 * The loading placeholder. Contract rule 6: no spinners — the chrome stays,
 * and a muted line says the cards are coming.
 *
 * Twenty-two hand-written copies preceded this, across three treatments and
 * two different sentences with no rule for which was which.
 */
export default function LoadingState({
  tone = "cream",
  label = "Dealing…",
  full = false,
}: Props) {
  return (
    <p
      role="status"
      className={[
        "text-sm",
        tone === "felt" ? "text-card-50/60" : "text-ink-500",
        full ? "flex min-h-[40vh] items-center justify-center" : "",
      ].join(" ")}
    >
      {label}
    </p>
  );
}
