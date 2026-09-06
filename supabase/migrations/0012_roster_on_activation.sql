-- Phase 3C (second half): a member gets a roster row when they become active.
--
-- ⚠ THIS ONE DROPS THINGS. Four global unique indexes go. Take a snapshot
-- first — `node scripts/db-backup.mjs` — because the free tier has no managed
-- backups. Dropping a unique index is recoverable (it can be recreated) as
-- long as no duplicate rows have been written in the meantime, which is
-- exactly what this migration then starts doing.
--
-- Why they have to go. From GROUPS.md §1, these four predate the group work
-- and are all strictly global:
--
--   players_name_unique        lower(name)              two groups cannot both have a "Dan"
--   players_user_id_unique     user_id                  one account = at most ONE players row, app-wide
--   players_username_unique    username                 same, via the old handle column
--   players_chosen_card_unique (chosen_suit, chosen_rank) 52 humans app-wide, ever
--
-- `players_user_id_unique` is the one GROUPS.md calls "the blocker": while it
-- stands, an account cannot appear on two rosters, so nothing can create a
-- roster row for someone who is already on another group's. The group-scoped
-- replacements were all created back in 0007 and are the real rule now:
--
--   players_group_name_unique     (group_id, lower(name))
--   players_group_profile_unique  (group_id, profile_id) where profile_id is not null
--   players_group_card_unique     (group_id, chosen_suit, chosen_rank)
--
-- The roster row itself is created by a TRIGGER, not by the approving UI. It
-- has to cover two paths that never meet: an admin approving a request, and an
-- instant-active join under join_policy 'code', which passes through no
-- approval at all. One trigger on group_members catches both, and cannot drift
-- the way two call sites would.
--
-- The legacy columns user_id / username / status / is_guest are still READ by
-- the app (PlayerProfilePage shows @username, PlayersPage filters on status and
-- is_guest), so new rows populate them. The contract migration drops the
-- columns and updates those readers together.
--
-- No money is read or written here.

begin;

-- ---------------------------------------------------------------------------
-- 1. Refuse to run unless the group-scoped replacements are really in place
-- ---------------------------------------------------------------------------

do $$
declare
  v_missing text;
begin
  foreach v_missing in array array[
    'players_group_name_unique',
    'players_group_profile_unique',
    'players_group_card_unique'
  ]
  loop
    if not exists (
      select 1 from pg_indexes
       where schemaname = 'public' and tablename = 'players'
         and indexname = v_missing
    ) then
      raise exception
        'Refusing to drop the global indexes: % is missing.', v_missing;
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Drop the four obsolete global constraints
-- ---------------------------------------------------------------------------

drop index if exists players_name_unique;
drop index if exists players_user_id_unique;
drop index if exists players_username_unique;
drop index if exists players_chosen_card_unique;

-- ---------------------------------------------------------------------------
-- 3. Create a roster row for a member of a group
--
-- security definer: the approving admin has no INSERT policy on players (that
-- is still players_insert_admin / is_admin()), and a joiner has none at all.
--
-- Idempotent on (group_id, profile_id): called again for someone who already
-- has a row, it does nothing. That matters because a member can go
-- active -> removed -> active and must keep the same roster row, and with it
-- their entire game history (decision 9).
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
  v_base      text;
  v_name      text;
  v_n         integer := 1;
begin
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

  v_base := coalesce(nullif(btrim(v_display), ''), 'Player');
  v_name := v_base;

  -- players_group_name_unique is (group_id, lower(name)). A guest already
  -- called "Dale" in this group means the joining Dale becomes "Dale (2)"
  -- until an admin links the two — that is decision 12's guest linking, and
  -- it is not built yet.
  while exists (
    select 1 from players
     where group_id = p_group_id and lower(name) = lower(v_name)
  ) loop
    v_n := v_n + 1;
    v_name := v_base || ' (' || v_n || ')';
    if v_n > 50 then
      raise exception 'Could not find a free roster name for % in group %.',
        v_base, p_group_id;
    end if;
  end loop;

  insert into players (
    group_id, profile_id, name, display_name, is_guest, status,
    -- Legacy columns, still read by the app. The contract migration drops
    -- them and updates their readers in the same change.
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

revoke all on function ensure_group_roster_row(uuid, uuid) from public, anon;

comment on function ensure_group_roster_row(uuid, uuid) is
  'Creates this account''s roster row in this group if it has none. Idempotent.';

-- ---------------------------------------------------------------------------
-- 4. Fire it whenever a membership becomes active
--
-- Covers approval (UPDATE pending -> active), restoration (removed -> active)
-- and an instant join under join_policy 'code' (INSERT straight to active).
-- ---------------------------------------------------------------------------

create or replace function roster_row_on_activation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'active'
     and (tg_op = 'INSERT' or old.status is distinct from 'active') then
    perform ensure_group_roster_row(new.group_id, new.profile_id);
  end if;
  return new;
end;
$$;

create trigger group_members_roster_row
after insert or update on group_members
for each row execute function roster_row_on_activation();

-- ---------------------------------------------------------------------------
-- 5. Backfill everyone who is already active without a roster row
--
-- Every member who joined between 0010 shipping and now — joining has created
-- no roster row until this moment.
-- ---------------------------------------------------------------------------

do $$
declare
  r record;
  v_made integer := 0;
begin
  for r in
    select gm.group_id, gm.profile_id
    from group_members gm
    where gm.status = 'active'
      and not exists (
        select 1 from players p
         where p.group_id = gm.group_id and p.profile_id = gm.profile_id
      )
    order by gm.created_at
  loop
    perform ensure_group_roster_row(r.group_id, r.profile_id);
    v_made := v_made + 1;
  end loop;
  raise notice 'Backfilled % roster row(s).', v_made;
end $$;

-- ---------------------------------------------------------------------------
-- 6. Assert the end state
-- ---------------------------------------------------------------------------

do $$
declare
  v_leftover integer;
begin
  select count(*) into v_leftover
  from group_members gm
  where gm.status = 'active'
    and not exists (
      select 1 from players p
       where p.group_id = gm.group_id and p.profile_id = gm.profile_id
    );
  if v_leftover > 0 then
    raise exception '% active member(s) still have no roster row.', v_leftover;
  end if;

  if exists (
    select 1 from pg_indexes
     where schemaname = 'public' and tablename = 'players'
       and indexname in (
         'players_name_unique', 'players_user_id_unique',
         'players_username_unique', 'players_chosen_card_unique'
       )
  ) then
    raise exception 'A global unique index on players survived the drop.';
  end if;

  if not exists (
    select 1 from pg_trigger
     where tgname = 'group_members_roster_row'
       and tgrelid = 'group_members'::regclass and not tgisinternal
  ) then
    raise exception 'The roster-row trigger was not created.';
  end if;
end $$;

commit;
