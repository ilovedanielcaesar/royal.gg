# Style contract — royal.gg page redesigns

This is the binding style guide for the Sessions / League / Profile redesign
artifacts. It is the CSS and the rules extracted verbatim from the **published
dashboard redesign artifact** (the settled one, revised 2026-09-09 — newer than
`dashboard_overhaul_artifact.html` on disk), crossed with the section grammar of
`landing_page_mock.html`.

Read alongside:
- `DESIGN.md` → "Direction", "Palette", "Typography", "Dashboard layout"
- `design_archetypes/landing_page_mock.html` → section grammar, gold numerals, reveal-on-scroll
- `design_archetypes/dashboard_overhaul_artifact.html` → earlier draft, visual language only

## The one-sentence direction

Playing-card maximalist on dark felt: the page is the table, and every primary
container is a literal cream playing-card laid on it. Suits, ranks and serif
numerals are the language, not decoration.

## Copy the head verbatim

```html
<link
  href="https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=Inter:wght@400;500;600;700&display=swap"
  rel="stylesheet" />
```

## Tokens — copy verbatim, never hand-pick a hex

```css
:root {
  --felt-900: #0d3324;
  --felt-800: #11402c;
  --felt-700: #1a5238;
  --card-50: #f7f1de;
  --card-100: #ece3c8;
  --card-200: #d9cfa8;
  --ink-900: #1a1614;
  --ink-700: #3a322b;
  --ink-500: #6b5e54;
  --crimson-700: #8a1620;
  --crimson-600: #b21e2c;
  --crimson-500: #d23548;
  --gold-500: #c9a24a;
  --gold-ink: #7a5d1a;
  --sage-700: #436c54;
  --sage-600: #5b8e6e;
  --teal-500: #2c9c8e;
  --sky-500: #2a7fb8;
  --orange-500: #d97a3b;
  --amber-500: #d6a13a;

  --display: "DM Serif Display", Georgia, "Times New Roman", serif;
  --sans: Inter, ui-sans-serif, system-ui, -apple-system, sans-serif;
}
```

**Money colour is financial convention, not suit colour.** Wins are sage,
losses are crimson, zero is `ink-500` — independent of the player's suit, so a
red-suit player is never visually conflated with "losing." Any figure that is
**not money** (a rating, an action score, a count) stays `ink-900`: a sage-tinted
score reads as a dollar amount.

## The felt — copy verbatim

```css
* { box-sizing: border-box; }
html { background: var(--felt-900); }

body {
  margin: 0;
  min-width: 320px;
  background-color: var(--felt-900);
  background-image:
    radial-gradient(ellipse at 50% -12%, rgba(255, 255, 255, 0.055), transparent 58%),
    repeating-linear-gradient(45deg, rgba(255, 255, 255, 0.012) 0 2px, transparent 2px 6px);
  background-attachment: fixed;
  color: var(--card-50);
  font-family: var(--sans);
  -webkit-font-smoothing: antialiased;
}

a { color: inherit; text-decoration: none; }
button { font: inherit; cursor: pointer; }

:focus-visible {
  outline: 2px solid var(--gold-500);
  outline-offset: 2px;
  border-radius: 4px;
}

.tabular { font-variant-numeric: tabular-nums; letter-spacing: -0.01em; }
```

## Chrome — identical on all four pages, copy verbatim

Only the `aria-current="page"` moves. **The nav is
`Dashboard / Sessions / League / You`** — four tabs, matching
`src/components/GroupNav.tsx`. ("Profile" is the tab labelled `You`.)

