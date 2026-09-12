# Pre-release audit

Full audit of the codebase before opening royal.gg to public beta users.
Run 2026-09-11 against `redesign-a-audit` @ `99ddfd9`.

**Method.** Source read in full, then verified against the **live Supabase
project** read-only: RLS policies, role grants, function bodies, constraints,
triggers, indexes and row counts were queried directly rather than
reconstructed from the migration files. Anonymous access was probed over the
REST API with the real anon key. One write probe (finding 1) was executed
inside a transaction and rolled back; `players` was re-counted afterwards and
is unchanged at 25 rows.

**This file is a worksheet, not a record.** Every finding carries a
`**Decision:**` line. Fill it in, and it becomes the plan.

---

# Scope: what ships before beta

Settled 2026-09-12.

**The gate is findings 1 through 8.** Everything Medium and Low becomes a
post-beta backlog, with two exceptions that ride along: finding 11 is closed
by the same RPC as 2 and 3, and findings 13 and 14 have their approach settled
but their timing deferred.

| # | Finding | Verdict |
|---|---|---|
| 1 | `ensure_group_roster_row` escalation | ✅ **Shipped** — `0021`, 2026-09-12 |
| 2 | Non-atomic session save | **Pre-beta** — `save_session` RPC |
| 3 | Client-side money invariant | **Pre-beta** — same RPC + trigger check |
| 4 | No password reset / no confirmation | **Pre-beta** — reset page, confirmation on, legacy users to Google |
| 5 | Drafts counted in stats | **Pre-beta** — stats read `approved` only |
| 6 | Profile-less redirect loop | **Pre-beta** — sign out, don't navigate |
| 7 | `players_update_self` column scope | **Pre-beta** — pinning trigger |
| 8 | 1000-row silent truncation | **Pre-beta (guard only)** — aggregate backlogged |
| 11 | Negative adjusted cash-out | **Pre-beta** — falls out of 2 and 3 |
| 13 | Cross-tab auth lock | Backlog — approach settled, *see the flag* |
| 14 | Raw DB errors on screen | Backlog — approach settled |
| 9, 10, 12, 15 | Small correctness and data | Backlog |
| 16, 17, 20 | Schema and algorithm tidy-up | Backlog |
| 18, 19, 22, 24 | Hardening and polish | Backlog |
| 21, 23 | Doc and convention drift | Backlog |

**Build order.**

1. ~~Finding 1 alone — a `revoke` migration, its own PR, today.~~ Done.
2. Findings 2, 3 and 11 — the `save_session` RPC and the approval-trigger
   balance check. The largest and riskiest piece; it needs a smoke test before
   the migration is pushed, per the existing local gate.
3. Finding 5 — the `approved`-only stats filter. Lands after 2 so the two
   changes to the session lifecycle are not in flight together.
4. Findings 6, 7, 8 — independent of each other and of the above.
5. Finding 4 — two dashboard settings, a reset page, and a prompt on the
   profile page for the legacy sixteen.

**One thing to resolve before starting:** finding 3 leaves reconciliation
implemented twice, in TypeScript and in SQL. Decide how that stays honest — a
shared fixture both run against is the cheapest answer — before writing the
second copy, not after.

---

## Baseline: what is already right

Worth stating, because it sets the bar the findings below are measured
against.

- `npm run typecheck`, `npm run lint` and `npm run build` all pass clean.
- No `any`, no `@ts-ignore`, no `@ts-expect-error`, no `eslint-disable`, no
  `dangerouslySetInnerHTML`, no `TODO`/`FIXME`/`HACK` anywhere in `src/`.
- RLS is enabled on all 9 application tables, with 28 policies.
- Every custom `SECURITY DEFINER` function pins `search_path = public`.
- Anonymous access is genuinely closed. Verified over REST with the anon key:
  every table returns `[]`, an insert returns `42501`, and `rpc/join_group`
  returns `permission denied for function`.
- CSV export escapes formula injection (`exportLeague.ts:75`).
- Date handling is correct: `played_at` is a real `date` column, and
  `calendar.ts` never parses an ISO string through `Date`, so there is no
  off-by-one for anyone west of Greenwich.
