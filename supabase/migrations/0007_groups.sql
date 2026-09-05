-- Multi-group: EXPAND phase. See GROUPS.md for the full design.
--
-- This migration is deliberately ADDITIVE ONLY:
--   * creates profiles / groups / group_members / group_invites
--   * adds group_id to players, sessions, payouts
--   * adds players.profile_id
--   * adds the game-log workflow columns to sessions
--   * backfills all of the above from existing data
--
-- It does NOT drop any column, does NOT drop any existing index, and does NOT
-- touch a single RLS policy. That is on purpose: the running app still reads
-- players.user_id, players.username and players.status, and still relies on
-- is_admin(). Removing them here would break production the moment this lands.
--
-- The CONTRACT migration (0008) drops the old columns, replaces the global
-- unique indexes with the group-scoped ones, and swaps the policies over to
-- is_group_member() / is_group_admin(). That runs only once the frontend has
-- been migrated in Phase 2.
--
-- Money remains integer cents throughout. No amount is read or written here.

begin;

-- ---------------------------------------------------------------------------
-- 1. Accounts, groups, membership
-- ---------------------------------------------------------------------------

-- One row per human account, global (not scoped to any group).
create table profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  username      citext not null unique,
  display_name  text not null,
  -- Superadmin. Sees accounts and groups only, NEVER money — no policy on
  -- sessions/buy_ins/cash_outs/payouts may ever reference this. See GROUPS.md §6.
  is_app_owner  boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create trigger profiles_set_updated_at
before update on profiles
for each row execute function set_updated_at();

