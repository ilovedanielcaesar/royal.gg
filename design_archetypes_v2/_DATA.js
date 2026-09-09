/**
 * FROZEN SAMPLE DATASET — iteration 2 of the royal.gg page redesigns.
 *
 * Every figure here is integer cents and every invariant below has been
 * verified by script. DO NOT invent, round, re-derive or "tidy" any number in
 * this file. Inline it verbatim into each v2 mock and format at render time.
 *
 * Verified invariants
 * -------------------
 *  1. The eight members' lifetime nets sum to exactly $0.00.
 *  2. The three guests' lifetime nets sum to exactly $0.00.
 *  3. Dan's 24 per-night nets sum to exactly +$412.00, 15 W / 9 L.
 *  4. Buy-in counts over 24 nights sum to 671; 671 x $40 = $26,840.00.
 *  5. Each of the last five nights conserves money exactly across every
 *     participant present, members and guests together.
 *  6. Each player's last-five-night nets sum to the canonical window total.
 *  7. The 4 Sep reported cash-outs, run through the real reconcile() in
 *     src/lib/reconcile.ts, produce the canonical adjusted cash-outs
 *     ($280.00 / $164.50 / $104.50 / $41.00) to the cent.
 *  8. Dan's stdevCents is his real sample standard deviation over the 24
 *     nets below, using the n-1 form in netStats() in src/lib/stats.ts:
 *     $43.65. The other seven are illustrative but ordered monotonically
 *     against their consistency subscore, as playerRating() implies.
 *  9. The two flagged nights carry equal and opposite discrepancies
 *     (15 May $8.00 short, 19 Jun $8.00 over), so the 24-night ledger still
 *     conserves money even though neither night does on its own.
 */

export const GROUP = {
  name: "Thursday Night",
  stakes: "$0.25 / $0.50",
  buyInCents: 4000,
  reconcileThresholdCents: 500,
  payoutReminderAfterSessions: 8,
};

/** name, rank, suit, nights, W, L, lifetime net (cents), rating, consistency subscore, stdev (cents) */
export const MEMBERS = [
  { name: "Dan Caesar",   rank: "A", suit: "spade",   nights: 24, w: 15, l:  9, lifetimeCents:  41200, rating: 8.1, consistency: 6.4, stdevCents: 4365, you: true },
  { name: "Priya Raman",  rank: "Q", suit: "heart",   nights: 22, w: 13, l:  9, lifetimeCents:  28650, rating: 7.6, consistency: 4.8, stdevCents: 5820 },
  { name: "Marcus Webb",  rank: "K", suit: "club",    nights: 19, w: 11, l:  8, lifetimeCents:  13400, rating: 6.9, consistency: 7.3, stdevCents: 3740 },
  { name: "Theo Lund",    rank: "9", suit: "spade",   nights: 18, w:  9, l:  9, lifetimeCents:      0, rating: 5.8, consistency: 8.1, stdevCents: 3120 },
  { name: "Ash Okonkwo",  rank: "7", suit: "diamond", nights: 16, w:  7, l:  9, lifetimeCents:  -7800, rating: 4.9, consistency: 5.9, stdevCents: 4780 },
  { name: "Lena Sorokin", rank: "5", suit: "heart",   nights: 21, w:  8, l: 13, lifetimeCents: -14250, rating: 4.2, consistency: 4.3, stdevCents: 6490 },
  { name: "Jonah Fitz",   rank: "J", suit: "club",    nights: 23, w:  9, l: 14, lifetimeCents: -21150, rating: 3.8, consistency: 6.8, stdevCents: 4010 },
  { name: "Rory Adeyemi", rank: "8", suit: "spade",   nights: 20, w:  7, l: 13, lifetimeCents: -40050, rating: 2.9, consistency: 3.4, stdevCents: 7850 },
];

/**
 * Per-member nets across the last five nights, in order:
 * 7 Aug, 14 Aug, 21 Aug, 28 Aug, 4 Sep. `null` = did not play.
 * Drives the League page's five-night trajectory sparkline. The sparkline is
 * sage when the row's total is positive and crimson when it is negative.
 */
