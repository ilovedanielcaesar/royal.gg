# GROUPS.md — multi-group design

Status: **agreed design, not yet built.** This is the spec for the v1.1 group
work. `CLAUDE.md` remains authoritative for domain rules and conventions;
this document only covers what changes when royal.gg stops being a single
group.

---

## 1. The problem

Today `players` does three unrelated jobs at once:

| Job | Columns |
|---|---|
| An account you log in with | `user_id`, `username` |
| Membership state of the one group | `status` |
| A roster entry that money points at | `name`, `is_guest`, `chosen_suit/rank` |

Four constraints are global, and each one blocks multiple groups:

```
players_name_unique        (lower(name))                   two groups can't both have a "Dan"
players_chosen_card_unique (chosen_suit, chosen_rank)      52 humans app-wide, ever
players_user_id_unique     (user_id)                       one account = at most ONE player row
is_admin()                 hardcoded 'will@royal.gg.local' one admin for the entire app
```

`players_user_id_unique` is the blocker: as written you **cannot** be a player
in two groups. And every RLS `select` policy is `using (true)`, so the moment a
second group exists, every member of group A can read all of group B's money.

---

## 2. Decisions

Settled in conversation, 2026-09-05. Each of these is a fork we do not need to
revisit.

| # | Decision | Choice |
|---|---|---|
| 1 | Identity across groups | One account, many rosters — `profiles` + per-group `players` |
| 2 | Routing | Slug in the URL, `/g/:slug/...` |
| 3 | Guests | Admin adds them to the roster; no account, no login |
| 4 | Balancing | Auto-reconcile runs, admin approves the adjusted result |
| 5 | Draft editing | Any member can edit the whole table |
| 6 | Superadmin | Exists, **outside all groups**; sees users + groups, never money |
| 7 | Stakes | Per-group buy-in and reconcile threshold |
| 8 | Join codes | Standing code per group **plus** expiring invite links |
| 9 | Removals | Access revoked, history and leaderboard position untouched |
| 10 | Player cards | Per group, unique within the group |
| 11 | Game log flow | Full round trip: send back to draft, reopen after approval |
| 12 | Guest linking | Admin links a guest row to a newly-joined account |

Two more, settled 2026-09-07 once Phase 5 was scoped against the live schema:

| # | Decision | Choice |
|---|---|---|
| 13 | Stakes vs. history | `sessions.buy_in_cents`, stamped at creation. A night keeps the stakes it was played at |
| 14 | Linking direction | Admin links the guest row **before** the person joins; the join then adopts it |

Settled 2026-09-08, building auth:

| # | Decision | Choice |
|---|---|---|
| 15 | Account linking | An existing account connects Google **from `/profile`, while signed in**. Signing in with Google first creates a second account with no way back |
| 16 | New signups | Real email address, no username field. Google is an alternative, not a replacement |

**On 15.** The mirror image of 14, and for the same reason: a person arrives
under a second identity and their history is attached to the first. All twelve
original accounts carry a synthetic `<username>@royal.gg.local` address, which
can never match a Google address, so Supabase's automatic identity linking
never fires for them. `linkIdentity()` attaches Google to the auth user already
signed in — one account, two ways in, every game intact.

The failure mode if they get it backwards is permanent: a second `auth.users`
row, a second profile, no groups, and no repair, because their roster row still
belongs to the first profile and `0018`'s guard rightly refuses to move a card
off an active member. There is no merge tool and building one would mean moving
`buy_ins` and `cash_outs` between profiles — the trade decision 14 already
rejected. So the warning lives on `/login`, where the mistake would be made.

**On 16.** Decision from §10b, now settled: a username is a display handle, not
a credential. Asking for one at signup implies otherwise and creates a second
thing to forget, so the form takes email, password and display name, and the
trigger seeds the handle from the email local part. The real address is also
what makes a forgotten password recoverable at all — reset is not built, but it
was previously *impossible*, because the mail went to a domain that does not
exist.

