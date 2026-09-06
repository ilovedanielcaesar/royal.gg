# WORKFLOW.md — multi-group build tracker

Live progress for the v1.1 group work. **`GROUPS.md` is the design** (what and
why). **This file is the state** (where we are). If they ever disagree,
`GROUPS.md` wins and this file is stale.

**Convention:** `[ ]` todo · `[~]` in progress · `[x]` done · `[!]` blocked ·
`[-]` dropped. Update the status table and the change log in the same edit as
the checkbox — a tick with no log entry is how this file rots.

---

## Status

| Phase | What | State | Done |
|:--:|---|---|:--:|
| **0** | Provider consolidation | `[x]` **done** | 5/5 |
| **1** | `0007`–`0013` applied | `[~]` RLS + contract left | 15/18 |
| **2** | Group routing + picker | `[x]` **done** | 8/8 |
| **3** | Joining + membership | `[~]` 3A/3B/3C done, 3B-2 left | 3.5/4 |
| **4** | Game log states | `[ ]` not started | 0/6 |
| **5** | Settings, guest linking, admin | `[ ]` not started | 0/5 |

**Current focus:** 3B-2 — the group settings page, the last piece of Phase 3.
The join code is still only reachable through `scripts/db.mjs`, and the join
policy cannot be changed from the UI at all.

Phase 2 verified by Will in the browser: a new group shows no Royal members,
guests or sessions.

**Last updated:** 2026-09-06 · Phase 3C complete: members page committed,
`0012` applied, `0013` written and rehearsed.

---

## Phase 0 — Provider consolidation

No user-visible change. Pure refactor, and the prerequisite for everything
else: it collapses the 32 scattered queries and 14 auth hooks that would
otherwise each need `group_id` threaded through them by hand.

- [x] `AuthProvider` — one auth listener + one profile fetch for the whole app
- [x] `useCurrentUser()` becomes a context read — **all 14 call sites unchanged**
- [x] `useLeagueData()` — single fetch of players/sessions/buy-ins/cash-outs/payouts
- [x] Replace the duplicated `Promise.all` block in 6 pages
- [x] Drop the redundant per-page single-player queries (read from the shared set)

**Moved to Phase 2:** `GroupProvider` and the `RequireGroupMember` /
`RequireGroupAdmin` guards. Both resolve `:slug` → group, and the `groups`
table doesn't exist until Phase 1. `useLeagueData()` is deliberately *not*
group-scoped yet — it gains `.eq("group_id", …)` in one place in Phase 2, which
is the entire reason for consolidating now.

**Keep synchronous:** the `onAuthStateChange` callback must not `await` any
Supabase call. See the deadlock note in `src/lib/auth.ts` — this is the bug
that blanked the tab on refocus.

**Exit gate**
- [x] `npm run build` and `npx tsc --noEmit` pass
- [x] Lint warnings **6 → 5**, 0 errors. Gate said 4; the real number is 5
      because the shared hook now carries the same fetch pattern once
      (`useLeagueData.ts:72`) in place of the two page copies it replaced.
      `PlayersPage:70` and `RecordsPage:65` did clear as predicted.
- [x] App still works signed out, pending, member, admin — manually verified
      by Will in the browser, incl. the tab-refocus fix.

The other four are *not* Phase 0's to fix, and the earlier "6 → 0" gate was
wrong: `ProfilePage:31` is a separate props-into-state issue,
`AdminApprovalsPage:33` has its own narrow query, and `SessionsListPage:89` /
`SessionFormPage:140` are rewritten in Phases 2 and 4. Zero is reachable after
Phase 4 — that's when `set-state-in-effect` goes back to `"error"`.

---

## Phase 1 — Migration

Touches live data. The risky one.

- [x] Supabase CLI installed (2.116.0), `supabase init`, project linked
- [x] Migration history verified in sync: `0001`–`0006` local **and** remote,
      `db push --dry-run` reports up to date. No `migration repair` needed.
