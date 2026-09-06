-- A member can leave a group, distinctly from being removed by an admin.
--
-- `GROUPS.md` §4 already assumed this existed — the last-admin guard is worded
-- to constrain "Leave" — but no phase ever scheduled it. This is that gap.
--
-- `left` is a separate status from `removed` on purpose. Reusing `removed`
-- conflates "I stepped away" with "you were kicked out", and since join_group()
-- refuses `removed`, it would mean an accidental Leave could only be undone by
-- an admin. `left` is re-joinable with the code, subject to the group's join
-- policy. `removed` and `rejected` stay blocked.
--
-- Leaving is an RPC, NOT an RLS policy. A policy allowing a member to update
-- their own row cannot express "only the status column": RLS `with check` sees
-- the new row, never the old one, so a member could set status='left' AND
-- role='admin' in one statement. It looks harmless while they are gone, and
-- then rejoining reactivates that row with the admin role. A security definer
-- function writes exactly one column and closes the whole class.
--
-- Two things come free. The last-admin trigger from 0011 fires on any update
-- that stops a row being an active admin, so a sole admin cannot leave. And
-- ensure_group_roster_row() is idempotent, so rejoining reuses the same
-- players row and every session attached to it.
--
-- No money is read or written here.

begin;

-- ---------------------------------------------------------------------------
-- 1. The new status
-- ---------------------------------------------------------------------------

alter table group_members drop constraint if exists group_members_status_check;

alter table group_members add constraint group_members_status_check
  check (status in ('pending', 'active', 'rejected', 'removed', 'left'));

-- ---------------------------------------------------------------------------
-- 2. leave_group()
-- ---------------------------------------------------------------------------