export const LAST_FIVE = {
  "Dan Caesar":   [-6250,  2400,  8650, -4000,  12000], // +$128.00
  "Priya Raman":  [ 3200, -1500,  2500,  1000,   4450], //  +$96.50
  "Marcus Webb":  [ 1800,  null, -1100,  1500,   2000], //  +$42.00
  "Theo Lund":    [  600,  1200, -2000,  1250,    800], //  +$18.50
  "Ash Okonkwo":  [ null, -1200,  null,  -450,  -1450], //  −$31.00
  "Lena Sorokin": [-1600, -2200, -1250,   150,  -2550], //  −$74.50
  "Jonah Fitz":   [-3200,   900, -7250,   550,  -1800], // −$108.00
  "Rory Adeyemi": [ 5450,   400, -3450,  null,  -9550], //  −$71.50
};

/** Guests: no account, no card. A blank spade tile stands in for a card. */
export const GUESTS = [
  { name: "Mo Haddad",  nights: 1, dates: ["4 Sep 2026"],               lifetimeCents: -3900, lastSeen: "4 Sep 2026",  invitedBy: "Dan Caesar" },
  { name: "Bea Nolan",  nights: 1, dates: ["21 Aug 2026"],              lifetimeCents:  3900, lastSeen: "21 Aug 2026", invitedBy: "Priya Raman" },
  { name: "Sam Ortiz",  nights: 2, dates: ["12 Jun 2026", "3 Jul 2026"], lifetimeCents:     0, lastSeen: "3 Jul 2026",  invitedBy: "Marcus Webb" },
];

export const PAYOUT_PERIOD = {
  openedAfter: "2 Aug 2026",
  sessionsSince: 5,
  firstSession: "7 Aug 2026",
  lastSession: "4 Sep 2026",
  stillOpen: true,
};

/**
 * The 24 nights. `netSumCents` is the sum of every participant's net that
 * night: 0 on a night that reconciles, non-zero only on the two flagged ones.
 * `totalAbsCents = 2 * winnersTotalCents - netSumCents`, which is what the
 * real action score consumes.
 *
 * actionScore = clamp(0, 10,
 *   round10( (totalAbsCents / playerCount / 100) / 8
 *            + max(0, playerCount - 4) * 0.3
 *            + rebuyPlayers * 0.4 ) )
 * — transcribed from SessionsListPage.tsx. Compute it, never hardcode it.
 */
