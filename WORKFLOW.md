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
| **0** | Provider consolidation | `[~]` code done, untested | 5/5 |
| **1** | `0007_groups.sql` + backfill | `[~]` tooling ready | 2/9 |
| **2** | Group routing + picker | `[ ]` not started | 0/6 |
| **3** | Joining + membership | `[ ]` not started | 0/7 |
| **4** | Game log states | `[ ]` not started | 0/6 |
| **5** | Settings, guest linking, admin | `[ ]` not started | 0/5 |

**Current focus:** Phase 0 code complete; needs a manual smoke test in the
browser before it can be called done.

**Last updated:** 2026-09-05 · design agreed, nothing built.

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
- [ ] **App still works signed out, pending, member, admin** — NOT yet
      verified. Build-level only; needs a real browser run.

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
- [ ] **Take a Supabase backup before anything else**
- [ ] Write `supabase/migrations/0007_groups.sql` (steps 1–11, `GROUPS.md` §8)
- [ ] Dry-run the backfill on a branch/copy, not production
- [ ] Verify: `profiles` count == `players` with a `user_id`
- [ ] Verify: every session, buy-in and cash-out resolves to exactly one group
- [ ] Apply to production
- [ ] Regenerate `src/types/database.ts` from the live schema

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

- [ ] `/groups` picker + `/groups/new`
- [ ] `/g/:slug/*` for all existing pages
- [ ] `/` redirects: one group → its dashboard, else `/groups`
- [ ] Every `<Link>` and `navigate()` rewritten to be slug-aware
- [ ] Group switcher in the header
- [ ] `/profile` becomes global (account + your groups)

**Exit gate**
- [ ] Can create a second group and switch between them
- [ ] A pasted deep link opens the right group for the right person

---

## Phase 3 — Joining and membership

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
