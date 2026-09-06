-- Phase 3A: an account exists independently of any group.
--
-- ADDITIVE ONLY. This migration drops nothing, and changes no existing policy.
-- RLS isolation (dropping the four rogue `using (true)` policies) is 0010; the
-- destructive contract (dropping players.user_id/.username/.status/.is_guest,
-- is_admin(), and 0008's transitional default_group_id() defaults) is 0011.
--
-- Three things happen here:
--   1. profiles.username becomes nullable — a display handle, not a credential
--   2. a trigger on auth.users creates the profiles row, for ANY provider
--   3. two narrow INSERT policies so a brand-new account can found a group
--
-- (1) and (2) are the OAuth-readiness rules from GROUPS.md §10b. Nothing here
-- knows about the synthetic royal.gg.local email domain, which is rule 3.

begin;

-- ---------------------------------------------------------------------------
-- 1. username is a handle, not a login credential
--
-- An OAuth user arrives with an email and a display name and no username, so
-- NOT NULL would make the trigger below unable to create their profile. The
-- unique index stays: Postgres allows many NULLs under a UNIQUE constraint.
-- ---------------------------------------------------------------------------

alter table profiles alter column username drop not null;

-- ---------------------------------------------------------------------------
-- 2. Profile creation belongs in the database, not in signUp()
--
-- Fires for a user created by any provider — password today, Google later —
-- so enabling OAuth needs no frontend change to get a profile. security
-- definer because the row is written before the new user has a session.
-- ---------------------------------------------------------------------------

create or replace function handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_username     text;
  v_display_name text;
begin
  -- Password signup passes username/display_name through options.data. OAuth
  -- passes provider metadata instead, so fall through the usual keys and
  -- finally to the email local part.
  v_username := nullif(btrim(lower(new.raw_user_meta_data ->> 'username')), '');
  if v_username is null then
    v_username := nullif(btrim(lower(split_part(coalesce(new.email, ''), '@', 1))), '');
  end if;

  -- Handle already taken? Leave it NULL rather than failing the signup — the
  -- user picks one on /profile. A password signup cannot reach this branch:
  -- its synthetic email would have collided in auth.users first.
  if v_username is not null
     and exists (select 1 from profiles p where p.username = v_username::citext)
  then
    v_username := null;
  end if;

  v_display_name := coalesce(
    nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''),
    nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),   -- Google
    nullif(btrim(new.raw_user_meta_data ->> 'name'), ''),
    v_username,
    nullif(btrim(split_part(coalesce(new.email, ''), '@', 1)), ''),
    'Player'
  );

  begin
    insert into profiles (id, username, display_name)
    values (new.id, v_username::citext, v_display_name)
    on conflict (id) do nothing;
  exception when unique_violation then
    -- Two signups raced for the same handle. Take the account without one
    -- rather than losing the account.
    insert into profiles (id, username, display_name)
    values (new.id, null, v_display_name)
    on conflict (id) do nothing;
  end;

  return new;
end;
$$;

comment on function handle_new_auth_user() is
  'Creates the profiles row for a new auth user, whatever the provider. See GROUPS.md 10b.';

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function handle_new_auth_user();

-- ---------------------------------------------------------------------------
-- 3. A brand-new account can found its own group
--
-- Without these, groups_write_admin / group_members_write_admin (0007) gate
-- every write on is_admin() — the hardcoded will@royal.gg.local — so a new
-- account lands on /groups and the only button on the page fails with an RLS
-- error. Policies are OR-ed, so neither of these weakens anything that exists:
-- they add one narrow path each, and 0010 replaces them along with the rest.
-- ---------------------------------------------------------------------------

create policy groups_insert_own on groups
  for insert to authenticated
  with check (created_by = auth.uid());

-- Only yourself, only as admin, only into a group you just created. Cannot be
-- used to join (or promote yourself into) anybody else's group.
create policy group_members_insert_founder on group_members
  for insert to authenticated
  with check (
    profile_id = auth.uid()
    and role = 'admin'
    and status = 'active'
    and exists (
      select 1 from groups g
      where g.id = group_members.group_id
        and g.created_by = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- 4. Assert what the app now depends on
-- ---------------------------------------------------------------------------

do $$
begin
  if (select is_nullable from information_schema.columns
       where table_schema = 'public' and table_name = 'profiles'
         and column_name = 'username') <> 'YES' then
    raise exception 'profiles.username is still NOT NULL.';
  end if;

  if not exists (
    select 1 from pg_trigger
     where tgname = 'on_auth_user_created'
       and tgrelid = 'auth.users'::regclass
       and not tgisinternal
  ) then
    raise exception 'on_auth_user_created trigger was not created.';
  end if;
end $$;

commit;
