-- Phase 5C, decision 12 and 14 — an admin links a guest row to an account.
--
-- The problem this closes. A group has been playing with "Dale" as a guest for
-- months. Dale makes an account and asks to join. 0013 refuses that join,
-- because "Dale" is already taken in the group, and tells him to rename
-- himself — which loses the connection between the person and his record. The
-- fix is to link first: the admin puts Dale's profile_id on the existing guest
-- row, and ensure_group_roster_row() is idempotent on (group_id, profile_id),
-- so the approval ADOPTS that row instead of inserting a second one. Every
-- buy_in and cash_out stays exactly where it is. No money moves here, and no
-- money is read.
--
-- No new policy. players_update_admin is is_group_admin(group_id) on both
-- USING and WITH CHECK, so a group admin may already write profile_id on their
-- own roster. What was missing is the rules, and rules belong in the database:
-- the UI writes ONE column and the trigger derives the rest.
--
--   1. The profile has to have a group_members row in this group. RLS already
--      hides every other profile from the admin (profiles_select is
--      shares_group_with()), so without this the guard is only in the UI.
--   2. The profile must not already hold a roster row here.
--      players_group_profile_unique enforces that, but a raw 23505 reaches the
--      admin as "duplicate key value violates unique constraint". Raise first
--      and say what happened.
--   3. Linking derives is_guest / user_id / username. The Phase 1 preflight
--      established that is_guest is exactly `user_id is null` (12 accounts +
--      6 guests, zero exceptions) and the app still reads all three. Four
--      correlated columns written by a client drift; derived in one trigger
--      they cannot.
--   4. Unlink is allowed only while the linked profile is NOT an active
--      member — the window decision 14 describes, where a mis-click is still
--      undoable. Once they are active the roster row is their identity, and
--      an active member with no roster row is a state nothing repairs:
--      ensure_group_roster_row() only fires on activation, which has already
--      happened.
--
-- The roster NAME is deliberately untouched. The group knows this person as
-- "Dale"; preserving that row is the entire point, and renaming it from the
-- profile would undo the thing being fixed.
--
-- ⚠ SECOND HALF, found by rehearsal. The guard alone leaves decision 14
-- unreachable. 0013 made join_group() refuse a joiner whose roster name is
-- already taken, BEFORE any membership row is written — so Dale never reaches
-- the pending queue, the admin never sees a request, and there is no
-- membership for the link to attach to. Verified against the live function:
-- both join policies refuse with "Someone in J already goes by \"Dale\"" and
-- leave no group_members row at all.
--
-- So the check moves to where it is actually load-bearing. Under 'code' a join
-- is instantly active and the roster row is created in the same breath, so a
-- clash still has to be refused at the door and renaming is the only way in.
-- Under 'code_approve' nothing is created until an admin acts: the request is
-- allowed to land, the admin links or asks for a rename, and
-- ensure_group_roster_row() stays the backstop that refuses an approval which
-- would still clash. Its message now offers linking, which is the better fix
-- and did not exist when 0013 wrote it.
--
-- UPDATE only. An INSERT carrying a profile_id comes from exactly one place,
-- ensure_group_roster_row(), which runs after activation and would pass every
-- check here anyway; guarding INSERT would put this trigger in the founder's
-- group-creation path for no gain the unique index does not already give.
--
-- ADDITIVE: one function, one trigger. No column, index or policy changes.

begin;

-- ---------------------------------------------------------------------------
-- 1. Refuse to run unless what this leans on is really there
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (
    select 1 from pg_indexes
     where schemaname = 'public' and tablename = 'players'
       and indexname = 'players_group_profile_unique'
  ) then
    raise exception
      'players_group_profile_unique is missing; linking has no backstop.';
  end if;

  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'ensure_group_roster_row'
  ) then
    raise exception 'ensure_group_roster_row() is missing; the join cannot adopt.';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 2. The guard
-- ---------------------------------------------------------------------------

create or replace function guard_player_profile_link()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member_status text;
  v_username      text;
  v_taken_by      text;