```css
.topbar {
  border-bottom: 1px solid rgba(247, 241, 222, 0.1);
  background: rgba(13, 51, 36, 0.76);
  backdrop-filter: blur(14px);
}

.wrap { width: min(1152px, calc(100% - 32px)); margin-inline: auto; }

.topbar-inner { display: flex; align-items: center; gap: 20px; min-height: 66px; }

.brand { display: flex; align-items: center; gap: 9px; }
.brand-suits { display: flex; gap: 2px; }
.brand-name { font-family: var(--display); font-size: 24px; letter-spacing: -0.02em; }
.brand-name em { font-style: normal; color: var(--crimson-500); }

.nav { display: flex; gap: 4px; margin-left: auto; }
.nav a {
  display: inline-flex;
  align-items: center;
  min-height: 36px;
  padding: 0 13px;
  border-radius: 10px;
  color: rgba(247, 241, 222, 0.62);
  font-size: 13px;
  font-weight: 500;
  transition: background 160ms ease, color 160ms ease;
}
.nav a:hover { background: rgba(247, 241, 222, 0.08); color: var(--card-50); }
.nav a[aria-current="page"] { background: rgba(247, 241, 222, 0.1); color: var(--card-50); }

.group-switch {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  min-height: 34px;
  padding: 0 12px;
  border: 0;
  border-radius: 999px;
  background: rgba(247, 241, 222, 0.07);
  box-shadow: inset 0 0 0 1px rgba(247, 241, 222, 0.12);
  color: var(--card-50);
  font-size: 12px;
  font-weight: 500;
}
.group-switch:hover { background: rgba(247, 241, 222, 0.12); }

.profile { display: flex; align-items: center; gap: 8px; font-size: 12px; font-weight: 500; }
```

```html
<div class="topbar">
  <div class="wrap topbar-inner">
    <div class="brand">
      <span class="brand-suits">
        <svg viewBox="0 0 100 100" width="15" height="15" aria-hidden="true">
          <path d="M50 8c-7 14-30 28-30 47a18 18 0 0 0 27 16c-2 6-7 12-13 17h32c-6-5-11-11-13-17a18 18 0 0 0 27-16c0-19-23-33-30-47Z" fill="#f7f1de" />
        </svg>
        <svg viewBox="0 0 100 100" width="15" height="15" aria-hidden="true">
          <path d="M50 88C28 72 8 56 8 35a20 20 0 0 1 36-12 20 20 0 0 1 36 12c0 21-20 37-30 53Z" fill="#d23548" />
        </svg>
      </span>
      <span class="brand-name">royal<em>.gg</em></span>
    </div>

    <nav class="nav" aria-label="Main">
      <a href="#">Dashboard</a>
      <a href="#">Sessions</a>
      <a href="#">League</a>
      <a href="#">You</a>
    </nav>

    <button type="button" class="group-switch">Thursday Night <span aria-hidden="true">▾</span></button>

    <div class="profile">
      <span class="pcard" aria-hidden="true">
        <span class="rank">A</span>
        <svg viewBox="0 0 100 100"><path d="M50 8c-7 14-30 28-30 47a18 18 0 0 0 27 16c-2 6-7 12-13 17h32c-6-5-11-11-13-17a18 18 0 0 0 27-16c0-19-23-33-30-47Z" /></svg>
      </span>
      <span>Dan</span>
    </div>
  </div>
</div>
```

## The mini playing-card avatar (`PlayerAvatar`) — copy verbatim

**Every card is rendered with a name beside it.** A card is decoration, not an
identifier — two people in one group may both hold A♠ (migration
`0019_card_not_unique.sql`), so a bare avatar identifies nobody. The only
exception is the signed-in user's own avatar in the topbar.

```css
.pcard {
  position: relative;
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 34px;
  border-radius: 5px;
  background: var(--card-50);
  box-shadow: 0 0 0 1px var(--card-200), 0 1px 2px rgba(0, 0, 0, 0.1);
  color: var(--ink-900);
}
.pcard.red { color: var(--crimson-600); }
.pcard .rank { position: absolute; top: 2px; left: 3.5px; font: 10px/1 var(--display); }
.pcard svg { width: 13px; height: 13px; fill: currentColor; }
```

Suit paths (all four, `viewBox="0 0 100 100"`), and the red rule:

