/**
 * The window the pill counts over. Four nights, so "3 of your last 4" is a
 * claim about a month of poker rather than about noise.
 */
export const STREAK_WINDOW = 4;

/**
 * The one piece of derived commentary on the dashboard. A local template over
 * the player's session nets — no API, no LLM, no extra query.
 *
 * Returns null when there is nothing honest to say:
 *
 * - **Fewer than 4 nights played.** Don't count out of a window that hasn't
 *   filled; "2 of your last 4" when only two nights exist is a lie about the
 *   denominator.
 * - **Four nights, none of them up or down.** All flat is vanishingly
 *   unlikely and would render "0 of your last 4 nights down", which says
 *   nothing.
 *
 * When nothing is up, the framing flips to the downs rather than rendering
 * `0 of your last 4 nights up`, which reads as a taunt. It counts downs
 * rather than assuming `4 − ups`, because a flat night is neither.
 */
export function streakPillText(netsOldestFirst: number[]): string | null {
  if (netsOldestFirst.length < STREAK_WINDOW) return null;

  const window = netsOldestFirst.slice(-STREAK_WINDOW);
  const ups = window.filter((n) => n > 0).length;
  const downs = window.filter((n) => n < 0).length;

  if (ups > 0) {
    return `${ups} of your last ${STREAK_WINDOW} nights up`;
  }
  if (downs > 0) {
    return `${downs} of your last ${STREAK_WINDOW} nights down`;
  }
  return null;
}
