-- Refuse a join when the roster name is already taken, instead of suffixing it.
--
-- 0012 resolved a clash by inventing "Bob (2)". Decided against: a group ends
-- up with two rows a human has to tell apart, and the only way back is the
-- guest linking that does not exist yet. Refusing at the door leaves the
-- person able to fix it themselves, in one step, on /profile.
--
-- Two places raise, because there are two ways in:
--
--   join_group()               the joiner is refused before any membership row
--                              exists, and reads a message aimed at them
--   ensure_group_roster_row()  the backstop, for an approval where the clash
--                              appeared after the request was made — an admin
--                              added a guest by that name in the meantime.
--                              That message is aimed at the admin.
--
-- Matching is case-insensitive, the same as players_group_name_unique, which
-- is on (group_id, lower(name)).
--
-- ADDITIVE: replaces two function bodies. No table, column, index, policy or
-- trigger changes. No money is read or written.

begin;

-- ---------------------------------------------------------------------------
-- 1. Roster creation refuses rather than renames
-- ---------------------------------------------------------------------------

create or replace function ensure_group_roster_row(
  p_group_id   uuid,
  p_profile_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_player_id uuid;
  v_display   text;
  v_username  text;
  v_name      text;
begin
  -- Idempotent: a member can go active -> removed -> active and must keep the
  -- same roster row, and with it their whole game history (decision 9).
  select id into v_player_id
  from players
  where group_id = p_group_id and profile_id = p_profile_id;
  if v_player_id is not null then
    return v_player_id;
  end if;

  select coalesce(nullif(btrim(pr.display_name), ''), pr.username::text),
         pr.username::text
    into v_display, v_username
  from profiles pr
  where pr.id = p_profile_id;

  v_name := coalesce(nullif(btrim(v_display), ''), 'Player');

  if exists (
    select 1 from players
     where group_id = p_group_id
       and lower(name) = lower(v_name)
  ) then
    raise exception
      'The name "%" is already taken in this group. Ask them to change their display name, then approve again.',
      v_name;
  end if;

  insert into players (
    group_id, profile_id, name, display_name, is_guest, status,
    -- Legacy columns, still read by the app (PlayerProfilePage shows
    -- @username, PlayersPage filters on status and is_guest). The contract
    -- migration drops them and updates their readers in the same change.
    user_id, username
  )
  values (
    p_group_id, p_profile_id, v_name, v_display, false, 'active',
    p_profile_id, v_username
  )
  returning id into v_player_id;

  return v_player_id;
end;
$$;

comment on function ensure_group_roster_row(uuid, uuid) is
  'Creates this account''s roster row in this group. Idempotent. Raises if the name is taken.';

-- ---------------------------------------------------------------------------
-- 2. join_group() refuses at the door
--
-- Identical to 0010 apart from the name check, which sits after the
-- already-a-member answer (re-clicking a link must stay a no-op) and before
-- anything is written (no invite use is spent on a join that cannot succeed).
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

  -- The roster name has to be free before anything is written. This applies
  -- to a 'code_approve' group too: there is no point taking a request that
  -- cannot be approved, and the person can fix it in one step on /profile.
  select coalesce(nullif(btrim(pr.display_name), ''), pr.username::text, 'Player')
    into v_name
  from profiles pr where pr.id = v_uid;

  if exists (
    select 1 from players
     where group_id = v_group_id
       and lower(name) = lower(v_name)
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

-- create or replace keeps the existing grants, but re-assert them rather than
-- rely on that: Supabase's default privileges grant EXECUTE in `public`
-- directly to anon, and a direct grant survives a revoke aimed at PUBLIC.
revoke all on function join_group(text) from public, anon;
grant execute on function join_group(text) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Assert
-- ---------------------------------------------------------------------------

do $$
begin
  if has_function_privilege('anon', 'public.join_group(text)', 'execute') then
    raise exception 'join_group() is executable by anon.';
  end if;

  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname in ('join_group', 'ensure_group_roster_row')
       and p.prosecdef
    having count(*) = 2
  ) then
    raise exception 'Both functions must exist and be security definer.';
  end if;

  -- The suffixing in 0012 could have produced "Name (2)" rows. None were
  -- created in practice, but fail loudly rather than leave one behind.
  if exists (select 1 from players where name ~ '\([0-9]+\)$') then
    raise exception
      'Found a suffixed roster name from 0012. Rename it by hand before applying this.';
  end if;
end $$;

commit;