```js
const SUITS = {
  spade: "M50 8c-7 14-30 28-30 47a18 18 0 0 0 27 16c-2 6-7 12-13 17h32c-6-5-11-11-13-17a18 18 0 0 0 27-16c0-19-23-33-30-47Z",
  heart: "M50 88C28 72 8 56 8 35a20 20 0 0 1 36-12 20 20 0 0 1 36 12c0 21-20 37-30 53Z",
  club: "M50 6a17 17 0 0 0-13 28 17 17 0 1 0-9 28 17 17 0 0 0 16-3c-1 7-6 14-13 19h38c-7-5-12-12-13-19a17 17 0 0 0 16 3 17 17 0 1 0-9-28A17 17 0 0 0 50 6Z",
  diamond: "M50 6 88 50 50 94 12 50Z",
};
const isRed = (s) => s === "heart" || s === "diamond";
```

A **guest** has no card: a felt-dark tile with a cream diamond at 55% opacity in
place of the cream face, and the word `GUEST` in a 10px `ink-500` letterspaced
caps beside the name (from `landing_page_mock.html`).

## Page heading, on felt, above the sheet — copy verbatim

Actions live **outside** the sheet, in the heading. The sheet is a record of
results and holds no controls except its own tabs.

```css
main { padding: 30px 0 56px; }

.page-heading {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 24px;
  flex-wrap: wrap;
  margin-bottom: 18px;
}
.page-heading h1 { margin: 0; font: 40px/1 var(--display); letter-spacing: -0.015em; }
.page-heading p { margin: 7px 0 0; color: rgba(247, 241, 222, 0.6); font-size: 13px; }

.actions { display: flex; gap: 8px; }
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 40px;
  padding: 0 16px;
  border: 0;
  border-radius: 11px;
  font-size: 13px;
  font-weight: 600;
  transition: transform 150ms ease, background 150ms ease;
}
.btn:hover { transform: translateY(-1px); }
.btn-primary {
  background: var(--card-50);
  color: var(--ink-900);
  box-shadow: 0 2px 0 rgba(0, 0, 0, 0.22);
}
.btn-ghost {
  background: rgba(247, 241, 222, 0.08);
  color: var(--card-50);
  box-shadow: inset 0 0 0 1px rgba(247, 241, 222, 0.14);
}
```

## The sheet — one cream card, horizontal bands

The dashboard's central move: **one** cream sheet with `border-top` hairline
bands inside it, rather than a scattered grid of small cards. Keep it.

```css
.sheet {
  overflow: hidden;
  border-radius: 22px;
  background: var(--card-50);
  box-shadow:
    0 2px 0 rgba(0, 0, 0, 0.14),
    0 30px 70px -28px rgba(0, 0, 0, 0.65),
    0 0 0 1px var(--card-100);
  color: var(--ink-900);
  animation: settle 460ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
}

@keyframes settle {
  from { opacity: 0; transform: translateY(14px) rotate(-0.35deg); }
  to { opacity: 1; transform: none; }
}

.band { padding: 26px 36px; }
.band + .band { border-top: 1px solid var(--card-100); }

.kicker {
  color: var(--ink-500);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.13em;
  text-transform: uppercase;
}

.band-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}
.band-head h2 { margin: 0; font: 400 23px/1.1 var(--display); }
.subtle { color: var(--ink-500); font-size: 12px; }
.link { color: var(--ink-500); font-size: 12px; font-weight: 500; }
.link:hover { color: var(--ink-900); text-decoration: underline; }

.pos { color: var(--sage-700); }
.neg { color: var(--crimson-700); }
.flat { color: var(--ink-500); }
```

## Rows, chips, segmented control, stats — copy the ones you use