- [x] Backup — free tier has none, so `scripts/db-backup.mjs` snapshots all
      344 rows + money totals to gitignored `backups/`
- [x] Direct DB access: `pg` + `scripts/db.mjs`, reading `SUPABASE_DB_URL`
      from `.env.local`
- [x] **`0007_groups.sql` written and applied** — EXPAND only (see below)
- [x] Preflight: 15 checks passed on real data before applying
- [x] Verify: `profiles` (12) == `players` with a `user_id` (12)
- [x] Verify: every player/session/payout resolves to exactly one group
- [x] Verify: money byte-identical pre/post (696000 / 696875 / 696250)
- [x] **`0008_group_id_default.sql`** — hotfix. 0007 added three NOT NULL
      `group_id` columns with no default, which broke every INSERT path
      (signup, add guest ×2, create session, record payout). Reads were fine,
      so the smoke test missed it. Adds a transitional default via
      `default_group_id()`; 0011 drops it.
- [x] **`0009_auth_profiles_trigger.sql` applied** — Phase 3A. Additive only:
      the `auth.users` trigger, nullable `profiles.username`, and two narrow
      INSERT policies so a new account can found a group. Rehearsed against
      live data first (18/18), then pushed; confirmed in the live schema —
      trigger present, `username` nullable, both founder policies there.
- [x] **`0010_group_join.sql` applied** — Phase 3B. Additive: the two
      membership helpers, `join_group()`, and the group-admin policies for
      `groups` and `group_invites`. 32/32 rehearsed, then pushed.
- [ ] RLS isolation — swap to `is_group_member()`/`is_group_admin()`, which
      `0010` already created. **AFTER Phase 3**, not Phase 2: switching the
      `players` policies breaks `signUp()` until the join flow exists.
- [ ] Contract — drop `players.user_id/.username/.status/.is_guest`,
      the old global unique indexes, `is_admin()`, and the transitional
      `default_group_id()` defaults. AFTER auth moves to profiles in Phase 3.

**⚠ Numbering has shifted twice.** 3A needed a migration of its own, and the
Supabase CLI only recognises filenames matching `<digits>_name.sql` — a
`0009a_` file is not a valid version and risks being skipped in silence rather
than erroring. So 3A took `0009`, and the two planned migrations moved to
`0010` (RLS) and `0011` (contract). `0008`'s own header comment still says
"0009 drops them"; it means `0011` now. The applied file was left untouched on
purpose rather than disturb migration history for a comment.

**⚠ SCHEMA DRIFT FOUND — must be handled in 0010.** Four policies exist in the
live database that are in NO migration, added by hand in the dashboard:

    players_select_all · sessions_select_all
    buy_ins_select_all · cash_outs_select_all      all `using (true)`

RLS policies are OR-ed. Adding a strict `is_group_member(group_id)` policy
while these survive leaves every group's data readable by every authenticated
user — and the app would look perfectly correct while doing it. `0010` MUST
drop these by name, and must end with an assertion that no permissive
`using (true)` SELECT policy remains on players/sessions/buy_ins/cash_outs/
payouts. Verify with:

    select tablename, policyname, qual from pg_policies
    where schemaname='public' and qual = 'true';

This is also why `db push` alone can't be trusted as the source of truth here:
the migrations and the live database had diverged before we started.
- [ ] Regenerate `src/types/database.ts` from the live schema

**EXPAND/CONTRACT split.** `GROUPS.md` §8 had `0007` dropping
`players.user_id`/`.username`/`.status` and swapping the policies. That would
have broken the live app instantly — `AuthProvider` reads `status`, `signUp()`
writes `user_id`/`username`, and new-user signup needs the old insert policy.
So `0007` is purely additive (drops nothing, changes no existing policy) and
all destructive work moved to `0008`, after the frontend migrates in Phase 2.

**Resolved by preflight:** `is_guest` is exactly equivalent to
`user_id is null` (12 accounts + 6 guests = 18, zero exceptions), so `0008`
can safely drop it and derive from `profile_id`. That was the open question in
`GROUPS.md` §3.