- Secrets are properly gitignored — `.env.local` and `backups/` are both
  untracked.
- Money is integer cents throughout, with one exception (finding 9).
- All 18 existing sessions balance to the cent: `sum(buy_ins) -
  sum(cash_outs.adjusted) = 0` for every one.

---

# Blockers

Things that should not meet a stranger.

## 1. `ensure_group_roster_row()` is a cross-group privilege escalation

**Severity:** Blocker — confirmed exploitable
**Where:** `supabase/migrations/0018_guest_linking.sql:360`; grant originates
in `0012_roster_on_activation.sql:152`

**What.** The function is `SECURITY DEFINER` and `EXECUTE` is granted to
`authenticated`. Its body makes no authorization check of any kind: it never
calls `auth.uid()`, never checks group membership, never checks admin. Running
as the table owner, it bypasses RLS entirely.

Any signed-in user who knows a group's UUID can insert an `active`,
non-guest roster row into a group they do not belong to, naming any account
they like.

**Confirmed, not theorised.** Executed as `role authenticated` with a `sub`
claim belonging to a non-member of the target group:

```sql
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"<non-member>","role":"authenticated"}';
select ensure_group_roster_row('<group they are not in>', '<someone else>');
-- returns 095d3eb1-12b0-4b0b-8e4a-a74525885790
rollback;
```

**Cause.** A partial revoke. `0012` did `revoke all ... from public, anon` and
left Supabase's default grant to `authenticated` untouched. The ACL still
reads `authenticated=X/postgres`.

**Blast radius.** Roster pollution in any group whose UUID is known — a name
of the attacker's choosing appearing in another group's standings — and a
denial-of-service on approvals, since a planted name makes
`ensure_group_roster_row` raise its name-clash exception when the real member
is approved. A removed member knows their old group's UUID, so "knows the
UUID" is not a meaningful barrier.

**Fix.** One line. Nothing in `src/` calls this function; the only callers are
the `roster_row_on_activation` trigger and `join_group()`, both themselves
`SECURITY DEFINER` and unaffected by the revoke.

```sql
revoke all on function public.ensure_group_roster_row(uuid, uuid) from authenticated;
```

**Decision:** **IN SCOPE — pre-beta.** One-line revoke, shipped on its own
ahead of everything else.

**Status: SHIPPED 2026-09-12.** `0021_revoke_roster_rpc_grant.sql`, pushed to
the live project. The ACL now reads `postgres=X/postgres |
service_role=X/postgres` — `authenticated` is gone, and `service_role` is the
server-side key that never reaches a browser. `scripts/smoke-0021.mjs` passes
10/10 against the live schema, proving both halves: the direct call is refused
for an outsider *and* for the group's own admin, while `join_group()` and the
approval trigger still write roster rows through the definer path.

---

## 2. Saving a session is five writes with no transaction

**Severity:** Blocker — silent money corruption
**Where:** `src/lib/useSessionFormSave.ts:74-135`

**What.** On an edit the sequence is: update `sessions` → **delete every
`buy_in` for the session** → insert the new ones → **delete every `cash_out`
for the session** → insert the new ones. Five separate HTTP requests, no
transaction, no compensating action on failure.

**Why it matters.** A dropped connection, a transient RLS refusal or a
constraint violation between the delete and the insert leaves a session
holding cash-outs and **no buy-ins**. Every player that night then reads as a
winner by their entire stack. Nothing flags it — `needs_review` was written in
step one, before the damage — and it propagates straight into the lifetime
leaderboard, the ratings, and every chart.

The likeliest place for this to happen is a phone on cellular data at a poker
table, which is the stated primary use.

Finding 11 is a concrete way to trigger exactly this: a constraint violation
on the `cash_outs` insert, after the `buy_ins` are already gone.

**Fix.** One `save_session(...)` RPC so the whole ledger commits or none of it
does. This is also the natural home for finding 3.

**Decision:** **IN SCOPE — pre-beta.** Full `save_session` RPC: atomic writes
AND server-side reconciliation. Findings 3 and 11 are closed by the same
change.

