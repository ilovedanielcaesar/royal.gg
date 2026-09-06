-- Real group isolation. Until now scoping has been CLIENT-SIDE ONLY: every
-- query asked for one group's rows, but any authenticated user calling the API
-- directly could read every group's money.
--
-- ⚠ This replaces the entire policy surface on nine tables. Take a snapshot
-- first — `node scripts/db-backup.mjs`. Policies are recoverable (they are all
-- in this file), but a wrong one is invisible: the app looks perfectly correct
-- while leaking, which is the whole reason this migration is late.
--
-- TWELVE permissive SELECTs are being removed, not the four in WORKFLOW.md.
-- The four undocumented `*_select_all` added by hand in the dashboard are the
-- ones that would have silently defeated everything — policies are OR-ed, so a
-- strict policy next to `using (true)` changes nothing at all — but the
-- migrations themselves also shipped `using (true)` on players, sessions,
-- buy_ins, cash_outs, payouts, profiles, groups and group_members. All twelve
-- go.
--
-- Ten policies still gate writes on is_admin(), the hardcoded
-- will@royal.gg.local. Those become is_group_admin(group_id), so every group
-- runs itself. is_admin() is dropped at the end; if any policy still referenced
-- it, that DROP fails loudly rather than leaving a privileged back door.
--
-- THE SUPERADMIN RULE (GROUPS.md §6): is_app_owner() may appear in exactly
-- three policies — profiles, groups and group_members SELECT. No policy on
-- players, sessions, buy_ins, cash_outs or payouts may reference it. That
-- single rule is what keeps the promise that the superadmin never reads a
-- cent, and it is asserted at the bottom of this file.
--
-- Money is not read or written here.

begin;

-- ---------------------------------------------------------------------------
-- 1. The two helpers this needs that do not exist yet
--
-- security definer for the same reason as is_group_member(): a policy on
-- group_members that calls a plain function selecting from group_members
-- recurses forever.
-- ---------------------------------------------------------------------------

create or replace function is_app_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select p.is_app_owner from profiles p where p.id = auth.uid()),
    false
  );
$$;

-- "This person is on a roster I can see." Their own status is deliberately not
-- checked: a removed or departed member must keep their name on the members
-- page, or an admin cannot tell who they are looking at.
create or replace function shares_group_with(p_profile uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from group_members mine
    join group_members theirs on theirs.group_id = mine.group_id
    where mine.profile_id = auth.uid()
      and mine.status = 'active'
      and theirs.profile_id = p_profile
  );
$$;

revoke all on function is_app_owner() from public, anon;
revoke all on function shares_group_with(uuid) from public, anon;
grant execute on function is_app_owner() to authenticated;
grant execute on function shares_group_with(uuid) to authenticated;

comment on function is_app_owner() is
  'Superadmin flag. May appear ONLY in profiles/groups/group_members select. See GROUPS.md §6.';

-- ---------------------------------------------------------------------------
-- 2. Drop the old surface, by name
--
-- Named individually rather than looped, so that a policy appearing in
-- production which is not in this list survives visibly instead of being
-- swept away — the schema has drifted by hand before.
-- ---------------------------------------------------------------------------

drop policy if exists buy_ins_write_admin        on buy_ins;
drop policy if exists buy_ins_select             on buy_ins;
drop policy if exists buy_ins_select_all         on buy_ins;

drop policy if exists cash_outs_write_admin      on cash_outs;
drop policy if exists cash_outs_select           on cash_outs;
drop policy if exists cash_outs_select_all       on cash_outs;

drop policy if exists group_invites_admin        on group_invites;

drop policy if exists group_members_write_admin  on group_members;
drop policy if exists group_members_select       on group_members;

drop policy if exists groups_write_admin         on groups;
drop policy if exists groups_select              on groups;

drop policy if exists payouts_write_admin        on payouts;
drop policy if exists payouts_select             on payouts;