**Pre-existing, unrelated to this work:** 2 sessions are flagged
`needs_review` with real gaps of −$110.00 (2026-08-26) and +$107.50
(2026-08-30). Correctly never auto-adjusted (both far over the $5 threshold).
They need real numbers entered at some point.

**Lesson from 0007:** "additive" is not automatically "safe". Adding a NOT
NULL column with no default breaks every existing INSERT that omits it. Read
paths kept working, so a click-through smoke test did not catch it — only a
real insert probe did. Probe writes, not just reads, after any schema change.

**Watch for**
- Helpers **must** be `security definer` — a plain function selecting from
  `group_members` inside a `group_members` policy recurses forever
- Steps 7 and 10 (dropping columns, dropping policies) are irreversible
- No policy on `sessions` / `buy_ins` / `cash_outs` / `payouts` may reference
  `is_app_owner()` — that rule is the whole superadmin promise

**Exit gate**
- [ ] Existing group loads with all history intact and correct totals
- [ ] A second test group is invisible to the first group's members

---

## Phase 2 — Group routing

- [x] `/groups` picker + `/groups/new` (chunk B)
- [x] `/g/:slug/*` for all existing pages, nested so `GroupProvider` is
      declared once inside the `:slug` route (chunk B)
- [x] `/` redirects: one group → its dashboard, else `/groups` (chunk B)
- [x] Every `<Link>`/`navigate()` slug-aware via `path()` — verified by grep,
      zero stale refs (chunk C)
- [x] Group switcher + `GroupNav` in the header (chunk C)
- [x] `/profile` global (account + groups); new `/g/:slug/profile` for your
      card and per-group stats (chunk D)
- [x] `useLeagueData` scoped to the active group (chunk D)
- [ ] **Browser test by Will** — see exit gate

**Delivered in 4 Codex chunks (A–D).** One big spec failed twice; small specs
worked first time. Chunk C's spec had a real contradiction (a nav rendered by
AppLayout can't call `useGroup()`, since AppLayout is above `GroupProvider`) —
Codex stopped and asked rather than hacking round it. Resolved by having
`GroupNav` parse the slug from the URL; it's the one place allowed to, and
says so in a comment.

**Leak found by Will's browser test, now fixed (`cce16fb`).** `SessionsListPage`
and `SessionFormPage` were never moved onto `useLeagueData` (different query
shapes), so they read every group's rows. Worse, four INSERT paths omitted
`group_id` — `0008`'s transitional default then filed them under the *oldest*
group, so a session logged in a new group would have landed in Royal. Also
fixed: React Router keeps those components mounted when only `:slug` changes,
so their effects served the previous group's data after a switch.

*Lesson:* a page that doesn't use the shared data hook is invisible to
"scope the data" work. Grep `\.from("` and check every call site, not just the
ones the hook covers.

⚠ **Scoping is client-side only.** `useLeagueData` asks for one group's rows,
but RLS still returns everything to any authenticated user — anyone who calls
the API directly still sees every group. Real isolation is `0010`.

**Exit gate** — code done, needs a browser run:
- [x] `tsc` 0, build passes, lint 5 → 3 warnings / 0 errors
- [x] Sign in → lands on `/g/royal`, all 16 sessions and correct totals
- [x] Create a second group at `/groups/new`, switch between them
- [x] Second group starts empty — verified in-DB with a rolled-back probe
      group: royal 18/16, test1 0/0, probe 1/1
- [x] A pasted `/g/royal/players/<id>` link opens the right page

---

## Phase 3 — Joining and membership

Split into chunks, same as Phase 2 — one small Codex spec at a time.

**⚠ LIVE ISSUE this phase fixes:** `signUp()` still writes a `players` row with
no `group_id`, so every new signup today becomes a *pending player in Royal*,
whichever group they meant to join. Verified with a rolled-back probe.

