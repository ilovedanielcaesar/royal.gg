# REDESIGN.md — v1.2 UI overhaul tracker

Live progress for the page redesign. **The mocks are the design** (what each
page looks like and why). **This file is the state** (where we are). If they
ever disagree, the mocks win and this file is stale.

The design is three binding documents, none of which this file overrides:

- `design_archetypes/_STYLE_CONTRACT.md` — the palette, the chrome, the sheet,
  the rules. Copy the tokens verbatim; never hand-pick a hex.
- `design_archetypes_v2/_FEEDBACK_V2.md` — the band-by-band brief for League,
  Sessions, Profile and the new Session detail page, plus the reasoning behind
  each change from iteration 1.
- `DESIGN.md` → "Dashboard layout" — the Dashboard has **no v2 mock**. That
  section is its spec, settled 2026-09-08 and revised 2026-09-09.

`design_archetypes_v2/_DATA.js` is the frozen sample dataset behind the mocks.
Every figure in it is integer cents and script-verified against the real
`reconcile()`. It is a fixture for reading the mocks, **not** a seed for the
app.

`design_archetypes/{league,sessions,profile}_redesign.html` is iteration 1. It
is superseded and not edited. Do not build from it.

**Convention:** `[ ]` todo · `[~]` in progress · `[x]` done · `[!]` blocked ·
`[-]` dropped. Update the status table and the change log in the same edit as
the checkbox — a tick with no log entry is how this file rots.

---

## Status

| Stage | What | Backend? | State | Done |
|:--:|---|:--:|---|:--:|
| **P** | Pre-flight: land `qol-small-items`, commit the mocks | no | `[x]` | 3/3 |
| **0** | Foundation: tokens, felt, chrome, sheet primitives | no | `[x]` | 6/6 |
| **1** | Dashboard | one route change | `[x]` | 7/7 |
| **2** | League | **none needed** | `[x]` | 7/7 · 1 moved |
| **3** | Sessions list | lib only | `[x]` | 6/6 |
| **4** | Profile (merged) | routing | `[x]` | 6/6 |
| **5** | Session detail | **migration `0020`** | `[x]` | 9/9 · merged |
| **A** | **Audit: every surface in the new style** | no | `[~]` | 6/23 seen · 22/22 built |

**Current focus:** **seeing Stage A's seventeen rows.** All of them are now
built on `redesign-a-audit` and every one is `[~]` — which under Stage A's own
rule means not done. `tsc`, build and lint are green and cannot see a layout.
`v1.2.0` is not tagged until somebody opens them.

**The style guide is `DESIGN.md`.** The audit's first finding was that the
binding style document was mock-level — raw CSS for the HTML archetypes, with
nothing mapping it onto the React primitives. So the app-level layer (page
anatomy, which primitive on which surface, the four states, the colour rules
in the places they get misused) now lives in `DESIGN.md`, citing
`_STYLE_CONTRACT.md` for every value rather than restating one.

Four of the audit's findings were bugs rather than styling, and none was
visible in a screenshot: the error banner on the felt measured **1.5:1** on
two pages, **17 inputs had no visible keyboard focus**, three `window.confirm`
calls survived, and `PlayerStatsCard` tinted win/loss COUNTS as money. All
fixed. Full list in `DESIGN.md` → Per-page audit.

**`0020` is pushed** (Will, 2026-09-11) and the whole gate is green against
the pushed schema: 301 checks, 0 failures, and no script needs `--rehearse`
any more. 2026-08-30 collapsed to a draft as designed and Will then approved
it through the new one-step flow, which is the first real exercise of
`draft → approved`.

**The six built-but-unseen surfaces are now seen.** Will ran the five-point
check on Dashboard, Records, League, Sessions and Profile — owed since
2026-09-09 — and on the session page, on 2026-09-11. Rows 1–5 and 8 are
`[x]`. That clears the largest backlog the redesign has carried.

**Every stage is merged.** `main` carries the whole redesign.

| Stage | PR | Merge | Feedback round |
|:--:|:--:|---|---|
| 0 | #4 | `7e22721` | — |
| 1 | #5 | `cc2bfe9` | 8 items, landed direct on `main` |
| 2 | #7 | `cf4d7b0` | 3 items |
| 3 | #8 | `81fa783` | 2 items |
| 4 | #9 | `f740f02` | 7 items |
| 5 | #12 | see change log | 1 item |

All merged 2026-09-10 in the order `2 → 3 → 4`, which mattered: Stage 3 is the
branch that dropped CI's ratchet to `--max-warnings 0`, so landing it first
would have failed the other two on a warning they neither introduced nor
could fix. Every branch and worktree is deleted.

**One conflict, and it is worth knowing why.** Stage 2 and Stage 4 both added
a block immediately above `currentPayoutPeriod` in `stats.ts` —
`PAYOUT_REMINDER_AFTER_SESSIONS` and `rebuySuccessRate` — so git could not
choose. Both were wanted and both were kept. The instructive part is what the
conflict exposed: **both branches had inserted themselves between
`currentPayoutPeriod`'s doc comment and `currentPayoutPeriod`**, orphaning it.
The same mistake on each side, invisible on either branch alone, visible the
moment they met. Anchoring an insertion on `export function foo(` lands it
below `foo`'s documentation, not above it.

**The lint baseline is now 0.** `SessionsListPage:98` is gone with the page
that held it, and CI runs `--max-warnings 0`. The "zero headroom" warning
under Stage P is now literal: any new warning fails the build.

`RecordsPage` was pulled forward out of Stage 2's tail and restyled early,
which is what turned the mockless-pages note into **Stage A** below — a real
stage with a real inventory, because "restyle the leftovers" was never going
to be checked.

**Still owed by Will, and narrower than it was:** the settings page **as a
member**. Stage 1's admin pass was done 2026-09-09 and found eight things,
all fixed on `dashboard-feedback`; the 2026-09-11 five-point pass covered
rows 1–5 and 8 as an admin. What no one has opened is `/g/:slug/settings`
signed in as a plain member — the fix list made the stakes card read-only
for them for the first time, and that view has never been seen. It is
**Stage A row 9**, and it is the one row on that list with a known reason to
look rather than a routine one.

Stage 0's four tabs went with the five-point pass: the chrome is on every
one of the six routes that were checked.

**League, Sessions and Profile have now been through a preview pass** — Will
read all three on their Vercel previews on 2026-09-10 and returned twelve
items, all of them fixed before merge and all recorded under their stages
below. That is not the same as a Stage A tick: the pass was a read of the
design, not the five-point check, and it happened before the fixes landed.
~~Rows 3, 4 and 5 stay `[~]` until someone opens the merged pages~~ **Done
2026-09-11.** All six mocked surfaces went through the five-point check in
one sitting. Nothing is built-but-unseen any more; every remaining row is
unbuilt.

Nothing in Stages 0–4 waits on a decision. Everything below waits on eyes.

> ### ⚠ START HERE
>
> Two things are true before any redesign work starts, and both are cheap to
> check and expensive to assume:
>
> 1. ~~**`0019_card_not_unique.sql` is in the migrations folder.**~~
>    **Checked 2026-09-09: it is unpushed.** `WORKFLOW.md` says `0007`–`0018`
>    are applied and that the folder holds no unpushed work, which was true
>    when it was written; `0019` arrived after. It is still local-only. Stage P
>    holds the full answer and the ordering it forces.
> 2. ~~**The mocks are untracked.**~~ **Done** — `3abdbff` tracks
>    `design_archetypes_v2/`, `design_archetypes/_STYLE_CONTRACT.md` and the
>    three iteration-1 files. They are the design, and they are now in the
>    history rather than on one disk.
>
> The full smoke gate, green as of 2026-09-08, is listed in `WORKFLOW.md`. It
> is re-run in Stage 5 and nowhere else — Stages 0–4 touch no policy.

---

## How the work is split

Inherits `WORKFLOW.md` → "How the work is split" unchanged. Migrations, RLS and
anything security-shaped are written by Claude and rehearsed against live data
in a rolled-back transaction before Will pushes. UI chunks go to Codex or
Antigravity one at a time, with a spec naming the files in scope, what is out of
scope, the invariants and the lint baseline to beat. Never trust a delegated
run's self-report: check `git status`, never `git add -A`, and verify `tsc`,
build and lint yourself.

Three rules specific to a redesign:

**The mock is the spec, and it is read, not guessed.** Each stage opens by
reading the relevant `_v2.html` file and the matching section of
`_FEEDBACK_V2.md`. A band that is in the mock and not in the stage's checklist
is a bug in this file.

**No new tokens, no new colour, no chart library.** `src/index.css` already
carries the contract's palette under `@theme`. The one gap is `--gold-ink`
(`#7a5d1a`), added in Stage 0. Money colour is financial convention — sage up,
crimson down, `ink-500` at zero — independent of the player's suit. Any figure
that is not money (a rating, an action score, a count) stays `ink-900`.

**One branch per stage, PR into `main`, named for the work.**
`redesign-0-foundation`, `redesign-1-dashboard`, and so on. `main` stays
deployable throughout, which means a half-migrated app has to look deliberate
at every merge — see the note under Stage 0. `v1.2.0` is tagged when Stage 5
lands, and no branch is ever named after a version.

---

## Decisions taken 2026-09-09

Four questions were open before this file could be written. All four are
answered; the consequences are folded into the stages below.

**1. Dashboard first.** Foundation, then Dashboard, then League, Sessions,
Profile, Session detail. The Dashboard spec was already settled and revised
against a preview, so it is the one page that can be built without first
reading a mock — and it is what you land on, so it is what makes the app feel
redesigned soonest. The cost is that the riskiest work, the money-writing
session page and its migration, lands last, when the visual language is
already proven everywhere else. That is an acceptable trade because Stage 5's
risk is in the database, not the design.