```css
/* a row in a list of players */
.row {
  display: grid;
  align-items: center;
  gap: 14px;
  padding: 9px 10px;
  border-radius: 10px;
  transition: background 150ms ease;
}
.row + .row { border-top: 1px solid var(--card-100); }
.row:hover { background: rgba(236, 227, 200, 0.42); }
.row.you { background: rgba(236, 227, 200, 0.62); }
.row.you:hover { background: var(--card-100); }
.row-rank { font: 17px/1 var(--display); color: var(--ink-500); text-align: right; }
.row-name { min-width: 0; font-size: 13.5px; font-weight: 500; }
.row-sub { color: var(--ink-500); font-size: 10.5px; font-weight: 400; }
.row-net { font: 18px/1 var(--display); text-align: right; }

/* a compact result chip */
.chip {
  min-width: 0;
  padding: 12px 14px;
  border-radius: 12px;
  background: rgba(236, 227, 200, 0.5);
  transition: background 150ms ease, transform 150ms ease;
}
.chip:hover { background: var(--card-100); transform: translateY(-1px); }
.chip time {
  display: block;
  color: var(--ink-500);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
.chip-net { display: block; margin-top: 6px; font: 20px/1 var(--display); }
.chip-outcome { display: block; margin-top: 5px; color: var(--ink-500); font-size: 10px; }

/* tab strip inside a band */
.segmented { display: flex; gap: 2px; padding: 3px; border-radius: 999px; background: var(--card-100); }
.segmented button {
  min-height: 32px;
  padding: 0 16px;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: var(--ink-500);
  font-size: 12px;
  font-weight: 500;
  transition: background 150ms ease, color 150ms ease;
}
.segmented button[aria-selected="true"] {
  background: var(--card-50);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
  color: var(--ink-900);
  font-weight: 600;
}

/* a labelled figure */
.stat-value { margin-top: 5px; font: 30px/1 var(--display); }
.stat-note { margin-top: 4px; color: var(--ink-500); font-size: 11.5px; }

/* a status pill on cream */
.pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 10px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
}
.pill-gold { background: rgba(201, 162, 74, 0.2); color: var(--gold-ink); }
.pill-sage { background: rgba(91, 142, 110, 0.18); color: var(--sage-700); }
.pill-crimson { background: rgba(178, 30, 44, 0.1); color: var(--crimson-700); }
.pill-quiet { background: rgba(217, 207, 168, 0.5); color: var(--ink-500); }
```

**Accent bar.** A 1px band across the top of a card marking its state:
`neutral`, `sage` (reconciled), `crimson` (needs review), `gold` (pending /
in progress). From `src/components/Card.tsx`.

## Tooltip — if you draw a chart, copy verbatim

```css
#tip {
  position: fixed;
  z-index: 40;
  transform: translate(12px, -50%);
  padding: 7px 10px;
  border-radius: 9px;
  background: var(--ink-900);
  color: var(--card-50);
  font-size: 11px;
  line-height: 1.45;
  pointer-events: none;
  box-shadow: 0 8px 22px -8px rgba(0, 0, 0, 0.7);
}
#tip[hidden] { display: none !important; }
.tip-head {
  color: rgba(247, 241, 222, 0.62);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
.tip-big { margin-top: 3px; font-size: 15px; font-weight: 600; }
.tip-sub { color: rgba(247, 241, 222, 0.6); }
```

## Felt content below the sheet

Anything secondary — the cut list, a footnote, a hairline grid of small notes —
sits on the felt **below** the sheet, not inside it.

```css
.cutlist { margin-top: 34px; }
.cutlist > .kicker { color: rgba(247, 241, 222, 0.5); }
.cutlist-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(268px, 1fr));
  gap: 1px;
  margin-top: 14px;
  background: rgba(247, 241, 222, 0.11);
  border-radius: 14px;
  overflow: hidden;
}
.cut { padding: 15px 17px; background: var(--felt-900); }
.cut h3 { margin: 0; color: rgba(247, 241, 222, 0.9); font-size: 12.5px; font-weight: 600; }
.cut p { margin: 5px 0 0; color: rgba(247, 241, 222, 0.52); font-size: 11.5px; line-height: 1.5; }

.footnote {
  margin: 22px 0 0;
  color: rgba(247, 241, 222, 0.42);
  font-size: 11.5px;
  line-height: 1.6;
  max-width: 74ch;
}
.footnote code {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.94em;
  color: rgba(247, 241, 222, 0.62);
}
```