drop policy if exists players_delete_admin       on players;
drop policy if exists players_insert_admin       on players;
drop policy if exists players_insert_self_pending on players;
drop policy if exists players_select             on players;
drop policy if exists players_select_all         on players;
drop policy if exists players_update_admin       on players;
drop policy if exists players_update_self        on players;

drop policy if exists profiles_insert_self       on profiles;
drop policy if exists profiles_select            on profiles;

drop policy if exists sessions_write_admin       on sessions;
drop policy if exists sessions_select            on sessions;
drop policy if exists sessions_select_all        on sessions;

-- Kept from 3A/3B/3C, already group-scoped and correct:
--   groups_insert_own, groups_update_group_admin,
--   group_members_insert_founder, group_members_update_group_admin,
--   group_invites_group_admin, profiles_update_self

-- ---------------------------------------------------------------------------
-- 3. Accounts, groups, membership
-- ---------------------------------------------------------------------------

alter table profiles enable row level security;

-- Yourself, anyone you share a group with, and the superadmin.
create policy profiles_select on profiles
  for select to authenticated
  using (id = auth.uid() or shares_group_with(id) or is_app_owner());

-- No insert policy: the on_auth_user_created trigger (0009) is the only thing
-- that creates a profile, and it is security definer.

alter table groups enable row level security;

-- created_by is not redundant. CreateGroupPage does INSERT ... RETURNING, and
-- at that instant the founder has no membership row yet — without this the
-- insert succeeds and the RETURNING comes back empty.
create policy groups_select on groups
  for select to authenticated
  using (is_group_member(id) or created_by = auth.uid() or is_app_owner());

alter table group_members enable row level security;

-- Your own rows always: a pending applicant has to be able to see that they
-- are pending, and they are not a member yet.
create policy group_members_select on group_members
  for select to authenticated
  using (
    profile_id = auth.uid() or is_group_member(group_id) or is_app_owner()
  );

-- ---------------------------------------------------------------------------
-- 4. The roster
--
-- No is_app_owner() from here down. Not one of these tables.
-- ---------------------------------------------------------------------------

alter table players enable row level security;

create policy players_select on players
  for select to authenticated using (is_group_member(group_id));

create policy players_insert_admin on players
  for insert to authenticated with check (is_group_admin(group_id));

create policy players_update_admin on players
  for update to authenticated
  using (is_group_admin(group_id)) with check (is_group_admin(group_id));

-- Your own roster row, so you can pick your card. Keyed on profile_id, not the
-- legacy user_id the old policy used.
create policy players_update_self on players
  for update to authenticated
  using (profile_id = auth.uid() and is_group_member(group_id))
  with check (profile_id = auth.uid() and is_group_member(group_id));

create policy players_delete_admin on players
  for delete to authenticated using (is_group_admin(group_id));

-- ---------------------------------------------------------------------------
-- 5. Money
--
-- Writes stay admin-only, matching the app today: SessionFormPage sits behind
-- RequireGroupAdmin. Phase 4 opens drafts to any member and will revisit this.
-- ---------------------------------------------------------------------------

alter table sessions enable row level security;

create policy sessions_select on sessions
  for select to authenticated using (is_group_member(group_id));

create policy sessions_write_admin on sessions
  for all to authenticated
  using (is_group_admin(group_id)) with check (is_group_admin(group_id));

alter table payouts enable row level security;

create policy payouts_select on payouts
  for select to authenticated using (is_group_member(group_id));

create policy payouts_write_admin on payouts
  for all to authenticated
  using (is_group_admin(group_id)) with check (is_group_admin(group_id));

-- buy_ins and cash_outs carry no group_id; they reach one through session_id.
alter table buy_ins enable row level security;

create policy buy_ins_select on buy_ins
  for select to authenticated
  using (exists (
    select 1 from sessions s
     where s.id = buy_ins.session_id and is_group_member(s.group_id)
  ));