---

## 3. The money invariant is enforced only in the browser

**Severity:** Blocker — the core domain guarantee is not a guarantee
**Where:** `src/lib/reconcile.ts`, `src/lib/useSessionFormSave.ts:73,100`,
`supabase/migrations/0020_drop_submitted.sql:120`

**What.** `reconcile()` runs client-side. `needs_review`, `reconciled` and
`discrepancy_cents` are written to `sessions` as ordinary client-supplied
columns. The approval guard in `enforce_session_state()` reads that flag back:

```sql
if new.status = 'approved' and new.needs_review then
  raise exception 'These books do not balance yet. ...';
end if;
```

Nothing server-side ever compares `sum(buy_ins.amount_cents)` against
`sum(cash_outs.adjusted_amount_cents)`.

**Why it matters.** `sessions_update_draft` lets **any group member** — not
just an admin — write that row while it is a draft. So a member can set
`needs_review = false` on books that do not balance, and the admin's approve
then passes the trigger cleanly. "The books must balance before approval" is
presently a claim the client makes about itself.

CLAUDE.md asks for precisely this check: *"Don't trust user input on the
frontend. Validate cash-out totals server-side too (or in a Supabase
function)."*

**Fix.** A few lines in the approval branch of `enforce_session_state()`:
recompute both sums for the session and refuse the transition when they
differ. Naturally paired with finding 2.

**Decision:** **IN SCOPE — pre-beta.** Reconciliation moves into Postgres
inside `save_session`, and the approval trigger independently re-verifies
`sum(buy_ins) = sum(cash_outs.adjusted)` rather than trusting a flag.
`reconcile()` stays in TS for the live preview only. **Consequence to plan
for:** two implementations of the same arithmetic now exist and must be kept
in step — they need a test that runs both over the same inputs.

---

## 4. No password reset, and email confirmation is off

**Severity:** Blocker for public users — operational
**Where:** `src/lib/auth.ts` (no `resetPasswordForEmail` anywhere);
`auth.ts:47` says so outright; `auth.ts:89` instructs disabling confirmation

**What.** All 17 auth users have `email_confirmed_at` set at creation, which
means confirmation is disabled in the project. There is no password reset
flow, in the UI or the lib.

**Why it matters.** For twelve friends, neither matters. For strangers:

- Anyone can register an address they do not own.
- Anyone who forgets their password is permanently locked out, with no
  self-service path and no way for you to help short of hand-editing
  `auth.users`.

Sixteen of the seventeen existing accounts carry synthetic
`<username>@royal.gg.local` addresses and **cannot** be recovered by email
even once reset exists — for those, linking Google (`auth.ts:linkGoogle`) is
the only durable path.

**Fix.** Two Supabase dashboard settings plus a small reset page. Decide
separately what to do about the sixteen legacy accounts.

**Decision:** **IN SCOPE — pre-beta.** Enable email confirmation, build the
reset page, and prompt the sixteen legacy accounts to link Google. Nobody is
forced off a synthetic address; they are given a recoverable path.

---

# High

## 5. Draft sessions count toward every lifetime statistic

**Severity:** High — correctness
**Where:** `src/lib/useLeagueData.ts:58-60`

**What.** `.select("*").eq("group_id", groupId)` with no `status` filter, and
nothing downstream in `stats.ts` filters either. A draft is in the data from
the moment it is first saved.

**Why it matters.** A half-entered night immediately moves the lifetime
leaderboard, the player ratings, E(X) and Var(X), the records page and the
cumulative charts — for everyone in the group, not just the person entering
it. That is the entire reason the approve step exists, and the stats do not
observe it.

**Currently latent.** The `royal` group has 0 drafts; the two drafts in the
database are in test groups. It stops being latent as soon as a member starts
a draft.

**Not a documented decision.** `REDESIGN.md` and `GROUPS.md` were searched for
an election to count drafts and there is none, so this is reported as a gap
rather than intent.

