import type { Database } from "../types/database";

export type Player = Database["public"]["Tables"]["players"]["Row"];
export type Session = Database["public"]["Tables"]["sessions"]["Row"];
export type BuyIn = Database["public"]["Tables"]["buy_ins"]["Row"];
export type CashOut = Database["public"]["Tables"]["cash_outs"]["Row"];

type SessionAggregate = {
  session: Session;
  totalBuyInCents: number;
  totalReportedCents: number;
  totalAdjustedCents: number;
  playerCount: number;
};

export type Payout = Database["public"]["Tables"]["payouts"]["Row"];

export type PlayerStats = {
  playerId: string;
  sessionsPlayed: number;
  wins: number;
  losses: number;
  totalNetCents: number;
  best: number;
  worst: number;
};

export type CumulativePoint = {
  sessionIndex: number;
  sessionId: string;
  playedAt: string;
  netCents: number;
  cumulativeCents: number;
};

function aggregateSession(
  session: Session,
  buyIns: BuyIn[],
  cashOuts: CashOut[]
): SessionAggregate {
  const sb = buyIns.filter((b) => b.session_id === session.id);
  const sc = cashOuts.filter((c) => c.session_id === session.id);
  const totalBuyInCents = sb.reduce((s, b) => s + b.amount_cents, 0);
  const totalReportedCents = sc.reduce(
    (s, c) => s + c.reported_amount_cents,
    0
  );
  const totalAdjustedCents = sc.reduce(
    (s, c) => s + c.adjusted_amount_cents,
    0
  );
  const playerIds = new Set([
    ...sb.map((b) => b.player_id),
    ...sc.map((c) => c.player_id),
  ]);
  return {
    session,
    totalBuyInCents,
    totalReportedCents,
    totalAdjustedCents,
    playerCount: playerIds.size,
  };
}

/**
 * Per-player chronological cumulative net.
 * Sessions are sorted by played_at ascending, with stable id tie-break.
 * If a player didn't play a given session, no point is added (their line just
 * stays flat from their previous point).
 */
export function cumulativeByPlayer(
  sessions: Session[],
  buyIns: BuyIn[],
  cashOuts: CashOut[]
): Map<string, CumulativePoint[]> {
  const sorted = [...sessions].sort((a, b) => {
    const cmp = a.played_at.localeCompare(b.played_at);
    return cmp !== 0 ? cmp : a.id.localeCompare(b.id);
  });

  const byPlayer = new Map<string, CumulativePoint[]>();
  sorted.forEach((s, idx) => {
    const sb = buyIns.filter((b) => b.session_id === s.id);
    const sc = cashOuts.filter((c) => c.session_id === s.id);
    const playerIds = new Set([
      ...sb.map((b) => b.player_id),
      ...sc.map((c) => c.player_id),
    ]);
    playerIds.forEach((pid) => {
      const buyTotal = sb
        .filter((b) => b.player_id === pid)
        .reduce((sum, b) => sum + b.amount_cents, 0);
      const co = sc.find((c) => c.player_id === pid);
      const cashTotal = co ? co.adjusted_amount_cents : 0;
      const net = cashTotal - buyTotal;
      const arr = byPlayer.get(pid) ?? [];
      const prev = arr.length ? arr[arr.length - 1]!.cumulativeCents : 0;
      arr.push({
        sessionIndex: idx,
        sessionId: s.id,
        playedAt: s.played_at,
        netCents: net,
        cumulativeCents: prev + net,
      });
      byPlayer.set(pid, arr);
    });

    byPlayer.forEach((arr, pid) => {
      if (!playerIds.has(pid)) {
        const prev = arr.length ? arr[arr.length - 1]!.cumulativeCents : 0;
        arr.push({
          sessionIndex: idx,
          sessionId: s.id,
          playedAt: s.played_at,
          netCents: 0,
          cumulativeCents: prev,
        });
      }
    });
  });
  return byPlayer;
}