create policy buy_ins_write_admin on buy_ins
  for all to authenticated
  using (exists (
    select 1 from sessions s
     where s.id = buy_ins.session_id and is_group_admin(s.group_id)
  ))
  with check (exists (
    select 1 from sessions s
     where s.id = buy_ins.session_id and is_group_admin(s.group_id)
  ));

alter table cash_outs enable row level security;

create policy cash_outs_select on cash_outs
  for select to authenticated
  using (exists (
    select 1 from sessions s
     where s.id = cash_outs.session_id and is_group_member(s.group_id)
  ));

create policy cash_outs_write_admin on cash_outs
  for all to authenticated
  using (exists (
    select 1 from sessions s
     where s.id = cash_outs.session_id and is_group_admin(s.group_id)
  ))
  with check (exists (
    select 1 from sessions s
     where s.id = cash_outs.session_id and is_group_admin(s.group_id)
  ));

alter table group_invites enable row level security;

-- ---------------------------------------------------------------------------
-- 6. The hardcoded admin is gone
--
-- Every policy that referenced is_admin() has been replaced above. If one was
-- missed, Postgres refuses this DROP because the policy depends on it — which
-- is exactly the failure we want, rather than a surviving back door.
-- ---------------------------------------------------------------------------

drop function if exists is_admin();

-- ---------------------------------------------------------------------------
-- 7. Assert, or roll the whole thing back
-- ---------------------------------------------------------------------------

do $$
declare
  v_tables text[] := array[
    'players', 'sessions', 'buy_ins', 'cash_outs', 'payouts',
    'profiles', 'groups', 'group_members', 'group_invites'
  ];
  v_bad text;
begin
  -- 7a. No permissive SELECT survives anywhere. This is the check WORKFLOW.md
  --     demanded: a `using (true)` policy beside a strict one defeats it
  --     entirely, and the app looks fine while it happens.
  select string_agg(tablename || '.' || policyname, ', ')
    into v_bad
  from pg_policies
  where schemaname = 'public'
    and tablename = any(v_tables)
    and qual = 'true';
  if v_bad is not null then
    raise exception 'Permissive using(true) policies survive: %', v_bad;
  end if;

  -- 7b. The superadmin promise. GROUPS.md §6.
  select string_agg(tablename || '.' || policyname, ', ')
    into v_bad
  from pg_policies
  where schemaname = 'public'
    and tablename in ('players', 'sessions', 'buy_ins', 'cash_outs', 'payouts')
    and (coalesce(qual, '') like '%is_app_owner%'
      or coalesce(with_check, '') like '%is_app_owner%');
  if v_bad is not null then
    raise exception
      'is_app_owner() must never appear on a money table. Found on: %', v_bad;
  end if;

  -- 7c. Nothing still leans on the hardcoded email.
  if exists (
    select 1 from pg_policies
     where schemaname = 'public'
       and (coalesce(qual, '') like '%is_admin()%'
         or coalesce(with_check, '') like '%is_admin()%')
  ) then
    raise exception 'A policy still references is_admin().';
  end if;

  -- 7d. RLS actually on. A table with policies and RLS disabled reads as
  --     secured and is not.
  select string_agg(c.relname, ', ') into v_bad
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relname = any(v_tables) and not c.relrowsecurity;
  if v_bad is not null then
    raise exception 'Row level security is disabled on: %', v_bad;
  end if;

  -- 7e. Every one of these tables must still have at least one SELECT policy,
  --     or the app goes blank rather than merely secure.
  select string_agg(t, ', ') into v_bad
  from unnest(v_tables) as t
  where t <> 'group_invites'   -- deliberately admin-only, no select policy
    and not exists (
      select 1 from pg_policies
       where schemaname = 'public' and tablename = t
         and cmd in ('SELECT', 'ALL')
    );
  if v_bad is not null then
    raise exception 'No SELECT policy left on: %', v_bad;
  end if;
end $$;

commit;
