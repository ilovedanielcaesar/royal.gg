-- Phase 3B: joining a group by standing code or invite link.
--
-- ADDITIVE ONLY. Creates three functions and two policies. Drops nothing,
-- changes no existing policy, touches no existing column or index.
--
-- Why the join is a function and not a client-side insert. Three RLS facts:
--
--   1. group_members INSERT is reachable only by group_members_write_admin
--      (is_admin(), hardcoded to one email) and group_members_insert_founder
--      (yourself, as admin, only into a group you created). A joiner matches
--      neither, and loosening either one would let anybody into any group.
--   2. group_invites has a single policy, is_admin(), so a joiner cannot read
--      a token in order to validate it.
--   3. groups.join_code is a shared secret. Resolving codes inside a
--      security definer function means the client never reads one, which is
--      what lets the RLS-isolation migration lock groups reads down later
--      without breaking this.
--
-- What this deliberately does NOT do: create a players roster row for the new
-- member. Three pre-group global unique indexes are still in force —
-- players_name_unique (lower(name), not partial), players_user_id_unique and
-- players_username_unique — so the insert would be rejected outright for
-- anyone already on another group's roster. Roster creation belongs with the
-- approvals queue in Phase 3C, which has to drop those indexes first AND
-- cover both paths: approval, and an instant-active join under join_policy
-- 'code', which never passes through an approval at all.
--
-- No money is read or written here.

begin;

-- ---------------------------------------------------------------------------
-- 1. Membership helpers (GROUPS.md §7)
--
-- security definer is NOT optional. A plain function that selects from
-- group_members, called from a policy ON group_members, recurses forever. A
-- security definer function runs as its owner and bypasses RLS, which breaks
-- the cycle. This is the single easiest thing to get wrong in the whole
-- migration. They are `stable` so the planner can cache them per statement.
-- ---------------------------------------------------------------------------

create or replace function is_group_member(gid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from group_members gm
     where gm.group_id = gid
       and gm.profile_id = auth.uid()
       and gm.status = 'active'
  );
$$;

create or replace function is_group_admin(gid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from group_members gm
     where gm.group_id = gid
       and gm.profile_id = auth.uid()
       and gm.status = 'active'
       and gm.role = 'admin'
  );
$$;

-- `revoke ... from public` is not enough on its own: Supabase's default
-- privileges grant EXECUTE on every new function in `public` directly to anon
-- and authenticated, and a direct grant survives a revoke aimed at PUBLIC.
-- Nothing anonymous has any business reaching group internals, so name anon.
revoke all on function is_group_member(uuid) from public, anon;
revoke all on function is_group_admin(uuid)  from public, anon;
grant execute on function is_group_member(uuid) to authenticated;
grant execute on function is_group_admin(uuid)  to authenticated;

comment on function is_group_member(uuid) is
  'Active membership in the given group. security definer to avoid policy recursion.';
comment on function is_group_admin(uuid) is
  'Active membership with role=admin. security definer to avoid policy recursion.';

-- ---------------------------------------------------------------------------
-- 2. join_group() — redeem a standing join code or an invite token
--
-- Every raise below is worded to be shown to a person as-is; the frontend
-- surfaces the message unchanged rather than re-classifying it.
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

  -- Already known to this group? Answer before spending an invite use.
  select gm.status into v_existing
  from group_members gm
  where gm.group_id = v_group_id and gm.profile_id = v_uid;

  if v_existing is not null then
    -- Decision 9: removal revokes access. A standing code must not quietly
    -- undo an admin's decision.
    if v_existing in ('removed', 'rejected') then
      raise exception
        'Your access to this group was removed. Ask an admin to let you back in.';
    end if;
    -- Clicking a link twice is a no-op, not a failure.
    return jsonb_build_object(
      'slug',           v_slug,
      'group_name',     v_group_name,
      'status',         v_existing,
      'already_member', true
    );
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

  insert into group_members (group_id, profile_id, role, status)
  values (v_group_id, v_uid, 'member', v_status);

  return jsonb_build_object(
    'slug',           v_slug,
    'group_name',     v_group_name,
    'status',         v_status,
    'already_member', false
  );
end;
$$;

-- Same as the helpers above: revoke the default grant to anon by name, or a
-- signed-out caller can still probe codes and read the error messages back.
revoke all on function join_group(text) from public, anon;
grant execute on function join_group(text) to authenticated;

comment on function join_group(text) is
  'Redeem a groups.join_code or a group_invites.token. security definer: the caller has no RLS path to group_members or group_invites.';

-- ---------------------------------------------------------------------------
-- 3. Let a group admin run their own group
--
-- Today groups and group_invites are writable only by is_admin() — the
-- hardcoded will@royal.gg.local — so the founder of a new group cannot rotate
-- its code or mint an invite. Policies are OR-ed, so neither of these weakens
-- anything that already exists. The RLS-isolation migration replaces them
-- along with every other policy.
-- ---------------------------------------------------------------------------

create policy groups_update_group_admin on groups
  for update to authenticated
  using (is_group_admin(id)) with check (is_group_admin(id));

create policy group_invites_group_admin on group_invites
  for all to authenticated
  using (is_group_admin(group_id)) with check (is_group_admin(group_id));

-- ---------------------------------------------------------------------------
-- 4. Assert what the app now depends on
-- ---------------------------------------------------------------------------

do $$
declare
  v_name text;
begin
  foreach v_name in array array['is_group_member', 'is_group_admin', 'join_group']
  loop
    if not exists (
      select 1 from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.proname = v_name and p.prosecdef
    ) then
      raise exception '%() is missing or is not security definer.', v_name;
    end if;
    if has_function_privilege('anon', format('public.%I', v_name) ||
         case v_name when 'join_group' then '(text)' else '(uuid)' end, 'execute') then
      raise exception '%() is still executable by anon.', v_name;
    end if;
  end loop;

  -- Policy recursion is silent until it deadlocks a real query, so pin the
  -- volatility the planner relies on too.
  if not exists (
    select 1 from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname in ('is_group_member', 'is_group_admin')
       and p.provolatile = 's'
    having count(*) = 2
  ) then
    raise exception 'The membership helpers must both be STABLE.';
  end if;

  if not exists (
    select 1 from pg_policies
     where schemaname = 'public' and policyname = 'groups_update_group_admin'
  ) or not exists (
    select 1 from pg_policies
     where schemaname = 'public' and policyname = 'group_invites_group_admin'
  ) then
    raise exception 'Group-admin policies were not created.';
  end if;
end $$;

commit;
