-- v1.2 redesign, decision 2: `submitted` is removed, not merely unused.
--
-- The lifecycle 0016 built had three states and five legs. The redesign has
-- two states and two legs:
--
--    [ draft ] ──approve (admin)──→ [ approved ]
--        ↑                               │
--        └────── reopen (admin) ─────────┘
--
-- Nothing is ever "sent" anywhere. A night is a draft, any member of the group
-- may edit it, and an admin approves it when the books balance. The three legs
-- that went through `submitted` (draft → submitted, submitted → approved,
-- submitted → draft) are gone, and so is `submitted` as a legal status.
--
-- This is mostly subtraction from 0016. What it is NOT is a change to who may
-- write money: a member could already edit a draft, and reopening an approved
-- night was already admin-only (`sessions_admin_reopen`, 0016:165, untouched
-- here). The write window widens only in the sense that there is no longer an
-- intermediate state a member could be locked out of.
--
-- `submitted_at` and `submitted_by` are deliberately KEPT as unused nullable
-- columns. Dropping columns off live data is destructive and buys nothing; a
-- later cleanup migration can take them once a release has passed without
-- them. `src/types/database.ts` narrows in the same commit as this file.
--
-- Money is not read or written here. reconcile() is untouched.

begin;

-- ---------------------------------------------------------------------------
-- 1. Collapse the live `submitted` row before the state stops existing
--
-- One row is in it: 2026-08-30, balanced, $480.00 in and $480.00 out. It has
-- to move first, because step 2 removes the submitted -> draft leg that lets
-- it move at all, and step 5 removes 'submitted' as a legal value.
--
-- This runs through the OLD trigger, on purpose: submitted -> draft is still
-- legal at this point, and the trigger's draft branch nulls submitted_at and
-- submitted_by for us. That is the coherent outcome — after this migration a
-- row carrying a submitted timestamp would be describing a state the schema
-- no longer has.
-- ---------------------------------------------------------------------------

update sessions set status = 'draft' where status = 'submitted';

-- ---------------------------------------------------------------------------
-- 2. Two legs, not five
--
-- `create or replace function` takes no patch, so the whole body is restated.
-- It is restated from 0017's, NOT 0016's: 0017 added the buy_in_cents stamp
-- and the re-stake guard to this same function, and rebasing on 0016 would
-- have silently reverted both. That mistake was made writing this file and
-- caught by the rehearsal — which is what the rehearsal is for.
--
-- Everything here is 0017's, unchanged, except the transition list and the
-- submitted stamping branch.
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
  -- deliberately loose so that draft -> approved can pass it, and that same
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
      (old.status = 'draft'    and new.status = 'approved') or  -- approved
      (old.status = 'approved' and new.status = 'draft')        -- reopened
    ) then
      raise exception 'A game log cannot go from % to %.', old.status, new.status;
    end if;

    if new.status = 'approved' and new.needs_review then
      raise exception
        'These books do not balance yet. Fix the counts before approving.';
    end if;

    -- Stamped here, never by the client: approved_by is a claim about who
    -- signed off, and a browser must not get to make it.
    if new.status = 'approved' then
      new.approved_at := now();
      new.approved_by := auth.uid();
    else
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
  'Legal game-log transitions (draft <-> approved), server-side stamping of approved_by, and the session buy-in stamp (decision 13).';

-- ---------------------------------------------------------------------------
-- 3. The session policies stop naming a state that does not exist
--
-- sessions_insert_member, sessions_delete_own_draft, sessions_admin_insert,
-- sessions_admin_reopen and sessions_admin_delete never mentioned 'submitted'
-- and are left exactly as 0016 wrote them.
-- ---------------------------------------------------------------------------

drop policy if exists sessions_update_draft on sessions;

-- Editing a draft. It is the only thing a non-admin member may land on; the
-- approve leg is sessions_admin_review's, below.
create policy sessions_update_draft on sessions
  for update to authenticated
  using (is_group_member(group_id) and status = 'draft')
  with check (is_group_member(group_id) and status = 'draft');

drop policy if exists sessions_admin_review on sessions;

