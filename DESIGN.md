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

## Suit assignment (player display)

`src/lib/playerSuit.ts` deterministically maps a player's UUID → `(suit, rank)`. That's the fallback for anyone who hasn't picked; a player who has picked gets `chosen_suit` / `chosen_rank` off their roster row. Stable as long as the UUID is.

**A card is decoration, not an identifier.** Migration `0019_card_not_unique.sql` dropped `players_group_card_unique`, so two people in the same group may both hold A♠ — a card is how someone likes to see themselves, not a seat number. The consequence is a rule: **every card is rendered with a name beside it.** A bare `<PlayerAvatar>` identifies nobody. The one exception is `UserMenu`, where the avatar is the signed-in user's own and its label is only hidden below `sm:`.

`<PlayerAvatar player size>` renders a small playing-card-shaped avatar with their rank, suit, and monogram.

`<SuitRankPicker suit rank onChange>` is how a card gets picked: a row of four suits and a row of thirteen ranks, chosen independently. It was a 4 × 13 grid of all 52 cards while uniqueness stood, because it had to grey out claimed ones; nothing is claimed now, so 52 targets became 17.

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
| `/` | `DashboardPage` | Hero, recent five, trajectory chart, standings + stats panel — see Dashboard layout |
| `/sessions` | `SessionsListPage` | Card grid of all sessions |
| `/sessions/new` | `SessionFormPage` | Create new session |
| `/sessions/:id` | `SessionFormPage` | Same form, editing existing |
| `/players` | `PlayersPage` | Roster card grid |
| `/settings` | `GroupSettingsPage` | League settings. Member-reachable, read-only for members |
| `/members` | `GroupMembersPage` | Approve and manage members. **Admin-only** |

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
- One line per player. Color comes from the caller's `colorOf(playerId)` — the dashboard passes the winner/loser ramps described under Palette. Suit-color (♠/♣ → ink, ♥/♦ → crimson) is only the fallback when `colorOf` is omitted. Player name labeled at line end.
- Hover anywhere → vertical rule + tooltip card listing top 6 players' cumulative at that session.

## Dashboard layout

Settled 2026-09-08, reconciling `design_archetypes/dashboard_redesign.html` against
`design_archetypes/dashboard_overhaul_artifact.html`. The artifact won almost
everywhere; the exceptions are noted inline.

Actions live **outside** the sheet, in the page heading on felt: `Settings` and
`+ New session`. The sheet itself is a record of results and holds no controls
except its own tabs. `Settings` navigates to the existing `GroupSettingsPage` —
the dashboard never duplicates settings content.

One cream sheet, five bands, in order:

### 1. Hero — numbers only

`Your lifetime net`, the figure at display scale, then a gold streak pill, then
two mini-stats and a link to your profile.

- **No chart in the hero.** The page draws your cumulative net exactly once, in
  band 3 below. The artifact had a compact sparkline here as well; two renderings of
  one metric on one page is a redundancy, and dropping it lets band 3 be larger.
- **Streak pill** (`3 of your last 4 nights up`) is the one piece of derived
  commentary on the page. Gold pill, `gold-500` at 16% on cream. It is a local
  template over `playerSessionNets()` — no API, no LLM, no extra query.
- Mini-stats: win rate, nights played. Both from `playerStats()`.

### 2. Recent five

Five compact chips across the sheet — date, net, `Win`/`Loss` — and
`All your sessions →`. Scannable; no per-session detail.

The redesign proposed a single "last night" card instead (buy-ins, cash-out,
table pot, reconciled flag). Rejected: five outcomes at a glance beats one
night in depth, and the depth already exists on the session page.

### 3. Your trajectory

One chart, larger than the artifact's, with a two-tab segmented control.

- The tabs switch **subject, not time window**: `You` draws your cumulative net,
  `League` overlays the top-3 winners and top-3 losers with a legend, using the
  ramps defined under Palette above.
- The redesign's `All time / Season / Last 10` control is **not** used. It
  switches time window, which requires a "season" concept the app does not have.

### 4. Last five games

Winners and losers over the **last five group sessions** — three each side, the
existing `<SeasonLeaders>` component with a new window.

- The window is **five sessions, not three months.** `seasonLeaders()` takes a
  `windowStart: Date` and `SeasonLeaders` computes it from a `monthsBack` prop
  defaulting to 3. Both change to a session count: take the five most recent
  `played_at` values and filter on those, so the window is stable whether the
  group played weekly or took a month off.
- **The window counts group sessions, not the player's.** Someone who showed up
  for one of the last five appears with a one-night sample, which is not form.
  Each row therefore carries `n of 5` beside the net, so a small sample reads as
  one.