**On 13.** Decision 7 puts the buy-in on the group, which is right for a new
session and wrong for an old one: reopening a game logged at $40 after the
group moved to $50 would recompute its buy-ins at the new rate and silently
rewrite a night that is already settled. The group value becomes the *default a
session is stamped with*, not a value read live at edit time. Historical rows
backfill from `groups.default_buy_in_cents`, which is where they came from.

**On 14.** `0013` refuses a join whose roster name is already taken, and names
this feature as the missing fix. Linking first means the clash never happens:
the guest row gains a `profile_id`, and `ensure_group_roster_row()` is already
idempotent on `(group_id, profile_id)`, so the join adopts that row instead of
inserting a second one. The alternative — let both rows exist, then merge — has
to move `buy_ins` and `cash_outs` between players, and moving money to fix a
naming problem is a bad trade.

---

## 3. Schema

### New tables

```sql
-- One row per human account. Global: not scoped to any group.
profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  username      citext not null unique,
  display_name  text not null,
  is_app_owner  boolean not null default false,   -- superadmin; see §6
  created_at, updated_at
)

groups (
  id                        uuid primary key,
  name                      text not null,
  slug                      citext not null unique,
  join_code                 text not null unique,           -- standing code
  join_policy               text not null default 'code_approve'
                              check (join_policy in ('code','code_approve')),
  default_buy_in_cents      integer not null default 4000 check (> 0),
  reconcile_threshold_cents integer not null default 500  check (>= 0),
  stakes_label              text,                            -- "$0.25 / $0.50"
  created_by                uuid references profiles(id) on delete set null,
  created_at, updated_at
)

-- Expiring / limited-use invite links, alongside the standing join_code.
group_invites (
  id          uuid primary key,
  group_id    uuid not null references groups(id) on delete cascade,
  token       text not null unique,
  expires_at  timestamptz,          -- null = no expiry
  max_uses    integer,              -- null = unlimited
  used_count  integer not null default 0,
  created_by  uuid references profiles(id) on delete set null,
  created_at
)

-- Who may sign in to a group, and with what power. Guests have NO row here.
group_members (
  id          uuid primary key,
  group_id    uuid not null references groups(id) on delete cascade,
  profile_id  uuid not null references profiles(id) on delete cascade,
  role        text not null default 'member' check (role in ('admin','member')),
  status      text not null default 'pending'
                check (status in ('pending','active','removed')),
  created_at, updated_at,
  unique (group_id, profile_id)
)
```

### Changed tables

```sql
players
  + group_id    uuid not null references groups(id) on delete cascade
  + profile_id  uuid references profiles(id) on delete set null   -- NULL = guest
  - user_id     (moves to profiles.id)
  - username    (moves to profiles)
  - status      (moves to group_members.status; see note below)
  - is_guest    (now derivable: profile_id is null)

  unique (group_id, lower(name))
  unique (group_id, profile_id)                where profile_id is not null
  unique (group_id, chosen_suit, chosen_rank)  where both are not null

sessions
  + group_id     uuid not null references groups(id) on delete cascade
  + status       text not null default 'draft'
                   check (status in ('draft','submitted','approved'))
  + created_by   uuid references profiles(id) on delete set null
  + submitted_at timestamptz,  + submitted_by uuid references profiles(id)
  + approved_at  timestamptz,  + approved_by  uuid references profiles(id)
  + review_note  text          -- why an admin sent it back

payouts
  + group_id  uuid not null references groups(id) on delete cascade

buy_ins, cash_outs
  unchanged — they reach a group through session_id
```

**On dropping `players.status`:** a roster row now means "confirmed member of
this group's roster". Pending applicants have a `group_members` row and no
`players` row; they only get one on approval. Removed members keep their
`players` row (decision 9) with `group_members.status = 'removed'`. Nothing is
left for `players.status` to express.

**On dropping `is_guest`:** it becomes exactly `profile_id is null`, so keeping
it invites the two from drifting apart. Derive it in TS with a helper. If you'd
rather keep the explicit column, say so — it's ~6 read sites either way.

**Money stays integer cents everywhere.** No change to that rule.

---

## 4. Permissions