## Responsive + reduced motion — copy verbatim, extend as needed

```css
@media (max-width: 720px) {
  .nav { display: none; }
  .band { padding-inline: 20px; }
  .page-heading h1 { font-size: 32px; }
}

@media (prefers-reduced-motion: reduce) {
  .sheet { animation: none; }
  .btn:hover, .chip:hover { transform: none; }
  * { transition-duration: 1ms !important; }
}
```

## Borrowed from `landing_page_mock.html`

Take these three, and only these three — the landing page is a marketing page
and its scroll theatre does not belong in an app surface.

1. **Gold serif section numerals.** A section's eyebrow is a
   `DM Serif Display` `01` in `gold-500` at 15px, set on the baseline beside
   the heading, with a hairline `rgba(247,241,222,.12)` rule under the pair and
   a `38ch` explanatory paragraph opposite. Use this for the **felt-level**
   sections of a page that has more than one sheet — never inside a sheet,
   where `.kicker` does the job.
2. **Gold letterspaced eyebrow on felt.** `11px`, `font-weight: 600`,
   `letter-spacing: .22em`, `color: #c9a24a`, uppercase.
3. **Reveal on scroll**, exactly as the mock defines it, and only for felt-level
   sections below the fold:
   ```css
   [data-reveal] {
     opacity: 0;
     transform: translateY(26px);
     transition: opacity .7s cubic-bezier(.2,.8,.2,1), transform .7s cubic-bezier(.2,.8,.2,1);
   }
   [data-reveal].in { opacity: 1; transform: none; }
   ```
   Driven by one `IntersectionObserver`, and **disabled under
   `prefers-reduced-motion`** by adding `.in` immediately.

Do **not** borrow: the 195vh sticky hero, the fanned hand of six large cards,
the `SCROLL TO DEAL` cue, marketing CTAs, or `a:hover { color: #ddbb6b }`.

## Rules that bind every page

1. **Integer cents.** Every money figure in the mock's data must be a whole
   number of cents, formatted at render. `+$412.00`, `−$214.50`, `$26,840`.
   Use the real minus sign `−` (U+2212) for negatives and a `+` for positives,
   exactly as `formatSignedCents()` does. Never `0.1 + 0.2` arithmetic on
   dollars.
2. **Money is sage/crimson; everything else is ink.**
3. **Every card avatar has a name beside it.**
4. **Sample data must be internally consistent.** Money is conserved inside a
   session, so nets across any whole set of sessions sum to exactly `$0.00`;
   buy-ins are integer multiples of `$40`; a player's session nets sum to their
   lifetime net. State the arithmetic in the footnote so a reader can check it.
5. **Real data shapes only.** The mock may only show figures the app can
   actually compute — the helpers are `lib/stats.ts` (`playerStats`,
   `leaderboard`, `seasonLeaders`, `currentPayoutPeriod`, `playerSessionNets`,
   `playerRating`, `sessionScore`), `lib/reconcile.ts`, `lib/money.ts`. If a
   figure needs a concept the schema lacks (a "season", a scheduled next game,
   an RSVP, a per-player target), it does not go on the page. Put it in the cut
   list instead and say what is in the way.
6. **No spinners.** A loading state is the page chrome with a muted `Dealing…`.
7. **No chart library.** Hand-rolled inline SVG only, as `CumulativeChart` does.
8. **Tap targets ≥ 36px.** Max content width 1152px, centred.
9. **Accessible.** `aria-current` on the nav, `role="tablist"` + `aria-selected`
   on segmented controls, `<title>` inside every decorative-but-meaningful SVG,
   `aria-hidden` on purely decorative ones, real `<button>`/`<a>` elements,
   and a visible `:focus-visible` gold ring.

## The canonical sample league — shared by all four pages