**Fix.** Either filter the stats to `approved`, or render draft-inclusive
numbers as explicitly provisional. This is a product call, not just a bug.

**Decision:** **IN SCOPE — pre-beta.** Stats read `status = 'approved'` only.
Approval becomes the act that publishes a night.

---

## 6. An account with no `profiles` row hits an infinite redirect loop

**Severity:** High — unrecoverable lockout
**Where:** `src/components/RequireAuth.tsx:23`, `src/pages/LoginPage.tsx:23`,
`src/components/IndexRoute.tsx:61`

**What.** The cycle:

1. `RequireAuth` sees `user` but no `profile` → `<Navigate to="/login">`
2. `LoginPage` sees a signed-in `user` → `<Navigate to="/">`
3. `IndexRoute` at `/` sees `!profile` → renders `<LoginPage/>`
4. `LoginPage` sees `user` → `<Navigate to="/">` → back to 3

`<Navigate>` re-fires on every render, so this spins rather than settling.

**Who is affected.** Four auth users right now — `roadrunner`, `test1`,
`dalec`, `test2`, all legacy `@royal.gg.local` accounts predating the `0009`
profile trigger. New signups are safe, because the trigger runs inside signup
and a failure there fails the signup. But any profile row that is ever deleted
bricks that account.

**The irony.** `RequireAuth.tsx:20` anticipates this case exactly — *"an auth
user created before the trigger existed, or one whose profile was deleted.
Nothing in the app works without it, so send them back to the door."* The door
bounces them.

**Fix.** Sign the user out in that branch instead of navigating.

**Decision:** **IN SCOPE — pre-beta.** Sign the user out in the `!profile`
branch instead of navigating. Note finding 15 was backlogged, so the four
affected accounts still exist — this fix is what stops them spinning.

---

## 7. `players_update_self` is row-scoped, but the grant is whole-table

**Severity:** High — API-surface hole
**Where:** policy `players_update_self`;
`supabase/migrations/0018_guest_linking.sql:94` for the guard that does not
cover it

**What.** The policy is `(profile_id = auth.uid() AND is_group_member(group_id))`
for `UPDATE`. There are no column-level grants — `authenticated` holds
`UPDATE` on all 13 columns of `players`. `guard_player_profile_link()` only
fires when `profile_id` itself changes, so it does not apply.

A member can therefore PATCH their own roster row to set:

- `is_guest = true` — `isRankingEligible()` (`stats.ts:264`) excludes guests,
  so a losing player can vanish from the standings while their money stays in
  every total;
- `status = 'rejected'`;
- `group_id` to another group they belong to, which moves the roster row
  across groups while its `buy_ins` still point at the first group's sessions.

**Mitigating.** The UI only ever writes `chosen_suit` / `chosen_rank`
(`ProfileCardBand.tsx:89`). This is a hole in the API, not in the app.

**Fix.** A trigger pinning the immutable columns on a self-update, or
column-level grants.

**Decision:** **IN SCOPE — pre-beta.** A `BEFORE UPDATE` trigger pinning
`group_id`, `is_guest`, `status` and `profile_id` against non-admin writes.
One policy, and the rule stays readable next to `guard_player_profile_link()`.

---

## 8. PostgREST's 1000-row cap will silently truncate the ledger

**Severity:** High — latent, dated
**Where:** `src/lib/useLeagueData.ts:68-72`

**What.** Every `buy_in` for the group is fetched in one request. At roughly
10 buy-ins per session — 186 rows across 18 sessions today — the default
1000-row ceiling arrives at about 95 to 100 sessions. Call it two years of
weekly play.

**Why it matters.** There is no error when the cap is hit. The array simply
stops, and every lifetime figure quietly goes wrong. The
`.in("session_id", [...])` URL also grows with every session ever played and
will eventually hit a URL length limit of its own.

**Fix.** Aggregate server-side — a view or an RPC returning per-player,
per-session nets — rather than shipping the raw ledger to the browser. Worth
doing before the numbers start lying, not after.

**Decision:** **IN SCOPE — pre-beta, partial.** Add the loud guard now:
detect a full 1000-row page and raise, rather than silently rendering wrong
numbers. The server-side aggregate is backlogged. This buys the two years
honestly instead of hoping.

