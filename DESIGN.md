# DESIGN.md

Visual + interaction spec for royal.gg, and **the binding style guide every
page follows**. The frontend is built against this doc — keep it in sync when
you change either.

Three documents, and they do not overlap:

- **This file** is the app-level guide. Which React primitive goes on which
  surface, what a page is made of, and the per-page conformance table. It is
  what you read before touching a page.
- **`design_archetypes/_STYLE_CONTRACT.md`** is the mock-level contract: the
  hexes, the raw CSS, the sample league. It is the source of truth for any
  *value*. Copy tokens from it verbatim; never hand-pick a hex. This file
  never contradicts it — where a rule here looks new, it is that contract's
  rule expressed in components.
- **`design_archetypes_v2/_FEEDBACK_V2.md`** is the band-by-band brief for
  League, Sessions, Profile and Session detail.

`REDESIGN.md` is the *state* — where the work has got to. If it disagrees with
this file about what a page should look like, this file wins and `REDESIGN.md`
is stale.

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

## Surfaces — Sheet, Card, felt

Three surfaces, and choosing between them is the single most common styling
decision in the app. Get this one right and most of the rest follows.

### The felt

The page background is the table. It holds the chrome, the `PageHeading`, and
anything secondary that sits *below* the sheet. Text on felt is `card-50`, or
`card-50/60` when muted. **No ink token is ever legible on felt** — `ink-900`
is `#1a1614` on `#0d3324`, and `crimson-700` measures 1.5:1.

### The Sheet — `src/components/Sheet.tsx`

**One cream playing-card per page, divided into `Band`s by hairline rules.**
This is the central move of the redesign and it replaced a scattered grid of
small `Card`s. There is exactly one `Sheet` per page. If a second one is going
in, another `Band` in the first is the answer instead.

A `Band` (`src/components/Band.tsx`) takes `kicker` / `title` / `caption` /
`action` and renders the contract's band head for you. Don't hand-roll an
`<h2>` inside a sheet — `Band` owns that typography.

### The Card — `src/components/Card.tsx`

`Card` is **not** deleted and it is not deprecated. It is the right primitive
for a **small standalone tile in a grid** — a group tile on `/groups`, a
session tile — and the wrong one for a page body. The test is whether there
are several of them side by side: one `Card` alone on a page should have been
a `Sheet`.

- Cream face (`bg-card-50`), `rounded-xl`, `ring-1 ring-card-100`, layered shadow.
- Optional **accent bar** at top: `neutral`, `sage` (reconciled), `crimson` (review), `gold` (pending). 1px tall.
- Optional **rank label** at top-left (`rankLabel="K"`, `rankLabel="Apr 25"`).
- Optional **suit watermark** in bottom-right at 7% opacity.
- `interactive` prop adds hover lift + 0.4° rotation (card-being-pulled-from-hand feel). Use only on clickable cards.
- `dealIn={ms}` prop applies the `deal-in` keyframe with that delay. Stagger lists by `idx * 60`.

Both `Sheet` and `Card` set `data-cream`, which is what swaps the focus ring
to a readable gold. A hand-rolled cream surface that forgets it gets an
invisible focus ring — which is most of why hand-rolled cream surfaces are
not allowed.

## Suit assignment (player display)

`src/lib/playerSuit.ts` deterministically maps a player's UUID → `(suit, rank)`. That's the fallback for anyone who hasn't picked; a player who has picked gets `chosen_suit` / `chosen_rank` off their roster row. Stable as long as the UUID is.

**A card is decoration, not an identifier.** Migration `0019_card_not_unique.sql` dropped `players_group_card_unique`, so two people in the same group may both hold A♠ — a card is how someone likes to see themselves, not a seat number. The consequence is a rule: **every card is rendered with a name beside it.** A bare `<PlayerAvatar>` identifies nobody. The one exception is `UserMenu`, where the avatar is the signed-in user's own and its label is only hidden below `sm:`.

`<PlayerAvatar player size>` renders a small playing-card-shaped avatar with their rank, suit, and monogram.

`<SuitRankPicker suit rank onChange>` is how a card gets picked: a row of four suits and a row of thirteen ranks, chosen independently. It was a 4 × 13 grid of all 52 cards while uniqueness stood, because it had to grey out claimed ones; nothing is claimed now, so 52 targets became 17.

## Motion

Restrained, all reinforcing the card metaphor.

