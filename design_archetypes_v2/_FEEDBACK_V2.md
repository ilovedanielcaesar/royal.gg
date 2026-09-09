# Iteration 2 — the feedback, and how it was resolved

Iteration 1 lives in `design_archetypes/{league,sessions,profile}_redesign.html`.
It is **not edited**. This folder is a second pass plus one new page.

Binding documents, unchanged:
- `design_archetypes/_STYLE_CONTRACT.md` — the palette, the chrome, the sheet,
  the rules. Nothing here overrides it.
- `_DATA.js` in this folder — the frozen sample dataset. Every figure in it is
  integer cents and script-verified. No number in it may be invented, rounded
  or re-derived.

Four files: `league_v2.html`, `sessions_v2.html`, `profile_v2.html`,
`session_detail_v2.html`.

---

## League

Bands in this order, top to bottom:

1. **League settings button — admin only.** In the page heading, outside the
   sheet, with a small `ADMIN` marker so it is clear the row is conditional.
2. **All-time rankings.** Per row: player score, a five-night trajectory
   sparkline (sage if the five-night total is up, crimson if down), and
   all-time P/L. A sort dropdown offering: P/L high→low, P/L low→high, player
   score, consistency score, most games played. **Column headers sit above
   their own columns** — the iteration-1 mock crammed them all over the player
   name, which was the complaint.
3. **Current payout period.** A button through to the payout page — the period
   is *not* settled here any more. Shows only when it opened and how many
   sessions have run since. Once the session count passes 8, a reminder to pay
   out appears.
4. **Guests**, beside the payout period: the players who are not registered to
   the league, each viewable, plus a small add-guest button.
5. **League rules.**
6. **Export**: league data + metadata as CSV or JSON — every game, buy-in,
   cash-out, date and player.
7. **Leave league**, red, with a confirmation step.

Cut: the huge payout display, the recent-form band, and the add-a-guest form
that used to sit at the bottom of the page.

## Sessions

- The four header figures are **Nights logged / Reconciled / Drafted and
  balanced / Needs review**. Table volume is gone.
- Cut the commentary: the "Weekly. $0.25 / $0.50…" line under the title and the
  whole "needs review" prose band.
- Keep the month divider between games — it was the best part.
- Each row, in this order: **date · night · players · state · action score ·
  your net**. The night's note appears as a caption under the night only when
  that session actually has one. Player avatars: show all of them up to eight,
  and above eight show the top five by lifetime net plus a `+n` overflow.
- Sort by: latest, oldest, highest action score, individual highest win.
- "The shape of the season" moves to the profile page.

## Profile

- The card picker: clicking a card selects it and **Save sits right at the
  card**, not at the bottom of the page.
- Keep the caption. Drop the player's name from it, and write the card's full
  name — "Ace of Spades", not "A of spades".
- Cut the "3 of your last 4 nights" streak line.
- Track record: no commentary on the stats. They are obvious.
- Your nights graph: a toggle between the cumulative **line** and the per-night
  **bar** chart. The bar mode is the "shape of the season" chart brought over
  from the sessions page — that is what the move means in practice.
- Your nights rows show buy-ins and cash-out as **cash values**, not "4 × $40".
  The multiple lives on the individual session page.

## Individual session page — new

Same style as the other three. Four states on one artboard stack, because they
are the same page under different conditions:

1. **Editing a night** (the primary state).
   - The date picker is **hand-rolled** — a custom calendar in the card
     language. No `<input type="date">`, no library. The native control is ugly
     and breaks the feel.
   - "Who's at the table" lists **registered members only**. No guests, not
     even previously-added ones.
   - Guests are reached only through "add a guest": start typing and previously
     seen guests appear as suggestions; a name that matches nothing creates a
     new guest. A guest gets a **blank spade card** by default.
   - Adding a player defaults them to **1 buy-in in, one buy-in's value out**,
     so the sheet is balanced the moment the players are picked and the
     discrepancy starts at $0.00.
   - The cash-out stepper moves by **one dollar** per press, not one cent.
2. **Draft.** A night is labelled Draft when its discrepancy is under the
   reconcile threshold. **No submit-for-approval step** — nothing is sent
   anywhere. Any user may edit a draft until it is approved.
3. **Needs review.** Discrepancy over the threshold. Not auto-adjusted.
4. **Approved.** "Who's at the table" disappears; what remains is the list of
   players with in, out and net. An **admin can reopen** the record, which puts
   it back into draft.

---

## Decisions taken while resolving this, and why

**The `submitted` status.** `src/types/database.ts` has
`status: "draft" | "submitted" | "approved"`, and `SessionStatusBadge` renders
"Waiting on admin" for `submitted`. The feedback removes that step, so
`submitted` is unreachable in this design and the mock never shows it. Acting
on this in the app means a migration and a change to `useSessionReview`. It is
a schema decision, so it is flagged rather than assumed.

**"Any user can edit a draft."** Today `SessionFormPage` computes
`canEdit = isDraft || (isGroupAdmin && status === "submitted")`, and delete is
gated on `isGroupAdmin || session.created_by === user.id`. Edit is already open
to any member on a draft, so only the RLS policy for *reopening* an approved
night is new, and that stays admin-only.

**The payout period is five sessions, not six.** The style contract says the
current period "covers the last six sessions" and also that the payout settled
on `2 Aug`, with the 24 fixed dates ending 7 Aug, 14 Aug, 21 Aug, 28 Aug,
4 Sep. Only five of those fall after 2 Aug. Five is what the dates support, so
five is what these mocks say. Being under the reminder threshold of 8 is also
why the reminder is shown as a labelled example state rather than live.

**The contract's $280.00 / $164.50 / $104.50 / $41.00 for 4 Sep are the
*adjusted* cash-outs, not the reported ones.** They have to be: reported
cash-outs are what came up $4.50 short, and the contract fixes the adjusted
total at $1,240.00. The reported column in `_DATA.js` was solved backwards from
them, and running it through the real `reconcile()` in `src/lib/reconcile.ts`
reproduces all four to the cent. That is why the reported figures are ragged
($277.20, $163.46) and the adjusted ones are clean — which is the right way
round for a miscount.

**Two flagged nights, equal and opposite.** 15 May is $8.00 short and 19 Jun is
$8.00 over. A night that needs review does not conserve money — that is what
being flagged means — so the pair is made to cancel, and the 24-night ledger
still sums to exactly $0.00 while neither night does on its own.

**Three nights score a perfect 10.0 action score.** 15 May, 19 Jun and 4 Sep all
compute above 10 and clamp. That is the real formula's behaviour, not a fudge;
the "highest action score" sort breaks the tie by date.

**Leave league now appears on both League and Profile.** The feedback puts it on
League as item 7; nothing asked for its removal from Profile, so it is left in
place on both. Worth picking one.