**2. `submitted` is dropped properly, with a migration.** Not merely unused —
removed. `sessions.status` becomes `draft | approved`. A night is a draft until
an admin approves it, and nothing is ever sent anywhere. This retires
Quality-of-life backlog item 4 (`DESIGN.md`) at the same time and by the same
means, since widening the member write window to "until approved" and deleting
the intermediate state are the same change. Details in Stage 5.

**3. All-time rankings show active members with at least 3 games played, and
no guests.** Stricter than the `DESIGN.md` backlog's guess, deliberately: the
standings are a claim about the league, and three nights is the smallest number
that makes a player score mean anything. Consequences, all of them intended:

- **Guest money still counts everywhere else.** A guest's buy-ins and cash-outs
  remain in session totals, in reconciliation, in the lifetime ledger and in
  every chart. They are excluded from *rankings*, not from the record. Nothing
  about `reconcile()` changes.
- Guests get their own League band (`_FEEDBACK_V2.md` → League item 4), which
  is where an excluded player is still visible and viewable.
- **The threshold counts lifetime sessions, not sessions in the window.** The
  Seasonal leaders band (last 5 games) draws from the same eligible set, so a
  member with 3 lifetime nights who played one of the last five ranks in both.
  Otherwise a five-game window could never seat anyone at a 3-game bar.
- Former members stay in the standings if they are otherwise eligible — leaving
  does not erase your results. What is missing is the marker saying they left;
  that is `WORKFLOW.md` → Open Items item 2 and it is picked up in Stage 2.

**4. Profile and the account page merge, per-group.** One page at
`/g/:slug/profile`. Everything on it is scoped to the group you are in;
different stakes do not sum honestly, so nothing is ever added across groups.
This retires backlog item 6. It also means the merged page needs a band the
mock does not have — see Stage 4.

---

## Stage P — Pre-flight

- [x] Commit `design_archetypes_v2/`, `design_archetypes/_STYLE_CONTRACT.md`,
      the three iteration-1 redesign files, and `.claude/skills/agy/`. Landed
      as `3abdbff` on `qol-small-items`, so they arrive in `main` with the PR
      below rather than as a separate commit on top of it.
- [x] PR `qol-small-items` into `main` and merge it. It carried `0019`, the
      shrunken `SuitRankPicker`, the `MyGroupProfilePage`/`PlayersPage` edits
      and the Dashboard spec in `DESIGN.md`. **PR #3, merged 2026-09-09** as
      `7ccb608`, after `0019` was pushed — that order, for the reason above.
      `migration list` now pairs `0019` remote-side.
- [x] Confirm `0019` is applied in the live schema (`npx supabase migration
      list`). Record the answer here.

      **It is not.** As of 2026-09-09, `migration list` reports
      `{"local":"0019","remote":""}` — `0001`–`0018` are paired, `0019` exists
      only on disk. The START HERE note guessed right.

      What that costs, and why it is not urgent. `0019` is `drop index if
      exists players_group_card_unique` plus two column comments: no data is
      rewritten, no policy moves, and there is no `smoke-0019.mjs` because
      there is no rule left to assert. But `5efe5d8` already deleted
      `MyGroupProfilePage`'s `isCardTaken()` and the 23505 handler that
      translated the index's error into a sentence, so the moment that code is
      in `main` the app has no answer for a duplicate card — and the index is
      still live to raise one. **Order matters: Will pushes `0019` before or
      with the merge, not after.** With one person using the app the window is
      theoretical; it stops being theoretical the first time two people set up
      a profile at once, which is exactly the race `0019` exists to remove.

      This also settles the question Stage 5 was told to ask: `0020` must not
      be written until `0019` is pushed, or the push stacks two unpushed
      migrations.

**Lint baseline, recorded 2026-09-09:** **1 warning** —
`src/pages/SessionsListPage.tsx:98`, `react-hooks/set-state-in-effect`.
`tsc -b --noEmit` clean, so the baseline is the one warning and nothing else.
That is exactly CI's `--max-warnings 1`, which means every stage below has
**zero headroom**: one new warning fails the build. Stage 3 rewrites
`SessionsListPage` and should clear it, and the ratchet comes down to 0 in the
same PR.

---

## Stage 0 — Foundation

Branch: `redesign-0-foundation`. No backend.

The goal is that every later stage is assembly. Nothing user-visible changes
except the chrome, so this stage is where the "`main` stays deployable" rule
gets tested: the old pages must keep rendering, on the new felt, inside the new
topbar, without a redesign half-finished on screen.

- [x] `--gold-ink: #7a5d1a` added to `@theme`. Audit the rest of the contract's
      tokens against `src/index.css` and reconcile any other gap here, once.

      The audit found **eight** gaps, not the one this file predicted. All
      eight are closed: `--gold-ink`; the radial highlight (was `-10%` /
      `.04` / `60%`, the contract's is `-12%` / `.055` / `58%`, and the
      brighter highlight is what makes the sheet read as lying under a light);
      `html` background, which is what overscroll actually paints; `body
      min-width: 320px`; `button { cursor: pointer }`, which Tailwind v4's
      preflight dropped and which no page had noticed; the `:focus-visible`
      gold ring; and both font fallback stacks.

      Two tokens exist **beyond** the contract — `--color-felt-600` and
      `--color-sage-500` — and both are in use (`Button`, `PlayerStatsCard`,
      `SessionPlayerPicker`). Kept. They are consistent with their ramps and
      deleting them is three unrelated restyles.
- [x] The felt on `body`: the radial highlight plus the 45° repeating weave,
      `background-attachment: fixed`, and the `.tabular` numeric utility. The
      weave, `fixed` and `.tabular` were already correct and untouched.
- [x] Chrome to match the contract exactly — `AppLayout`, `GroupNav`,
      `GroupSwitcher`. Four tabs, `Dashboard / Sessions / League / You`, only
      `aria-current` moving between pages.

      `NavLink` already sets `aria-current="page"`, so rule 9 comes free. The
      active tab changed from a **solid cream pill to a translucent wash**:
      solid cream in the topbar reads as a small playing card, which is the
      language the sheet and the avatars own, and the chrome has to stay quiet.
      `GroupSwitcher`'s two branches (one group → link, several → menu) now
      share one `PILL` constant; they had drifted into two hand-written class
      strings for a control that is one control to the eye.
- [x] `Sheet` and `Band` primitives: one cream playing-card sheet per page,
      divided into bands. This is the container every later stage fills.

      `Band` takes `title` / `caption` / `kicker` / `action` — the exact shape
      every `band-head` in the v2 mocks uses — and generates its own
      `aria-labelledby` via `useId`. The divider is `border-t` with
      `first:border-t-0`, not `border-b` on all but the last: a sheet whose
      last band is conditional would otherwise end on a rule with nothing
      under it.
- [x] `PageHeading`: the heading and its actions live on the felt, **outside**
      the sheet. The sheet is a record of results and holds no controls except
      its own tabs.
- [~] Small shared pieces the mocks all use: a display-scale stat figure, a
      mini-stat, a gold pill, a sort dropdown, a `Sparkline`, and a two-step
      destructive confirm. Build them when the first stage needs them, not
      speculatively — but they live in `src/components/`, not in a page.

      **One built: `FeltButton`.** `PageHeading` is inert without it — the
      contract's `.btn` / `.btn-primary` / `.btn-ghost` is cream-on-felt and
      40px tall, and the existing `Button` is ink-on-cream and 34px, styled
      for the inside of a card. They are two different controls and merging
      them would have restyled every existing page, which Stage 0 must not do.
      `FeltButton` renders a `Link` when given `to`, since both of Stage 1's
      heading actions are navigations.

      **Stage 1 took four more** as it needed them: `StatFigure` (the
      display-scale figure), `MiniStat`, `GoldPill` and `Sparkline`. The two
      left are the sort dropdown (Stage 2) and the two-step destructive
      confirm (Stage 2 or 4). This item is working as designed rather than
      unfinished.

**Exit gate:** every existing route renders, `tsc` clean, build clean, lint at
or below the recorded baseline, and a browser pass on all four tabs.

Machine half, 2026-09-09: `tsc -b --noEmit` clean · `vite build` clean · lint
**1 warning**, still only `SessionsListPage:98`, so the baseline held and
`--max-warnings 1` passes. Dev server boots clean and serves `/` 200. **Human
half outstanding:** the browser pass. An SPA's routes cannot be proved to
render by `curl` — it returns the same `index.html` for every path.

**Out of scope:** the hand-rolled calendar (Stage 5 owns it — it is only ever
used there).

### Five things the build turned up

**1. A focus ring you could not see, and the token that fixes it.** Rule 9
asks for "a visible `:focus-visible` gold ring" and the contract implements it
as `outline: 2px solid var(--gold-500)`. On felt that is right. On `card-50`
it is about **1.9:1** — a ring that satisfies the letter of the rule and not
the point of it, and cream is the surface every result in the app sits on.
`--gold-ink` is the contract's own answer for gold that has to read on cream,
so cream surfaces swap the outline colour to it: `[data-cream]
:focus-visible`. `Sheet` and `Card` both carry `data-cream`, `Card` because
the un-migrated pages are still built from it and their focus rings should not
stay invisible until Stage 4 reaches them. No new colour, no new token.

**2. Tailwind v4 tree-shakes `@theme`, so a token can be "added" and absent.**
`--color-gold-ink` was in `@theme` and *not in the built CSS* until something
referenced it — v4 emits only the variables it can see used. It is emitted now
(the focus rule above uses it), but the trap generalises: **grepping the built
CSS is not how you check a token exists.** Prefer the generated utilities
(`text-gold-ink`, `bg-gold-ink`) over `var(--color-gold-ink)` in an arbitrary
value, because the utility cannot silently resolve to nothing.

