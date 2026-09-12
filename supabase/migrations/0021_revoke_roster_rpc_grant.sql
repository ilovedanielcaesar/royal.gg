-- Pre-release audit, finding 1 — ensure_group_roster_row() stops being a
-- public API.
--
-- What this closes. The function is security definer and EXECUTE was granted
-- to `authenticated`. Its body makes no authorization check of any kind: it
-- never calls auth.uid(), never checks group membership, never checks admin.
-- Running as the owner, it bypasses RLS. So any signed-in account that knows
-- a group's UUID could insert an active, non-guest roster row into a group it
-- does not belong to, naming any profile it likes.
--
-- This was not theorised. It was run, as `role authenticated` with a sub
-- claim belonging to a non-member of the target group, and it returned a
-- player id:
--
--   begin;
--   set local role authenticated;
--   set local request.jwt.claims = '{"sub":"<non-member>","role":"authenticated"}';
--   select ensure_group_roster_row('<a group they are not in>', '<someone else>');
--   -- 095d3eb1-12b0-4b0b-8e4a-a74525885790
--   rollback;
--
-- How the grant got there. 0012 created the function and wrote
--
--   revoke all on function ensure_group_roster_row(uuid, uuid) from public, anon;
--
-- which is two of the three names that matter. Supabase grants EXECUTE on new
-- public functions to anon, authenticated and service_role by default, and
-- `public` is not the role `authenticated` — revoking PUBLIC leaves a direct
-- grant standing. The ACL still read `authenticated=X/postgres`. 0013 and
-- 0018 each restated the body with `create or replace`, which preserves the
-- ACL, so the gap survived two rewrites of the function it was attached to.
--
-- Why revoking is the whole fix, and not a workaround. Nothing in src/ calls
-- this function — the only two callers are in the database:
--
--   roster_row_on_activation()  the trigger on group_members
--   join_group(text)            via that same trigger, on the insert it makes
--
-- Both are themselves security definer and execute as the owner, which holds
-- its own EXECUTE privilege. Revoking from the client roles does not reach
-- them. The roster still appears when a member is approved, exactly as before.
--
-- Why NOT an auth.uid() check inside the body instead. It would have to pass
-- in two different shapes: on a self-join auth.uid() IS p_profile_id, and on
-- an admin approval it is the admin, not the member being added. A check
-- loose enough to admit both is close to no check, and getting it wrong
-- breaks joining rather than failing safe. The call is not meant to be
-- reachable from a browser at all, so the honest fix is to make it
-- unreachable.
--
-- No data changes. This alters a privilege and nothing else.

begin;

-- All three names, not just the one that is wrong today. `public` and `anon`
-- are already revoked; naming them again is free and means this file states
-- the whole intended end state rather than a delta from a file you would have
-- to go and read.
revoke all on function public.ensure_group_roster_row(uuid, uuid)
  from public, anon, authenticated;

comment on function public.ensure_group_roster_row(uuid, uuid) is
  'Creates this account''s roster row in this group. Idempotent, so a linked '
  'guest row is adopted. Raises if the name is taken. NOT CALLABLE BY A '
  'CLIENT: security definer with no authorization check of its own, so the '
  'only thing standing between it and a cross-group insert is the absence of '
  'an EXECUTE grant (0021). Callers are roster_row_on_activation() and '
  'join_group(), both security definer. Do not grant this to anon or '
  'authenticated.';

-- ---------------------------------------------------------------------------
-- Assert the end state
--
-- A revoke that silently did nothing looks exactly like a revoke that worked,
-- so the file refuses to commit unless the privilege is actually gone.
-- ---------------------------------------------------------------------------

do $$
begin
  if has_function_privilege(
       'authenticated', 'public.ensure_group_roster_row(uuid, uuid)', 'execute'
     ) then
    raise exception 'ensure_group_roster_row() is still executable by authenticated.';
  end if;

  if has_function_privilege(
       'anon', 'public.ensure_group_roster_row(uuid, uuid)', 'execute'
     ) then
    raise exception 'ensure_group_roster_row() is still executable by anon.';
  end if;

  -- The legitimate path has to survive. If either caller has gone missing,
  -- approving a member stops creating a roster row and the revoke would be
  -- masking that rather than causing it.
  if not exists (
    select 1 from pg_trigger
     where tgname = 'group_members_roster_row'
       and tgrelid = 'group_members'::regclass
       and not tgisinternal
       and tgenabled = 'O'
  ) then
    raise exception 'group_members_roster_row is missing or disabled; the roster would stop being written.';
  end if;

  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'roster_row_on_activation'
       and p.prosecdef
  ) then
    raise exception 'roster_row_on_activation() is missing or is no longer security definer.';
  end if;

  -- Nothing above touches a row.
  if (select count(*) from players) is null then
    raise exception 'unreachable';
  end if;
end $$;

commit;