export const NIGHTS = [
  { n:  1, date: "2026-03-27", state: "reconciled", playerCount: 7, buyInCount: 26, rebuyPlayers: 5, winnersTotalCents:  9200, netSumCents:    0, yourNetCents:  4800, yourBuyIns: 2, biggestWinCents:  4800, biggestWinner: "Dan Caesar",   biggestLossCents:  -3600, note: null },
  { n:  2, date: "2026-04-03", state: "reconciled", playerCount: 6, buyInCount: 24, rebuyPlayers: 4, winnersTotalCents:  7400, netSumCents:    0, yourNetCents: -2400, yourBuyIns: 2, biggestWinCents:  4100, biggestWinner: "Priya Raman",  biggestLossCents:  -3900, note: null },
  { n:  3, date: "2026-04-10", state: "reconciled", playerCount: 7, buyInCount: 26, rebuyPlayers: 5, winnersTotalCents:  6800, netSumCents:    0, yourNetCents:  2400, yourBuyIns: 1, biggestWinCents:  3300, biggestWinner: "Marcus Webb",  biggestLossCents:  -3100, note: null },
  { n:  4, date: "2026-04-17", state: "reconciled", playerCount: 7, buyInCount: 28, rebuyPlayers: 5, winnersTotalCents: 12500, netSumCents:    0, yourNetCents:  6250, yourBuyIns: 2, biggestWinCents:  6250, biggestWinner: "Dan Caesar",   biggestLossCents:  -5800, note: "Theo's first night on the good side of it." },
  { n:  5, date: "2026-04-24", state: "reconciled", playerCount: 7, buyInCount: 25, rebuyPlayers: 4, winnersTotalCents:  6400, netSumCents:    0, yourNetCents: -1600, yourBuyIns: 1, biggestWinCents:  3900, biggestWinner: "Jonah Fitz",   biggestLossCents:  -3400, note: null },
  { n:  6, date: "2026-05-01", state: "reconciled", playerCount: 6, buyInCount: 27, rebuyPlayers: 5, winnersTotalCents:  5800, netSumCents:    0, yourNetCents:  1600, yourBuyIns: 1, biggestWinCents:  2700, biggestWinner: "Priya Raman",  biggestLossCents:  -2900, note: null },
  { n:  7, date: "2026-05-08", state: "reconciled", playerCount: 8, buyInCount: 30, rebuyPlayers: 6, winnersTotalCents: 11200, netSumCents:    0, yourNetCents:  3200, yourBuyIns: 2, biggestWinCents:  5600, biggestWinner: "Priya Raman",  biggestLossCents:  -4800, note: null },
  { n:  8, date: "2026-05-15", state: "review",     playerCount: 8, buyInCount: 34, rebuyPlayers: 7, winnersTotalCents: 30200, netSumCents: -800, yourNetCents: -5200, yourBuyIns: 3, biggestWinCents: 28600, biggestWinner: "Priya Raman",  biggestLossCents:  -9700, note: "Chips came up $8.00 short. Nobody could find it." },
  { n:  9, date: "2026-05-22", state: "reconciled", playerCount: 7, buyInCount: 27, rebuyPlayers: 5, winnersTotalCents:  8200, netSumCents:    0, yourNetCents:   900, yourBuyIns: 1, biggestWinCents:  4400, biggestWinner: "Marcus Webb",  biggestLossCents:  -3800, note: null },
  { n: 10, date: "2026-05-29", state: "reconciled", playerCount: 8, buyInCount: 29, rebuyPlayers: 6, winnersTotalCents: 13400, netSumCents:    0, yourNetCents:  5450, yourBuyIns: 2, biggestWinCents:  5450, biggestWinner: "Dan Caesar",   biggestLossCents:  -6200, note: null },
  { n: 11, date: "2026-06-05", state: "reconciled", playerCount: 7, buyInCount: 26, rebuyPlayers: 5, winnersTotalCents:  7600, netSumCents:    0, yourNetCents:  -800, yourBuyIns: 1, biggestWinCents:  4000, biggestWinner: "Theo Lund",    biggestLossCents:  -3300, note: null },
  { n: 12, date: "2026-06-12", state: "reconciled", playerCount: 8, buyInCount: 31, rebuyPlayers: 6, winnersTotalCents:  9800, netSumCents:    0, yourNetCents:  2050, yourBuyIns: 2, biggestWinCents:  4900, biggestWinner: "Priya Raman",  biggestLossCents:  -4100, note: "Sam sat in. Sam is not registered." },
  { n: 13, date: "2026-06-19", state: "review",     playerCount: 8, buyInCount: 33, rebuyPlayers: 7, winnersTotalCents: 23000, netSumCents:  800, yourNetCents:  7200, yourBuyIns: 3, biggestWinCents:  9800, biggestWinner: "Priya Raman",  biggestLossCents: -21450, note: "Rory's −$214.50. Chips came up $8.00 over." },
  { n: 14, date: "2026-06-26", state: "reconciled", playerCount: 7, buyInCount: 28, rebuyPlayers: 6, winnersTotalCents:  8600, netSumCents:    0, yourNetCents: -1250, yourBuyIns: 2, biggestWinCents:  4300, biggestWinner: "Marcus Webb",  biggestLossCents:  -3700, note: null },
  { n: 15, date: "2026-07-03", state: "reconciled", playerCount: 7, buyInCount: 26, rebuyPlayers: 5, winnersTotalCents:  7200, netSumCents:    0, yourNetCents:  1250, yourBuyIns: 1, biggestWinCents:  3600, biggestWinner: "Priya Raman",  biggestLossCents:  -3200, note: null },
  { n: 16, date: "2026-07-10", state: "reconciled", playerCount: 8, buyInCount: 30, rebuyPlayers: 6, winnersTotalCents: 11800, netSumCents:    0, yourNetCents:  3800, yourBuyIns: 2, biggestWinCents:  5100, biggestWinner: "Dan Caesar",   biggestLossCents:  -4600, note: null },
  { n: 17, date: "2026-07-17", state: "reconciled", playerCount: 7, buyInCount: 27, rebuyPlayers: 5, winnersTotalCents:  6900, netSumCents:    0, yourNetCents:  -900, yourBuyIns: 1, biggestWinCents:  3500, biggestWinner: "Theo Lund",    biggestLossCents:  -3100, note: null },
  { n: 18, date: "2026-07-24", state: "reconciled", playerCount: 8, buyInCount: 32, rebuyPlayers: 7, winnersTotalCents: 10400, netSumCents:    0, yourNetCents:  2600, yourBuyIns: 2, biggestWinCents:  4700, biggestWinner: "Priya Raman",  biggestLossCents:  -4200, note: null },
  { n: 19, date: "2026-07-31", state: "reconciled", playerCount: 7, buyInCount: 27, rebuyPlayers: 5, winnersTotalCents:  7100, netSumCents:    0, yourNetCents:  -950, yourBuyIns: 1, biggestWinCents:  3800, biggestWinner: "Marcus Webb",  biggestLossCents:  -3300, note: null },
  { n: 20, date: "2026-08-07", state: "reconciled", playerCount: 7, buyInCount: 26, rebuyPlayers: 6, winnersTotalCents: 11050, netSumCents:    0, yourNetCents: -6250, yourBuyIns: 3, biggestWinCents:  5450, biggestWinner: "Rory Adeyemi", biggestLossCents:  -6250, note: null },
  { n: 21, date: "2026-08-14", state: "reconciled", playerCount: 7, buyInCount: 24, rebuyPlayers: 5, winnersTotalCents:  4900, netSumCents:    0, yourNetCents:  2400, yourBuyIns: 2, biggestWinCents:  2400, biggestWinner: "Dan Caesar",   biggestLossCents:  -2200, note: null },
  { n: 22, date: "2026-08-21", state: "reconciled", playerCount: 8, buyInCount: 29, rebuyPlayers: 6, winnersTotalCents: 15050, netSumCents:    0, yourNetCents:  8650, yourBuyIns: 3, biggestWinCents:  8650, biggestWinner: "Dan Caesar",   biggestLossCents:  -7250, note: "Bea sat in for one. Bea is not registered." },
  { n: 23, date: "2026-08-28", state: "draft",      playerCount: 7, buyInCount: 25, rebuyPlayers: 5, winnersTotalCents:  4450, netSumCents:    0, yourNetCents: -4000, yourBuyIns: 2, biggestWinCents:  1500, biggestWinner: "Marcus Webb",  biggestLossCents:  -4000, note: "Still a draft — balanced, nobody has locked it." },
  { n: 24, date: "2026-09-04", state: "reconciled", playerCount: 9, buyInCount: 31, rebuyPlayers: 9, winnersTotalCents: 19250, netSumCents:    0, yourNetCents: 12000, yourBuyIns: 4, biggestWinCents: 12000, biggestWinner: "Dan Caesar",   biggestLossCents:  -9550, note: "Off by $4.50, distributed among the four winners." },
];