---

# Medium

## 9. The one place money is still parsed as a float

**Severity:** Medium — violates a stated project rule
**Where:** `src/pages/CreateGroupPage.tsx:25-26`

```ts
const dollars = Number(value);
const cents = Math.round(dollars * 100);
```

This is the exact pattern CLAUDE.md forbids (*"Floating point money is
forbidden"*) and that `money.ts:5` documents against by name. Every other
money field in the app uses `parseDollarsToCents`; `StakesBand.tsx:103,107`
— the settings-page equivalent of this same form — already does.

**Effect.** `"4e3"` is accepted as a $4000 default buy-in, and `"1.005"`
silently becomes $1.00. The strict parser rejects both.

**Fix.** Use `parseDollarsToCents`.

**Decision:** **BACKLOG — post-beta.**

---

## 10. Group creation is non-atomic

**Severity:** Medium
**Where:** `src/pages/CreateGroupPage.tsx:78-99`

Insert `groups`, then insert `group_members`. If the second fails, the group
exists with no membership row and its slug is taken — the creator cannot reach
it and cannot re-create it under the same name.

**Fix.** A `create_group(...)` RPC, or a cleanup path on failure.

**Decision:** **BACKLOG — post-beta.**

---

## 11. Reconciliation can produce a negative cash-out and fail the save

**Severity:** Medium
**Where:** `src/lib/reconcile.ts:118-176`; constraint
`cash_outs_adjusted_amount_cents_check (>= 0)`

**What.** The discrepancy is distributed among winners in proportion to their
winnings. With a large `reconcile_threshold_cents` and one winner holding
small winnings, that winner's share of a negative discrepancy can exceed their
entire cash-out. The row then violates the `>= 0` check and the save dies with
a raw Postgres error — **after** the buy-ins have already been deleted
(finding 2).

The threshold is admin-configurable with no upper bound, so this is reachable
by configuration rather than by bad luck.

**Fix.** Clamp in `reconcile()`, or treat "no winner can absorb this" as a
review flag — which is what the existing no-winners branch
(`reconcile.ts:129`) already does for the neighbouring case.

**Decision:** **IN SCOPE — pre-beta, via finding 2.** Once reconciliation runs
server-side the negative-cash-out case is handled there — clamp, or flag for
review the way the existing no-winners branch already does. The atomicity fix
separately removes the "fails after the buy-ins are already deleted" half,
which is the dangerous part.

---

## 12. No length limit on any text column

**Severity:** Medium
**Where:** schema-wide

`groups.name`, `groups.stakes_label`, `players.name`, `players.display_name`,
`sessions.notes` and `profiles.display_name` are all unbounded `text`, with no
client-side cap either. One beta user pasting 50KB into a group name breaks
every page that renders it.

**Fix.** `check (length(col) <= n)` on each, plus `maxLength` on the inputs.

**Decision:** **BACKLOG — post-beta.**

---

## 13. Cross-tab auth lock is disabled

**Severity:** Medium
**Where:** `src/lib/supabase.ts:25`

```ts
lock: async (_name, _acquireTimeout, fn) => fn(),
```

The comment justifies it: *"this app is only ever driven from one tab at a
time."* That premise stops holding with public users. `navigator.locks` exists
to stop two tabs racing on a token refresh; without it, concurrent refreshes
can produce spurious sign-outs.

The original problem it was working around ("lock stolen" errors) is real, so
this needs testing rather than a blind revert.

**Fix.** Restore the default and re-test multi-tab, or scope the override
more narrowly.

**Decision:** **APPROACH CHOSEN, scheduled post-beta.** Restore the
`navigator.locks` default and test multi-tab properly, handling "lock stolen"
rather than disabling the lock.

**Flagged:** this is the one backlogged item with a direct beta-user symptom —
spurious sign-outs for anyone with two tabs open. Worth reconsidering whether
it really waits.

---

## 14. Raw database errors reach the UI

**Severity:** Medium — information disclosure
**Where:** `src/lib/errors.ts:10-14`

`describeError()` concatenates Postgres `message`, `details`, `hint` and
`code` into the on-screen string. Useful while you are the only user; it shows
strangers your schema, your policy names and your constraint names.

**Fix.** Map known codes to human sentences for the UI, keep the full object
going to `console.error`.

**Decision:** **APPROACH CHOSEN, scheduled post-beta.** Map known Postgres
codes (23505, 42501, 23514) to human sentences, generic message otherwise,
full object to `console.error`.

---

# Low and cleanup

## 15. Production data is dirty

Four test groups — `test1`, `test phase 3a`, `test phase 4`, `test phase 5` —
and four profile-less auth users (the same four as finding 6). They will
appear in the app-owner admin overview. Clean before beta.

**Decision:** **BACKLOG — post-beta.** The four orphan accounts stay, which is
why finding 6 is in scope.

---

## 16. Largest-remainder rounding picks the wrong winner when the discrepancy is negative

**Where:** `src/lib/reconcile.ts:146-152`

`Math.trunc` rounds toward zero while the remainder is computed as a positive
modulo. For a negative discrepancy the two disagree, so the ±1 cent goes to
the slot with the *smallest* true remainder rather than the largest.

Totals still sum exactly — no money is created or lost. Only *which* winner
absorbs the odd cent is wrong. Cosmetic, but it is a documented algorithm
behaving differently from its comment.

**Decision:** **BACKLOG.**

---

## 17. Vestigial schema

- `sessions.submitted_at` and `sessions.submitted_by` survive `0020`, which
  removed the `submitted` state. `useSessionReview.ts:54` still writes
  `review_note: null`.
- `players.user_id` and `players.username` are legacy duplicates of
  `profile_id` and the profile's username; `0018:404` calls them out as
  "Legacy columns ... The contract migration drops them".
- `default_group_id()` is still the column default on `players`, `sessions`
  and `payouts` despite `0008:34` marking it `TRANSITIONAL (0008). Drop in
  0009.`

**Decision:** **BACKLOG.** Deliberately not folded into the `save_session`
migration — that migration is risky enough without unrelated drops riding
along.

---

## 18. No security headers

`vercel.json` sets rewrites only. No CSP, no `X-Frame-Options`, no
`Referrer-Policy`, no `X-Content-Type-Options`.

**Decision:** **BACKLOG.**

---

## 19. `anon` holds table-level INSERT/UPDATE grants on every table

RLS blocks it — verified, an anon insert returns `42501` — so this is not
presently exploitable. But RLS is the *only* thing stopping it. `revoke` would
be belt-and-braces on the money tables.

**Decision:** **BACKLOG.**

---

## 20. `buy_ins` has no `updated_at`

Against the CLAUDE.md convention (*"Always include `created_at` and
`updated_at` on tables"*). Arguably fine, since buy-ins are insert-and-delete
only and never updated — but then the convention should say so.

**Decision:** **BACKLOG.**

---

## 21. CLAUDE.md and CI disagree about the lint ratchet

CLAUDE.md says lint runs `--max-warnings 1`. `.github/workflows/ci.yml` uses
`0`, and its comment explains why it was tightened. The CI file is right; the
doc is stale.

**Decision:** **BACKLOG.**

---

## 22. Single 603 KB bundle, no route splitting

603 KB raw, 175 KB gzip, one chunk. Vite warns about it on every build. The
login page loads the entire app, including the charts. Relevant because the
stated use is phones at a table.

**Decision:** **BACKLOG.**

---

## 23. Four files exceed the ~200-line convention

`GroupSettingsPage.tsx` (223), `PlayerRatingPage.tsx` (211),
`GroupMembersPage.tsx` (208), `SessionFormPage.tsx` (201). CLAUDE.md: *"If a
component file passes ~200 lines, split it."*

**Decision:** **BACKLOG.**

---

## 24. `index.html` has no favicon, meta description or OG tags

A missing favicon is a 404 in every visitor's console, and a shared link has
no preview card.

**Decision:** **BACKLOG.**

---