- **Deal-in** (`var(--animate-deal-in)`): 480ms cubic-bezier from below + slight rotate. Used on first paint of card lists and dashboard widgets, staggered by 60ms per item.
- **Hover lift**: clickable `<Card interactive>` translates -1 unit Y and rotates ~0.4°.
- **No spinners.** While loading, render the page chrome with a small "Dealing…" muted-text placeholder — `LoadingState`. See States above for which tone and which sentence.

## Layout & breakpoints

- Content width is `w-[min(1152px,calc(100%-32px))]`, centred — defined once as
  `WRAP` in `AppLayout`. **Not** `max-w-6xl px-4`: with padding the content
  narrows to 1120px on a wide screen, and 1152px is the content width, not the
  frame. The gutter belongs inside the calc so it only exists when the viewport
  is actually narrow.
- The breakpoint is **720px**, not Tailwind's `sm`. The contract breaks the
  nav, the band padding and the `h1` size at one width and they have to agree,
  so band-level responsive rules are written `max-[720px]:`.
- Header is fixed-feeling but not sticky — `bg-felt-900/[0.76] backdrop-blur-[14px]`
  with a 1px `border-card-50/10` bottom.
- Card grids: 1col on phone → 2col `sm:` → 3col `lg:`.
- Tap targets: every interactive control is ≥ 36px tall.

## Page anatomy — what every page is made of

Every page is the same four things in the same order. This is the shape Stage A
checks for, and a page that does not have it is not in the new style no matter
how good its colours are.

```
<PageHeading title actions={<FeltButton/>} />   ← on the felt
<Sheet>
  <Band title caption action>…</Band>           ← one sheet, N bands
  <Band>…</Band>
</Sheet>
{secondary notes}                               ← on the felt, BELOW the sheet
```

1. **The heading is a `PageHeading`, on the felt, outside the sheet.** Not an
   `<h1>` inside a card, and not a hand-rolled `font-display text-4xl` — the
   scale is 40px, dropping to 32px under 720px, and `PageHeading` is the only
   thing that knows that.
2. **The body is one `Sheet` divided into `Band`s.** Not a stack of `Card`s.
3. **Page actions live in the heading, never in the sheet.** The sheet is a
   record of results and holds no controls except its own tabs. The one bend:
   a *per-row* action — a Revert on one payout, an Add guest on one band — has
   nowhere else to go and sits in that band's `action` slot. The rule is about
   page-level controls.
4. **Anything secondary goes below the sheet, on the felt.** Footnotes, cut
   lists, a hairline grid of small notes.

### Which button

| Where | Primitive | Why |
|---|---|---|
| In a `PageHeading`, on felt | `FeltButton` | Sized and coloured for cream-on-felt; 40px tall |
| Inside a `Sheet` or `Card` | `Button` | Sized and coloured for ink-on-cream |
| A destructive action, anywhere | `ConfirmButton` | Arms in place. **Never `window.confirm`** |
| A quiet button inside a sheet | `Button variant="subtle"` | — |

**`Button variant="ghost"` is felt-only.** Its text is `card-50`, so inside a
sheet it is cream on cream and vanishes. And a ghost button that *is* on the
felt is still usually wrong, because a page-level action on the felt should be
a `FeltButton variant="ghost"` — bigger, and the thing `PageHeading` expects.

### A felt-level `<h2>` is a smell

A section heading sitting on the felt almost always means a page that should be
one `Sheet` with several `Band`s has become several loose containers instead.
Before styling it, ask whether the sections are bands. They usually are.

The contract *does* allow felt-level section headings — gold serif numerals, or
a gold letterspaced eyebrow — but only for a page with **more than one sheet**,
which no page in this app currently has.

## States — loading, error, empty, refusal

Four states, three primitives, and a rule for each. They were hand-written at
thirty-odd call sites before Stage A and had drifted into six variants.

### Loading — `LoadingState`

**No spinners** (contract rule 6). The chrome stays and a muted line says the
cards are coming.

```tsx
<LoadingState tone="felt" label="Dealing in…" full />   // a whole route waiting
<LoadingState tone="felt" />                            // page data, on felt
<LoadingState />                                        // one band's data, on cream
```

- `tone="felt"` is `card-50/60`; `tone="cream"` (the default) is `ink-500`.
  Getting this wrong is not a nuance — ink on felt is invisible.
- `full` gives it the vertical space a page occupies. Without it a route-level
  state renders as one small line jammed under the chrome, which is exactly how
  the route guards looked before Stage A.
