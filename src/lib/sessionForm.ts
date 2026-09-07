import type { Database } from "../types/database";

export type SessionFormPlayer =
  Database["public"]["Tables"]["players"]["Row"];
export type SessionFormSession =
  Database["public"]["Tables"]["sessions"]["Row"];

export type SessionFormRow = {
  playerId: string;
  buyInCount: string;
  cashOut: string;
};

/**
 * The lenient sibling of `parseDollarsToCents`, for a field being typed into.
 *
 * It stays separate rather than collapsing into that one, because strictness
 * that is right for a setting is wrong here: a cash-out is parsed on every
 * keystroke, and "4." is a real intermediate state. The strict parser returns
 * null for it, which would blank the running Net while someone is mid-number.
 *
 * The arithmetic is exact all the same. This used to be
 * `Math.round(Number(raw) * 100)`, which multiplies a float — "47.35" is
 * really 4734.999999999999 and only survived because of the rounding.
 */
export function parseDraftCents(raw: string): number | null {
  const match = raw.trim().match(/^(\d+)(?:\.(\d{0,2}))?$/);
  if (!match) return null;
  return Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
}

export function parseCount(raw: string): number {
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

/**
 * What one buy-in costs on a given night.
 *
 * Decision 13, and the whole reason 0017 exists. An EXISTING night is priced at
 * the stake stamped on it; only a NEW one takes the group's current default.
 * Reading `group.default_buy_in_cents` unconditionally would look identical and
 * be correct right up until a group changed its stakes — at which point
 * reopening any older game would recompute its buy-ins at the new price and
 * silently rewrite a night that was settled months ago.
 *
 * Undefined until the group has loaded. Callers must refuse to save on that
 * rather than substituting a number.
 */
export function resolveBuyInCents(
  session: Pick<SessionFormSession, "buy_in_cents"> | null,
  group: { default_buy_in_cents: number } | null | undefined
): number | undefined {
  return session?.buy_in_cents ?? group?.default_buy_in_cents;
}