export function playerStats(
  playerId: string,
  sessions: Session[],
  buyIns: BuyIn[],
  cashOuts: CashOut[]
): PlayerStats {
  let sessionsPlayed = 0;
  let wins = 0;
  let losses = 0;
  let totalNetCents = 0;
  let best = 0;
  let worst = 0;
  sessions.forEach((s) => {
    const sb = buyIns.filter(
      (b) => b.session_id === s.id && b.player_id === playerId
    );
    const sc = cashOuts.filter(
      (c) => c.session_id === s.id && c.player_id === playerId
    );
    if (sb.length === 0 && sc.length === 0) return;
    sessionsPlayed += 1;
    const buyTotal = sb.reduce((sum, b) => sum + b.amount_cents, 0);
    const cashTotal = sc.reduce(
      (sum, c) => sum + c.adjusted_amount_cents,
      0
    );
    const net = cashTotal - buyTotal;
    totalNetCents += net;
    if (net > 0) wins += 1;
    else if (net < 0) losses += 1;
    if (net > best) best = net;
    if (net < worst) worst = net;
  });
  return {
    playerId,
    sessionsPlayed,
    wins,
    losses,
    totalNetCents,
    best,
    worst,
  };
}

export function leaderboard(
  players: Player[],
  sessions: Session[],
  buyIns: BuyIn[],
  cashOuts: CashOut[]
): Array<PlayerStats & { player: Player }> {
  return players
    .map((p) => ({
      ...playerStats(p.id, sessions, buyIns, cashOuts),
      player: p,
    }))
    .sort((a, b) => b.totalNetCents - a.totalNetCents);
}

/**
 * Per-session nets for one player, sorted oldest-to-newest.
 * Sessions where the player didn't participate are skipped.
 */
export function playerSessionNets(
  playerId: string,
  sessions: Session[],
  buyIns: BuyIn[],
  cashOuts: CashOut[]
): Array<{ session: Session; netCents: number }> {
  const sorted = [...sessions].sort((a, b) => {
    const cmp = a.played_at.localeCompare(b.played_at);
    return cmp !== 0 ? cmp : a.id.localeCompare(b.id);
  });
  const out: Array<{ session: Session; netCents: number }> = [];
  for (const s of sorted) {
    const sb = buyIns.filter(
      (b) => b.session_id === s.id && b.player_id === playerId
    );
    const sc = cashOuts.filter(
      (c) => c.session_id === s.id && c.player_id === playerId
    );
    if (sb.length === 0 && sc.length === 0) continue;
    const buy = sb.reduce((sum, b) => sum + b.amount_cents, 0);
    const cash = sc.reduce((sum, c) => sum + c.adjusted_amount_cents, 0);
    out.push({ session: s, netCents: cash - buy });
  }
  return out;
}

/**
 * Sample mean and (unbiased) sample variance of session nets, in cents².
 * Returns null fields when there aren't enough data points.
 */
export function netStats(nets: number[]): {
  mean: number | null;
  variance: number | null;
  stdev: number | null;
} {
  if (nets.length === 0) return { mean: null, variance: null, stdev: null };
  const mean = nets.reduce((s, n) => s + n, 0) / nets.length;
  if (nets.length < 2) {
    return { mean, variance: null, stdev: null };
  }
  const variance =
    nets.reduce((s, n) => s + (n - mean) ** 2, 0) / (nets.length - 1);
  return { mean, variance, stdev: Math.sqrt(variance) };
}

/**
 * The bar for appearing in a ranking: three lifetime nights.
 *
 * Deliberately the same number as RATING_MIN_SESSIONS, and deliberately not
 * the same constant — they answer different questions ("is this score
 * meaningful?" vs "does this player belong in the standings?") and could
 * reasonably diverge. Sharing one constant would couple them by accident.
 */
export const RANKING_MIN_SESSIONS = 3;

/**
 * Whether a player appears in a ranking: active, not a guest, and at least
 * RANKING_MIN_SESSIONS lifetime nights.
 *
 * ONE definition, used by the dashboard's seasonal leaders and the League
 * page's all-time standings. Two copies of this rule will drift, and the two
 * places it is used are the two places that make a claim about who is good.
 *
 * What this does NOT do is remove anyone's money from the record. A guest's
 * buy-ins and cash-outs stay in session totals, in reconciliation, in the
 * lifetime ledger and in every chart. Excluded from rankings is not excluded
 * from the league.
 *
 * `sessionsPlayed` counts LIFETIME nights, even when the caller is ranking a
 * five-game window — otherwise a five-game window could never seat anyone at
 * a three-game bar.
 *
 * Former members stay eligible. Leaving does not erase your results, and
 * `players.status` stays "active" after someone leaves the group anyway; the
 * former-member marker lives on `group_members.status` and is a Stage 2
 * concern.
 */
export function isRankingEligible(
  player: Player,
  sessionsPlayed: number
): boolean {
  return (
    player.status === "active" &&
    !player.is_guest &&
    sessionsPlayed >= RANKING_MIN_SESSIONS
  );
}