- **Two sentences, one rule.** `Dealing…` means the data is coming. `Dealing
  in…` means *you* are being seated — route guards only, where what is
  resolving is your identity or your membership, not the group's money.

### Error — `ErrorNote`

```tsx
<ErrorNote>{message}</ErrorNote>                  // inside a Sheet or Card
<ErrorNote tone="felt">{message}</ErrorNote>      // out on the table
```

The felt tone is a contrast fix, not a preference. The cream banner is
`crimson-700` on a `crimson-500/10` ground, which is correct on cream and
**1.5:1 on felt** — an error message nobody can read. On felt the crimson moves
into the ground and the ring and the text goes cream, the same trade `GoldPill`
makes for the same reason.

### Empty

An empty state is a `Band` with a title that says what is missing and one
sentence saying where the thing comes from. It is not a loading state, not a
crimson note, and not blank. `RecordsPage`'s "No payouts yet" is the model.

### Refusal

A refusal — not found, not a member, not an admin — is a **page**, not a
notice: a `PageHeading` saying what happened, and a `Sheet` with one `Band`
explaining it and offering the way out. Not a bare `Card` with red text.

## Colour rules in practice

The palette above is the vocabulary; these are the four places it gets misused.

**1. Sage and crimson mean money. Nothing else.**
Money tone comes from `moneyToneClass(cents)` — never a hand-written ternary.
Any figure that is *not* money — a rating, an action score, a count, a rank —
stays `ink-900`. A sage-tinted score reads as a dollar amount.

**A link is not money.** `text-sage-700 underline` was the app's de-facto link
style at eight call sites, which puts "winnings green" on a word that is not a
number. The link style on cream is the contract's `.link`: `ink-500`, going
`ink-900` and underlined on hover.

**2. Money is formatted, never built.**
`formatCents` / `formatSignedCents` from `lib/money.ts`, at all 39 call sites.
They emit U+2212 MINUS, not a hyphen, because a hyphen is narrower than a digit
and a `.tabular` column of money goes ragged without it. A `-$40` written into
a string literal sits visibly out of line beside a real one.

**3. The focus ring is not yours to set.**
`index.css` draws a gold `:focus-visible` outline globally and swaps it to
`gold-ink` under `[data-cream]`, because `gold-500` on `card-50` is ~2.1:1 and
`gold-ink` is 5.4:1. **Never write `focus:outline-none`.** Eleven inputs
overrode the global rule with `focus:ring-gold-500` — reinstating, on cream,
the exact pairing the global rule exists to avoid — and six more replaced the
outline with a sage border tint, which is no visible focus at all.

**4. Gold has two tokens and they are not interchangeable.**
`gold-500` for fills and rules **on felt**; `gold-ink` for gold that has to
read **as text on cream**. `GoldPill` picks correctly from its `tone`; use it
rather than rolling `bg-gold-500/20` by hand.

## Forms

One shape, built from two primitives:

```tsx
<Field label="Group name" hint={`URL: /g/${slug}`}>
  <TextInput value={name} onChange={…} placeholder="Friday Night Poker" />
</Field>
```

- `Field` owns the label and hint typography and wraps its control in a
  `<label>`, so there is no id to invent.
- `TextInput` sets **no focus styling**, deliberately — see colour rule 3.
- `CurrencyInput` is the money field: right-aligned, `tabular`, leading `$`.
  Money in, integer cents out via `parseDollarsToCents`.
- Validation errors go in an `ErrorNote` at the foot of the form, not beside
  the field.

## Routes

Every route renders inside `AppLayout`, so the chrome and the felt are always
there — including the loading and refusal states. Group-scoped routes are
prefixed `/g/:slug` and reach `useGroup()`; the rest are account-level.