| Action | Member | Admin | Superadmin |
|---|:--:|:--:|:--:|
| View roster, leaderboard, past sessions | ✅ | ✅ | ❌ |
| Create a game log / edit any draft | ✅ | ✅ | ❌ |
| Submit a draft for approval | ✅ | ✅ | ❌ |
| Delete a draft | own only | ✅ | ❌ |
| Approve / send back / reopen | ❌ | ✅ | ❌ |
| Edit an approved game | ❌ | ✅ (reopen first) | ❌ |
| Record a payout / settle up | ❌ | ✅ | ❌ |
| Add a guest to the roster | ❌ | ✅ | ❌ |
| Link a guest to an account | ❌ | ✅ | ❌ |
| Approve join requests | ❌ | ✅ | ❌ |
| Promote / demote / remove members | ❌ | ✅ | ❌ |
| Rotate join code, manage invites | ❌ | ✅ | ❌ |
| Edit group settings (stakes, policy) | ❌ | ✅ | ❌ |
| List all accounts and groups | ❌ | ❌ | ✅ |

The superadmin column is empty almost all the way down on purpose — see §6.

**Last-admin guard (decision 11).** `Leave` and `Demote self` are blocked while
`count(active admins) == 1`. Enforce in a trigger on `group_members`, not only
in the UI.

---

## 5. Game log lifecycle

```
                    ┌──────────── send back (admin, + note) ───────────┐
                    ↓                                                  │
   [ draft ] ──submit──→ [ submitted ] ──approve──→ [ approved ]       │
       ↑                       │                          │            │
       │                       └──────────────────────────┼────────────┘
       └───────────── reopen (admin) ─────────────────────┘

  draft      any member edits any row; creator may delete
  submitted  locked to members; admin approves or sends back
  approved   admin-only; must reopen to change
```

Approval requires the books to balance **after** auto-reconciliation:

1. Compute `discrepancy = total_buy_ins − total_reported_cash_outs`.
2. `|discrepancy| ≤ group.reconcile_threshold_cents` → distribute
   proportionally across winners, store reported **and** adjusted, approve.
3. Over the threshold → `needs_review`, **approval blocked** until someone
   fixes the entry or an admin sends it back.

`reconcile()` already takes the threshold as its second argument, so this is a
call-site change, not a rewrite of the reconciliation logic.

---

## 6. Superadmin

Deliberately narrow. The superadmin is **not a member of any group**, appears
on no roster and no leaderboard, and cannot read a single cent.

```sql
is_app_owner()  -- reads profiles.is_app_owner for auth.uid()
```

It appears in exactly two policies — `profiles` and `groups` select, plus
`group_members` select for the membership overview. **No policy on `sessions`,
`buy_ins`, `cash_outs` or `payouts` may reference it.** That single rule is
what keeps the promise, and it should be checked whenever a policy is touched.

Break-glass for real emergencies is the Supabase dashboard, not the app.

This replaces the hardcoded email in `is_admin()` and the
`VITE_ADMIN_USERNAME` env var, both of which go away.

---

## 7. Row-level security

Three helpers, all `security definer` and `stable`:

```sql
is_app_owner()             -- superadmin flag
is_group_member(gid uuid)  -- active membership in gid
is_group_admin(gid uuid)   -- active membership in gid with role='admin'
```

**They must be `security definer`.** A policy on `group_members` that calls a
plain function selecting from `group_members` recurses infinitely. A
`security definer` function runs as its owner and bypasses RLS, which breaks
the cycle. This is the single easiest thing to get wrong in the whole
migration.

Shape of every policy:

```sql
-- money + roster: members only, writes gated further by state and role
create policy sessions_select on sessions
  for select to authenticated using (is_group_member(group_id));

create policy sessions_update_draft on sessions
  for update to authenticated
  using (is_group_member(group_id) and status = 'draft')
  with check (is_group_member(group_id) and status = 'draft');

create policy sessions_update_admin on sessions
  for all to authenticated
  using (is_group_admin(group_id)) with check (is_group_admin(group_id));
```