- **It is labelled "Last five games", not "Season standings."** The app has no
  season — nothing defines when one starts or ends, and the word invited exactly
  the goal-bar feature cut above. Five games is a fact the data already knows.
  `seasonLeaders()` keeps its name; only the heading changes.

Placed directly above At the table so the two league views sit together: recent
form, then the lifetime record.

### 5. At the table + stats panel

Two columns: standings on the left, a stats panel on the right.

- **Every player is listed**, each row with an 8-point sparkline. This is the
  one place the redesign beat the artifact, which elided the middle of the
  table. Consequence: the band has no fixed height and grows with the roster.
- **Your own row gets a faint `card-100` tint and no label.** Your card avatar
  already identifies you; the redesign's inverted felt row and gold `YOU` tag
  were both louder than the sheet wants.
- The right panel holds the **stats** — biggest win, biggest loss, nights
  played, table volume. There is therefore **no separate footer stat row**; the
  artifact's group blurb ("the full table is one click away…") is dropped as it
  only restated the list beside it.
- The panel's contents are **top-aligned, not stretched.** The list outgrows the
  panel as players are added, and whitespace below four stats is the correct
  answer to that, not four stats spread over 700px.

### Role behavior

The dashboard is identical for admins and members. The difference lives on the
settings page it links to:

- `/g/:slug/settings` is **member-reachable, read-only for members.** All four
  sections are visible to them — join code, join policy, stakes + default
  buy-in, reconcile threshold. Seeing the reconcile threshold is what explains
  why a session got flagged for review.
- Hidden from members: the **regenerate-code** button, and the "approve pending
  requests on the members page" link — it points somewhere they cannot go.
- `/g/:slug/members` **stays admin-only.** Members invite; they do not approve.
- Member invites mean the **standing `groups.join_code`** and its `/join/CODE`
  link. `group_invites` (expiring, limited-use tokens) remains admin-only with
  no select policy, per `0010_group_join.sql:12` — that decision is untouched.

No migration is needed for any of this. `groups_select`
(`0015_rls_isolation.sql:148`) already lets a member read `join_code` and
`join_policy` off their own group row, and `groups_write_admin` already blocks
their writes server-side — so the read-only UI is enforced by the database, not
merely by hiding buttons. The only backend change is dropping
`RequireGroupAdmin` from the `settings` route in `src/App.tsx`.

### Streak-pill copy rules

Two cases beyond the happy path, both reachable:

- **Fewer than 4 nights played** — no pill at all. Don't count out of a window
  that hasn't filled.
- **0 of the last 4 up** — flip the framing to `3 of your last 4 nights down`
  rather than render `0 of your last 4 nights up`, which reads as a taunt.

## Component inventory

Reusable primitives in `src/components/`:

- `Card` — the playing-card surface
- `Button` — `primary` (cream button on felt), `secondary` (felt button), `ghost`, `danger`
- `SuitBadge` — SVG suit pip
- `PlayerAvatar` — mini playing card with rank + suit + monogram
- `CurrencyInput` — right-aligned tabular dollars input with leading `$`
- `CumulativeChart` — multi-line SVG chart
- `SuitRankPicker` — suit row + rank row for choosing your card
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

## Quality-of-life backlog

Raised 2026-09-08. Items 2, 3, 5 and 7 are done; the rest are not built.
Recorded here so the reasoning survives;
each entry names what's in the way, because most of these are cheaper or dearer
than they look. Not ordered by priority.

**1. Only actual members in the all-time standings.**
`leaderboard()` maps over whatever `players` array it is handed, and
`DashboardPage` hands it all of them — so guest rows (`is_guest`) and
`pending`/`rejected` roster rows rank alongside real members. Needs a decision
before it can be built: "member" could mean `status = 'active'`, or
`profile_id is not null` (has an account), or `not is_guest`. These differ. A
guest who played six nights and won is a real result; a `pending` row that has
never played is noise. Likely answer is `status = 'active'` **and** the row has
played at least one session, with guests kept — but that is a call, not a
cleanup. Whatever is chosen applies to the Last five games band too.

**2. Season standings should be the last 5 games.** Settled and folded into
the Dashboard layout section above as band 4.

**3. Payout period says "ending today" when it isn't.** Done, 2026-09-08.
`PlayersPage` appended the literal `" · ending today"` unconditionally, which
was true only if a payout got settled the same day it was read. The period has
no end date until someone settles it — `currentPayoutPeriod()` returns
`endOn: todayIso` because "now" is the only sensible upper bound on an open
period, not because the period ends today. It now reads
`Since 2 Aug · 6 sessions · still open`, or `· no sessions yet` when empty.
The count uses the same window predicate as `periodNets()`, so the number of
games and the money below it always describe the same set. Closed periods keep
their real date range on `RecordsPage`.