| Route | Page | Purpose |
|---|---|---|
| `/` | `IndexRoute` | Login for guests; redirect to your group once signed in |
| `/login`, `/signup` | `LoginPage`, `SignupPage` | The door |
| `/join`, `/join/:code` | `JoinPage` | Redeem a join code |
| `/groups` | `GroupsPage` | Your tables. Empty state is onboarding |
| `/groups/new` | `CreateGroupPage` | Create a table and set its defaults |
| `/profile` | `ProfilePage` | Account-level settings |
| `/admin` | `AdminOverviewPage` | Accounts, groups, memberships. **App-owner only**. Never shows money |
| `/g/:slug` | `DashboardPage` | Hero, recent five, trajectory, standings, seasonal leaders |
| `/g/:slug/sessions` | `SessionsListPage` | Every night, newest first |
| `/g/:slug/sessions/new`, `/g/:slug/sessions/:id` | `SessionFormPage` | Post-game entry and the session record |
| `/g/:slug/league` | `LeaguePage` | Standings, payout, guests, rules, export |
| `/g/:slug/players/:id` | `PlayerProfilePage` | One player's track record |
| `/g/:slug/players/:id/rating` | `PlayerRatingPage` | How that rating was computed |
| `/g/:slug/records` | `RecordsPage` | Every payout that has ever settled |
| `/g/:slug/profile` | `MyGroupProfilePage` | Your card and name in this group |
| `/g/:slug/settings` | `GroupSettingsPage` | Table settings. Member-reachable, **read-only for members** |
| `/g/:slug/members` | `GroupMembersPage` | Approve and manage members. **Admin-only** |

`/g/:slug/players` redirects to `league`.

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

Settled 2026-09-08 by reconciling `design_archetypes/dashboard_redesign.html`
against `design_archetypes/dashboard_overhaul_artifact.html`, and revised
2026-09-09 after a pass over the preview. The artifact won almost everywhere;
the exceptions are noted inline.

The page heading on felt reads `Dashboard`, subtitled **`Welcome back, <name>.`**
— the display name off the player's roster row, the same one `PlayerAvatar`
labels. It is the one place on the page that addresses the reader directly, so
it replaces the descriptive tagline the archetypes carried there.

Actions live **outside** the sheet, in that same heading: `Settings` and
`+ New session`. The sheet itself is a record of results and holds no controls
except its own tabs. `Settings` navigates to the existing `GroupSettingsPage` —
the dashboard never duplicates settings content.

One cream sheet, five bands, in order — hero, recent five, trajectory,
standings, seasonal leaders:

### 1. Hero — numbers only

Four figures, one of them the headline: **your player score at display scale**,
then a gold streak pill, then wins, losses and lifetime net as three smaller
mini-stats.

- **The score is the headline**, from `playerRating()` — the 1–10 figure with
  `/10` set small in `ink-500` beside it, the same treatment `PlayerRatingPage`
  already uses. The hero's link is `Open profile →`, going to the player's own
  profile rather than to the rating explainer: the hero is about the player,
  and the profile is where the rest of their record lives. `PlayerHeroBand`
  there already carries a `ratingHref`, so the explainer is one hop further on
  for anyone who wants it.
- **The score is not money, so it is `ink-900`, not sage.** Sage and crimson
  mean won and lost (see Palette); a rating tinted sage would read as a
  positive dollar figure. Lifetime net keeps its money color in the mini-stats.
- **Mini-stats: wins, losses, lifetime net**, all from `playerStats()`. Wins
  and losses are shown rather than win rate — 15 and 9 carry the sample size
  that 62.5% hides, and nights played is their sum, so it needs no tile.
  They render at `MiniStat`'s **`lg`** size (28px figure, 11px label), added
  2026-09-09 after a browser pass: at the default `md` the trio read too quiet
  beside the 52px score. `lg` exists for this band only — every other
  `MiniStat` on the page keeps `md`.
- **Null score.** `playerRating()` returns null below `RATING_MIN_SESSIONS`
  (3). Then the headline is `—` with `Need 3+ sessions for a rating.` beneath;
  the three mini-stats still render.
- **No chart in the hero.** The page draws your cumulative net exactly once, in
  band 3 below. The artifact had a compact sparkline here as well; two renderings of
  one metric on one page is a redundancy, and dropping it lets band 3 be larger.
- **Streak pill** (`3 of your last 4 nights up`) is the one piece of derived
  commentary on the page. Gold pill, `gold-500` at 16% on cream. It is a local
  template over `playerSessionNets()` — no API, no LLM, no extra query.

### 2. Recent five

Five compact chips across the sheet — date, net, `Win`/`Loss` — and
`All sessions →`. Scannable; no per-session detail.

The redesign proposed a single "last night" card instead (buy-ins, cash-out,
table pot, reconciled flag). Rejected: five outcomes at a glance beats one
night in depth, and the depth already exists on the session page.

### 3. Your trajectory

One chart, larger than the artifact's, with a two-tab segmented control.

