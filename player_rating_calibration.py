"""
Player rating calibration — royal.gg.

Combines four signals into a single 1–10 rating:

    1. Win rate           — wins / sessions_played                       weight 0.25
    2. Consistency        — lower stdev of session nets is better        weight 0.20
    3. Recent trend       — sum of net P/L over last 6 sessions          weight 0.20
    4. Lifetime winnings  — career net P/L                                weight 0.35

Each component is normalized to [0, 1], multiplied by its weight,
summed, then mapped to 1–10:

    rating = round(1 + 9 * sum(component_i * weight_i))

`null` when sessions_played < 3 (not enough signal).

Tweak the constants at the top, then run this file:
    python3 player_rating_calibration.py
to see how the sample players score.

The TS port lives in src/lib/stats.ts (function `playerRating`).
Keep the two in sync if you change weights or scaling.
"""

from dataclasses import dataclass
from typing import Optional

# ---------- Tunables -------------------------------------------------------

WEIGHT_WIN_RATE         = 0.25
WEIGHT_CONSISTENCY      = 0.20
WEIGHT_RECENT_TREND     = 0.20
WEIGHT_LIFETIME_WINNINGS = 0.35

# Consistency: stdev_dollars at which consistency score hits 0.
# $0 stdev → 1.0 (perfect); $STDEV_FLOOR_USD or higher → 0.0.
STDEV_FLOOR_USD = 80

# Recent trend: net P/L (in dollars) over the last 6 games at which
# trend score hits the extremes.
TREND_HALF_RANGE_USD = 50  # +$50 → 1.0, $0 → 0.5, -$50 → 0.0

# Lifetime winnings: career net (in dollars) at which the score hits the
# extremes.  +$100 → 1.0, 0 → 0.5, -$100 → 0.0.
LIFETIME_HALF_RANGE_USD = 100

MIN_SESSIONS_FOR_RATING = 3


# ---------- Math -----------------------------------------------------------

def _clamp01(x: float) -> float:
    return max(0.0, min(1.0, x))


def win_rate_score(wins: int, sessions: int) -> float:
    if sessions == 0:
        return 0.5
    return _clamp01(wins / sessions)


def consistency_score(stdev_usd: Optional[float]) -> float:
    if stdev_usd is None:
        return 0.5
    return _clamp01(1.0 - stdev_usd / STDEV_FLOOR_USD)


def recent_trend_score(last6_net_usd: float) -> float:
    return _clamp01(0.5 + last6_net_usd / (2 * TREND_HALF_RANGE_USD))


def lifetime_score(total_net_usd: float) -> float:
    return _clamp01(0.5 + total_net_usd / (2 * LIFETIME_HALF_RANGE_USD))


@dataclass
class RatingBreakdown:
    rating: Optional[float]             # 1.0..10.0 (1dp) or None if too few sessions
    win_rate_subscore: float
    consistency_subscore: float
    trend_subscore: float
    lifetime_subscore: float
    raw_score: float                    # 0..1 weighted sum


def player_rating(
    *,
    sessions_played: int,
    wins: int,
    stdev_usd: Optional[float],
    last6_net_usd: float,
    total_net_usd: float,
) -> RatingBreakdown:
    if sessions_played < MIN_SESSIONS_FOR_RATING:
        return RatingBreakdown(None, 0.0, 0.0, 0.0, 0.0, 0.0)

    wr = win_rate_score(wins, sessions_played)
    cs = consistency_score(stdev_usd)
    tr = recent_trend_score(last6_net_usd)
    lt = lifetime_score(total_net_usd)
    raw = (
        wr * WEIGHT_WIN_RATE
        + cs * WEIGHT_CONSISTENCY
        + tr * WEIGHT_RECENT_TREND
        + lt * WEIGHT_LIFETIME_WINNINGS
    )
    rating = round((1 + 9 * raw) * 10) / 10  # 1 decimal place
    return RatingBreakdown(rating, wr, cs, tr, lt, raw)


# ---------- Sample players (sanity-check the calibration) ------------------

SAMPLES = [
    # (label,                sessions, wins, stdev_usd, last6_net_usd, total_net_usd)
    ("Solid winner",         20, 13,  25,  +80,  +300),
    ("Average / break-even", 15,  7,  40,    0,     0),
    ("Losing player",        18,  5,  50,  -60,  -200),
    ("Hot but volatile",     10,  6,  70, +120,   +50),
    ("Cold but steady",      12,  3,  10,  -30,   -50),
    ("Brand new (1 game)",    1,  1,  None, +40,  +40),
    ("Brand new (2 games)",   2,  1,  20,   +5,   +5),
]

if __name__ == "__main__":
    print(f"{'Player':<28}{'Rating':>8}  WR    Cons  Trend  Life   raw")
    print("-" * 70)
    for label, sessions, wins, stdev, last6, total in SAMPLES:
        b = player_rating(
            sessions_played=sessions,
            wins=wins,
            stdev_usd=stdev,
            last6_net_usd=last6,
            total_net_usd=total,
        )
        rating_str = f"{b.rating:.1f}/10" if b.rating is not None else "—"
        print(
            f"{label:<28}{rating_str:>8}  "
            f"{b.win_rate_subscore:.2f}  "
            f"{b.consistency_subscore:.2f}  "
            f"{b.trend_subscore:.2f}  "
            f"{b.lifetime_subscore:.2f}  "
            f"{b.raw_score:.2f}"
        )