**3A — auth onto `profiles`** `[x]` **done**
- [x] **`0009_auth_profiles_trigger.sql`: trigger on `auth.users` that creates
      the `profiles` row**, and `profiles.username` nullable. Provider-agnostic,
      so Google sign-in later needs no frontend change. See `GROUPS.md` §10b.
- [x] `signUp()` creates the auth user only — the trigger makes the profile.
      No `players` row, no group. A new account belongs to nothing until it
      joins one. Username + display name ride along in `options.data`.
- [x] `AuthProvider` reads identity from `profiles`, not `players`
- [x] App-owner flag from `profiles.is_app_owner`, replacing the
      `username === ADMIN_USERNAME` check. `ADMIN_USERNAME` and
      `VITE_ADMIN_USERNAME` are both deleted.
- [x] `isPending`/`isApproved` are gone from the auth context entirely — group
      membership is `useGroup()`'s to answer. Signed in with no active
      membership → `/groups`.
- [x] Retire the global `/pending` page and `/admin/approvals` (both become
      per-group in 3C). `RequireAdmin` deleted with them.
- [x] New account with no groups → `/groups`, whose empty state offers
      "create a group" (join-by-code lands in 3B)
- [x] **Extra, agreed with Will:** `0009` also adds `groups_insert_own` and
      `group_members_insert_founder`. Without them `groups_write_admin` (0007)
      still gates group creation on `is_admin()` — the hardcoded
      `will@royal.gg.local` — so a brand-new account would reach `/groups` and
      get an RLS error from the one button on the page. Both are additive and
      narrow: you may create a group you own, and add only *yourself* as admin
      to a group *you* created. `0010` replaces them along with the rest.
- [x] **Four pages were reading the wrong admin flag.** `DashboardPage`,
      `PlayersPage`, `RecordsPage` and `SessionsListPage` gated group actions
      on the global `isAdmin`. Once that flag became `profiles.is_app_owner`
      they would have been gating money UI on the superadmin — which
      `GROUPS.md` §6 forbids. All four now read `isGroupAdmin` from
      `useGroup()`. Invisible in the browser (Will is both), but it is the
      difference between correct and accidentally correct.
- [x] `DashboardPage` found "you" through the auth context's player row, which
      no longer exists. It now looks up its roster row by `profile_id` within
      the active group, the way `MyGroupProfilePage` already did.
- [x] **`npx supabase db push`** — run by Will
- [x] **Browser test by Will** — app healthy after the migration

**Known interim state:** a member whose `group_members.status` is `pending`
now lands on `/groups` and sees "No groups yet" rather than a waiting room.
The per-group approvals queue in 3C is what gives that state a real screen.
No live row is affected — every membership in both groups is currently
`active`.

**3A gate**
- [x] `tsc` 0, build passes, lint 3 → 2 warnings / 0 errors (the one that went
      was `AdminApprovalsPage`, deleted; the two left are the `SessionFormPage`
      / `SessionsListPage` effects that Phase 4 rewrites)
- [x] `node scripts/smoke-3a.mjs --rehearse` — 18/18 against live data, inside
      a transaction that is always rolled back. Probes WRITES, per 0007's lesson
- [x] After the push: `node scripts/smoke-3a.mjs` (no flag), run by Will
- [x] Existing account signs in and the app works — checked in the browser
- [ ] Sign up a fresh account → lands on `/groups`, empty state, no Royal data
- [ ] That account creates a group → becomes its admin, sees only its own
- [ ] Confirm in the DB that the new signup made **no** `players` row anywhere

The last three want a throwaway account and nobody has made one yet. The
smoke test covers the same ground at the database level — signup writes no
`players` row, a founder can create a group, a stranger cannot join it — so
this is confirmation through the UI rather than an untested path. Worth doing
once before 3B builds join-by-code on top of it.

**3B — joining** `[~]` migration applied, UI delegated in two chunks
- [x] **`0010_group_join.sql` applied.** Additive: the `is_group_member()` /
      `is_group_admin()` helpers (early, because 3B needs them — the RLS
      migration reuses them), `join_group(p_code text)`, and the two policies
      that let a group admin who is not the app owner run their own group.
