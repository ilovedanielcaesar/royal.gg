# DESIGN.md

Visual + interaction spec for royal.gg. The current frontend is built against this doc — keep it in sync when you change either.

## Direction

**Playing-card maximalist on dark felt.** The page is the table; every primary container is a literal cream playing-card laid on it. Suits, ranks, and serif numerals are part of the language, not decoration.

## Palette

Defined as Tailwind v4 tokens in `src/index.css` under `@theme`. Reference these everywhere — don't hand-pick hex.

| Token | Hex | Use |
|---|---|---|
| `felt-900` | `#0d3324` | Page background — deep poker-table felt |
| `felt-800` | `#11402c` | Slightly darker felt accents |
| `felt-700` | `#1a5238` | Felt hover surface |
| `felt-600` | `#246b4a` | Brighter felt for nav highlights |
| `card-50` | `#f7f1de` | Card face — vintage cream/ivory |
| `card-100` | `#ece3c8` | Card edge / inner ring |
| `card-200` | `#d9cfa8` | Card divider, secondary edge |
| `ink-900` | `#1a1614` | Body text, ♠/♣ suits |
| `ink-700` | `#3a322b` | Muted ink |
| `ink-500` | `#6b5e54` | Tertiary ink |
| `crimson-700` | `#8a1620` | Error text, deep red |
| `crimson-600` | `#b21e2c` | ♥/♦ suits, losses, alerts |
| `crimson-500` | `#d23548` | Lighter crimson for hover |
| `gold-500` | `#c9a24a` | Brass detail, dividers, pending state |
| `gold-400` | `#ddbb6b` | Gold hover |
| `sage-700` / `sage-600` / `sage-500` | greens | Wins (positive net), reconciled state |
| `teal-500` | `#2c9c8e` | Winner ramp — 2nd biggest winner on the cumulative chart |
| `sky-500` | `#2a7fb8` | Winner ramp — 3rd biggest winner on the cumulative chart |
| `orange-500` | `#d97a3b` | Loser ramp — 2nd biggest loser on the cumulative chart |
| `amber-500` | `#d6a13a` | Loser ramp — 3rd biggest loser on the cumulative chart |

**Money color = financial convention, not suit color.** Wins are sage, losses are crimson — independent of a player's auto-suit so a "red-suit" player isn't visually conflated with "losing."

**Cumulative-net chart ramps.** The dashboard's cumulative chart shows only the top 3 winners and top 3 losers (by lifetime net). Lines are colored along two ramps so rank is visually obvious:

- Winners (1st → 3rd): `sage-600` → `teal-500` → `sky-500`. The biggest winner is the most saturated green; sky-blue is the third.
- Losers (1st → 3rd): `crimson-600` → `orange-500` → `amber-500`. The biggest loser is the most saturated red; amber is the third.

Because all greens/blues sit on the "winning" side and all reds/oranges sit on "losing," reading the chart never requires the legend.

## Typography

- **Display / headers / large numbers**: `DM Serif Display` (loaded from Google Fonts in `index.html`). Use via Tailwind: `font-display`.
- **Body / UI**: `Inter` (Google Fonts). Use via Tailwind: `font-sans` (default).
- **Money**: any text rendering currency adds `tabular` (defined in `index.css`) — applies `font-variant-numeric: tabular-nums` and slight tightening. Without this, columns of `$1,234.50` jitter horribly.
- **Suit pips**: `<SuitBadge>` renders SVG, never unicode (more weight control, scales cleanly).

## Card surface

Implemented in `src/components/Card.tsx`. Every primary container — sessions, players, dashboard widgets, inputs — wraps in `<Card>`.

- Cream face (`bg-card-50`), `rounded-xl`, `ring-1 ring-card-100`, layered shadow.
- Optional **accent bar** at top: `neutral`, `sage` (reconciled), `crimson` (review), `gold` (pending). 1px tall.
- Optional **rank label** at top-left (`rankLabel="K"`, `rankLabel="Apr 25"`).
- Optional **suit watermark** in bottom-right at 7% opacity.
- `interactive` prop adds hover lift + 0.4° rotation (card-being-pulled-from-hand feel). Use only on clickable cards.
- `dealIn={ms}` prop applies the `deal-in` keyframe with that delay. Stagger lists by `idx * 60`.