- The tabs switch **subject, not time window**: `You` draws your cumulative net,
  `League` overlays the top-3 winners and top-3 losers with a legend, using the
  ramps defined under Palette above.
- **Hover snaps to a session column and marks that game on every line.** A
  vertical `ink-500` rule at 28% plus one dot per series — `r=3.4` in the
  series color with a cream stroke, over a soft `r=6.5` halo — matching what
  `CumulativeChart` already does with `hoveredCol`. Not per-vertex hit
  targets: at 24 points across 900 units they are fiddly to hit, and on the
  League view a single vertex can only ever report one of six players, whereas
  the column says what that night did to everybody.
- **The tooltip answers what the vertex is for.** On `You`, the cumulative
  figure as the headline and *that night's own net* beneath it — the line plots
  cumulative, so the night's result is the difference from the night before,
  and it is the thing you hover a point to find out. On `League`, all six
  players with their swatches, **ordered by their standing on that night, not
  today's** — the point of hovering an old game is seeing who was ahead then.
- **Both views share one y-axis.** The domain is computed once, across every
  series in both views, and neither view narrows it to its own data. Switching
  tabs must not move the gridlines, the zero line or the money labels — an axis
  that jumps makes the two views unreadable against each other and turns the
  toggle into a different chart rather than the same chart filtered. The cost
  is real and accepted: a single player's line uses only part of the height,
  since the domain has to hold the biggest winner and the biggest loser at
  once.
- **The `You` line is `ink-900`, always.** It is one line about one player,
  and it carries no money tone: the chart's default is suit-derived, which drew
  a red line for anyone holding a red card and read as "you are losing" — the
  suit means nothing here. Sage was rejected for the mirror-image reason, since
  a green line trending down says the opposite of what it means. The zero line
  and the axis already say which side of even you are on. The League view keeps
  its six ramp colours, and `CumulativeChart`'s suit fallback is untouched for
  the pages that want it.
- **Hovering a legend name emphasises that line** (League view only). The
  hovered series goes to `strokeWidth` 3 and every other drops to 22% opacity —
  line, end label and hover dot together, since six lines crossing one column
  cannot otherwise be told apart. The legend entries are buttons, not labels,
  so focus does the same thing as hover and the band is usable from the
  keyboard. Hover and focus only: **no click-to-pin**, which would need a
  visible selected state and an obvious way out of it. Dimming is suppressed
  when the emphasised player has no plotted line, so a legend entry that
  outlives its series cannot fade the whole chart.
- The redesign's `All time / Season / Last 10` control is **not** used. It
  switches time window, which requires a "season" concept the app does not have.

### 4. Standings + stats panel

Two columns: standings on the left, a stats panel on the right.

- **Ranking-eligible members are listed**, each row with an 8-point sparkline,
  and none of them elided — the redesign beat the artifact here, which cut the
  middle out of the table. Consequence: the band has no fixed height and grows
  with the roster.

  Eligibility is `isRankingEligible()`: active, not a guest, three or more
  lifetime nights. **Revised 2026-09-09** — the band listed everyone who had
  played, on the argument that it was "who was at the table" rather than a
  ranking. It is numbered and sorted by lifetime net, so it read as a ranking
  whatever the caption said, and a guest who turned up once outranking a
  regular is the thing that makes standings meaningless. It is now titled
  `Standings`, captioned `Lifetime · members with 3+ nights`, and obeys the
  same rule as band 5 and the chart's League view — one filter, three
  consumers.

  **Guest money is untouched by this.** Guests stay in session totals, in
  reconciliation, in `lifetimeTotals`, in the records panel beside this list
  and in every chart. They are excluded from the *ranking*, not from the
  record; the League page's guest band (`_FEEDBACK_V2.md` → League item 4) is
  where an excluded player stays visible. The empty state says
  `No one has three nights yet.` rather than anything about the roster, because
  a filtered list going empty says nothing about who is on it.
- **Your own row gets a faint `card-100` tint and no label.** Your card avatar
  already identifies you; the redesign's inverted felt row and gold `YOU` tag
  were both louder than the sheet wants.
- The right panel holds the **stats** — biggest win, biggest loss, nights
  played, table volume. There is therefore **no separate footer stat row**; the
  artifact's group blurb ("the full table is one click away…") is dropped as it
  only restated the list beside it.
