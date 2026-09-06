-- Phase 4: the game log lifecycle. draft -> submitted -> approved.
--
-- The columns have existed since 0007; nothing has ever used them, and every
-- session is 'approved' because 0007 backfilled them as historical fact. This
-- migration makes the states mean something.
--
--                     ┌──────────── send back (admin, + note) ───────────┐
--                     ↓                                                  │
--    [ draft ] ──submit──→ [ submitted ] ──approve──→ [ approved ]       │
--        ↑                       │                          │            │
--        │                       └──────────────────────────┼────────────┘
--        └───────────── reopen (admin) ─────────────────────┘
--
-- Two mechanisms, doing different jobs:
--
--   POLICIES decide who may touch a row at all. 0015 left sessions writable
--   only by a group admin; Phase 4 opens drafts to any member (decision 5).
--
--   A TRIGGER decides which transitions are legal and stamps who did them.
--   RLS cannot express "from this state to that state" — `with check` sees
--   only the new row — and audit columns set by the client are worth nothing:
--   approved_by would be whoever the browser said it was.
--
-- Approval is refused while needs_review is set. That is GROUPS.md §5.3: over
-- the group's reconcile threshold the books do not balance, and an approved
-- session that does not balance is exactly the corruption this app exists to
-- prevent. Two live sessions are in that state right now (−$110.00 on
-- 2026-08-26, +$107.50 on 2026-08-30); they are already 'approved' and this
-- migration does not touch them, but neither can they be re-approved after a
-- reopen until their real numbers are entered.
--
-- Money is not read or written here. reconcile() is untouched.

begin;

-- ---------------------------------------------------------------------------
-- 1. Legal transitions, and honest audit columns
-- ---------------------------------------------------------------------------

create or replace function enforce_session_state()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    -- A log always starts as a draft, whoever creates it.
    if new.status <> 'draft' then
      raise exception 'A new game log must start as a draft.';
    end if;
    new.created_by := coalesce(new.created_by, auth.uid());
    new.submitted_at := null;
    new.submitted_by := null;
    new.approved_at  := null;
    new.approved_by  := null;
    return new;
  end if;

  -- An approved game is closed. Reopening it is the only thing reachable, and
  -- this has to live here rather than in a policy: WITH CHECK clauses are OR-ed
  -- across every permissive policy for the command, independently of which
  -- policy's USING matched the row. sessions_admin_review's check is
  -- deliberately loose so that submitted -> approved can pass it, and that same
  -- looseness would rescue a straight edit of an approved row.
  if old.status = 'approved' and new.status = 'approved' then
    raise exception
      'This game is approved. Reopen it before making changes.';
  end if;

  if new.status is distinct from old.status then
    if not (
      (old.status = 'draft'     and new.status = 'submitted') or
      (old.status = 'submitted' and new.status = 'approved')  or
      (old.status = 'submitted' and new.status = 'draft')     or  -- sent back
      (old.status = 'approved'  and new.status = 'draft')          -- reopened
    ) then
      raise exception 'A game log cannot go from % to %.', old.status, new.status;
    end if;

    if new.status = 'approved' and new.needs_review then
      raise exception
        'These books do not balance yet. Fix the counts, or send this back, before approving.';
    end if;

    -- Stamped here, never by the client: approved_by is a claim about who
    -- signed off, and a browser must not get to make it.
    if new.status = 'submitted' then
      new.submitted_at := now();
      new.submitted_by := auth.uid();
    elsif new.status = 'approved' then
      new.approved_at := now();
      new.approved_by := auth.uid();
    elsif new.status = 'draft' then
      -- Back in play: the old sign-off no longer describes this row.
      new.approved_at  := null;
      new.approved_by  := null;
      new.submitted_at := null;
      new.submitted_by := null;
    end if;
  end if;

  -- created_by is who wrote it. It never changes hands.
  new.created_by := old.created_by;
  return new;
end;
$$;

comment on function enforce_session_state() is
  'Legal game-log transitions, and server-side stamping of submitted_by / approved_by.';

drop trigger if exists sessions_state on sessions;

create trigger sessions_state
before insert or update on sessions
for each row execute function enforce_session_state();

-- ---------------------------------------------------------------------------
-- 2. Who may touch a session
--
-- Replaces 0015's admin-only sessions_write_admin. Decision 5: any member may
-- edit any draft — the table fills the log in together after a game.
-- ---------------------------------------------------------------------------

drop policy if exists sessions_write_admin on sessions;