create table groups (
  id                        uuid primary key default gen_random_uuid(),
  name                      text not null,
  slug                      citext not null unique,
  join_code                 text not null unique,
  join_policy               text not null default 'code_approve'
                              check (join_policy in ('code','code_approve')),
  default_buy_in_cents      integer not null default 4000
                              check (default_buy_in_cents > 0),
  reconcile_threshold_cents integer not null default 500
                              check (reconcile_threshold_cents >= 0),
  stakes_label              text,
  created_by                uuid references profiles(id) on delete set null,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

create trigger groups_set_updated_at
before update on groups
for each row execute function set_updated_at();

-- Who may sign in to a group, and with what power. Guests have NO row here.
-- 'rejected' is kept alongside 'removed' so the existing players.status values
-- migrate across without losing their meaning: rejected = never let in,
-- removed = was a member, access revoked (history preserved either way).
create table group_members (
  id          uuid primary key default gen_random_uuid(),
  group_id    uuid not null references groups(id) on delete cascade,
  profile_id  uuid not null references profiles(id) on delete cascade,
  role        text not null default 'member' check (role in ('admin','member')),
  status      text not null default 'pending'
                check (status in ('pending','active','rejected','removed')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (group_id, profile_id)
);

create index group_members_group_idx   on group_members (group_id);
create index group_members_profile_idx on group_members (profile_id);

create trigger group_members_set_updated_at
before update on group_members
for each row execute function set_updated_at();

-- Expiring / limited-use invite links, alongside each group's standing code.
create table group_invites (
  id          uuid primary key default gen_random_uuid(),
  group_id    uuid not null references groups(id) on delete cascade,
  token       text not null unique,
  expires_at  timestamptz,                       -- null = never expires
  max_uses    integer check (max_uses is null or max_uses > 0),
  used_count  integer not null default 0 check (used_count >= 0),
  created_by  uuid references profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);

create index group_invites_group_idx on group_invites (group_id);

-- ---------------------------------------------------------------------------
-- 2. New columns on existing tables (all nullable for now; tightened below)
-- ---------------------------------------------------------------------------

alter table players
  add column group_id   uuid references groups(id) on delete cascade,
  add column profile_id uuid references profiles(id) on delete set null;

alter table sessions
  add column group_id     uuid references groups(id) on delete cascade,
  add column status       text not null default 'draft'
                            check (status in ('draft','submitted','approved')),
  add column created_by   uuid references profiles(id) on delete set null,
  add column submitted_at timestamptz,
  add column submitted_by uuid references profiles(id) on delete set null,
  add column approved_at  timestamptz,
  add column approved_by  uuid references profiles(id) on delete set null,
  add column review_note  text;

alter table payouts
  add column group_id uuid references groups(id) on delete cascade;

-- ---------------------------------------------------------------------------
-- 3. Backfill
-- ---------------------------------------------------------------------------

do $$
declare
  v_group_id   uuid;
  v_admin_id   uuid;
  -- Edit these two if you want the existing group named differently.
  v_group_name text := 'Royal';
  v_group_slug text := 'royal';
  -- The email is_admin() has been hardcoded to since migration 0005.
  v_admin_email text := 'will@royal.gg.local';
begin
  -- 3PRE. Refuse to run on data this migration would silently mis-handle.
  --       A player with an auth user but no username gets no profile below,
  --       so profile_id would stay NULL and they would silently become a
  --       "guest" — losing their account link. Fail loudly instead.
  if exists (
    select 1 from players
     where user_id is not null and username is null
  ) then
    raise exception
      'Aborting: % player row(s) have user_id but no username. Give them a username, then re-run.',
      (select count(*) from players where user_id is not null and username is null);
  end if;

  -- Two player rows sharing one auth user would produce one profile and an
  -- ambiguous roster link. The old partial unique index should prevent this.
  if exists (
    select user_id from players
     where user_id is not null
     group by user_id having count(*) > 1
  ) then
    raise exception 'Aborting: an auth user maps to more than one player row.';
  end if;

  -- 3a. One profile per player row that is backed by an auth user.
  --     display_name falls back to name; username is already unique+citext.
  insert into profiles (id, username, display_name, created_at, updated_at)
  select p.user_id,
         p.username,
         coalesce(nullif(btrim(p.display_name), ''), p.name),
         p.created_at,
         p.updated_at
  from players p
  where p.user_id is not null
    and p.username is not null
  on conflict (id) do nothing;

  -- 3b. The one existing group. Random readable join code.
  insert into groups (name, slug, join_code, join_policy, stakes_label)
  values (
    v_group_name,
    v_group_slug,
    upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
    'code_approve',
    '$0.25 / $0.50'
  )
  returning id into v_group_id;

  -- 3c. Membership, carrying each player's existing status across verbatim.
  insert into group_members (group_id, profile_id, role, status, created_at, updated_at)
  select v_group_id,
         p.user_id,
         'member',
         p.status,
         p.created_at,
         p.updated_at
  from players p
  where p.user_id is not null
    and p.username is not null
  on conflict (group_id, profile_id) do nothing;

  -- 3d. Promote the existing hardcoded admin. Matched on the auth email that
  --     is_admin() checks, so this cannot drift from the old behaviour.
  select u.id into v_admin_id
  from auth.users u
  where u.email = v_admin_email
  limit 1;

  if v_admin_id is not null then
    update group_members
       set role = 'admin', status = 'active'
     where group_id = v_group_id
       and profile_id = v_admin_id;

    update groups set created_by = v_admin_id where id = v_group_id;
    update profiles set is_app_owner = true where id = v_admin_id;
  else
    raise warning
      'No auth user with email %. No group admin or app owner was set — fix before 0008.',
      v_admin_email;
  end if;

  -- 3e. Everything existing belongs to that one group.
  update players  set group_id = v_group_id where group_id is null;
  update sessions set group_id = v_group_id where group_id is null;
  update payouts  set group_id = v_group_id where group_id is null;

  -- 3f. Link roster rows to their accounts. profile_id stays NULL for guests.
  update players p
     set profile_id = p.user_id
   where p.user_id is not null
     and exists (select 1 from profiles pr where pr.id = p.user_id);

  -- 3g. Every pre-existing session is historical fact, not a draft.
  update sessions
     set status      = 'approved',
         approved_at = coalesce(updated_at, created_at),
         approved_by = v_admin_id
   where status = 'draft';

  -- 3POST. Every row must now resolve to exactly one group, and every account
  --        must have kept its roster link. Any failure rolls the whole thing
  --        back, since this is all inside one transaction.
  if exists (select 1 from players  where group_id is null)
  or exists (select 1 from sessions where group_id is null)
  or exists (select 1 from payouts  where group_id is null) then
    raise exception 'Aborting: rows left without a group_id after backfill.';
  end if;

  if (select count(*) from profiles)
     <> (select count(*) from players where user_id is not null) then
    raise exception
      'Aborting: profiles (%) != players with a user_id (%).',
      (select count(*) from profiles),
      (select count(*) from players where user_id is not null);
  end if;

  if exists (
    select 1 from players
     where user_id is not null and profile_id is null
  ) then
    raise exception 'Aborting: an account-backed player row lost its profile link.';
  end if;

  -- buy_ins / cash_outs reach a group through session_id, so their sessions
  -- having a group is sufficient — but prove there are no orphans.
  if exists (
    select 1 from buy_ins b
     where not exists (select 1 from sessions s where s.id = b.session_id)
  ) or exists (
    select 1 from cash_outs c
     where not exists (select 1 from sessions s where s.id = c.session_id)
  ) then
    raise exception 'Aborting: orphaned buy_ins or cash_outs found.';
  end if;

  raise notice 'Backfill OK: % profile(s), % player(s), % session(s), % payout(s) into group %.',
    (select count(*) from profiles),
    (select count(*) from players  where group_id = v_group_id),
    (select count(*) from sessions where group_id = v_group_id),
    (select count(*) from payouts  where group_id = v_group_id),
    v_group_slug;
end $$;

-- ---------------------------------------------------------------------------
-- 4. Tighten what the backfill has now guaranteed
-- ---------------------------------------------------------------------------

alter table players  alter column group_id set not null;
alter table sessions alter column group_id set not null;
alter table payouts  alter column group_id set not null;

-- ---------------------------------------------------------------------------
-- 5. Group-scoped indexes
--
-- The OLD global unique indexes (players_name_unique, players_user_id_unique,
-- players_chosen_card_unique) are intentionally left in place — they are
-- stricter than these, so they stay satisfied while only one group exists, and
-- the app still depends on the columns behind them. 0008 drops them, which is
-- what actually unlocks a second group.
-- ---------------------------------------------------------------------------

create unique index players_group_name_unique
  on players (group_id, lower(name));

create unique index players_group_profile_unique
  on players (group_id, profile_id)
  where profile_id is not null;

create unique index players_group_card_unique
  on players (group_id, chosen_suit, chosen_rank)
  where chosen_suit is not null and chosen_rank is not null;

create index players_group_idx   on players (group_id);
create index sessions_group_idx  on sessions (group_id);
create index sessions_group_status_idx on sessions (group_id, status);
create index payouts_group_idx   on payouts (group_id);

-- ---------------------------------------------------------------------------
-- 6. RLS on the new tables only
--
-- The five existing tables keep their current policies untouched. These four
-- are new, so Supabase enables RLS with zero policies (denying everything);
-- they need a policy set from the start.
--
-- Deliberately permissive-but-authenticated for now, matching the existing
-- players_select style. 0008 tightens all of this to real membership checks
-- once the frontend is ready.
-- ---------------------------------------------------------------------------

alter table profiles      enable row level security;
alter table groups        enable row level security;
alter table group_members enable row level security;
alter table group_invites enable row level security;

create policy profiles_select on profiles
  for select to authenticated using (true);

create policy profiles_update_self on profiles
  for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

create policy profiles_insert_self on profiles
  for insert to authenticated with check (id = auth.uid());

create policy groups_select on groups
  for select to authenticated using (true);

create policy groups_write_admin on groups
  for all to authenticated
  using (is_admin()) with check (is_admin());

create policy group_members_select on group_members
  for select to authenticated using (true);

create policy group_members_write_admin on group_members
  for all to authenticated
  using (is_admin()) with check (is_admin());

-- Invite tokens are shareable secrets: admin-only, never world-readable.
create policy group_invites_admin on group_invites
  for all to authenticated
  using (is_admin()) with check (is_admin());

commit;