-- Approving. The `using` is draft-only — an approved row is reachable only
-- through sessions_admin_reopen — and the `with check` stays deliberately
-- loose so that landing on 'approved' passes. The trigger is what refuses
-- every illegal jump; see the note in enforce_session_state().
create policy sessions_admin_review on sessions
  for update to authenticated
  using (is_group_admin(group_id) and status = 'draft')
  with check (is_group_admin(group_id));

-- ---------------------------------------------------------------------------
-- 4. Buy-ins and cash-outs follow their session's state
--
-- 0016 gave these two legs: a member on a draft, or an admin on a draft or a
-- submitted log. With 'submitted' gone the admin leg says "an admin, on a
-- draft" — and is_group_admin is a strict subset of is_group_member, so it
-- is subsumed entirely by the member leg. Keeping a dead disjunct on a money
-- policy is how a policy stops being readable, so it goes.
--
-- The guarantee is unchanged and is the one that matters: NOBODY writes money
-- to an approved session. It is reopened first, which leaves an audit trail.
-- ---------------------------------------------------------------------------

drop policy if exists buy_ins_write   on buy_ins;
drop policy if exists cash_outs_write on cash_outs;

create policy buy_ins_write on buy_ins
  for all to authenticated
  using (exists (
    select 1 from sessions s
     where s.id = buy_ins.session_id
       and is_group_member(s.group_id)
       and s.status = 'draft'
  ))
  with check (exists (
    select 1 from sessions s
     where s.id = buy_ins.session_id
       and is_group_member(s.group_id)
       and s.status = 'draft'
  ));

create policy cash_outs_write on cash_outs
  for all to authenticated
  using (exists (
    select 1 from sessions s
     where s.id = cash_outs.session_id
       and is_group_member(s.group_id)
       and s.status = 'draft'
  ))
  with check (exists (
    select 1 from sessions s
     where s.id = cash_outs.session_id
       and is_group_member(s.group_id)
       and s.status = 'draft'
  ));

-- ---------------------------------------------------------------------------
-- 5. 'submitted' stops being a legal value
--
-- Last, because everything above has to have moved off it first. From here a
-- write of 'submitted' fails at the constraint rather than at the trigger,
-- which is the stronger of the two: the constraint holds even for a superuser
-- session that has disabled triggers.
-- ---------------------------------------------------------------------------

alter table sessions drop constraint if exists sessions_status_check;

alter table sessions
  add constraint sessions_status_check
  check (status in ('draft', 'approved'));

-- ---------------------------------------------------------------------------
-- 6. Assert
-- ---------------------------------------------------------------------------

do $$
begin
  if exists (select 1 from sessions where status = 'submitted') then
    raise exception 'A submitted session survived the collapse.';
  end if;

  if not exists (
    select 1 from pg_trigger
     where tgname = 'sessions_state' and tgrelid = 'sessions'::regclass
       and not tgisinternal
  ) then
    raise exception 'The session state trigger is missing.';
  end if;

  -- No policy on a money table may still name the state we just removed.
  if exists (
    select 1 from pg_policies
     where schemaname = 'public'
       and tablename in ('sessions', 'buy_ins', 'cash_outs')
       and (coalesce(qual, '') like '%submitted%'
         or coalesce(with_check, '') like '%submitted%')
  ) then
    raise exception 'A policy still refers to the submitted state.';
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

  -- 0017 lives in this same function, and restating the body is exactly how
  -- its two additions get lost. Assert them here rather than trusting a read.
  if (select prosrc from pg_proc p join pg_namespace n on n.oid=p.pronamespace
       where n.nspname='public' and p.proname='enforce_session_state')
     not like '%default_buy_in_cents%' then
    raise exception '0017''s buy-in stamp was dropped from the trigger.';
  end if;
  if (select prosrc from pg_proc p join pg_namespace n on n.oid=p.pronamespace
       where n.nspname='public' and p.proname='enforce_session_state')
     not like '%cannot change in the same step%' then
    raise exception '0017''s re-stake guard was dropped from the trigger.';
  end if;

  -- The columns stay. Dropping them is a later, separate decision.
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'sessions'
       and column_name in ('submitted_at', 'submitted_by')
    having count(*) = 2
  ) then
    raise exception 'submitted_at / submitted_by should have been kept.';
  end if;
end $$;

commit;