/**
 * The most recent `count` sessions, oldest-first.
 *
 * A window measured in games rather than months, which is what makes it
 * stable: "the last five" means the same thing whether the group played five
 * straight weekends or took August off. Sorted with the same
 * played_at-then-id tie-break as everywhere else, so two nights logged on one
 * date order identically here and in the charts.
 */
export function recentSessions(sessions: Session[], count: number): Session[] {
  const sorted = [...sessions].sort((a, b) => {
    const cmp = a.played_at.localeCompare(b.played_at);
    return cmp !== 0 ? cmp : a.id.localeCompare(b.id);
  });
  return count >= sorted.length ? sorted : sorted.slice(sorted.length - count);
}

/**
 * Players sorted by net across the sessions handed in.
 *
 * Takes an already-windowed session list rather than a `windowStart: Date`.
 * The window is a count of games now (see `recentSessions`), and a function
 * that filters by date cannot express that — so the filtering moved out to
 * the one helper that owns it.
 */
export function seasonLeaders(
  players: Player[],
  windowSessions: Session[],
  buyIns: BuyIn[],
  cashOuts: CashOut[]
): Array<{ player: Player; netCents: number; sessionsPlayed: number }> {
  const byPlayer = new Map<string, { net: number; count: number }>();
  for (const s of windowSessions) {
    const sb = buyIns.filter((b) => b.session_id === s.id);
    const sc = cashOuts.filter((c) => c.session_id === s.id);
    const playerIds = new Set([
      ...sb.map((b) => b.player_id),
      ...sc.map((c) => c.player_id),
    ]);
    playerIds.forEach((pid) => {
      const buy = sb
        .filter((b) => b.player_id === pid)
        .reduce((sum, b) => sum + b.amount_cents, 0);
      const co = sc.find((c) => c.player_id === pid);
      const cash = co ? co.adjusted_amount_cents : 0;
      const cur = byPlayer.get(pid) ?? { net: 0, count: 0 };
      cur.net += cash - buy;
      cur.count += 1;
      byPlayer.set(pid, cur);
    });
  }
  return players
    .filter((p) => byPlayer.has(p.id))
    .map((p) => ({
      player: p,
      netCents: byPlayer.get(p.id)!.net,
      sessionsPlayed: byPlayer.get(p.id)!.count,
    }))
    .sort((a, b) => b.netCents - a.netCents);
}

// ----- Player Rating ------------------------------------------------------
// Mirror of player_rating_calibration.py. Keep weights and floors in sync.

export const PLAYER_RATING_WEIGHTS = {
  winRate: 0.25,
  consistency: 0.2,
  trend: 0.2,
  lifetime: 0.35,
} as const;

const STDEV_FLOOR_USD = 80;
const TREND_HALF_RANGE_USD = 50;
const LIFETIME_HALF_RANGE_USD = 100;
const RATING_MIN_SESSIONS = 3;
const TREND_WINDOW = 6;

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

export type ConsistencyScore = {
  /** Standard deviation of the player's per-night nets. Null under 2 nights. */
  stdevCents: number | null;
  /** 0..1, higher is steadier. This is the rating's consistency component. */
  subscore: number;
};

/**
 * How steady a player's nights are, on its own rather than buried in a
 * weighted sum.
 *
 * Extracted 2026-09-09 for the League page's sort: consistency existed only
 * as a subscore inside `playerRating()`, and you cannot sort on a number that
 * has no name. `playerRating()` calls this, so there is exactly one
 * definition — the reason to extract rather than copy.
 *
 * Takes the nets rather than a player id because every caller already has
 * them (`playerRating()` computes them one line earlier), and recomputing
 * `players × sessions` nets to answer one question is the cost this avoids.
 *
 * A single night has no deviation to measure, so `netStats` returns null and
 * the subscore is the neutral 0.5 — neither steady nor wild, which is the
 * honest answer to one data point.
 */
export function consistencyScore(netsCents: number[]): ConsistencyScore {
  const { stdev } = netStats(netsCents);
  return {
    stdevCents: stdev,
    subscore: stdev == null ? 0.5 : clamp01(1 - stdev / 100 / STDEV_FLOOR_USD),
  };
}

export type PlayerRating = {
  rating: number | null; // 1..10 or null when too few sessions
  rawScore: number; // 0..1
  components: {
    winRate: { value: number; subscore: number; weight: number };
    consistency: { stdevCents: number | null; subscore: number; weight: number };
    trend: { last6NetCents: number; subscore: number; weight: number };
    lifetime: { totalNetCents: number; subscore: number; weight: number };
  };
  sessionsPlayed: number;
};

