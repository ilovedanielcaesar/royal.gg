-- Phase 5, decision 13: a night keeps the stakes it was played at.
--
-- Decision 7 put the buy-in on the group, and that is right for a NEW session
-- and wrong for an old one. The app reads a hardcoded 4000 in five places and
-- multiplies it by a rebuy count; point those at `groups.default_buy_in_cents`
-- and the first time the group moves from $40 to $50, reopening any 2025 game
-- recomputes its buy-ins at $50 and silently rewrites a night that was settled
-- months ago. The money would change with nobody touching it.
--
-- So the group's value becomes the default a session is STAMPED WITH, not a
-- value read live at edit time. After this, `sessions.buy_in_cents` is the only
-- thing the form may multiply by.
--
-- This is why Phase 5 opens with a migration instead of a settings form: the
-- form is what makes the stakes editable, and it is not safe to ship first.
--
-- The backfill takes what was actually recorded — `buy_ins.amount_cents` —
-- ahead of the group's current setting, because those rows ARE the history.
-- The distinction is live today: `test-phase-4` is configured at $20 but its
-- one session was logged at $40, since the app never read the group value.
-- $40 is what happened, so $40 is what it keeps.
--
-- Money is READ here (to learn what each night's stake was) and one new column
-- is written. No buy-in, cash-out or reconciled figure is altered.

begin;

-- ---------------------------------------------------------------------------
-- 1. Refuse to run if the backfill would be a guess
--
-- One stake per night is the app's whole model — a rebuy is another buy-in at
-- the same price. If a session ever held two different amounts, picking one
-- would be inventing history, and this migration must stop rather than choose.
-- ---------------------------------------------------------------------------

do $$
declare
  v_mixed int;
begin
  select count(*) into v_mixed from (
    select session_id from buy_ins
     group by session_id having count(distinct amount_cents) > 1
  ) x;
  if v_mixed > 0 then
    raise exception
      'Aborting: % session(s) hold more than one buy-in amount. The backfill would have to guess which is the stake.',
      v_mixed;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 2. The column, backfilled from what was recorded
-- ---------------------------------------------------------------------------

alter table sessions add column if not exists buy_in_cents integer;

-- The trigger comes off for the backfill and goes straight back on.
--
-- 0016 refuses ANY update to an approved row — that is the rule that makes an
-- approved night final — and sixteen of the rows below are approved. Without
-- this the backfill raises "This game is approved. Reopen it before making
-- changes." on its first row and the migration aborts. Found by rehearsing it
-- against live data, not by reading it.
--
-- The window is safe because it is inside this transaction: DISABLE TRIGGER
-- takes an ACCESS EXCLUSIVE lock and rolls back with everything else, so no
-- other session ever sees the guard off.
alter table sessions disable trigger sessions_state;

update sessions s
   set buy_in_cents = coalesce(
         (select max(b.amount_cents) from buy_ins b where b.session_id = s.id),
         g.default_buy_in_cents
       )
  from groups g
 where g.id = s.group_id
   and s.buy_in_cents is null;

alter table sessions enable trigger sessions_state;

alter table sessions alter column buy_in_cents set not null;

alter table sessions drop constraint if exists sessions_buy_in_cents_positive;
alter table sessions add constraint sessions_buy_in_cents_positive
  check (buy_in_cents > 0);

comment on column sessions.buy_in_cents is
  'The stake this night was played at, in integer cents. Stamped from the group at creation; never re-read from the group afterwards (GROUPS.md decision 13).';

-- ---------------------------------------------------------------------------
-- 3. Stamp it on insert
--
-- Same reasoning as submitted_by / approved_by in 0016: a value the client is
-- free to leave unset is a value the database has to settle, and the group is
-- the only honest source at creation time.
--
-- Unchanged from 0016 apart from the buy_in_cents lines. The whole body is
-- restated because `create or replace function` takes no patch.
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
    -- Decision 13. A caller may name the stake explicitly — a one-off night at
    -- different stakes is a real thing — but may not leave it to be resolved
    -- later, because "later" is when the group's setting has moved on.
    new.buy_in_cents := coalesce(
      new.buy_in_cents,
      (select g.default_buy_in_cents from groups g where g.id = new.group_id)
    );
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

  -- The stake may move while the log is still being worked on. It may not move
  -- in the same statement that signs the log off: approval is a sign-off on the
  -- numbers as reviewed, and the stake is one of them.
  --
  -- Reopening and re-staking in ONE statement is still allowed, deliberately.
  -- It is not a hole: the row lands as a draft with approved_by and approved_at
  -- cleared, so the sign-off is visibly gone rather than quietly carried over a
  -- changed number. That is the same end state as reopening and then editing,
  -- and refusing it would only force two statements for the same result.
  if new.buy_in_cents is distinct from old.buy_in_cents
     and new.status = 'approved' then
    raise exception
      'The buy-in cannot change in the same step that approves the game.';
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
  'Legal game-log transitions, server-side stamping of submitted_by / approved_by, and the session buy-in stamp (decision 13).';

-- ---------------------------------------------------------------------------
-- 4. Assert
-- ---------------------------------------------------------------------------

do $$
declare
  v_bad int;
begin
  if not exists (
    select 1 from information_schema.columns
     where table_schema='public' and table_name='sessions'
       and column_name='buy_in_cents' and is_nullable='NO'
  ) then
    raise exception 'sessions.buy_in_cents is missing or still nullable.';
  end if;

  -- Every night that recorded buy-ins keeps the stake it actually recorded.
  select count(*) into v_bad
    from sessions s
   where exists (select 1 from buy_ins b where b.session_id = s.id)
     and s.buy_in_cents <> (
       select max(b.amount_cents) from buy_ins b where b.session_id = s.id
     );
  if v_bad > 0 then
    raise exception
      'Aborting: % session(s) were stamped with a stake their buy-ins do not show.', v_bad;
  end if;

  -- 0015 and 0016 must survive this migration.
  if exists (
    select 1 from pg_policies
     where schemaname='public'
       and tablename in ('sessions','buy_ins','cash_outs')
       and (qual = 'true'
         or coalesce(qual,'') like '%is_app_owner%'
         or coalesce(with_check,'') like '%is_app_owner%')
  ) then
    raise exception
      'A permissive or superadmin-referencing policy appeared on a money table.';
  end if;

  -- tgenabled 'O' is origin-enabled. 'D' would mean the backfill left the
  -- guard off, which is the one way this migration could do real harm.
  if not exists (
    select 1 from pg_trigger
     where tgname='sessions_state' and tgrelid='sessions'::regclass
       and not tgisinternal and tgenabled = 'O'
  ) then
    raise exception 'The session state trigger is missing or still disabled.';
  end if;

  -- Nothing that predates Phase 4 changed hands.
  if exists (select 1 from sessions where created_by is null and status <> 'approved') then
    raise exception 'A pre-Phase-4 session is no longer approved.';
  end if;
end $$;

commit;
