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
 * Players sorted by net within a date window. Defaults to "last 3 months".
 */
export function seasonLeaders(
  players: Player[],
  sessions: Session[],
  buyIns: BuyIn[],
  cashOuts: CashOut[],
  windowStart: Date
): Array<{ player: Player; netCents: number; sessionsPlayed: number }> {
  const cutoff = windowStart.toISOString().slice(0, 10);
  const inWindow = sessions.filter((s) => s.played_at >= cutoff);
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
  const { stdev } = netStats(nets.map((n) => n.netCents));

  const wrSub =
    stats.sessionsPlayed === 0
      ? 0.5
      : clamp01(stats.wins / stats.sessionsPlayed);
  const consSub =
    stdev == null ? 0.5 : clamp01(1 - stdev / 100 / STDEV_FLOOR_USD);
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
        stdevCents: stdev,
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
  biggestLossCents: number;
  biggestLossDate: string | null;
  biggestLossPlayerId: string | null;
} {
  let totalPotCents = 0;
  let biggestWinCents = 0;
  let biggestWinDate: string | null = null;
  let biggestWinPlayerId: string | null = null;
  
  let biggestLossCents = 0;
  let biggestLossDate: string | null = null;
  let biggestLossPlayerId: string | null = null;

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
      }
      if (net < biggestLossCents) {
        biggestLossCents = net;
        biggestLossDate = s.played_at;
        biggestLossPlayerId = pid;
      }
    });
  });
  return {
    sessionCount: sessions.length,
    totalPotCents,
    biggestWinCents,
    biggestWinDate,
    biggestWinPlayerId,
    biggestLossCents,
    biggestLossDate,
    biggestLossPlayerId,
  };
}