/**
 * Combined 1–10 rating using win rate + consistency + recent trend +
 * lifetime winnings. Returns null when sessions_played < 3 (insufficient
 * data). Caller can introspect `components` to render an explainer.
 */
export function playerRating(
  playerId: string,
  sessions: Session[],
  buyIns: BuyIn[],
  cashOuts: CashOut[]
): PlayerRating {
  const stats = playerStats(playerId, sessions, buyIns, cashOuts);
  const nets = playerSessionNets(playerId, sessions, buyIns, cashOuts);
  const last6Net = nets
    .slice(-TREND_WINDOW)
    .reduce((s, n) => s + n.netCents, 0);
  const consistency = consistencyScore(nets.map((n) => n.netCents));

  const wrSub =
    stats.sessionsPlayed === 0
      ? 0.5
      : clamp01(stats.wins / stats.sessionsPlayed);
  const consSub = consistency.subscore;
  const trendSub = clamp01(
    0.5 + last6Net / 100 / (2 * TREND_HALF_RANGE_USD)
  );
  const lifeSub = clamp01(
    0.5 + stats.totalNetCents / 100 / (2 * LIFETIME_HALF_RANGE_USD)
  );

  const raw =
    wrSub * PLAYER_RATING_WEIGHTS.winRate +
    consSub * PLAYER_RATING_WEIGHTS.consistency +
    trendSub * PLAYER_RATING_WEIGHTS.trend +
    lifeSub * PLAYER_RATING_WEIGHTS.lifetime;

  const rating =
    stats.sessionsPlayed < RATING_MIN_SESSIONS
      ? null
      : Math.max(1, Math.min(10, Math.round((1 + 9 * raw) * 10) / 10));

  return {
    rating,
    rawScore: raw,
    components: {
      winRate: {
        value:
          stats.sessionsPlayed === 0
            ? 0
            : stats.wins / stats.sessionsPlayed,
        subscore: wrSub,
        weight: PLAYER_RATING_WEIGHTS.winRate,
      },
      consistency: {
        stdevCents: consistency.stdevCents,
        subscore: consSub,
        weight: PLAYER_RATING_WEIGHTS.consistency,
      },
      trend: {
        last6NetCents: last6Net,
        subscore: trendSub,
        weight: PLAYER_RATING_WEIGHTS.trend,
      },
      lifetime: {
        totalNetCents: stats.totalNetCents,
        subscore: lifeSub,
        weight: PLAYER_RATING_WEIGHTS.lifetime,
      },
    },
    sessionsPlayed: stats.sessionsPlayed,
  };
}

/**
 * Sum of net P/L per player over a date window — used for payout periods.
 * The window is sessions with played_at > startAfter (exclusive) AND
 * played_at <= endOn (inclusive). startAfter=null means "from the beginning".
 *
 * Result is sorted by netCents descending (winners on top, losers at bottom).
 * Players who played zero sessions in the window are omitted.
 */
export function periodNets(
  players: Player[],
  sessions: Session[],
  buyIns: BuyIn[],
  cashOuts: CashOut[],
  startAfter: string | null,
  endOn: string
): Array<{ player: Player; netCents: number; sessionsPlayed: number }> {
  const inWindow = sessions.filter((s) => {
    if (startAfter && s.played_at <= startAfter) return false;
    return s.played_at <= endOn;
  });
  const byPlayer = new Map<string, { net: number; count: number }>();
  for (const s of inWindow) {
    const sb = buyIns.filter((b) => b.session_id === s.id);
    const sc = cashOuts.filter((c) => c.session_id === s.id);
    const playerIds = new Set([
      ...sb.map((b) => b.player_id),
      ...sc.map((c) => c.player_id),
    ]);
    playerIds.forEach((pid) => {
      const buy = sb
        .filter((b) => b.player_id === pid)
        .reduce((sum, b) => sum + b.amount_cents, 0);
      const co = sc.find((c) => c.player_id === pid);
      const cash = co ? co.adjusted_amount_cents : 0;
      const cur = byPlayer.get(pid) ?? { net: 0, count: 0 };
      cur.net += cash - buy;
      cur.count += 1;
      byPlayer.set(pid, cur);
    });
  }
  return players
    .filter((p) => byPlayer.has(p.id))
    .map((p) => ({
      player: p,
      netCents: byPlayer.get(p.id)!.net,
      sessionsPlayed: byPlayer.get(p.id)!.count,
    }))
    .sort((a, b) => b.netCents - a.netCents);
}

