-- Payouts: settling-up events. Each payout closes a payout "period" (the
-- window since the previous payout, or all-time if this is the first one).
-- Reverting a payout is just a delete — sessions stay, the period reopens.

create table payouts (
  id                     uuid primary key default gen_random_uuid(),
  -- Sessions with played_at <= this date are inside this payout's period.
  period_end_date        date not null,
  -- The single person everyone settles with: losers transfer to them, then
  -- they distribute to the winners. Tracked here for the records page.
  distributor_player_id  uuid not null references players(id) on delete restrict,
  notes                  text,
  created_at             timestamptz not null default now()
);

create index payouts_period_end_idx on payouts (period_end_date desc);

alter table payouts enable row level security;

create policy payouts_select on payouts
  for select to authenticated using (true);

create policy payouts_write_admin on payouts
  for all to authenticated
  using (is_admin())
  with check (is_admin());
