-- Phase 3C (first half): let a group admin act on their own membership list.
--
-- ADDITIVE ONLY. One policy, one guard trigger. Drops nothing, changes no
-- existing policy, touches no column or index.
--
-- Approving, rejecting, promoting, demoting and removing are all UPDATEs of
-- group_members.status / .role. Today that table is writable only by
-- group_members_write_admin (is_admin(), one hardcoded email) and by
-- group_members_insert_founder (your own row, into a group you created), so a
-- group admin cannot approve anybody — including their own group's join
-- requests. That is the hole this closes.
--
-- Deliberately NOT here: creating the member's players roster row on approval.
-- players_name_unique (lower(name), not partial), players_user_id_unique and
-- players_username_unique are still global, so the insert would be rejected
-- for anyone already on another group's roster. Roster creation needs those
-- three indexes dropped first — the first genuinely destructive step in this
-- sequence — and it must cover BOTH paths: approval, and an instant-active
-- join under join_policy 'code', which never passes through an approval.
--
-- Removal is status = 'removed', never a DELETE: decision 9 keeps a removed
-- member's history and leaderboard position intact.
--
-- No money is read or written here.

begin;

-- ---------------------------------------------------------------------------
-- 1. A group admin may edit memberships in their own group
--
-- `with check` is evaluated against the NEW row, so an admin cannot move a
-- membership into a group they do not also run. There is deliberately no
-- DELETE policy: removal is a status change, not a deletion.
-- ---------------------------------------------------------------------------

create policy group_members_update_group_admin on group_members
  for update to authenticated
  using (is_group_admin(group_id))
  with check (is_group_admin(group_id));

-- ---------------------------------------------------------------------------
-- 2. Last-admin guard (GROUPS.md §4)
--
-- In a trigger, not only in the UI. A group with no active admin can never be
-- administered again — nobody could approve a join, rotate the code or promote
-- a replacement — and there is no path back short of the Supabase dashboard.
--
-- Fires when a row STOPS being an active admin, by demotion, by a status
-- change, or by deletion. security definer so it keeps working once the RLS
-- migration stops group_members from being world-readable.
-- ---------------------------------------------------------------------------

create or replace function enforce_last_group_admin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_was_admin   boolean;
  v_still_admin boolean;
begin
  v_was_admin := (old.role = 'admin' and old.status = 'active');

  if tg_op = 'DELETE' then
    v_still_admin := false;
  else
    v_still_admin := (new.role = 'admin' and new.status = 'active');
  end if;

  if v_was_admin and not v_still_admin then
    if not exists (
      select 1 from group_members gm
       where gm.group_id = old.group_id
         and gm.id      <> old.id
         and gm.role     = 'admin'
         and gm.status   = 'active'
    ) then
      raise exception
        'This is the group''s only admin. Promote someone else first.';
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

comment on function enforce_last_group_admin() is
  'Refuses to leave a group with no active admin. See GROUPS.md §4.';

create trigger group_members_last_admin
before update or delete on group_members
for each row execute function enforce_last_group_admin();

-- ---------------------------------------------------------------------------
-- 3. Assert what the app now depends on
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (
    select 1 from pg_policies
     where schemaname = 'public'
       and tablename  = 'group_members'
       and policyname = 'group_members_update_group_admin'
  ) then
    raise exception 'group_members_update_group_admin was not created.';
  end if;

  if not exists (
    select 1 from pg_trigger
     where tgname = 'group_members_last_admin'
       and tgrelid = 'group_members'::regclass
       and not tgisinternal
  ) then
    raise exception 'The last-admin guard trigger was not created.';
  end if;

  if not exists (
    select 1 from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'enforce_last_group_admin'
       and p.prosecdef
  ) then
    raise exception 'enforce_last_group_admin() is missing or not security definer.';
  end if;

  -- Every existing group must already satisfy the invariant, or the guard
  -- would be enforcing a rule the live data already breaks.
  if exists (
    select 1 from groups g
     where not exists (
       select 1 from group_members gm
        where gm.group_id = g.id and gm.role = 'admin' and gm.status = 'active'
     )
  ) then
    raise exception
      'Aborting: % group(s) already have no active admin.',
      (select count(*) from groups g where not exists (
         select 1 from group_members gm
          where gm.group_id = g.id and gm.role = 'admin' and gm.status = 'active'));
  end if;
end $$;

commit;