/** Who sat at each of the last five nights, for the Sessions page avatar row. */
export const ROSTERS = {
  "2026-08-07": ["Dan Caesar", "Priya Raman", "Marcus Webb", "Theo Lund", "Lena Sorokin", "Jonah Fitz", "Rory Adeyemi"],
  "2026-08-14": ["Dan Caesar", "Priya Raman", "Theo Lund", "Ash Okonkwo", "Lena Sorokin", "Jonah Fitz", "Rory Adeyemi"],
  "2026-08-21": ["Dan Caesar", "Priya Raman", "Marcus Webb", "Theo Lund", "Lena Sorokin", "Jonah Fitz", "Rory Adeyemi", "Bea Nolan"],
  "2026-08-28": ["Dan Caesar", "Priya Raman", "Marcus Webb", "Theo Lund", "Ash Okonkwo", "Lena Sorokin", "Jonah Fitz"],
  "2026-09-04": ["Dan Caesar", "Priya Raman", "Marcus Webb", "Theo Lund", "Ash Okonkwo", "Lena Sorokin", "Jonah Fitz", "Rory Adeyemi", "Mo Haddad"],
};

/**
 * The 4 Sep night in full — the subject of the individual-session page.
 *
 * `reportedCashOutCents` are what the table counted. They total $1,235.50
 * against $1,240.00 of buy-ins, so the night is $4.50 short — under the
 * $5.00 threshold, therefore distributed proportionally among the four
 * reported winners by the real algorithm, which yields exactly the
 * `adjustedCashOutCents` below. Show BOTH columns; never overwrite reported.
 */