/**
 * Nights in an open payout period before the League page starts nagging.
 *
 * A named constant because the number is stated in two places that must
 * agree: the reminder that fires in the payout band, and the "Payout
 * reminder" fact in the rules band directly below it. It was an inline `8`
 * in the first of those and absent from the second, which is precisely the
 * shape of a figure that drifts.
 *
 * Not a `groups` column. Nothing in the app can set it yet, and a settings
 * control nobody asked for is a bigger change than this stage owns — if the
 * reminder ever wants to be per-group, this constant is the seam.
 */
export const PAYOUT_REMINDER_AFTER_SESSIONS = 8;

/**
 * The smallest number of buy-ins that counts as having rebought.
 *
 * Two: the buy-in you sat down with, plus one more. Named because "rebought"
 * is ambiguous in English — "more than one rebuy" would be three — and the
 * stat below is meaningless if the reader guesses the wrong one.
 */
export const REBUY_MIN_BUY_INS = 2;

export type RebuySuccess = {
  /** 0..1, or null when no night qualifies. */
  rate: number | null;
  /** Qualifying nights that ended up. */
  successes: number;
  /** Nights with REBUY_MIN_BUY_INS or more buy-ins. */
  qualifying: number;
};

/**
 * How often digging in actually worked: of the nights you rebought, the share
 * you finished ahead on.
 *
 * A night qualifies on buy-in COUNT, not on money — three $40 buy-ins is a
 * rebuy night and one $120 buy-in is not, because the question is about the
 * decision to buy back in after busting, and that decision is a row in
 * `buy_ins`.
 *
 * Success is `netCents > 0`, strictly. Breaking exactly even after rebuying
 * is not a success; it is a night you got your money back, and rounding it
 * up would flatter the figure at precisely the point it is supposed to be
 * honest.
 *
 * `rate` is null rather than 0 when nothing qualifies. A player who has never
 * rebought has no rate — 0% would read as "rebought and always lost", which
 * is the opposite of what happened. The caller renders the em dash.
 *
 * Takes per-night pairs rather than a player id because every caller already
 * has them, the same reason `consistencyScore()` takes nets.
 */
export function rebuySuccessRate(
  nights: Array<{ buyInCount: number; netCents: number }>
): RebuySuccess {
  let qualifying = 0;
  let successes = 0;
  for (const night of nights) {
    if (night.buyInCount < REBUY_MIN_BUY_INS) continue;
    qualifying += 1;
    if (night.netCents > 0) successes += 1;
  }
  return {
    rate: qualifying === 0 ? null : successes / qualifying,
    successes,
    qualifying,
  };
}

/**
 * Given the list of all payouts (most-recent first or any order), return
 * the date range for the *current* (open) payout period: start exclusive,
 * end inclusive. Start is null when no payouts have happened yet.
 */
export function currentPayoutPeriod(
  payouts: Payout[],
  todayIso: string
): { startAfter: string | null; endOn: string; previousPayout: Payout | null } {
  const sorted = [...payouts].sort((a, b) =>
    b.period_end_date.localeCompare(a.period_end_date)
  );
  const previousPayout = sorted[0] ?? null;
  return {
    startAfter: previousPayout?.period_end_date ?? null,
    endOn: todayIso,
    previousPayout,
  };
}

