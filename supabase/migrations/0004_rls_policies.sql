-- Re-enable RLS on all tables and define policies.
-- Admin is identified by email match. To change the admin email, update the
-- value in is_admin() below (and the matching VITE_ADMIN_EMAIL in .env.local).

create or replace function is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select coalesce((auth.jwt() ->> 'email') = 'will@baycalact.com', false);
$$;

revoke all on function is_admin() from public;
grant execute on function is_admin() to anon, authenticated;

alter table players   enable row level security;
alter table sessions  enable row level security;
alter table buy_ins   enable row level security;
alter table cash_outs enable row level security;

-- ---------- players ----------

-- Any authenticated user can read all players. Pending users included — the
-- app's UI gates what they can see based on their player row's status.
-- (For a 6-person home game there's nothing in players that needs hiding.)
create policy players_select on players
  for select
  to authenticated
  using (true);

-- A signed-up user can insert their own pending row (used by FinishSignupPage).
create policy players_insert_self_pending on players
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and status = 'pending'
    and is_guest = false
  );

-- Admin can insert any player (auto-active self at signup, plus guests).
create policy players_insert_admin on players
  for insert
  to authenticated
  with check (is_admin());

-- Admin can update anything.
create policy players_update_admin on players
  for update
  to authenticated
  using (is_admin())
  with check (is_admin());

-- An active user can update their own row (display_name, username, suit/rank).
create policy players_update_self on players
  for update
  to authenticated
  using (user_id = auth.uid() and status = 'active')
  with check (user_id = auth.uid() and status = 'active' and is_guest = false);

-- Admin can delete.
create policy players_delete_admin on players
  for delete
  to authenticated
  using (is_admin());

-- ---------- sessions / buy_ins / cash_outs ----------

create policy sessions_select on sessions
  for select to authenticated
  using (true);

create policy sessions_write_admin on sessions
  for all to authenticated
  using (is_admin())
  with check (is_admin());

create policy buy_ins_select on buy_ins
  for select to authenticated
  using (true);

create policy buy_ins_write_admin on buy_ins
  for all to authenticated
  using (is_admin())
  with check (is_admin());

create policy cash_outs_select on cash_outs
  for select to authenticated
  using (true);

create policy cash_outs_write_admin on cash_outs
  for all to authenticated
  using (is_admin())
  with check (is_admin());
