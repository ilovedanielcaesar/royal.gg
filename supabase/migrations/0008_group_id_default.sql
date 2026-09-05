-- TRANSITIONAL HOTFIX for 0007.
--
-- 0007 added group_id to players, sessions and payouts as NOT NULL with no
-- default. Every insert path in the app predates group_id and doesn't supply
-- it, so all of these started failing the moment 0007 landed:
--
--   signUp()                       -> insert into players
--   PlayersPage.handleAdd()        -> insert into players
--   SessionFormPage.addGuest()     -> insert into players
--   SessionFormPage.handleSubmit() -> insert into sessions
--   PlayersPage.handleSettle()     -> insert into payouts
--
-- Reads were unaffected, which is why the app still looked healthy.
--
-- A DEFAULT cannot contain a subquery, so it goes through a function. This is
-- explicitly a bridge: once Phase 2 passes group_id explicitly on every insert,
-- 0009 (contract) drops both the defaults and this function. Leaving it in
-- permanently would silently file new rows under the oldest group, which is
-- exactly the wrong behaviour once a second group exists.

begin;

-- Oldest group, i.e. the one 0007 backfilled everything into. Returns NULL on
-- a fresh database with no groups, which correctly re-raises the NOT NULL
-- violation rather than inventing a group.
create or replace function default_group_id()
returns uuid
language sql
stable
as $$
  select id from groups order by created_at, id limit 1;
$$;

comment on function default_group_id() is
  'TRANSITIONAL (0008). Drop in 0009 once every insert passes group_id explicitly.';

alter table players  alter column group_id set default default_group_id();
alter table sessions alter column group_id set default default_group_id();
alter table payouts  alter column group_id set default default_group_id();

commit;