`buy_ins` and `cash_outs` have no `group_id`, so their policies reach the group
through `session_id`:

```sql
using (exists (
  select 1 from sessions s
  where s.id = buy_ins.session_id and is_group_member(s.group_id)
))
```

Index `sessions(group_id)` and `sessions(group_id, status)` — these subqueries
run on every row read.

---

## 8. Migration `0007_groups.sql`

Existing data is live, so order matters.

1. Create `profiles`, `groups`, `group_members`, `group_invites`.
2. Backfill `profiles` from `players` where `user_id is not null`
   (`id` ← `user_id`, carrying `username` and `display_name`).
3. Create the one existing group. Seed `default_buy_in_cents = 4000`,
   `reconcile_threshold_cents = 500`, and a `join_code`.
4. Backfill `group_members` from `players.status`; set `role='admin'` for the
   account matching the old `VITE_ADMIN_USERNAME`.
5. Add `group_id` to `players` / `sessions` / `payouts`, backfill to that
   group, then set `not null`.
6. Add `players.profile_id`, backfill from `players.user_id`.
7. Drop `players.user_id`, `.username`, `.status`, `.is_guest` and their
   indexes; add the three new group-scoped unique indexes.
8. Add the `sessions` workflow columns; backfill every existing session to
   `status = 'approved'` (they're all historical fact).
9. Drop `is_admin()`; create the three new helpers.
10. Drop every existing policy and write the new set.
11. Set `is_app_owner = true` on your profile.

**Verify before dropping anything:** `profiles` row count equals the count of
`players` with a `user_id`, and every `session`, `buy_in` and `cash_out`
resolves to exactly one group. Take a Supabase backup first — steps 7 and 10
are not reversible.

---

## 9. Frontend

**Do §9.1 before the migration.** Threading `group_id` through 32 scattered
query sites and 14 independent auth hooks is the whole difficulty; collapsing
them first turns the migration into a handful of files.

### 9.1 Providers (prerequisite)

- `AuthProvider` — one auth listener and one profile fetch for the whole app,
  replacing 14 separate `useCurrentUser()` calls. The listener callback stays
  synchronous; see the deadlock note already in `src/lib/auth.ts`.
- `GroupProvider` — resolves `:slug` → group + my membership + role, and
  exposes `useGroup()`. Every group-scoped query reads `group.id` from here.
- `useGroupData()` — the single fetch of players / sessions / buy-ins /
  cash-outs / payouts for the active group, replacing the same `Promise.all`
  copy-pasted across six pages.

### 9.2 Routes

```
/                    → redirect: one group → its dashboard, else /groups
/login  /signup      → unchanged
/groups              → picker + [Create group]
/groups/new
/join/:code          → accept a standing code or an invite token
/profile             → global: your account, your groups
/admin               → superadmin: accounts + groups overview

/g/:slug             → dashboard
/g/:slug/sessions    /g/:slug/sessions/new    /g/:slug/sessions/:id
/g/:slug/players     /g/:slug/players/:id     /g/:slug/players/:id/rating
/g/:slug/records
/g/:slug/settings    → admin: stakes, join policy, code, invites, members
```

`RequireAuth` stays. `RequireAdmin` becomes `RequireGroupAdmin` and reads role
from `GroupProvider`. Add `RequireGroupMember`.

### 9.3 Constants

`DEFAULT_BUY_IN_CENTS` and `RECONCILE_THRESHOLD_CENTS` are deleted from
`src/lib/money.ts` and `src/lib/reconcile.ts`. Both now come from the active
group. Everything in `stats.ts` is already pure over the rows it's handed, so
it needs **no changes** — it just gets group-scoped input.

---

## 10. Build order

| Phase | Work | Ships |
|---|---|---|
| 0 | `AuthProvider`, `GroupProvider`, `useGroupData` | no user-visible change |
| 1 | `0007_groups.sql` + backfill | existing group keeps working |
| 2 | `/groups`, create group, `/g/:slug/*` routing | multiple groups exist |
| 3 | Join codes, invites, approvals, member management | people can join |
| 4 | Game log states: submit / approve / send back / reopen | members log games |
| 5 | Group settings, guest linking, `/admin` overview | polish |

Phases 0 and 1 are the risky ones and touch live data. Everything after is
additive.

---

## 10b. Auth: OAuth, built 2026-09-08

Supabase Auth does the real work (hashing, JWTs, sessions). Three ways in:

| Way in | Who uses it |
|---|---|
| Google | Anyone who has connected it, and any account created through it |
| Email + password | Everyone who signed up from 2026-09-08 |
| Username + password | The twelve accounts created before that, on synthetic `<username>@royal.gg.local` addresses |

`signIn()` takes one field and routes on `"@"` — an email goes through as
typed, anything else becomes `syntheticEmail(username)`. The discriminator is
safe because the old signup only ever allowed `[a-z0-9_-]` in a username.
Asking someone which *kind* of account they have is asking them to remember an
implementation detail.

**⚠ What the 2026-09-06 plan below got wrong.** It said enabling Google would
be "enable the provider, add a button, the trigger handles the rest". That is
true for a brand-new person and false for everyone already playing — see
decision 15. The three rules were still right and still paid off: because
profile creation was already a trigger and `username` was already nullable, the
Google path needed **no migration and no schema change at all**. What it needed
was the linking route the plan did not foresee.

**Decision (2026-09-06), kept verbatim because it held up:** Google sign-in
comes later. We do not build it now, but nothing we build may block it. Three
rules:

1. **Profile creation belongs in a DB trigger on `auth.users`, not in
   `signUp()`.** The standard Supabase pattern. A trigger fires for a user
   created by *any* provider, so OAuth needs no frontend change to get a
   profile. Password signup stops needing to insert one at all.
2. **`profiles.username` becomes nullable.** An OAuth user arrives with an
   email and a display name, no username. It becomes a display handle people
   set on `/profile`, not a login credential. The trigger seeds it from the
   email local part.
3. **No new code may depend on the synthetic email domain.** `is_app_owner`
   on `profiles` already replaces the old `is_admin()` email match and is
   provider-agnostic. Keep it that way.

All three held. `is_app_owner` replaced the email match in `0015`, and nothing
outside `auth.ts` has ever referenced the synthetic domain.

### Onboarding: nothing to nightly game

No welcome screen (decided 2026-09-06). The route is the onboarding:

1. **`/signup`** — Google, or email + password + display name.
2. **The trigger** (`0009`) writes `profiles` for either path, deriving a
   display name from Google's `full_name` and a handle from the email.
3. **`/groups`**, because a new account belongs to nothing. Its empty state is
   the fork: **create a group** or **join with a code**.
4. **Joining** lands `pending` under `code_approve`, `active` under `code`
   (§4). An admin approving fires `ensure_group_roster_row()`, which is where
   an already-linked guest card is adopted instead of a second row created.
5. **`/g/:slug/profile`** — pick your card. Unique within the group, per
   decision 10.

An account existing and an account belonging to a group are separate
questions, answered by `RequireAuth` and `RequireGroupMember` respectively.
That separation is what lets someone hold five group memberships on one login.

### Not built, deliberately

- **Unlinking a provider.** Removing your only identity locks you out of your
  own account. Needs its own guard and its own phase.
- **Password reset.** Now *possible* for the first time, because new accounts
  have real addresses. Needs email delivery configured, which is its own work.
  The twelve legacy accounts can never have it — their address is not real.
- **Merging two accounts.** See decision 15: there is no repair path, on
  purpose. Prevention is the design.

## 11. Open items

Not blocking, but unanswered:

- Notifications — nothing tells an admin a log is waiting for approval, or a
  member that theirs was sent back. In-app badge is probably enough to start.
- Whether `/profile` shows cross-group totals or strictly per-group figures.
  Decision 1 makes stats per-group; a combined view is possible later but has
  no agreed meaning yet (different stakes don't sum honestly).
- Group deletion. Currently no path exists. Archive is probably the right
  answer rather than a destructive delete.