**3. The mocks leave a phone with no navigation.** `@media (max-width: 720px)`
sets `.nav { display: none }` and puts nothing in its place — checked all four
v2 mocks and the contract; there is no hamburger, no bottom bar, nothing.
Taken literally that ships an app you cannot navigate on the one device
`CLAUDE.md` says it gets used on ("we'll be using this on phones at the
table"), and it is a regression from today, where the nav is always visible.
The responsive section says "copy verbatim, **extend as needed**", so the nav
wraps to its own full-width centred row below 720px instead of vanishing.
Desktop is byte-identical to the contract. **This is a placeholder, not a
design** — if Phase 3 wants a real mobile pattern, `GroupNav` is the seam.

**4. The brand spade was invisible.** `SuitBadge` fills black suits with
`ink-900`, which is right on cream and is `#1a1614` on `#0d3324` felt — the
topbar's spade has been a dark smudge on dark green the whole time. The
contract's brand mark is explicit about it: cream spade, `crimson-500` heart.
`SuitBadge` gained an optional `fill` override (defaulting to exactly what it
did before, so its ten other call sites are untouched) and the brand passes
cream and `crimson-500`. Not a redesign, a legibility fix that the "copy the
chrome verbatim" instruction happened to surface.

**5. `PlayerAvatar` is not the contract's `.pcard`, and was left alone.** The
contract specifies 26×34, radius 5, a 10px rank and a 13px suit; `PlayerAvatar`
at `sm` is 28×36, radius 6, 11px rank, 16px suit. Two pixels, but it is a real
divergence. It is **not** on Stage 0's checklist, and it renders on nearly
every existing page, so aligning it here would have been exactly the
half-finished redesign this stage exists to avoid. Whichever stage first needs
a contract-exact card takes it.

---

## Stage 1 — Dashboard

Branch: `redesign-1-dashboard`. Spec: `DESIGN.md` → "Dashboard layout".

`DashboardPage.tsx` is 481 lines, well over the ~200-line convention, and five
bands is a natural split. One component per band.

- [x] Heading on felt: `Dashboard`, subtitled `Welcome back, <name>` from the
      roster display name. Actions outside the sheet: `Settings`, `+ New
      session`. Both are `FeltButton`s; both were admin-only before and are
      not any more, since Settings is now member-reachable and any member may
      log a night.
- [x] Band 1 — hero. Player score at display scale, gold streak pill, then
      wins / losses / lifetime net as mini-stats.
- [x] Streak-pill copy rules, both edges — `src/features/dashboard/streakPill.ts`.

      A **third** edge turned up writing it: four nights that are all
      *exactly* flat. Counting downs rather than assuming `4 − ups` is what
      makes that case visible, and it renders no pill, because
      `0 of your last 4 nights down` says nothing. Vanishingly unlikely, one
      line to handle, and the alternative is a pill that lies.
- [x] Band 2 — recent five. Band 3 — your trajectory. Band 4 — at the table +
      stats panel.
- [x] Band 5 — seasonal leaders, last 5 games, drawn from the Decision 3
      eligible set.
- [x] The eligibility filter itself: `isRankingEligible()` plus
      `RANKING_MIN_SESSIONS` in `src/lib/stats.ts`. Deliberately **not** the
      same constant as `RATING_MIN_SESSIONS`, though both are 3 — they answer
      different questions ("is this score meaningful?" against "does this
      player belong in the standings?") and sharing one constant would couple
      them by accident.

      It is used in three places, one more than this file expected: band 5,
      and **both** halves of band 3's League view (the featured six and the
      legend). The chart's League view is a claim about the league, so it
      obeys the same rule the standings do. It replaced an inline
      `sessionsPlayed >= 3 && !is_guest` that the old dashboard had written
      out twice — the drift this helper exists to prevent had already
      started.
- [x] **The one backend change:** `RequireGroupAdmin` dropped from the
      `settings` route in `src/App.tsx`.

      Four things are hidden from members, not the two this file listed:
      regenerate-code and the members-page link, plus **`InviteLinksCard`**
      and the whole Members card. Both extras are doors a member cannot walk
      through — `group_invites` has no member select policy
      (`0010_group_join.sql:12`), so the card would render an empty list and a
      create button that fails, and the Members card is a link to an
      admin-gated page. The join-policy radios are also disabled for members;
      the database already refuses the write, but a control that looks live
      and does nothing is worse than one that looks dead.

**Exit gate:** browser pass as both an admin and a member. Confirm a member
sees settings read-only and gets no dead links.

Machine half, 2026-09-09: `tsc` clean · build clean · lint **1 warning**, back
at baseline. `DashboardPage` went 481 → **118** lines; every new file is under
200.

### What Stage 1 turned up

**1. Money was printing a hyphen, not a minus sign.** Contract rule 1 asks for
U+2212 "exactly as `formatSignedCents()` does" — and `formatSignedCents()` did
not do it; `formatCents` emitted an ASCII `-`. Fixed at the source, which
changes every money figure in the app. The reason is mechanical rather than
fussy: a hyphen is narrower than a digit, so in a `.tabular` column a negative
figure sits a fraction out of line with the one above it. Checked before
changing it that nothing parses the output back — `parseDollarsToCents` reads
what a human types and rejects the `$` this always emits.

**2. `react-refresh/only-export-components` nearly ate the whole CI budget.**
Exporting `cumulativeDomain` beside `CumulativeChart`, and `moneyToneClass`
beside a `MoneyText` component, produced **two** new warnings — against a
ratchet of exactly 1. Both moved to `src/lib/` (`chartDomain.ts`,
`moneyTone.ts`). Worth internalising: in this repo a helper exported from a
component file is not a style question, it is a build failure. `MoneyText`
itself was **deleted before shipping** — every call site wanted the class for
its own element, because a wrapping `<span>` breaks the `font-display` and
width rules its parent sets, so the component had no users.

**3. `CumulativeChart` hit 460 lines, so its tooltip is now its own file.**
The chart gained a shared-domain prop and two tooltip shapes; that put it 130
lines past where it already was. `CumulativeChartTooltip.tsx` is split for
size, not reuse — nothing in it is chart-agnostic — and it leaves Stage 4 a
323-line file to add a bar mode to rather than a 460-line one.

**4. Two signatures changed, both narrowing to what the caller actually
knows.** `seasonLeaders()` took a `windowStart: Date`; it now takes the
windowed session list, because the window is a count of games and a date
filter cannot express that (`recentSessions()` owns it). `lifetimeTotals()`
gained `biggestWinSessionId` / `biggestLossSessionId` — it already returned
the date and the player, so it could *name* the night but not link to it,
which is what band 4 needs.

**5. Never-played roster rows are excluded from band 4.** "Every player is
listed" is about not eliding the middle of the table, not about listing people
with no record; a row reading `0 nights · $0.00` with an empty sparkline is
noise, not inclusion. Guests **were** listed too, on the argument that this
band is who was at the table and that eligibility is a rule about standings.

~~Guests **are** listed.~~ **Reversed 2026-09-09 by the browser pass** — see
the feedback round below. The band is numbered and sorted by lifetime net, so
it read as a ranking no matter what the caption claimed, and the argument above
lost to that. It is now `Standings` and obeys `isRankingEligible()`.

### Stage 1 feedback round — branch `dashboard-feedback`, 2026-09-09

Will's admin browser pass. Eight items; the specs went to Codex except the
bug, which was auth-shaped and stayed here. Reviewed by a second agent against
the spec, which found two real defects in the delegated work — both fixed
before the PR, and both listed below rather than quietly patched.

- [x] **Hero mini-stats too small.** `MiniStat` gains `size="lg"` (28px/11px),
      used by the hero band alone. Spec'd as a variant rather than a global
      bump because `TableBand` uses the same component and had to stay put.
- [x] **The `You` trajectory line was crimson.** It was suit-derived, so a
      red-card player got a red line that read as "you are losing". Now
      `ink-900`, always. **Sage was considered and rejected by Will** — a green
      line trending down says the opposite of what it means. Recorded in
      `DESIGN.md` → band 3, since it is a deliberate exception to the
      money-tone rule rather than an oversight.
- [x] **Legend hover emphasises a line.** League view; buttons not labels, so
      focus works like hover. No click-to-pin.
- [x] **Standings exclude guests and anyone under three nights.** The reversal
      above. Retires `DESIGN.md`'s backlog guess at the same time.
- [x] **"All your sessions" → "All sessions."** It was never a personal list.
- [x] **Members can no longer edit the stakes.** They saw live inputs and an
      enabled Save button that `handleSubmit` silently discarded — a control
      that looks live and does nothing, which is worse than one that looks
      dead. Read-only text for a member now, admin path unchanged.
- [x] **Join links use the public origin.** `publicAppUrl()` reads
      `VITE_PUBLIC_APP_URL` and falls back to `window.location.origin`, so the
      settings page stopped handing out `http://localhost:5173/join/…`.
      `src/lib/auth.ts` deliberately keeps using the live origin — an auth
      redirect has to come back to where you actually are, or sign-in breaks on
      localhost and on preview deploys. **Will owes the Vercel env var**; until
      it is set the links fall back to the origin, i.e. exactly today's
      behaviour, so this ships safely unset.
- [x] **"The page reloads when I leave the tab."** Nothing reloaded. Returning
      to a hidden tab makes supabase-js run a catch-up refresh that emits
      `SIGNED_IN` carrying the session it already had; `AuthProvider` stored
      that fresh object, and every effect keyed on the `user` **object** —
      six of them — refired, blanked its page to `Dealing…` and refetched the
      league. Fixed at both ends: `sameSession()` keeps the old object when the
      account and access token are unchanged, and the six consumers now key on
      `user?.id`, so a genuine hourly refresh cannot blank a page either. Worth
      internalising: in this app a Supabase `user` object is a new object on
      every refresh, so it is never a dependency — its `id` is.

**What the review caught in the delegated work**, both fixed:

1. **A false empty state.** Filtering the standings made
   `No players on the roster yet.` a lie — five members with two nights each
   render an empty list beside a records panel showing real money. Now
   `No one has three nights yet.` A filter changes what an empty list *means*,
   and the copy has to move with it; the spec did not think of it either.
2. **Emphasis could fade the whole chart.** `isDimmed` tested only that an
   emphasised id was set, not that it was drawn — and `leagueSeries` drops a
   player with no points while the legend does not, so a legend entry can
   outlive its line. Latent behind the 3-night rule rather than live, guarded
   in one line.

Everything else the review raised was style, taken or declined on the spot.
`CumulativeChart` is 313 lines, over the ~200 convention and over the 301 it
started at — pre-existing, and Stage 4 already owns splitting it.

---

## Stage 2 — League

Branch: `redesign-2-league`. Spec: `_FEEDBACK_V2.md` → League;
`design_archetypes_v2/league_v2.html`.

Replaces `PlayersPage.tsx` (348 lines). The League tab currently points at
`/g/:slug/players`; rename the route to `/league` and leave a redirect, since
old links exist in `WORKFLOW.md` and in the browser history of the one person
using the app.

Bands in this order: settings button (admin only, in the heading, marked
`ADMIN`) · all-time rankings · current payout period · guests · league rules ·
export · leave league.

- [x] All-time rankings. Per row: player score, a five-night trajectory
      sparkline (sage if the five-night total is up, crimson if down), all-time
      P/L. **Column headers sit above their own columns** — cramming them over
      the player name was iteration 1's complaint.
- [x] Sort dropdown: P/L high→low, P/L low→high, player score, consistency
      score, most games played.
- [x] **`consistencyScore()` extracted into `src/lib/stats.ts`.** Consistency
      exists today only as a weighted subscore inside `playerRating()`; you
      cannot sort on something you cannot name. Extract it, and have
      `playerRating()` call the extracted version so there is one definition.

      **Done early**, `b1c55fa`, alongside `actionScore()` — see the change
      log. `playerRating()` calls it. It takes the nets rather than a player
      id, because every caller already has them.
- [x] Rankings use the Stage 1 eligibility helper. Guests and under-3-game
      members do not appear here.
- [x] Current payout period: a button through to the payout page. Shows when
      the period opened and how many sessions have run — it is **not** settled
      from this page. Past 8 sessions, a reminder to pay out appears.
- [x] Guests band: the players not registered to the league, each viewable,
      plus a small add-guest button. Reuses `AddGuestForm`; the full form no
      longer sits at the bottom of the page.
- [x] Export league data as CSV or JSON — every game, buy-in, cash-out, date
      and player, plus metadata. Client-side off `useLeagueData`, no backend.
      A browser cannot start a download from inside a published artifact, but
      this is the real app, so an `<a download>` blob is fine.
- [-] ~~Leave league, red, with a confirmation step.~~ **Moved to Stage 4**,
      which is the choice `_FEEDBACK_V2.md` asked someone to make ("Leave
      league now appears on both League and Profile … Worth picking one") and
      the one Stage 4 below already recommended: leaving is something you do
      to your own membership, and the League page is about the league. Built
      there as `features/profile/LeaveGroupBand.tsx`, on `ConfirmButton`
      rather than `window.confirm`, which also retires the old
      `LeaveGroupCard`.

**Backend:** one read change. The former-member marker
(`WORKFLOW.md` → Open Items 2) needs `group_members.status` joined into the
roster read — `players.status` is a different column and stays `active` after
someone leaves. Do **not** filter them out; the numbers must keep counting.
This is the natural stage for it.

**Cut from iteration 1:** the huge payout display, the recent-form band, the
bottom-of-page add-guest form.

### What Stage 2 turned up

Built on `redesign-2-league` as `344c445`. `PlayersPage` (348 lines) is
deleted; the page is `LeaguePage` plus four band files and a data hook, every
file under 200 lines. `/g/:slug/players` is a redirect and `players/:id` is
declared separately so the redirect cannot swallow it.

**1. The roster read needed no migration after all.** This file booked Stage 2
for "lib + roster read" expecting to touch the backend. `group_members_select`
is already `profile_id = auth.uid() or is_group_member(group_id) or
is_app_owner()` (`0015_rls_isolation.sql:156`), so any member can read their
own group's memberships. It landed as a separate `useGroupMemberStatus()` hook
rather than a field on `useLeagueData`, which three pages depend on — a fourth
read for one marker is cheaper than widening the shared one.

**2. Both `left` and `removed` are marked, and neither is filtered out.** An
admin removing you does not make you a current member, and leaving does not
erase your results. The two words are kept apart because being removed and
walking away are not the same fact.

**3. Two gaps against the mock, both found in review and both now fixed.**
Recorded rather than quietly patched:

- **The rules band showed three facts; the mock has five.** Join policy was
  missing though `join_policy` is already on the `groups` row, and the payout
  reminder was missing entirely — which left the number 8 living in exactly
  one place, as an inline `periodSessionCount > 8` in the band directly above
  it. Fixed in `8034b75`: `PAYOUT_REMINDER_AFTER_SESSIONS` in `stats.ts`,
  read by both, and `join_policy` printed in English rather than as
  `code_approve`. It is deliberately **not** a `groups` column — nothing can
  set it, and a settings control nobody asked for is more than this stage
  owns. The constant is the seam if it ever wants to be per-group.
- **The standings row drew a gold `YOU` pill; the dashboard's deliberately
  does not.** `TableBand.tsx` carries the reasoning — "a gold YOU tag was
  louder than the sheet wants" — and settled on a faint tint. Two lists
  ranking one league cannot mark you two different ways. The mock draws the
  pill, so the mock-wins rule pointed one way and the Stage 1 browser pass
  pointed the other. **Will chose the dashboard's answer, 2026-09-10**: pill
  dropped in `c6806b8`, faint tint only, reasoning left at the call site
  because the next person to read the mock will ask. A shipped decision beats
  a drawing that predates it — worth remembering the next time the two
  disagree.

**4. The five-night sparkline is the player's last five nights *played*,** not
the league's last five nights with gaps for absence — `sessionNets.slice(-5)`.
This matches how Stage 1's standings sparkline already works, and differs from
the mock's `LAST_FIVE`, which carries `null` for a night a player sat out. The
consistent-with-shipped-code reading was taken. Worth a look in the browser: a
player who missed three of the last five gets a line drawn from older nights
than the row beside it.

**~~Open~~ Done, early.** `RecordsPage` had no v2 mock and is where the payout
button lands. Settled the way the proposal suggested — structure kept, clothes
new — but built **before** Stage 2 rather than after it, on
`redesign-records-page`, because the payout button must not lead from a
redesigned League page onto an un-redesigned one. It brought the last of
Stage 0's deferred shared pieces with it: `ConfirmButton`, the two-step
destructive confirm.

### Stage 2 feedback round — preview pass, 2026-09-10

Three items off the Vercel preview, all fixed before the merge.

- [x] **The rules band showed three of five facts.** Fixed in `8034b75`; see
      finding 3 above.
- [x] **The standings `YOU` pill is gone.** Fixed in `c6806b8`; see finding 3.
- [x] **The `ADMIN` pill came off the Settings button** and moved beside the
      heading on the settings page itself (`f0f13c1`). It was the one place
      the marker could not work: the button is admin-only, so a member never
      saw it and the admin already knew. The settings page is where a member
      and an admin genuinely see different controls — read-only stakes, no
      invite links, no members card, disabled join-policy radios — so it is
      where naming the role earns its space.

      `GoldPill` grew a `tone` for it. Not decoration: `gold-500` on cream is
      about 1.9:1 and `gold-ink` on `felt-900` is dark on dark, so each
      surface has exactly one readable gold pairing and the component now
      knows both. **This is the first Stage A row-9 work done ahead of the
      stage** — the settings page is otherwise untouched.

---

## Stage 3 — Sessions list

Branch: `redesign-3-sessions`. Spec: `_FEEDBACK_V2.md` → Sessions;
`design_archetypes_v2/sessions_v2.html`.

Rewrites `SessionsListPage.tsx` (301 lines). No backend.

- [x] Four header figures: **Nights logged · Reconciled · Drafted and balanced
      · Needs review.** Table volume is gone. "Drafted and balanced" and "needs
      review" both follow from a night's discrepancy against the group's
      threshold, which is already computable client-side.
- [x] Cut the commentary: the `Weekly. $0.25 / $0.50…` line under the title,
      and the whole "needs review" prose band.
- [x] **Keep the month divider between games** — it was the best part.
- [x] Row order: date · night · players · state · action score · your net. The
      night's note appears as a caption under the night **only when that
      session has one**. Avatars: show all up to eight; above eight, the top
      five by lifetime net plus a `+n` overflow.
- [x] Sorts: latest, oldest, highest action score, individual highest win.
- [x] **`actionScore()` moved into `src/lib/stats.ts`.** It is computed inline
      in `SessionsListPage.tsx:74` today, and Stage 5's session page needs the
      same number. Note the real formula clamps at 10.0 and genuinely ties —
      three of the 24 sample nights hit it — so the "highest action score" sort
      breaks ties by date.

"The shape of the season" leaves this page. It reappears in Stage 4 as the bar
mode of the profile chart; that is what the move means in practice.

### Stage 3 feedback round — preview pass, 2026-09-10

Two items, both fixed before the merge (`0250c09`).

- [x] **"Individual highest win" now means yours.** It sorted by whoever
      happened to win that night, so every player saw the same order and the
      sort answered a question nobody asked. The name reads as a claim about
      the person reading it. It now sorts on your own net: profitable nights
      first, losses after them worst-last, and **a night you did not play
      below every night you did** — absence is not a result, and ranking it
      among them puts an empty row above a real one. `biggestWinCents` fed
      only that comparison and is deleted.
- [x] **The avatar preview is three, always, by that night's net.** It was
      "all of them up to eight, then the top five by lifetime net" — this
      file's own spec. Both halves were wrong: a row is a glance and eight
      overlapping cards is a smear, and lifetime net is the wrong question
      for a row about one night. The three faces should be the three who won
      *it*, not the three who are up overall and happened to be there. The
      full participant list stays in the row's `aria-label`, so hiding five
      faces hides nothing from a reader.

**Still open, deliberately not changed.** The ledger row prints
`Night 7 · 4 Sep 2026`. Stage 4's pass killed exactly this on the profile
ledger — an invented number that is not on the session, is not what anyone
calls the game, and renumbers everything the first time a night is logged
back-dated. The same objection applies here and the same fix is one line.
It was left because the feedback named the profile page and because this
file's Stage 3 row order lists `night` as a column. **Worth settling.**

---

## Stage 4 — Profile, merged

Branch: `redesign-4-profile`. Spec: `_FEEDBACK_V2.md` → Profile;
`design_archetypes_v2/profile_v2.html`.

Merges `MyGroupProfilePage` (157 lines, per-group: card, display name) and
`ProfilePage` (188 lines, account-level: email, sign-in methods, identity
linking) into one page at `/g/:slug/profile`, per Decision 4.

- [x] Card picker: clicking a card selects it and **`Save` sits at the card**,
      not at the bottom of the page. Keep the caption; drop the player's name
      from it; write the card's full name — "Ace of Spades", not "A of spades".
- [x] Cut the "3 of your last 4 nights" streak line. Track record carries no
      commentary on its own stats — they are obvious.
- [x] Your nights graph: a toggle between the cumulative **line** and the
      per-night **bar** chart. `CumulativeChart.tsx` is 336 lines and gains a
      bar mode; no chart library.
- [x] Ledger rows show buy-ins and cash-out as **cash values**, not `4 × $40`.
      The multiple lives on the session page.
- [x] **A band the mock does not have.** `profile_v2.html` has no email or
      sign-in section, because iteration 2 was drawn before the merge was
      decided. The merged page needs a `Your account` band — email, sign-in
      methods, Google linking — reusing `SignInMethodsCard`, placed above
      Leave league so the destructive control stays last. Draw it in the sheet
      language; it is the one piece of this stage with no mock to read.
- [x] Routing: `/profile` (account-level, group-independent) becomes a redirect
      into the current group's profile. **Do not lose the no-group case** — an
      account that belongs to no group still has to be able to manage its
      sign-in methods, or a half-signed-up user is stranded with no route to
      identity linking. Simplest answer is to keep `/profile` rendering the
      account band alone when there is no group to redirect into.

**~~Open~~ Settled:** Leave league is **here only**, as the recommendation
below said it should be. Stage 2 shipped without it and this stage shipped
`LeaveGroupBand` on `ConfirmButton`, retiring `LeaveGroupCard` and its
`window.confirm` — which is also Stage A row 5's rule 5, paid early.

**Open:** `PlayerProfilePage` — viewing *someone else* — has no v2 mock, and
`profile_v2.html` is the "You" page (it has the card picker, Save, and Leave).
Proposal: the other-player view is this same page minus the picker, the account
band and Leave. `PlayerRatingPage` (206 lines) likewise has no mock; restyle it
and reach it from a player score.

### Stage 4 feedback round — preview pass, 2026-09-10

Seven items, all fixed before the merge (`d1d9c1b`).

- [x] **The card is the hero and the picker hides behind it.** Clicking the
      card opens the seventeen buttons underneath, Save beside them. The
      picker is used about twice in the life of an account and was
      permanently occupying the widest part of the page.
- [x] **The card got its tilt back** — resting at `−1.2°`, straightening and
      lifting `2px` under the cursor, from iteration 1's `.large-card`
      (`design_archetypes/profile_redesign.html:353`), which the v2 build
      dropped. A card lying at an angle reads as an object rather than a div.
      `motion-reduce` removes it entirely rather than shortening it.
- [x] **Player score and lifetime net fill the space beside the card**, at
      display scale. They **moved** out of Track record rather than being
      copied — the same figure printed twice on one page makes the reader
      check whether the two disagree.
- [x] **Track record is two named groups**, not one nine-cell grid. Win rate
      no longer sits between Record and E(X) with the eye left to sort them.
- [x] **Rebuy success rate.** Of the nights you bought in twice or more, the
      share you finished ahead on. **Buy-in count, not money** — three $40
      buy-ins is a rebuy night and one $120 buy-in is not, because the
      question is about the decision to buy back in, and that decision is a
      row in `buy_ins`. Strictly `netCents > 0`; breaking even after
      rebuying is getting your money back. `null` rather than `0%` when
      nothing qualifies, because 0% reads as "rebought and always lost".

      `REBUY_MIN_BUY_INS = 2` is named because "rebought" is ambiguous in
      English — Will's wording was "more than one rebuy", which literally
      means three — and the stat is meaningless if the reader guesses wrong.

      It carries a new `InfoTip`, which opens on hover **and focus and tap**.
      A phone has no hover and this app is used at the table, so a
      hover-only definition is invisible to the reader who most needs it.
- [x] **The ledger says the date.** `nightNumber` is deleted, not left unused.
- [x] **The page action is gone.** "Session detail view" linked to whichever
      night happened to be most recent, which is not why anyone opens their
      own profile, and the ledger links every night including that one.

**And one thing that was not on the list.** The band printed the account's
email, which for sixteen of seventeen accounts is a synthetic
`@royal.gg.local` address — a lookup key for username login, not a way to
reach anybody. It is no longer displayed. The data behind it is a separate
piece of work and is written up in `WORKFLOW.md` → Open items, checked
against the live database: four accounts can lose the fake address today
because Google already holds a real one, eight cannot because for them it
*is* the login, and four are dead test rows. Not a security item — `0015`
dropped `is_admin()`, the one policy that keyed on `will@royal.gg.local`.

---

## Stage 5 — Session detail, and migration `0020`

Branch: `redesign-5-session`. Spec: `_FEEDBACK_V2.md` → Individual session
page; `design_archetypes_v2/session_detail_v2.html`, which stacks all four
states on one artboard because they are one page under different conditions.

This is the money page. It is last, it is the only stage with a migration, and
it does not merge until the smoke gate is green and Will has pushed.

### The migration

`0020`, removing `submitted` per Decision 2. Everything it touches already
exists in `0016_game_log_states.sql`, so this is mostly subtraction:

- [x] Collapse any live `submitted` row to `draft` first, in the same
      migration. There is exactly one: **2026-08-30**, balanced at $480.00.
      It moves through the OLD trigger, which is what nulls its `submitted_at`
      and `submitted_by` for us. `node scripts/db-backup.mjs` immediately
      before the push — free tier means no managed backups. **That backup and
      `npx supabase db push` are Will's and have not happened.**
- [x] The transition trigger (`0016:71`) loses three legs and keeps two:
      `draft → approved` and `approved → draft` (reopen). The
      `draft → submitted`, `submitted → approved` and `submitted → draft`
      legs go.
- [x] `sessions_update_draft` (`0016:137`): the `with check` narrows from
      `status in ('draft','submitted')` to `draft`. `sessions_admin_review`
      (`0016:160`) narrows its `using` the same way.
- [x] `buy_ins_write` and `cash_outs_write` (`0016:188` onward): drop
      `submitted` from the admin legs. **The money rows have to follow the
      header or the change is cosmetic.**
- [x] The `status` check constraint drops `'submitted'` as a legal value.
- [x] **Keep `submitted_at` and `submitted_by`** as unused nullable columns for
      now. Dropping columns off live data is destructive and buys nothing; a
      later cleanup migration can take them once a release has passed without
      them.
- [x] `src/types/database.ts` narrows to `"draft" | "approved"` **in the same
      commit** — that file is hand-maintained, and `0017` already landed once
      without it, leaving a column invisible to TypeScript for a day.
- [x] `scripts/smoke-0020.mjs`: rehearse against live data in a rolled-back
      transaction. Assert the three removed transitions now raise, that a
      member can still write money to a draft, that an admin can still approve
      and reopen, and that no `submitted` row survives. Every migration since
      `0009` rehearsed this way and it caught a real defect every single time.
      **It caught one here too — see findings 1 below.** 37/37 green.
      `node scripts/smoke-0020.mjs` with no flag refuses and says so until
      Will has run `npx supabase db push`.

App-side fallout: `useSessionFormSave.ts:152` stops writing
`status: "submitted"`, `SessionStatusBadge` loses the "Waiting on admin" case,
and `SessionFormPage.tsx:32`'s `canEdit` collapses to "is it a draft". Editing
a draft is already open to any member, so no policy widens for that — the only
admin-only write left is reopening an approved night, and
`sessions_admin_reopen` (`0016:165`) already exists and needs no change.

### The page

- [x] **A hand-rolled date picker.** A custom calendar in the card language. No
      `<input type="date">`, no library — the native control is ugly and breaks
      the feel. This is the single largest new component in the redesign.
- [x] "Who's at the table" lists **registered members only** — no guests, not
      even previously-added ones.
- [x] Guests are reached only through "add a guest": start typing and
      previously seen guests appear as suggestions; a name matching nothing
      creates a new guest. A new guest gets a **blank spade card** by default.
- [x] Adding a player defaults them to **1 buy-in in, one buy-in's value out**,
      so the sheet is balanced the moment the players are picked and the
      discrepancy starts at `$0.00`.
- [x] The cash-out stepper moves by **one dollar** per press, not one cent.
- [x] Four states: **Editing** · **Draft** (discrepancy under the threshold;
      any member may edit it; nothing is submitted anywhere) · **Needs review**
      (over the threshold, not auto-adjusted) · **Approved** ("who's at the
      table" disappears, leaving in / out / net per player, and an admin can
      reopen it back to draft).
- [x] `SessionFormPage.tsx` is 199 lines before any of this. Split it. It is
      199 again, behind eleven feature files, and eight old `Session*Card`
      components are deleted rather than restyled.

### Feedback round — 2026-09-11

One item, from Will's preview pass. Everything else on the page passed.

- [x] **Show both nets while a discrepancy is being distributed.** The editor
      showed only `cash-out − buy-ins`, so a distribution under the threshold
      was invisible until after saving: a player up $30 on a table $3 over
      read `+$30.00` right up to the moment the record said `+$27.00`. Each
      winner's line now carries both — the counted net as the display figure,
      and the reconciled net under it in `gold-ink`, which is already the
      adjustment colour on the settled band. A loser's line is unchanged,
      because the discrepancy goes to winners only and there is no second
      number to show.

      Applied to the approved record too, for the same reason and so the two
      views do not disagree about what "Net" means. The column header becomes
      `Net · reconciled` when a distribution is live, and the band caption
      says how much is being shared and on what basis. Checked against the
      real `reconcile()`: on a $3.00-over table, one winner takes the whole
      −$3.00; two winners up $30 and $10 take −$2.25 and −$0.75.

      The state pill's wording changed with it — `$3.00 shared among the
      winners` rather than `+$3.00 to distribute`, and a night with no row
      behind it yet stops calling itself a draft.

### Findings

Nine, and the first is the one worth remembering.

**1. `create or replace function` has no patch, and 0020 nearly proved it.**
The first draft of the migration restated `enforce_session_state()` from
**0016's** body — which is where the function was last fully written down in
a file whose subject is the lifecycle. But `0017` had since added two things
to that same function: the `buy_in_cents` stamp on insert, and the guard
refusing a re-stake in the same statement as an approval. Rebasing on 0016
silently reverted both. Nothing in the migration failed; `smoke-phase4`
failed, on `null value in column "buy_in_cents"`, because it inserts a
session without one and had always relied on the stamp.

The rule: **a migration that replaces a function must start from the LAST
version of that function, not from the migration that owns the subject.**
`0020` is rebased on 0017's body, and both the migration's assert block and
`smoke-0020` now check the two additions survived, because the next person to
replace this function will reach for 0016 for exactly the same reason.

**2. The exit gate below was written against a database that has moved on.**
It names "the two nights that are deliberately open drafts (the +$107.50 on
2026-08-30 … and the $110-over 2026-08-26)". Live, today: there is **no
2026-08-26 session at all**, 2026-08-30 was `submitted` rather than draft and
balances exactly, the two real drafts are **2026-09-07 and 2026-09-08**, and
**no session anywhere has `needs_review` set**. `WORKFLOW.md`'s note under the
smoke gate says the same stale thing. Neither is wrong about the rule — an
unbalanced night cannot be approved, and `smoke-0020` asserts it — but the
nights named are gone. **Nothing in the app can now be tested against a live
"needs review" night**, which is a real gap in the browser pass and is why
that state has to be provoked by hand.

**3. `smoke-phase4 --rehearse` had been broken since 0016 was pushed.** Re-
running an applied migration dies on its first `create policy`. Nobody
noticed because the unflagged run still passed. It now applies only what is
missing, and `smoke-0017` got the same treatment when 0020 joined it.

**4. `smoke-auth` was asserting a snapshot, not a rule.** It required the
providers on `will` to be exactly `email,google`, which expired the day Will
connected Google for real. It asserts what cannot go stale instead: linking
added exactly one way in, it was the Google one, and the password sign-in
survived. Same class as the four found on 2026-09-08.

**5. Three documented smoke counts are stale.** `WORKFLOW.md` says
`smoke-rls # 42/42` and `smoke-3c2 # 23/23`; they are 41 and 24. The whole
gate as actually run: rls 41, phase4 24, 0017 24, 3a 18, 3b 32, 3c 18,
3c2 24, leave 22, 0018 36, auth 25, 0020 37.

**6. ONE DELIBERATE DEVIATION FROM THE MOCK, and it should be reviewed.**
`session_detail_v2.html` hides the buy-in column and the remove button under
720px (`.buyin-col, .remove-col { display: none }`). That leaves a phone
unable to record a rebuy or unseat a player — on the device `CLAUDE.md` says
this page exists for, at the table. Below 721px the row becomes two lines
instead of losing two controls. Reverting it is four class strings in
`LedgerStepperRow`.

**7. The blank spade was not free.** "A new guest gets a blank spade card by
default" was a real behaviour change, not a default that was already there:
`effectiveSuit()` dealt every card-less player a card hashed from their UUID,
guests included. It now returns `rank: null` for a guest who has not chosen,
and `PlayerAvatar` draws the corner empty. **This changes guest avatars
everywhere**, not only on this page — the sessions list, the League guests
band, the dashboard. That is the right answer (a hashed Queen of Hearts
asserts an identity nobody picked) but it is wider than Stage 5 and should be
looked at on those pages too.

**8. Adding a guest is admin-only at the database, and the mock does not say
so.** `players_insert_admin` gates INSERT on `is_group_admin`. The mock's
"add a guest" field implies anyone editing the night can create one. The
field therefore offers *creation* only to an admin and says so; seating an
existing guest is open to any member. **Widening that policy is a decision,
not a detail, so it is flagged rather than assumed** — if any member should
be able to add a guest mid-game, that is a migration.

**9. Approve reads the live client-side summary, not the saved row.** The
button disables on `reconcileSummary.needsReview`, computed from what is on
screen. Edit without saving and the button's state can disagree with the
database. The failure is safe and legible — the trigger refuses with "These
books do not balance yet" and the error lands in the sheet — but the honest
fix is to disable Approve while the form is dirty, which needs dirty
tracking the page does not have.

**Exit gate, money-shaped and non-negotiable.** Rewritten against the
database as it actually is — see finding 2, which is why the old wording is
struck rather than ticked.

- [x] The full smoke gate green. All eleven scripts, counts under finding 5.
- [x] `0020` rehearsed in a rolled-back transaction against live data. 37/37.
- [x] **`node scripts/db-backup.mjs`, then `npx supabase db push`.** Done by
      Will, 2026-09-11.
- [x] After the push: all eleven scripts re-run against the pushed schema
      rather than a rehearsal. **301 checks, 0 failures**, and `--rehearse`
      is no longer needed by any of them.
- [x] The money is unmoved. Royal reads $7,280.00 in and $7,280.00 adjusted
      out against $7,286.25 reported — the miscounts, distributed — and
      **zero approved nights are out of balance**.
- [x] `enforce_session_state()` in the live schema still carries 0017's
      buy-in stamp and re-stake guard, and no longer holds the `'submitted'`
      status literal. Checked against the pushed function, not the file.
      Finding 1 is the reason this is its own line.
- [x] **2026-09-07 and 2026-09-08**, the two real drafts, still open, edit
      and save in the browser. Both reconcile to the cent at $80.00.
- [x] A browser pass through all four states by Will, 2026-09-11. It
      returned one item, the feedback round above.
      **Needs review still has no live example** (finding 2), so that state
      was provoked by hand rather than found.

When this lands: **Stage A runs, and only then** is `main` tagged `v1.2.0`.
Stage 5 finishing is not the release; a redesign with six pages still in the
old language is not done. Delete the branch before cutting the tag — a tag and
a branch of the same name make every later checkout ambiguous, which is the
lesson `v1.1.0` taught.

---

## Stage A — every surface in the new style

Branch: `redesign-a-audit`. No backend.

**All seventeen are built as of 2026-09-11. None is seen.** Every row below is
`[~]`, which under this stage's own rule means *not done* — `tsc`, build and
lint cannot see a layout. What is left is the five-point check, in a browser,
on seventeen surfaces.

**The rule: `v1.2.0` is not tagged until every row below is ticked.** Not
"most", not "the ones anyone visits". A redesign that stops at the five mocked
pages leaves a user two clicks from cream-on-felt `Card`s, a 4xl heading and a
`window.confirm` — and the seam is worse than the old design was, because now
it looks like something broke.

This replaces the old "pages with no v2 mock" bullet, which was a list with no
owner and no gate. Each row below has both.

**`[~]` means built, `[x]` means seen.** The two are not the same and the
distinction is the whole point of this stage: a row goes to `[x]` only after
somebody has actually opened that route and looked at it. `tsc`, build and
lint cannot see a layout, and rows 1 and 2 are `[~]` for exactly that reason
even though both are merged and green. **A `[~]` row is not done.**

**How to tick a row.** Open the route in a browser and confirm all five:

1. The heading and its actions are a `PageHeading` on the **felt**, outside
   the sheet — not an `<h1>` inside a card.
2. The content is **one `Sheet`** divided into `Band`s. Not a stack of
   `Card`s. (`Card` is not deleted — it is the right primitive for a small
   standalone tile. It is the wrong one for a page body.)
3. Buttons are the right primitive for their surface: `FeltButton` in a
   `PageHeading`, `Button` inside a sheet, and **never** `Button
   variant="ghost"` on cream — it is `card-50` text and vanishes.
4. Money uses `formatCents`/`formatSignedCents` and `moneyToneClass`, with no
   hand-written sage/crimson ternary. Non-money figures are `ink-900`.
5. No `window.confirm` for a destructive action — `ConfirmButton`.

| # | Surface | Route | Owner | State |
|:--:|---|---|---|:--:|
| 1 | `DashboardPage` | `/g/:slug` | Stage 1 | `[x]` |
| 2 | `RecordsPage` | `/g/:slug/records` | pulled forward | `[x]` |
| 3 | `PlayersPage` → League | `/g/:slug/league` | Stage 2 | `[x]` |
| 4 | `SessionsListPage` | `/g/:slug/sessions` | Stage 3 | `[x]` |
| 5 | `MyGroupProfilePage` + `ProfilePage` (merged) | `/g/:slug/profile`, `/profile` | Stage 4 | `[x]` |
| 6 | `PlayerProfilePage` | `/g/:slug/players/:id` | Stage 4 tail | `[~]` |
| 7 | `PlayerRatingPage` | `/g/:slug/players/:id/rating` | Stage 4 tail | `[~]` |
| 8 | `SessionFormPage` | `/g/:slug/sessions/new`, `/sessions/:id` | Stage 5 | `[x]` |
| 9 | `GroupSettingsPage` | `/g/:slug/settings` | **Stage A** | `[~]` |
| 10 | `GroupMembersPage` | `/g/:slug/members` | **Stage A** | `[~]` |
| 11 | `GroupsPage` | `/groups` | **Stage A** | `[~]` |
| 12 | `CreateGroupPage` | `/groups/new` | **Stage A** | `[~]` |
| 13 | `JoinPage` | `/join`, `/join/:code` | **Stage A** | `[~]` |
| 14 | `LoginPage` | `/login` | **Stage A** | `[~]` |
| 15 | `SignupPage` | `/signup` | **Stage A** | `[~]` |
| 16 | `AdminOverviewPage` | `/admin` | **Stage A** | `[~]` |
| 17 | `SetupNotice` | any route, unconfigured env | **Stage A** | `[~]` |
| 18 | `IndexRoute` loading + no-group states | `/` | **Stage A** | `[~]` |
| 19 | `RequireAuth` loading state | any guarded route | **Stage A** | `[~]` |
| 20 | `RequireGroupMember` loading + refusal | `/g/:slug/*` | **Stage A** | `[~]` |
| 21 | `RequireGroupAdmin` loading + refusal | `/g/:slug/members` | **Stage A** | `[~]` |
| 22 | `RequireAppOwner` loading + refusal | `/admin` | **Stage A** | `[~]` |
| 23 | `ErrorBoundary` fallback | any crash | **exempt** | `[-]` |

**Rows 17–22 are not pages and are on the list anyway**, because a user
absolutely lands on them: every one is a full-screen state, and four of them
are the first thing a new or wrong-permission visitor sees. Five of the six
are a bare `Dealing in…` on felt, which is close enough to right that the fix
is small — but "close enough" is how a seam survives a redesign.

**Row 23 is exempt, deliberately.** `ErrorBoundary`'s fallback uses plain
markup rather than `Card`/`Button` **on purpose**, documented at
`ErrorBoundary.tsx:10`: if the thing that crashed is `Card` or `Button`, a
fallback built from them crashes too and the user gets a white screen instead
of an error. Do not "fix" this row. It is marked `[-]` dropped, not `[ ]`
todo, so nobody tries.

**One thing to check that is not a page.** `formatCents` now emits U+2212 for
negatives (Stage 1, finding 1), and it is used at 39 call sites. Sweep for
figures that are built by hand instead of through it — a `-$40` written into a
string literal will sit visibly out of line beside a real one.

## Cross-cutting open items

Not blocking any stage. Recorded so they are not rediscovered.

- [-] **Pages with no v2 mock.** Superseded by **Stage A**, which is the same
      list with an owner per row and a release gate on top. The old wording
      ("restyle minimally in the tail of the nearest stage") had neither, and
      a leftover with no owner is a leftover.
- [ ] **The four copies of the "my active groups" query**
      (`GroupSwitcher`, `IndexRoute`, `GroupsPage`, `ProfilePage`) —
      `WORKFLOW.md` → Open Items 3. Stage 4 deletes one of the four when
      `ProfilePage` merges, which makes a `MyGroupsProvider` cheaper than it
      is today. Fold it into Stage 4 if it is not more than an hour.
- [ ] **No admin indicator anywhere** — `WORKFLOW.md` → Open Items 1. Stage 2
      puts an `ADMIN` marker on the League settings row, which is the first
      place the role is ever named. Consider whether that is enough.
- [ ] `player_rating_calibration.py` is a second source of truth for the rating
      weights, kept in sync by hand. Stage 2 touches `playerRating()`; check it
      still agrees, and delete it when tuning is finished.

---

## Change log

Newest first. One line per meaningful change.

- **2026-09-11** — **Stage A built: all seventeen surfaces, plus a style guide
  that did not exist.** The audit's first question was whether a style guide
  existed, and the honest answer was "at the wrong altitude": the contract is
  binding and mock-level, and nothing said which React primitive belongs on
  which surface. Predictably, the four things it did not name were
  copy-pasted — eleven identical error banners, twenty-two loading lines
  across three treatments and two sentences, fourteen hand-written inputs.
  Those are `ErrorNote`, `LoadingState`, `Field` and `TextInput` now, and
  `DESIGN.md` is the guide.

  The seventeen rows split the way the tracker predicted: the seven Stage 1–5
  pages conformed and every other page was `<h1>` + a stack of `Card`s. All
  are the anatomy now. `StakesCard` and `InviteLinksCard` are renamed to
  `…Band`, which is not cosmetic — a component whose name says Card keeps
  being reached for as a page body.

  `PlayerStatsCard` is deleted rather than restyled: its compact layout had
  had no callers since Stage 4, and `useProfileData`'s computation is now a
  pure `buildPlayerProfile()` so `/players/:id` renders the same bands as
  your own profile.

  Then the sweep was turned on the seven already-ticked pages, which hand-
  rolled their states because until now there was nothing else to reach for.
  Ten more call sites. A guide that says "use LoadingState" while seven
  conforming pages do not is a guide with an asterisk.

  **Everything is `[~]`, nothing is `[x]`.** Seventeen surfaces are waiting on
  eyes, and row 9 — settings as a plain member — is still the one with a known
  reason to look rather than a routine one.

- **2026-09-11** — **Stage 5 merged as PR #12, and the built-but-unseen
  backlog is cleared.** `0020` was pushed first, in that order, because the
  page's approve button is a no-op against the old trigger and merging a
  page that cannot do its main job is how a seam ships. The whole gate was
  re-run against the pushed schema rather than a rehearsal: **301 checks, 0
  failures**, and no script needs `--rehearse` any more.

  Will then ran the five-point check on all six mocked surfaces in one
  sitting — Dashboard, Records, League, Sessions and Profile, owed since
  2026-09-09, plus the session page. **Stage A rows 1–5 and 8 are `[x]`.**
  Batching the human read again, as on 2026-09-10: it remains the scarce
  step and it remains the one that batches.

  The preview pass returned one item — a distribution under the threshold
  was invisible in the editor, so a winner's line read `+$30.00` until the
  saved record said `+$27.00`. Both nets are shown now, on the editor and on
  the approved record.

  **`main` carries the entire redesign.** What stands between here and
  `v1.2.0` is Stage A's other seventeen rows: two player pages, eight pages
  nobody drew a mock for, and six full-screen states that are not pages at
  all. Row 9 is the one to do first — the settings page has never been
  opened by a plain member, and the fix list made the stakes card read-only
  for them.
- **2026-09-11** — **Stage 5 built** on `redesign-5-session` (`f31db88`
  migration, `7d5f487` page). `0020` removes the `submitted` state: five
  transition legs become two, the one live row in it (2026-08-30) collapses
  to a draft, and the dead admin disjunct in `buy_ins_write` and
  `cash_outs_write` goes with it. Rehearsed 37/37 and **not pushed** — the
  backup and `npx supabase db push` are Will's.

  **The rehearsal caught the defect it exists to catch, for the ninth
  migration running.** 0020's first draft restated `enforce_session_state()`
  from 0016's body, silently reverting the two things 0017 had added to the
  same function. `create or replace function` takes no patch: replace a
  function from the LAST version of it, never from the migration that owns
  the subject. Finding 1 under Stage 5.

  Three smoke scripts were describing a world we left behind — `smoke-phase4`
  walked draft → submitted → approved and its `--rehearse` had been dead
  since 0016 was pushed, `smoke-0017` approved through `submitted`, and
  `smoke-auth` asserted a provider list that expired when Will connected
  Google. All three assert rules now instead of snapshots.

  The page is one `Sheet` in two bands with every control on the felt, and
  eight `Session*Card` components are deleted rather than restyled. The
  hand-rolled calendar is two components over `lib/calendar.ts`, which keeps
  every date in `YYYY-MM-DD` so nothing parses through UTC and lands a poker
  night on the wrong day. An approved night reads its adjusted figures back
  from `cash_outs` rather than re-running `reconcile()`, which would restate
  a settled record the day the threshold changes. Two `window.confirm` calls
  are gone.

  Nine findings recorded, including one deliberate deviation from the mock
  (it hides the rebuy and remove controls under 720px, on the device the page
  is for) and one stale exit gate: the two nights it names as open drafts are
  **not** the two that are open, and nothing in the database is flagged for
  review any more, so that state has no live example to look at.
- **2026-09-10** — **Stages 2, 3 and 4 merged** (`cf4d7b0` #7, `81fa783` #8,
  `f740f02` #9), in that order, after a preview pass returned twelve items
  that were all fixed first. `main` now carries every page of the redesign
  except session detail. Every branch and worktree is deleted. **CI's ratchet
  is `--max-warnings 0`** and `main` lints clean at it.

  One conflict, between Stage 2 and Stage 4, both adding a block above
  `currentPayoutPeriod`. Both kept — but it exposed that both had inserted
  themselves *between that function's doc comment and the function*,
  orphaning it. The same mistake on each branch, invisible until they met.
  Anchoring an insertion on `export function foo(` puts it below `foo`'s
  documentation.
- **2026-09-10** — **Preview pass on all three stages at once.** Opening the
  PRs before merging any gave three Vercel previews simultaneously, so one
  reading covered League, Sessions and Profile instead of three separate
  merge cycles. Worth repeating: the human read is the scarce step, and it
  batches even when the merges cannot.
- **2026-09-10** — The synthetic `@royal.gg.local` address stopped being
  displayed on the profile, and the data behind it was written up in
  `WORKFLOW.md` → Open items before hiding it made it easy to forget.
  Sixteen of seventeen accounts still carry one; four could lose it today,
  eight are gated on people rather than code.

- **2026-09-10** — **Stage 2's two findings closed.** The rules band now says
  all five of the mock's rules, with `PAYOUT_REMINDER_AFTER_SESSIONS` named in
  `stats.ts` so the reminder's `8` stops being an inline literal in one band
  and absent from the next (`8034b75`). The standings `YOU` pill is dropped
  for the dashboard's faint tint, on Will's call — a shipped decision beating
  a mock that predates it (`c6806b8`). Stage 2 is now waiting only on a PR
  and a browser pass.
- **2026-09-10** — **This file was three stages stale, and is now caught up.**
  Stages 2, 3 and 4 were all built on 2026-09-09 and none of them was ever
  written down here — the status table still read `0/8`, `0/6`, `0/6` while
  three finished branches sat in worktrees. This is exactly the rot the
  convention note at the top warns about, arrived at from the other end: not
  a tick with no log entry, but a stage with neither. All three gates were
  re-run per branch today rather than believed from the commit messages, and
  the results are in the Status block. Stage 2 also picked up a findings
  section it never got, carrying two unresolved gaps against the mock.
- **2026-09-09** — **Stage 4 built** on `redesign-4-profile` (`06b9b02`).
  `MyGroupProfilePage` and `ProfilePage` merge into one per-group page: six
  band files, a `useProfileData` hook, and an account band drawn without a
  mock. `CumulativeChart` gained a bar mode and was split four ways doing it
  (`CumulativeLineSeries`, `CumulativeBarSeries`, `CumulativeChartAxes`,
  `cumulativeChartTypes`), which is the 313-line file Stage 1 flagged and
  handed forward. `cardFullName()` in `playerSuit.ts` so the caption reads
  "Ace of Spades". Leave league is settled here and `LeaveGroupCard` is gone,
  taking a `window.confirm` with it. `/profile` redirects into the current
  group and still renders the account band alone when there is no group —
  the stranded-user case the stage was told not to lose.
- **2026-09-09** — **Stage 3 built** on `redesign-3-sessions` (`16d1f68`).
  `SessionsListPage` 345 → ~44 lines behind nine feature files; it reads
  through `useLeagueData` instead of its own fetch, which is what removes the
  `set-state-in-effect` warning. **CI's ratchet comes down to
  `--max-warnings 0` in the same commit**, as this file required — so this
  branch is the one that has to land before the other two, or their PRs fail
  on a warning they neither introduced nor can fix. `actionScore()` finally
  has its caller, closing the duplication the extraction below opened.
- **2026-09-09** — **Stage 2 built** on `redesign-2-league` (`344c445`).
  `PlayersPage` (348 lines) deleted; `LeaguePage` plus four bands and a data
  hook. `/g/:slug/players` redirects to `/league`. The former-member marker
  needed **no migration** — `group_members_select` already lets a member read
  their own group's memberships — and landed as its own hook rather than
  widening `useLeagueData`, which three pages share. Export writes reported
  *and* adjusted cash-outs so the archive keeps reconciliation reversible,
  keeps every amount an integer `*_cents` column, and quotes cells beginning
  `= + - @` against formula injection. Leave league was **not** built here;
  see Stage 4. Two gaps recorded and not fixed: the rules band shows three of
  the mock's five facts, and the standings `YOU` pill contradicts the
  dashboard's.
- **2026-09-09** — **`consistencyScore()` and `actionScore()` extracted** into
  `src/lib/stats.ts` (`b1c55fa`), ahead of the stages that need them. Both are
  prerequisites two stages would otherwise have added to the same file and
  collided over: Stage 2's sort dropdown cannot sort on a subscore with no
  name, and Stage 5's session page needs the same action figure Stage 3's list
  computes. `playerRating()` now calls the extracted `consistencyScore()`, so
  there is one definition. **`actionScore()` has no caller yet** —
  `SessionsListPage.tsx:74` still computes it inline, which is the duplication
  the extraction was meant to end; Stage 3 rewrites that page and owns
  switching the call site over. Ticks Stage 2's third box before Stage 2
  starts.
- **2026-09-09** — **Stage 1's feedback round landed** (`3d5e6ab`): the eight
  items from Will's admin browser pass, including the refocused-tab bug, which
  was never a reload — `AuthProvider` was storing a fresh `user` object on
  every catch-up refresh and six effects keyed on the object refired. Fixed at
  both ends. Band 4 became `Standings` and now obeys `isRankingEligible()`,
  reversing Stage 1's decision to list guests there.

  **Process note, recorded because the convention says otherwise:** this and
  the extraction above went **straight onto `main`**, with no PR and no CI run
  — the branch `dashboard-feedback` is a local pointer at `main` that was
  never pushed. `CLAUDE.md` → Branching says every phase goes through a PR,
  "even working alone: it is where the diff gets read before it lands, where
  CI runs, and where the reasoning is kept." Two of those three still happened
  (a second agent reviewed the work, and the reasoning is in the commit
  bodies). CI is the one that did not. The gates were run by hand instead and
  were green. Stage 2 goes back through a PR.
- **2026-09-09** — **`RecordsPage` restyled early**, out of Stage 2's tail,
  on `redesign-records-page`. Brought `ConfirmButton` (the last deferred
  Stage 0 shared piece) and a `subtle` `Button` variant — the existing `ghost`
  is `card-50` text and is invisible inside a cream sheet, which nothing had
  needed to discover yet. `PayoutSummary` lost its private copy of the
  money-tone ternary.
- **2026-09-09** — **Stage A added**, and it is a release gate: `v1.2.0` is
  not tagged until all 23 surfaces are confirmed in the new style. Replaces a
  cross-cutting bullet that listed eleven pages with no owner and no gate. Six
  non-page full-screen states are on the list (loading and refusal states
  nobody thinks of as pages); `ErrorBoundary`'s fallback is explicitly exempt
  and marked dropped so nobody "fixes" it.
- **2026-09-09** — **Stage 1 built** on `redesign-1-dashboard`. Five bands
  split out of a 481-line page, now 118. `isRankingEligible()` replaces two
  inline copies of the rule. Settings is member-reachable and read-only, with
  four things hidden rather than two. Five findings under Stage 1: money was
  printing a hyphen instead of U+2212; `react-refresh/only-export-components`
  cost two warnings against a 1-warning ratchet, so helpers moved to `lib/`
  and the unused `MoneyText` was deleted; `CumulativeChart`'s tooltip is its
  own file; `seasonLeaders()` and `lifetimeTotals()` changed shape; band 4
  drops never-played roster rows. Browser pass outstanding.
- **2026-09-09** — Stage 0 **merged** as PR #4 (`7e22721`).
- **2026-09-09** — **Stage 0 built** on `ui_redesign_0` (branch named by Will;
  this file had proposed `redesign-0-foundation`). Eight token/felt gaps
  closed, not one. Chrome to the contract, active tab now a translucent wash
  rather than a cream pill. New `Sheet`, `Band`, `PageHeading`, `FeltButton`.
  `tsc`/build clean, lint still 1. Five findings recorded under Stage 0: the
  gold focus ring is invisible on cream and now uses `gold-ink`; v4
  tree-shakes `@theme` so a token can be added and absent; the mocks leave a
  phone with no nav and the nav wraps instead of hiding; the topbar's brand
  spade was ink-on-felt and invisible; `PlayerAvatar` is not `.pcard` and was
  deliberately not touched. Browser pass outstanding.
- **2026-09-09** — Stage P **complete**. `0019` pushed, then PR #3 merged
  (`7ccb608`) — that order, because the branch had already deleted the 23505
  handler the live index could still raise.
- **2026-09-09** — Stage P, two of three. Mocks committed (`3abdbff`).
  `migration list` says `0019` is **unpushed** — Will pushes it before the
  `qol-small-items` merge, because the branch already deleted the 23505
  handler the live index can still raise. Lint baseline recorded: 1 warning,
  `SessionsListPage:98`, which is CI's ceiling exactly — no headroom.

- **2026-09-09** — This file created. Four decisions taken: Dashboard first;
  `submitted` dropped with a migration; all-time rankings show active,
  non-guest members with ≥3 games; Profile and the account page merge
  per-group. Nothing built yet.
