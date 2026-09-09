/**
 * Money colour is financial convention, not suit colour: sage up, crimson
 * down, `ink-500` at zero — independent of the player's card, so a red-suit
 * player is never visually conflated with losing.
 *
 * A lib function rather than a component because the caller needs the class
 * on its own element — a wrapping `<span>` breaks the `font-display` and
 * width rules its parent sets.
 *
 * Anything that is NOT money — a rating, an action score, a count — must not
 * come through here. It stays `ink-900`, because a sage-tinted score reads as
 * a dollar amount.
 */
export function moneyToneClass(cents: number): string {
  if (cents > 0) return "text-sage-700";
  if (cents < 0) return "text-crimson-700";
  return "text-ink-500";
}