export const SESSION_4_SEP = {
  date: "2026-09-04",
  state: "reconciled",
  approvedBy: "Dan Caesar",
  approvedAt: "5 Sep 2026",
  note: "Off by $4.50, distributed among the four winners.",
  totalBuyInCents: 124000,
  totalReportedCents: 123550,
  totalAdjustedCents: 124000,
  discrepancyCents: 450,
  needsReview: false,
  rows: [
    { name: "Dan Caesar",   buyIns: 4, buyInCents: 16000, reportedCashOutCents: 27720, adjustmentCents: 280, adjustedCashOutCents: 28000, netCents:  12000, you: true },
    { name: "Priya Raman",  buyIns: 3, buyInCents: 12000, reportedCashOutCents: 16346, adjustmentCents: 104, adjustedCashOutCents: 16450, netCents:   4450 },
    { name: "Marcus Webb",  buyIns: 3, buyInCents: 12000, reportedCashOutCents: 13953, adjustmentCents:  47, adjustedCashOutCents: 14000, netCents:   2000 },
    { name: "Theo Lund",    buyIns: 3, buyInCents: 12000, reportedCashOutCents: 12781, adjustmentCents:  19, adjustedCashOutCents: 12800, netCents:    800 },
    { name: "Ash Okonkwo",  buyIns: 4, buyInCents: 16000, reportedCashOutCents: 14550, adjustmentCents:   0, adjustedCashOutCents: 14550, netCents:  -1450 },
    { name: "Lena Sorokin", buyIns: 3, buyInCents: 12000, reportedCashOutCents:  9450, adjustmentCents:   0, adjustedCashOutCents:  9450, netCents:  -2550 },
    { name: "Jonah Fitz",   buyIns: 4, buyInCents: 16000, reportedCashOutCents: 14200, adjustmentCents:   0, adjustedCashOutCents: 14200, netCents:  -1800 },
    { name: "Rory Adeyemi", buyIns: 5, buyInCents: 20000, reportedCashOutCents: 10450, adjustmentCents:   0, adjustedCashOutCents: 10450, netCents:  -9550 },
    { name: "Mo Haddad",    buyIns: 2, buyInCents:  8000, reportedCashOutCents:  4100, adjustmentCents:   0, adjustedCashOutCents:  4100, netCents:  -3900, guest: true },
  ],
};

/** The 28 Aug draft — the editable state of the individual-session page. */
export const SESSION_28_AUG = {
  date: "2026-08-28",
  state: "draft",
  note: "Still a draft — balanced, nobody has locked it.",
  totalBuyInCents: 100000,
  totalReportedCents: 100000,
  discrepancyCents: 0,
  rows: [
    { name: "Dan Caesar",   buyIns: 2, buyInCents: 8000, reportedCashOutCents: 4000, netCents: -4000, you: true },
    { name: "Priya Raman",  buyIns: 4, buyInCents:16000, reportedCashOutCents:17000, netCents:  1000 },
    { name: "Marcus Webb",  buyIns: 3, buyInCents:12000, reportedCashOutCents:13500, netCents:  1500 },
    { name: "Theo Lund",    buyIns: 4, buyInCents:16000, reportedCashOutCents:17250, netCents:  1250 },
    { name: "Ash Okonkwo",  buyIns: 4, buyInCents:16000, reportedCashOutCents:15550, netCents:  -450 },
    { name: "Lena Sorokin", buyIns: 4, buyInCents:16000, reportedCashOutCents:16150, netCents:   150 },
    { name: "Jonah Fitz",   buyIns: 4, buyInCents:16000, reportedCashOutCents:16550, netCents:   550 },
  ],
};