The Sessions, League and Profile mocks describe **the same league on the same
night** as the dashboard artifact. Use this roster verbatim, so the four pages
read as one app rather than three unrelated mockups. `you` is Dan Caesar.

```js
// name, rank, suit, nights played, W, L, lifetime net in DOLLARS
const PLAYERS = [
  { name: "Dan Caesar",   rank: "A", suit: "spade",   nights: 24, w: 15, l: 9,  net:  412.00, you: true },
  { name: "Priya Raman",  rank: "Q", suit: "heart",   nights: 22, w: 13, l: 9,  net:  286.50 },
  { name: "Marcus Webb",  rank: "K", suit: "club",    nights: 19, w: 11, l: 8,  net:  134.00 },
  { name: "Theo Lund",    rank: "9", suit: "spade",   nights: 18, w:  9, l: 9,  net:    0.00 },
  { name: "Ash Okonkwo",  rank: "7", suit: "diamond", nights: 16, w:  7, l: 9,  net:  -78.00 },
  { name: "Lena Sorokin", rank: "5", suit: "heart",   nights: 21, w:  8, l: 13, net: -142.50 },
  { name: "Jonah Fitz",   rank: "J", suit: "club",    nights: 23, w:  9, l: 14, net: -211.50 },
  { name: "Rory Adeyemi", rank: "8", suit: "spade",   nights: 20, w:  7, l: 13, net: -400.50 },
];
// Lifetime nets sum to exactly $0.00 — as a reconciled league must.
// Mo is a guest: one night, no card, no account.
```

Fixed facts, consistent across the pages:

- **24 nights**, weekly, `27 Mar` → `4 Sep` 2026. The 24 dates are:
  27 Mar, 3 Apr, 10 Apr, 17 Apr, 24 Apr, 1 May, 8 May, 15 May, 22 May, 29 May,
  5 Jun, 12 Jun, 19 Jun, 26 Jun, 3 Jul, 10 Jul, 17 Jul, 24 Jul, 31 Jul, 7 Aug,
  14 Aug, 21 Aug, 28 Aug, 4 Sep.
- **Dan's last five nets**: 7 Aug `−$62.50`, 14 Aug `+$24.00`, 21 Aug `+$86.50`,
  28 Aug `−$40.00`, 4 Sep `+$120.00`. Lifetime `+$412.00`. Rating `8.1/10`.
  Streak: `3 of your last 4 nights up`.
- **Table volume**: `671` buy-ins × `$40` = `$26,840`.
- **Biggest win ever**: Priya, `+$286.00`, 15 May. **Biggest loss ever**: Rory,
  `−$214.50`, 19 Jun.
- **Last five games** (`Seasonal leaders` window, 7 Aug – 4 Sep) nets, which
  also sum to exactly `$0.00`: Dan `+$128.00` (5 of 5), Priya `+$96.50` (5 of 5),
  Marcus `+$42.00` (4 of 5), Theo `+$18.50` (5 of 5), Ash `−$31.00` (3 of 5),
  Rory `−$71.50` (4 of 5), Lena `−$74.50` (5 of 5), Jonah `−$108.00` (5 of 5).
- **Group**: `Thursday Night`, stakes `$0.25 / $0.50`, default buy-in `$40`,
  reconcile threshold `$5.00`.
- **The current payout period** opened after the payout settled on `2 Aug`, so
  it covers the last six sessions and is `still open` — it has no end date until
  someone settles it. Never write "ending today".
- **The 4 Sep night**, if a page needs one session in detail: buy-ins
  `$1,240.00` (31 × $40), reported cash-outs `$1,235.50`, so it was
  `off by $4.50` — under the `$5.00` threshold, therefore auto-distributed
  among that night's winners and `Reconciled`, with the original reported
  figures kept alongside the adjusted ones. Dan 4 buy-ins / `$280.00` out,
  Priya 3 / `$164.50`, Rory 5 / `$104.50`, Mo (guest) 2 / `$41.00`.