export function lifetimeTotals(
  sessions: Session[],
  buyIns: BuyIn[],
  cashOuts: CashOut[]
): {
  sessionCount: number;
  totalPotCents: number;
  biggestWinCents: number;
  biggestWinDate: string | null;
  biggestWinPlayerId: string | null;
  // The night it happened, so the figure can link to it. Every biggest-win
  // figure is a claim about one identifiable evening; without the id the
  // dashboard can name the night but not go there.
  biggestWinSessionId: string | null;
  biggestLossCents: number;
  biggestLossDate: string | null;
  biggestLossPlayerId: string | null;
  biggestLossSessionId: string | null;
} {
  let totalPotCents = 0;
  let biggestWinCents = 0;
  let biggestWinDate: string | null = null;
  let biggestWinPlayerId: string | null = null;
  let biggestWinSessionId: string | null = null;

  let biggestLossCents = 0;
  let biggestLossDate: string | null = null;
  let biggestLossPlayerId: string | null = null;
  let biggestLossSessionId: string | null = null;

  sessions.forEach((s) => {
    const agg = aggregateSession(s, buyIns, cashOuts);
    totalPotCents += agg.totalBuyInCents;
    const playerIds = new Set([
      ...buyIns.filter((b) => b.session_id === s.id).map((b) => b.player_id),
      ...cashOuts.filter((c) => c.session_id === s.id).map((c) => c.player_id),
    ]);
    
    playerIds.forEach((pid) => {
      const buy = buyIns
        .filter((b) => b.session_id === s.id && b.player_id === pid)
        .reduce((sum, b) => sum + b.amount_cents, 0);
      const co = cashOuts.find(
        (c) => c.session_id === s.id && c.player_id === pid
      );
      const cash = co ? co.adjusted_amount_cents : 0;
      const net = cash - buy;
      
      if (net > biggestWinCents) {
        biggestWinCents = net;
        biggestWinDate = s.played_at;
        biggestWinPlayerId = pid;
        biggestWinSessionId = s.id;
      }
      if (net < biggestLossCents) {
        biggestLossCents = net;
        biggestLossDate = s.played_at;
        biggestLossPlayerId = pid;
        biggestLossSessionId = s.id;
      }
    });
  });
  return {
    sessionCount: sessions.length,
    totalPotCents,
    biggestWinCents,
    biggestWinDate,
    biggestWinPlayerId,
    biggestWinSessionId,
    biggestLossCents,
    biggestLossDate,
    biggestLossPlayerId,
    biggestLossSessionId,
  };
}

// ----- Session action score -----------------------------------------------

/**
 * Divisor turning an average per-player swing into a 0–10-ish score. $80 of
 * average swing scores 10 on its own.
 */
const ACTION_SWING_DIVISOR_USD = 8;
/** Table size above which each extra seat adds to the score. */
const ACTION_TABLE_FREE_SEATS = 4;
const ACTION_TABLE_BONUS_PER_SEAT = 0.3;
const ACTION_REBUY_BONUS_PER_PLAYER = 0.4;

/**
 * How much of a night a night was, 0–10: average per-player swing, plus a
 * bonus for a big table, plus a bonus for every player who rebought.
 *
 * Extracted 2026-09-09 from `SessionsListPage.tsx`, where it was computed
 * inline. Stage 5's session detail page needs the same figure, and two copies
 * of a formula are two formulas. The inline version carried a comment
 * pointing at `sessionScore()` in this file — a function that never existed.
 *
 * **Not money**, despite being derived from it: it is a dimensionless score,
 * so it is a float on purpose and the integer-cents rule does not apply. The
 * cents are converted to dollars once, here, and nothing downstream treats
 * the result as an amount.
 *
 * Clamped to 10 and rounded to one decimal, which means it genuinely ties —
 * three of the 24 sample nights sit at 10.0 — so any "highest action score"
 * ordering needs a tiebreak of its own.
 */
export function actionScore(
  sessionId: string,
  buyIns: BuyIn[],
  cashOuts: CashOut[]
): number {
  const sb = buyIns.filter((b) => b.session_id === sessionId);
  const sc = cashOuts.filter((c) => c.session_id === sessionId);

  // Anyone who bought in OR cashed out was at the table. Both halves, because
  // a player with a buy-in and no cash-out row is mid-entry, not absent.
  const playerIds = new Set([
    ...sb.map((b) => b.player_id),
    ...sc.map((c) => c.player_id),
  ]);

  let totalAbsCents = 0;
  let rebuyPlayerCount = 0;
  playerIds.forEach((pid) => {
    const playerBuys = sb.filter((b) => b.player_id === pid);
    const buy = playerBuys.reduce((sum, b) => sum + b.amount_cents, 0);
    const cashOut =
      sc.find((c) => c.player_id === pid)?.adjusted_amount_cents ?? 0;
    // Absolute, so a $60 loser and a $60 winner both count as action.
    totalAbsCents += Math.abs(cashOut - buy);
    if (playerBuys.length > 1) rebuyPlayerCount += 1;
  });

  const perPlayerDollars =
    playerIds.size > 0 ? totalAbsCents / playerIds.size / 100 : 0;
  const swingScore = perPlayerDollars / ACTION_SWING_DIVISOR_USD;
  const tableBonus =
    Math.max(0, playerIds.size - ACTION_TABLE_FREE_SEATS) *
    ACTION_TABLE_BONUS_PER_SEAT;
  const rebuyBonus = rebuyPlayerCount * ACTION_REBUY_BONUS_PER_PLAYER;

  return Math.max(
    0,
    Math.min(10, Math.round((swingScore + tableBonus + rebuyBonus) * 10) / 10)
  );
}