- [x] `join_policy`: `code` → active immediately; `code_approve` → pending
- [x] Refuse expired and used-up invites — enforced by a conditional UPDATE
      (`where used_count < max_uses`) and `FOUND`, not by the read. A
      read-then-write check lets two people redeem a one-shot link at once.
- [x] A `removed`/`rejected` member is refused, not readmitted (decision 9)
- [x] `node scripts/smoke-3b.mjs --rehearse` — 32/32 against live data, then
      pushed and re-run green by Will
- [x] `/join/:code` and the `/groups` empty state — Codex chunk 3B-1,
      reviewed and committed (`32fe518`). Two defects fixed on review: the
      pending card outlived a change of `:code` and hid the next error (same
      class as the Phase 2 leak), and the join form existed only in the
      `/groups` empty state, so anyone already in a group had no route to it.
- [ ] `/g/:slug/settings`: show + regenerate the code, create/revoke invites —
      **Codex chunk 3B-2**, deferred until after 3C-1

**Why joining is an RPC and not a client insert.** `group_members` INSERT is
reachable only by `group_members_write_admin` (`is_admin()`) and
`group_members_insert_founder` (yourself, into a group you created); a joiner
matches neither. `group_invites` has one policy, `is_admin()`, so a joiner
cannot read a token to validate it. And resolving codes server-side means the
client never reads `groups.join_code`, which is what lets the RLS migration
lock `groups` reads down without breaking joining.

**Found by the smoke test:** `revoke ... from public` does NOT remove Supabase's
default grant. Default privileges grant EXECUTE on every new function in
`public` *directly* to `anon` and `authenticated`, and a direct grant survives a
revoke aimed at PUBLIC — `anon` could call `join_group()` and was stopped only
by its own signed-in guard. Every new function must `revoke ... from public,
anon` by name and assert `has_function_privilege('anon', …)` is false. The RLS
migration adds helpers the same way; it must do the same.

**No roster row on join.** `players_name_unique` (`lower(name)`, not partial),
`players_user_id_unique` and `players_username_unique` are all still global, so
the insert would be rejected for anyone already on another group's roster. 3C
owns roster creation, must drop those three indexes first, and must cover BOTH
paths — approval, and an instant-active join under `join_policy = 'code'`, which
never passes through an approval at all.

**3C — membership management** `[~]` migration applied, UI delegated
- [x] **`0011_membership_management.sql` applied.** Additive:
      `group_members_update_group_admin` (a group admin may UPDATE memberships
      in their own group — approve/reject/promote/remove are all UPDATEs, and
      the table was writable only by `is_admin()` and the founder policy), plus
      the `group_members_last_admin` guard trigger.
- [x] Last-admin guard as a DB trigger, not just UI. Covers demotion, status
      change AND outright DELETE — a superuser delete is refused too. A
      *pending* admin does not count as cover, or you could demote yourself
      while your replacement waits on an approval only you can grant.
- [x] `node scripts/smoke-3c.mjs --rehearse` — 18/18, then pushed and re-run
      green by Will
- [x] Per-group approvals queue + promote/demote/remove UI — Codex 3C-1,
      reviewed and committed (`41b910e`). Three fixes on review: three JSX
      lines of 379/634/232 chars reformatted, the 294-line page split into
      `MemberRow.tsx` (the spec asked; it did not), and shared helpers moved
      to `lib/membership.ts` — exporting a runtime helper from a component
      file trips `react-refresh/only-export-components`.
- [x] **`0012_roster_on_activation.sql` applied.** Dropped the four global
      unique indexes and added the roster-row trigger. Backfilled every
      already-active member. 19/19 rehearsed, then pushed.
- [x] **`0013_refuse_duplicate_roster_name.sql`** — a duplicate roster name
      now refuses the join instead of inventing "Bob (2)". 24/24 rehearsed.