create policy sessions_insert_member on sessions
  for insert to authenticated
  with check (
    is_group_member(group_id)
    and status = 'draft'
    and created_by = auth.uid()
  );

-- Editing a draft, and submitting it. The `with check` allows landing on
-- 'submitted'; the trigger is what refuses every other jump.
create policy sessions_update_draft on sessions
  for update to authenticated
  using (is_group_member(group_id) and status = 'draft')
  with check (is_group_member(group_id) and status in ('draft', 'submitted'));

-- Your own draft, and only while it is still a draft.
create policy sessions_delete_own_draft on sessions
  for delete to authenticated
  using (
    is_group_member(group_id)
    and status = 'draft'
    and created_by = auth.uid()
  );

-- The admin's powers are split by state on purpose. A single `for all` policy
-- would let an admin edit an approved game in place, and GROUPS.md §4 is
-- explicit that an approved game is editable only after reopening it. Reopen
-- is therefore the ONLY thing reachable on an approved row.

create policy sessions_admin_insert on sessions
  for insert to authenticated
  with check (is_group_admin(group_id) and status = 'draft');

create policy sessions_admin_review on sessions
  for update to authenticated
  using (is_group_admin(group_id) and status in ('draft', 'submitted'))
  with check (is_group_admin(group_id));

create policy sessions_admin_reopen on sessions
  for update to authenticated
  using (is_group_admin(group_id) and status = 'approved')
  with check (is_group_admin(group_id) and status = 'draft');

-- Drafts only. A finished game is deleted by reopening it first, which leaves
-- the approval trail behind rather than quietly erasing a night of poker.
create policy sessions_admin_delete on sessions
  for delete to authenticated
  using (is_group_admin(group_id) and status = 'draft');

-- ---------------------------------------------------------------------------
-- 3. Buy-ins and cash-outs follow their session's state
--
-- A member may write them while the log is a draft. An admin may while it is
-- draft or submitted — but NOT once approved: GROUPS.md §4 says an approved
-- game is editable only after reopening it, and that has to hold for the rows
-- carrying the money, not just the header.
-- ---------------------------------------------------------------------------

drop policy if exists buy_ins_write_admin   on buy_ins;
drop policy if exists cash_outs_write_admin on cash_outs;

create policy buy_ins_write on buy_ins
  for all to authenticated
  using (exists (
    select 1 from sessions s
     where s.id = buy_ins.session_id
       and ((is_group_member(s.group_id) and s.status = 'draft')
         or (is_group_admin(s.group_id)  and s.status in ('draft', 'submitted')))
  ))
  with check (exists (
    select 1 from sessions s
     where s.id = buy_ins.session_id
       and ((is_group_member(s.group_id) and s.status = 'draft')
         or (is_group_admin(s.group_id)  and s.status in ('draft', 'submitted')))
  ));

create policy cash_outs_write on cash_outs
  for all to authenticated
  using (exists (
    select 1 from sessions s
     where s.id = cash_outs.session_id
       and ((is_group_member(s.group_id) and s.status = 'draft')
         or (is_group_admin(s.group_id)  and s.status in ('draft', 'submitted')))
  ))
  with check (exists (
    select 1 from sessions s
     where s.id = cash_outs.session_id
       and ((is_group_member(s.group_id) and s.status = 'draft')
         or (is_group_admin(s.group_id)  and s.status in ('draft', 'submitted')))
  ));

-- ---------------------------------------------------------------------------
-- 4. Assert
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (
    select 1 from pg_trigger
     where tgname = 'sessions_state' and tgrelid = 'sessions'::regclass
       and not tgisinternal
  ) then
    raise exception 'The session state trigger was not created.';
  end if;

  -- 0015's guarantees must survive this migration.
  if exists (
    select 1 from pg_policies
     where schemaname = 'public'
       and tablename in ('sessions', 'buy_ins', 'cash_outs')
       and (qual = 'true'
         or coalesce(qual, '') like '%is_app_owner%'
         or coalesce(with_check, '') like '%is_app_owner%')
  ) then
    raise exception
      'A permissive or superadmin-referencing policy appeared on a money table.';
  end if;

  -- Every historical session stays exactly as 0007 left it.
  if exists (select 1 from sessions where status <> 'approved') then
    raise exception
      'Aborting: % session(s) are not approved. This migration expects the pre-Phase-4 state.',
      (select count(*) from sessions where status <> 'approved');
  end if;
end $$;

commit;