- **Biggest win and biggest loss are links to their session** (`/sessions/:id`),
  because each happened on one identifiable night. Nights played and table
  volume are aggregates over every night and have nowhere to go, so they are
  not links — which means the two that are must look clickable: a hover
  background, an underlined caption, and a trailing arrow. `playerStats()`
  already returns `best` and `worst` per player but not *which* session they
  came from, so the session id has to be carried alongside them.
- The panel's contents are **top-aligned, not stretched.** The list outgrows the
  panel as players are added, and whitespace below four stats is the correct
  answer to that, not four stats spread over 700px.

### 5. Seasonal leaders

Winners and losers over the **last five group sessions** — three each side, the
existing `<SeasonLeaders>` component with a new window.

Headed `Seasonal leaders`, subtitled `last five games · 7 Aug – 4 Sep`. The
dates are part of the subtitle, not decoration: "last five games" alone doesn't
say whether that means the last five weeks or the last five months, and the
window shifts every time a session is logged.

- The window is **five sessions, not three months.** `seasonLeaders()` takes a
  `windowStart: Date` and `SeasonLeaders` computes it from a `monthsBack` prop
  defaulting to 3. Both change to a session count: take the five most recent
  `played_at` values and filter on those, so the window is stable whether the
  group played weekly or took a month off.
- **The window counts group sessions, not the player's.** Someone who showed up
  for one of the last five appears with a one-night sample, which is not form.
  Each row therefore carries `n of 5` beside the net, so a small sample reads as
  one.
- **The heading says "seasonal" but the app still has no season**, and the
  subtitle is what keeps that honest. Nothing in the data defines when a season
  starts or ends, so "last five games · 7 Aug – 4 Sep" states the window in
  terms the data actually knows. Do not let the heading tempt the window back
  into months, and do not add a season-scoped figure elsewhere on the strength
  of this word — that road ends at the goal bar cut above.
  `seasonLeaders()` keeps its name; only the heading and window change.

Placed **last**, below the standings. The lifetime record is the league's
primary ordering and earns the higher slot; recent form is the qualifier you
read afterwards.

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

Reusable primitives in `src/components/`. Feature-specific components live in
`src/features/<feature>/` and are not listed here.

**Structure** — the page skeleton. Every page uses these.

| Component | What it is |
|---|---|
| `AppLayout` | Felt chrome, header, nav, the 1152px `WRAP`, `ErrorBoundary` |
| `PageHeading` | Title + subtitle + actions, on the felt, above the sheet |
| `Sheet` | The one cream playing-card a page is laid out on |
| `Band` | One horizontal division of a sheet, with kicker/title/caption/action |
| `Card` | A small standalone tile — for grids, not page bodies |

**Controls**

| Component | What it is |
|---|---|
| `FeltButton` | A page action on the felt. Only ever in a `PageHeading` |
| `Button` | `primary` · `secondary` · `subtle` · `danger` inside a sheet; `ghost` is felt-only |
| `ConfirmButton` | A destructive action that arms in place. Replaces `window.confirm` |
| `Field` | Label + control + hint, wrapped in a `<label>` |
| `TextInput` | The one text input. Sets no focus styling on purpose |
| `CurrencyInput` | Right-aligned tabular dollars with a leading `$` |
| `DatePicker` / `CalendarPopover` | Date entry for a session |
| `SuitRankPicker` | Four suits + thirteen ranks, picked independently |
| `GoogleButton` | OAuth entry, on both auth pages |

**States**

| Component | What it is |
|---|---|
| `LoadingState` | The muted `Dealing…`. `tone`, `label`, `full` |
| `ErrorNote` | The crimson banner. `tone="cream"` \| `"felt"` |
| `SetupNotice` | Shown when the Supabase env vars are missing |
| `ErrorBoundary` | Crash fallback. **Uses plain markup on purpose** — see below |

**Figures and identity**

| Component | What it is |
|---|---|
| `StatFigure` | The one display-scale figure on a page (52px) |
| `MiniStat` | A secondary figure subordinate to it (22px, or 28px in a hero) |
| `GoldPill` | Gold at 16%, in the one readable pairing per surface |
| `SessionStatusBadge` | Draft / submitted / approved |
| `PlayerAvatar` | Mini playing card — rank, suit, monogram. Always beside a name |
| `SuitBadge` | SVG suit pip, never unicode |
| `InfoTip` | The definition of a figure whose name is not enough |

**Charts** — hand-rolled SVG, no library.