- [ ] Browser test of `/g/:slug/members` by Will

**The index drops, done.** `0012` dropped `players_name_unique`
(`lower(name)`), `players_user_id_unique`, `players_username_unique` and
`players_chosen_card_unique` — all global, all superseded by the group-scoped
indexes `0007` created. `players_user_id_unique` was the blocker `GROUPS.md`
§1 names: while it stood, one account could hold at most ONE `players` row
app-wide. A backup was taken first (`scripts/db-backup.mjs`, 344 rows, money
`696000 / 696875 / 696250` unchanged).

**The roster row is created by a TRIGGER, not by the approving UI.** Two paths
never meet — an admin approving a request, and an instant-active join under
`join_policy = 'code'` that passes through no approval at all. One trigger on
`group_members` catches both and cannot drift the way two call sites would. It
is idempotent on `(group_id, profile_id)`, so active → removed → active keeps
the same row and with it the member's whole history.

**Duplicate names refuse the join** (`0013`, Will's call). `0012` suffixed to
"Bob (2)"; that leaves a group with two rows a human cannot tell apart, and the
only way back is the guest linking that does not exist yet. Now `join_group()`
refuses before writing anything, with a message telling the joiner to change
their display name — including on a `code_approve` group, since there is no
point accepting a request that could never be approved.
`ensure_group_roster_row()` still raises as the backstop, for a clash that
appears between the request and the approval; that message is aimed at the
admin. Both surface unchanged in the UI, because `JoinPage` and
`GroupMembersPage` both show the Postgres message verbatim.

**Known consequence:** someone who played as a guest and then makes an account
is refused by name. That is decision 12's guest linking arriving before guest
linking exists (Phase 5). The workaround today is for the admin to rename the
guest row first.

**New roster rows populate the legacy columns.** `PlayerProfilePage:75` still
shows `player.username`, and `PlayersPage` still filters on `.status` and
`.is_guest`, so `user_id` and `username` are filled from the profile. The
contract migration drops the columns and updates those readers together.

Verified live: `dale` holds memberships in both `royal` and `test1`, and the
`0012` backfill gave them a `test1` roster row — the first this mechanism
produced.

**A separate `/g/:slug/members` page.** `GROUPS.md` §9.2 has members inside
`/g/:slug/settings`; folding approvals, roles, removal, the join code, invites
and the join policy into one page would blow well past the ~200-line
convention. 3B-2's settings page links to it instead.

**3D — the migrations**
- [ ] **RLS isolation** (drop the 4 rogue `using (true)` policies!), and
      replace 3A's founder policies and 3B's group-admin policies
- [ ] **Contract**: drop the old columns, the three global unique indexes,
      `is_admin()`, and the transitional `default_group_id()` defaults

Numbers are deliberately not pinned here any more. They have shifted twice —
3A took `0009` and 3B took `0010`, each because a phase needed a migration
nobody had planned. Name them when they are written.

Original checklist, for reference:
- [ ] Standing `join_code` per group + admin regenerate
- [ ] `group_invites`: expiring / limited-use links
- [ ] `/join/:code` accepts either a code or an invite token
- [ ] `join_policy`: `code` vs `code_approve`
- [ ] Approvals queue (per group, replacing `/admin/approvals`)
- [ ] Promote / demote / remove members
- [ ] Last-admin guard — enforce in a DB trigger, not just the UI

**Exit gate**
- [ ] Second account joins by code, gets approved, sees only that group
- [ ] Expired and used-up invites are refused
- [ ] Removing a member revokes access and leaves their history untouched

---

## Phase 4 — Game log states

- [ ] `draft → submitted → approved` on `sessions`
- [ ] Any member creates/edits a draft; creator can delete their own
- [ ] Submit for approval
- [ ] Admin approve / send back with note / reopen
- [ ] Approval blocked while `needs_review` (over the group's threshold)
- [ ] `SessionFormPage` respects state + role (currently admin-only throughout)

**Exit gate**
- [ ] Member submits, admin sends back, member fixes, admin approves
- [ ] Approved log is read-only to members and editable only after reopen
- [ ] Reported and adjusted values both survive a full round trip

---

## Phase 5 — Settings, linking, admin

- [ ] `/g/:slug/settings` — stakes, buy-in, threshold, join policy
- [ ] `DEFAULT_BUY_IN_CENTS` / `RECONCILE_THRESHOLD_CENTS` deleted, read from group
- [ ] Guest linking — admin merges a guest row into a joined account
- [ ] Per-group card picker (unique within the group)
- [ ] `/admin` superadmin overview — accounts + groups, **no money**

**Exit gate**
- [ ] A group on different stakes computes correctly end to end
- [ ] Linked guest keeps every game and their leaderboard position
- [ ] Superadmin cannot reach any group's money, verified by query

---

## Open items

Carried from `GROUPS.md` §11 — not blocking any phase.

- [ ] Notifications: nothing tells an admin a log awaits approval, or a member
      that theirs was sent back. In-app badge probably enough.
- [ ] Does `/profile` show cross-group totals? Different stakes don't sum
      honestly, so this needs a defined meaning first.
- [ ] Group deletion vs archiving. No path exists today.

---

## Deferred cleanup

Found in the audit, deliberately not done yet.

- [ ] `player_rating_calibration.py` — second source of truth for the rating
      weights, kept in sync by hand. Delete when tuning is finished.
- [ ] `SessionFormPage.tsx` is 704 lines, `DashboardPage.tsx` 503 — both well
      over the ~200-line convention. Natural to split during Phase 4 and 2.
- [ ] `npm audit`: 8 pre-existing vulnerabilities (vite, react-router, postcss,
      nanoid, browserslist, babel). `npm audit fix` wants major bumps — its own
      piece of work, not to be folded into this.

---

## Change log

Newest first. One line per meaningful change.

- **2026-09-06** — Phase 3C done. `0012_roster_on_activation.sql` dropped the
  four global unique indexes (including `players_user_id_unique`, the blocker
  GROUPS.md §1 names) and added a trigger that creates the roster row whenever
  a membership becomes active — covering approval and instant-active joins
  alike. Backup taken first; money unchanged to the cent.
  `0013_refuse_duplicate_roster_name.sql` then replaced `0012`'s "Bob (2)"
  suffixing with a refusal, on Will's call: a clash now blocks the join with a
  message telling the person to change their display name. 3C-1 members page
  from Codex, reviewed and committed as `41b910e`.
- **2026-09-06** — `0011_membership_management.sql` applied: a group admin can
  finally act on their own membership list, and the last-admin guard is a
  trigger covering update AND delete. Found by testing: joining `test1` from a
  second account landed `pending` with nowhere to see it, because `/admin/
  approvals` went away in 3A and the per-group queue did not exist yet. So 3C
  was pulled ahead of 3B-2. 18/18 rehearsed, then pushed. Roster creation on
  approval stays blocked on dropping the three global unique indexes.
- **2026-09-06** — Phase 3B-1 (join page) delivered by Codex against a scoped
  spec, reviewed, two defects fixed, committed as `32fe518`.
- **2026-09-06** — `0010_group_join.sql` written, rehearsed 32/32, pushed by
  Will and re-run green. Adds `is_group_member()`/`is_group_admin()`,
  `join_group()`, and group-admin policies for `groups`/`group_invites`. The
  smoke test caught that `revoke ... from public` leaves Supabase's default
  direct grant to `anon` in place — every new function now revokes `anon` by
  name and asserts it. 3B's two UI chunks delegated to Codex.
- **2026-09-06** — `0009` pushed and verified in the live schema; smoke test
  green after the push and the app checked in the browser. Phase 3A done.
- **2026-09-06** — Phase 3A code complete. An account now exists independently
  of any group: `0009_auth_profiles_trigger.sql` (auth.users trigger, nullable
  `profiles.username`, two founder INSERT policies), `signUp()` reduced to
  creating the auth user, `AuthProvider` on `profiles`, `/pending` and
  `/admin/approvals` retired, and four pages moved off the global admin flag
  onto `isGroupAdmin`. Migration numbering shifted: RLS is `0010`, contract
  `0011` — `0009a` is not a filename the Supabase CLI recognises. New
  `scripts/smoke-3a.mjs` probes the write paths in a rolled-back transaction;
  18/18 against live data. Not pushed yet.
- **2026-09-06** — Phase 2 DONE, verified by Will in the browser. Phase 3
  planned in 4 chunks (3A auth→profiles, 3B joining, 3C membership,
  3D migrations 0009/0010).
- **2026-09-06** — Fixed group leakage in SessionsListPage / SessionFormPage /
  PlayersPage: 2 unscoped reads and 4 unscoped writes, plus stale-group effect
  deps. Found by Will testing a second group.
- **2026-09-06** — Phase 2 chunks B/C/D done: routing, group-aware links +
  switcher, group-scoped data, ProfilePage split. Codex model switched to
  gpt-5.6-sol (soul/terra unsupported on a ChatGPT account); fixed run.sh's
  --resume path, which passed --cd/-s that `codex exec resume` rejects.
- **2026-09-06** — Phase 2 chunk A done: groupContext, GroupProvider,
  RequireGroupMember, RequireGroupAdmin. Reviewed; fixed 2 defects (missing
  cancelled guards, path() double-slash). Not wired up yet — chunk B is routing.
- **2026-09-06** — Codex Phase 2 (one big spec) FAILED twice: run 1 interrupted,
  run 2 killed at 30min. Run 2's partial output was accidentally swept into
  2fa9263 by `git add -A` and broke the build; reverted in 8eae510. Lesson:
  give Codex one small chunk at a time, and check `git status` before staging.
- **2026-09-05** — Found 4 undocumented `using (true)` RLS policies in prod
  (`*_select_all`) that exist in no migration. They would silently defeat
  group isolation, since policies are OR-ed. Recorded as a hard requirement
  for 0009.
- **2026-09-05** — Phase 2 delegated to Codex (routing, GroupProvider,
  /g/:slug/*, group picker, ProfilePage split, group-scoped useLeagueData).
- **2026-09-05** — `0008_group_id_default.sql`: hotfix for 0007's NOT NULL
  group_id columns breaking all INSERT paths. Transitional default, dropped
  in 0009.
- **2026-09-05** — `0007_groups.sql` applied to production. profiles/groups/
  group_members/group_invites created; 12 profiles, 12 memberships, group
  `royal`, will = admin + app owner. Money unchanged to the cent. Split into
  expand/contract; `0008` deferred.
- **2026-09-05** — Phase 0 implemented (Codex, run interrupted; finished and
  corrected by hand). `AuthProvider` + `authContext` + `useLeagueData`;
  −413/+68 across 8 files. 14 auth listeners → 1. Codex's interrupted run left
  2 build errors and an unstable `?? []` pattern that added 13 lint warnings;
  both fixed with a module-level `EMPTY_LEAGUE_DATA`.
- **2026-09-05** — Supabase CLI installed + linked. Migration history
  confirmed in sync (0001–0006 both sides); `db push` is a clean no-op, so
  Phase 1 needs no repair step.
- **2026-09-05** — `GROUPS.md` written; 12 design decisions agreed. This
  tracker created. Nothing built yet.
- **2026-09-05** — Fixed tab-refocus blank page (Supabase auth deadlock),
  added `vercel.json` SPA rewrite, added `ErrorBoundary`. Committed.
- **2026-09-05** — ESLint installed and configured; 6 warnings, all in code
  Phase 0 replaces. Committed.
- **2026-09-05** — Dead-code audit: removed `sessionScore`, `consistencyScore`,
  `monogram`, two phantom RPC types, unused prop surfaces, two duplicate CSV
  importers. −146 lines in `src/`. Committed.