begin
  -- Card picks, renames and status changes are the overwhelming majority of
  -- updates to this table. They are none of this trigger's business.
  if new.profile_id is not distinct from old.profile_id then
    return new;
  end if;

  -- Moving a row from one account to another is a relink: it is an unlink and
  -- a link at once, and both halves are checked below on their own terms.

  -- --- losing an account -----------------------------------------------
  if old.profile_id is not null then
    select gm.status into v_member_status
    from group_members gm
    where gm.group_id = old.group_id and gm.profile_id = old.profile_id;

    if v_member_status = 'active' then
      raise exception
        'This card belongs to an active member and cannot be unlinked. Remove them from the group first.';
    end if;

    -- Back to a plain guest row, in step. The name and the history stay.
    if new.profile_id is null then
      new.is_guest := true;
      new.user_id  := null;
      new.username := null;
      return new;
    end if;
  end if;

  -- --- gaining an account ----------------------------------------------
  select gm.status into v_member_status
  from group_members gm
  where gm.group_id = new.group_id and gm.profile_id = new.profile_id;

  if v_member_status is null then
    raise exception
      'That account is not part of this group. Ask them to request to join first, then link.';
  end if;
  if v_member_status in ('removed', 'rejected', 'left') then
    raise exception
      'That account is no longer in this group, so a card cannot be linked to it.';
  end if;

  select p.name into v_taken_by
  from players p
  where p.group_id = new.group_id
    and p.profile_id = new.profile_id
    and p.id <> new.id;

  if v_taken_by is not null then
    raise exception
      'That account already plays here as "%". A person has one card per group.',
      v_taken_by;
  end if;

  select pr.username::text into v_username
  from profiles pr where pr.id = new.profile_id;

  if v_username is null then
    raise exception 'No such account.';
  end if;

  -- Derived, never taken from the caller. is_guest is exactly `user_id is
  -- null` and the app reads both; the legacy pair goes when the contract
  -- migration drops the columns and updates their readers together.
  new.is_guest := false;
  new.user_id  := new.profile_id;
  new.username := v_username;

  return new;
end;
$$;

revoke all on function guard_player_profile_link() from public, anon;

comment on function guard_player_profile_link() is
  'Rules for changing players.profile_id: link, unlink, relink. Derives is_guest/user_id/username. See GROUPS.md decision 14.';

create trigger players_guard_profile_link
before update on players
for each row execute function guard_player_profile_link();

-- ---------------------------------------------------------------------------
-- 3. A request to join may land even when the name clashes
--
-- The body below is 0014's — the live version, which fixed a 0013 bug where a
-- returning leaver collided with their own roster row. Reproduced in full
-- rather than patched, because that is what create or replace requires. It
-- differs from 0014 in ONE place, marked in the comment there: the name check
-- now runs only for an instantly-active join.
--
-- Copying the wrong ancestor here is a real hazard and was caught in
-- rehearsal: an earlier draft of this migration reproduced 0013 and silently
-- reverted 0014's fix. smoke-3b caught it.
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

  -- 0013 ran this for every policy, and under 'code_approve' that was the
  -- bug: refusing here means no pending request is ever written, so guest
  -- linking (decision 14) has nothing to attach a profile to and cannot
  -- happen at all. A request an admin can resolve beats a door slammed on
  -- someone's own name. ensure_group_roster_row() is still the backstop, and
  -- refuses the approval if nobody linked in the meantime.
  --
  -- Under 'code' the insert below lands 'active' and the roster trigger fires
  -- in the same statement, so there is no moment in which an admin could
  -- link. That clash is still refused at the door, and renaming is still the
  -- way in.
  --
  -- Their OWN roster row stays excluded either way: a returning leaver still
  -- has one, under the very name being checked (0014).
  if v_policy = 'code' then
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
-- 4. The backstop now offers the better fix
--
-- Diffed against the LIVE pg_proc body, not against a migration file, and
-- identical to it apart from the message and one comment. This is the
-- admin-facing refusal — an approval that would still clash — and linking is
-- what they should reach for now that it exists.
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
  -- same roster row, and with it their whole game history (decision 9). It is
  -- also what makes guest linking work — a linked row is found right here, so
  -- the approval adopts it instead of inserting a second one.
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
      'The name "%" is already taken in this group. If that card is theirs, link it to their account; otherwise ask them to change their display name.',
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
  'Creates this account''s roster row in this group. Idempotent, so a linked guest row is adopted. Raises if the name is taken.';

-- ---------------------------------------------------------------------------
-- 5. Assert the end state
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (
    select 1 from pg_trigger
     where tgname = 'players_guard_profile_link'
       and tgrelid = 'players'::regclass and not tgisinternal
  ) then
    raise exception 'The link guard trigger was not created.';
  end if;

  -- Enabled, not merely present. 0017 left a trigger disabled mid-migration
  -- to get its backfill past 0016; a guard that exists but does not fire is
  -- worse than no guard, because the schema looks correct.
  if (select tgenabled from pg_trigger
       where tgname = 'players_guard_profile_link'
         and tgrelid = 'players'::regclass) <> 'O' then
    raise exception 'The link guard trigger is not enabled.';
  end if;

  if has_function_privilege('anon', 'public.join_group(text)', 'execute') then
    raise exception 'join_group() is executable by anon.';
  end if;

  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname in ('join_group', 'ensure_group_roster_row',
                         'guard_player_profile_link')
       and p.prosecdef
    having count(*) = 3
  ) then
    raise exception 'All three functions must exist and be security definer.';
  end if;

  -- Nothing above should have moved a single row.
  if exists (
    select 1 from players
     where profile_id is not null and (is_guest or user_id is distinct from profile_id)
  ) then
    raise exception 'A linked roster row disagrees with itself on is_guest/user_id.';
  end if;
end $$;

commit;