| Component | What it is |
|---|---|
| `CumulativeChart` | Multi-line cumulative net, with axes/series/tooltip split out |
| `Sparkline` | A player's recent trend, inline in a row |

**`ErrorBoundary` is the one deliberate exception to all of the above.** Its
fallback uses plain markup rather than `Card` / `Button`, documented at
`ErrorBoundary.tsx:10`: if the thing that crashed *is* `Card` or `Button`, a
fallback built from them crashes too and the user gets a white screen instead
of an error message. Do not "fix" it.

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
cleanup. Whatever is chosen applies to the Seasonal leaders band too.

**2. Season standings should be the last 5 games.** Settled and folded into
the Dashboard layout section above as band 5, `Seasonal leaders`.

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

## Per-page audit — 2026-09-11

Every surface in the app, read against the rules above, and then aligned to
them. **This is the finding list, not the tick list** — `REDESIGN.md` → Stage A
owns which rows a human has actually opened, and duplicating its state here is
how two tables start disagreeing.

The split before this pass was clean: the seven pages built in Stages 1–5
conformed, and **every other page was `<h1>` + a stack of `Card`s** — the
pre-redesign shape. All of them are now the anatomy above.

### What the audit found, beyond the shape

Four defects were real bugs rather than styling, and all four were invisible
from a screenshot:

1. **The error banner on the felt was 1.5:1.** `GroupSettingsPage` and
   `GroupMembersPage` rendered `crimson-700` on `crimson-500/10` outside any
   card. On members that is the banner carrying the last-admin trigger's
   message, which is written to be read and could not be. `ErrorNote`'s felt
   tone fixes it.
2. **Keyboard focus was invisible on 20 inputs.** Eleven set
   `focus:ring-gold-500` on cream (~2.1:1 — the exact pairing `index.css`
   swaps away from); six replaced the outline with a sage border tint, which
   is no ring at all. `TextInput` sets none and lets the global rule through.

   **This said 17 until 2026-09-12, and the three it missed are the
   instructive ones.** `LedgerStepperRow`, `SessionSetupBand` and
   `GuestSearchField` set `outline-none` and then a *replacement*
   `focus:ring-gold-ink`, so they read as styled rather than as broken and
   survived a pass that caught the obviously-unstyled ones. A replacement ring
   is still a suppression: it is 1px where the contract's is 2px, and it fires
   on mouse focus too, so it cannot distinguish a click from a tab. All three
   are on the session detail page, which was ticked `[x]` with them in place —
   a focus ring does not appear in a screenshot of an unfocused page, so the
   five-point check structurally cannot see this class of defect. Grep for
   `outline-none` instead; it should return nothing outside `TextInput`'s
   doc comment.
3. **Three `window.confirm()`s survived.** Regenerate join code, remove a
   member, revoke an invite link. The last one asked "Revoke this invite
   link?" on a page listing several and never said which.
4. **`PlayerStatsCard` tinted counts as money.** Wins sage, losses crimson —
   rule 2 exists because a sage-tinted number reads as dollars. Its whole
   compact layout also had no callers left.

### Still open

- **`formatCents` does not group thousands.** It emits `$26840.00` where the
  contract's own sample writes `$26,840`. Affects any four-figure total —
  table volume, a lifetime net, a payout period. One function, 39 call sites
  downstream; it is a behaviour change rather than a restyle, so it is logged
  rather than folded into a page.
- **`Field` associates its hint with `aria-describedby`, not by nesting.** The
  hint sits outside the wrapping `<label>`; putting it inside made every
  control's accessible name run label and hint together. A radio group still
  needs a fieldset and legend — a wrapping label reaches only the first
  labelable descendant.
- **`Card` is not retired.** `GroupsPage`'s tile grid is the shape it is for,
  and it is the only `Card` import left in the app. The rule is about page
  *bodies*.
- **`ErrorBoundary` stays plain markup.** Deliberate — see Component
  inventory.

## What's intentionally NOT here

- No in-session live tracker (post-game entry only)
- No chart library dependency
- No state management library (per-page `useEffect` + `useMemo` is sufficient)
- No themes / light mode (dark felt is the theme)

Considered for the dashboard on 2026-09-08 and deliberately cut. All of these
appear in `design_archetypes/dashboard_redesign.html`; none of them ship:

- **No season-goal progress bar.** Requires a per-player target and a
  definition of "season," neither of which exists. The Seasonal leaders band is
  a different thing and does ship — despite its name it windows by session
  count, five games, not by season.
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