create or replace function leave_group(p_group_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_status text;
begin
  if v_uid is null then
    raise exception 'You must be signed in to leave a group.';
  end if;

  select gm.status into v_status
  from group_members gm
  where gm.group_id = p_group_id and gm.profile_id = v_uid;

  -- Never confirm or deny more than "you are not in this group".
  if v_status is null or v_status in ('removed', 'rejected') then
    raise exception 'You are not a member of that group.';
  end if;

  -- Clicking twice is a no-op, not a failure.
  if v_status = 'left' then
    return jsonb_build_object('already_left', true);
  end if;

  -- Only the status column. A pending member leaving is withdrawing their
  -- request, which is the same thing from their side.
  --
  -- group_members_last_admin refuses this when they are the group's only
  -- active admin, with a message that already reads correctly here:
  -- "This is the group's only admin. Promote someone else first."
  update group_members
     set status = 'left'
   where group_id = p_group_id and profile_id = v_uid;

  return jsonb_build_object('already_left', false);
end;
$$;

revoke all on function leave_group(uuid) from public, anon;
grant execute on function leave_group(uuid) to authenticated;

comment on function leave_group(uuid) is
  'Sets your own membership to left. security definer so nothing but status can change.';

-- ---------------------------------------------------------------------------
-- 3. join_group() lets a leaver back in, and stops colliding with itself
--
-- Two changes from 0013:
--
--   * `left` no longer falls into the already-a-member early return. It
--     reactivates the existing row per the group's join policy, always as
--     'member' — an ex-admin returning through a shared code should not
--     silently land back as an admin.
--
--   * The duplicate-name check excludes the caller's own roster row. A member
--     who left still HAS one, carrying their name, so without this a rejoin is
--     refused as a duplicate of itself. That bug shipped in 0013 and could not
--     be reached until leaving existed.
-- ---------------------------------------------------------------------------

create or replace function join_group(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid        uuid := auth.uid();
  v_code       text := btrim(coalesce(p_code, ''));
  v_group_id   uuid;
  v_group_name text;
  v_slug       text;
  v_policy     text;
  v_invite_id  uuid;
  v_expires_at timestamptz;
  v_max_uses   integer;
  v_used_count integer;
  v_existing   text;
  v_status     text;
  v_name       text;
begin
  if v_uid is null then
    raise exception 'You must be signed in to join a group.';
  end if;
  if v_code = '' then
    raise exception 'Enter a join code.';
  end if;

  -- Standing code first, matched case-insensitively: people retype these.
  select g.id, g.name, g.slug::text, g.join_policy
    into v_group_id, v_group_name, v_slug, v_policy
  from groups g
  where upper(g.join_code) = upper(v_code)
  limit 1;

  -- Otherwise an invite token, matched exactly — it is generated, not typed.
  if v_group_id is null then
    select gi.id, gi.group_id, gi.expires_at, gi.max_uses, gi.used_count
      into v_invite_id, v_group_id, v_expires_at, v_max_uses, v_used_count
    from group_invites gi
    where gi.token = v_code
    limit 1;

    if v_invite_id is null then
      raise exception 'That code does not match any group.';
    end if;
    if v_expires_at is not null and v_expires_at <= now() then
      raise exception 'This invite link has expired.';
    end if;
    if v_max_uses is not null and v_used_count >= v_max_uses then
      raise exception 'This invite link has already been used up.';
    end if;

    select g.name, g.slug::text, g.join_policy
      into v_group_name, v_slug, v_policy
    from groups g where g.id = v_group_id;
  end if;

  select gm.status into v_existing
  from group_members gm
  where gm.group_id = v_group_id and gm.profile_id = v_uid;

  if v_existing is not null then
    -- Decision 9: removal revokes access. A standing code must not quietly
    -- undo an admin's decision. Leaving was the member's own choice, so it
    -- is theirs to undo — that falls through to the rejoin path below.
    if v_existing in ('removed', 'rejected') then
      raise exception
        'Your access to this group was removed. Ask an admin to let you back in.';
    end if;
    -- Clicking a link twice is a no-op, not a failure.
    if v_existing in ('active', 'pending') then
      return jsonb_build_object(
        'slug',           v_slug,
        'group_name',     v_group_name,
        'status',         v_existing,
        'already_member', true
      );
    end if;
  end if;

  -- The roster name has to be free before anything is written. Their OWN
  -- roster row is excluded: a returning leaver still has one, under the very
  -- name being checked.
  select coalesce(nullif(btrim(pr.display_name), ''), pr.username::text, 'Player')
    into v_name
  from profiles pr where pr.id = v_uid;

  if exists (
    select 1 from players
     where group_id = v_group_id
       and lower(name) = lower(v_name)
       and profile_id is distinct from v_uid
  ) then
    raise exception
      'Someone in % already goes by "%". Change your display name on your profile, then join again.',
      v_group_name, v_name;
  end if;

  -- Spend the invite atomically. The checks above give a good message; this
  -- conditional update is what actually makes max_uses safe when two people
  -- redeem the same link at the same moment.
  if v_invite_id is not null then
    update group_invites
       set used_count = used_count + 1
     where id = v_invite_id
       and (max_uses   is null or used_count < max_uses)
       and (expires_at is null or expires_at > now());
    if not found then
      raise exception 'This invite link has already been used up.';
    end if;
  end if;

  v_status := case when v_policy = 'code' then 'active' else 'pending' end;

  if v_existing is not null then
    -- Only 'left' can reach here; every other status returned or raised above.
    update group_members
       set status = v_status, role = 'member'
     where group_id = v_group_id and profile_id = v_uid;
  else
    insert into group_members (group_id, profile_id, role, status)
    values (v_group_id, v_uid, 'member', v_status);
  end if;

  return jsonb_build_object(
    'slug',           v_slug,
    'group_name',     v_group_name,
    'status',         v_status,
    'already_member', false
  );
end;
$$;

revoke all on function join_group(text) from public, anon;
grant execute on function join_group(text) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Assert
-- ---------------------------------------------------------------------------

do $$
begin
  if has_function_privilege('anon', 'public.leave_group(uuid)', 'execute')
  or has_function_privilege('anon', 'public.join_group(text)', 'execute') then
    raise exception 'A group function is executable by anon.';
  end if;

  if not exists (
    select 1 from pg_constraint
     where conrelid = 'group_members'::regclass
       and conname  = 'group_members_status_check'
       and pg_get_constraintdef(oid) like '%left%'
  ) then
    raise exception 'group_members.status does not accept ''left''.';
  end if;

  -- A member must have no direct UPDATE path of their own: leaving goes
  -- through the function precisely so nothing but status can change.
  if exists (
    select 1 from pg_policies
     where schemaname = 'public' and tablename = 'group_members'
       and cmd in ('UPDATE', 'ALL')
       and policyname not in (
         'group_members_update_group_admin', 'group_members_write_admin'
       )
  ) then
    raise exception
      'An unexpected UPDATE policy exists on group_members. Leaving must stay an RPC.';
  end if;
end $$;

commit;