## Suit assignment (player identity)

`src/lib/playerSuit.ts` deterministically maps a player's UUID → `(suit, rank)`. This is their personal mark across the app — leaderboard, avatars, session participants. Stable as long as the UUID is.

`<PlayerAvatar playerId name size>` renders a small playing-card-shaped avatar with their rank, suit, and monogram.

## Motion

Restrained, all reinforcing the card metaphor.

- **Deal-in** (`var(--animate-deal-in)`): 480ms cubic-bezier from below + slight rotate. Used on first paint of card lists and dashboard widgets, staggered by 60ms per item.
- **Hover lift**: clickable `<Card interactive>` translates -1 unit Y and rotates ~0.4°.
- **No spinners.** While loading, render the page chrome with a small "Dealing…" muted-text placeholder.

## Layout & breakpoints

- Max content width: `max-w-6xl` (1152px), centered, `px-4`.
- Header is fixed-feeling but not sticky — `bg-felt-900/70 backdrop-blur` with a 1px `border-card-50/10` bottom.
- Card grids: 1col on phone → 2col `sm:` → 3col `lg:`.
- Tap targets: every interactive control is ≥ 36px tall.

## Routes

| Route | Page | Purpose |
|---|---|---|
| `/` | `DashboardPage` | Lifetime totals strip, cumulative chart, standings, recent sessions |
| `/sessions` | `SessionsListPage` | Card grid of all sessions |
| `/sessions/new` | `SessionFormPage` | Create new session |
| `/sessions/:id` | `SessionFormPage` | Same form, editing existing |
| `/players` | `PlayersPage` | Roster card grid |

## Session entry model

There is **no in-session live-tracking screen.** Sessions are entered post-game in one pass. The form has:

1. Date + notes
2. Participants table — each row: avatar, buy-in count (integer × $40), cash-out (decimal dollars), live net
3. "Add player" dropdown of remaining roster
4. Live reconcile preview strip (totals + discrepancy)
5. Save button — adapts label based on reconcile state (Save / Save flagged for review)

Buy-ins are still stored as N rows of $40 each in `buy_ins` (matches schema; allows future variable-amount rebuys without migration).

## Cumulative chart

`src/components/CumulativeChart.tsx`. Hand-rolled SVG, no chart library:

- X-axis = session ordinal (`#1`, `#2`, …) — chronological but evenly spaced regardless of date gaps.
- Y-axis = cumulative net cents per player; auto-padded; zero-line drawn in gold if zero is in range.
- One line per player, colored by suit-color (♠/♣ → ink, ♥/♦ → crimson). Player name labeled at line end.
- Hover anywhere → vertical rule + tooltip card listing top 6 players' cumulative at that session.

## Component inventory

Reusable primitives in `src/components/`:

- `Card` — the playing-card surface
- `Button` — `primary` (cream button on felt), `secondary` (felt button), `ghost`, `danger`
- `SuitBadge` — SVG suit pip
- `PlayerAvatar` — mini playing card with rank + suit + monogram
- `CurrencyInput` — right-aligned tabular dollars input with leading `$`
- `CumulativeChart` — multi-line SVG chart
- `AppLayout` — felt page chrome, header, nav
- `SetupNotice` — shown when Supabase env vars missing

## Helpers

- `lib/playerSuit.ts` — id → (suit, rank), monogram, suit-color
- `lib/stats.ts` — per-session aggregate, cumulative-by-player, leaderboard, lifetime totals, per-player stats
- `lib/reconcile.ts` — discrepancy distribution algorithm (unchanged from Phase 1)
- `lib/money.ts` — integer cents formatters
- `lib/format.ts` — date helpers
- `lib/errors.ts` — Supabase-error stringifier
- `lib/supabase.ts` — typed client; soft-fails when env vars missing

## What's intentionally NOT here

- No in-session live tracker (post-game entry only)
- No chart library dependency
- No state management library (per-page `useEffect` + `useMemo` is sufficient)
- No themes / light mode (dark felt is the theme)