**4. A session should be editable until it is approved, not until it is
submitted.**
The most expensive item here, and it contradicts a written decision.
`GROUPS.md` §5 states `submitted  locked to members` in the lifecycle diagram,
and `sessions_update_draft` (`0016_game_log_states.sql:137`) enforces it with
`using (is_group_member(group_id) and status = 'draft')`. Admins already have
the wider window via `sessions_admin_review`, which allows `draft` **and**
`submitted`.

Doing this means a migration widening that member policy to
`status in ('draft','submitted')`, the same widening on the `buy_ins` and
`cash_outs` write policies (`0016:188` onward — the money rows have to follow
the header or the change is cosmetic), and an amendment to `GROUPS.md` §5 so
the diagram stops describing the old rule. Two open questions first: may *any*
member edit a submitted log, or only whoever submitted it; and does an edit
after submission bounce the log back to `draft` so the admin re-reviews, or
land silently under a submission that has already been read? Sending it back to
`draft` is the safer default — it keeps "submitted" meaning "these numbers are
the ones I reviewed."

**5. A profile card need not be unique within a league.** Done, 2026-09-08,
in `0019_card_not_unique.sql` — it drops `players_group_card_unique`. Three
things went with it: the `taken` snapshot the picker used to grey out claimed
cards, the `isCardTaken()` 23505 translator in `MyGroupProfilePage` (the claim
was racy — two people setting up at once both saw the same card free), and one
assertion in `scripts/smoke-3c2.mjs`, which checked that all three
group-scoped indexes survive and now checks the remaining two plus the card
index's absence.

`players_group_name_unique` and `players_group_profile_unique` deliberately
stand: a name still identifies a person within a group, and one account still
holds at most one roster row per group. All twelve `PlayerAvatar` call sites
were checked and already render a name beside the card, so nothing became
ambiguous — see the rule under Suit assignment.

**6. Merge the "you" and profile pages.**
`MyGroupProfilePage` (197 lines, per-group: card pick, display name) and
`ProfilePage` (188 lines, account-level) are separate pages that read as the
same page to anyone using the app. Follows naturally from item 5 — once the
card is not a scarce leaguewide resource, picking one is a personal setting
rather than a claim against the group. Blocked on the open question already
logged at `GROUPS.md` §11: whether `/profile` shows cross-group or strictly
per-group figures. Decision 1 makes stats per-group, and different stakes don't
sum honestly, so a merged page needs to decide what it shows when someone
belongs to two groups.

**7. The card selection panel is too big.** Done, 2026-09-08, alongside item 5
as predicted — the 4 × 13 grid of all 52 cards existed only to grey out
claimed ones. It is now a row of four suits and a row of thirteen ranks,
picked independently: 17 targets instead of 52, and every control clears the
36px minimum from Layout & breakpoints.

One detail worth keeping: the selected *suit* chip stays on a light ground and
marks itself with a `ring-2 ring-sage-600` rather than filling with sage, the
way the rank buttons do. `SuitBadge` hard-codes its pip fill by suit
(`crimson-600` or `ink-900`), so a sage fill would put an ink-900 spade on
green.

## What's intentionally NOT here

- No in-session live tracker (post-game entry only)
- No chart library dependency
- No state management library (per-page `useEffect` + `useMemo` is sufficient)
- No themes / light mode (dark felt is the theme)

Considered for the dashboard on 2026-09-08 and deliberately cut. All of these
appear in `design_archetypes/dashboard_redesign.html`; none of them ship:

- **No season-goal progress bar.** Requires a per-player target and a
  definition of "season," neither of which exists. The Last five games band is
  a different thing and does ship — it windows by session count, not by season.
- **No settle-up / transfer list on the dashboard.** Settling stays on its own
  surface; the dashboard is a record, not a ledger.
- **No next-game tile or RSVP.** Scheduling and attendance are a feature in
  their own right, not part of a redesign. The group knows it's the weekend.
- **No "last night" detail card.** Superseded by Recent five; the depth lives
  on the session page.
- **No prose commentary in the hero.** The streak pill is the only derived
  sentence. In particular, no ranking claim ("the best mark at the table") —
  it is false on a tie and absurd on a one-night guest, and guarding it means
  picking a minimum-nights floor for a line nobody asked for.
- **No "Add a guest player" button on the dashboard.** Roster management
  belongs with the roster.
