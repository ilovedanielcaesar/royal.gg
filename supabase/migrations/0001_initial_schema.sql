-- Initial schema for royal.gg poker tracking.
-- All money is stored as integer cents. Never floats.

create extension if not exists "pgcrypto";

-- Generic trigger to keep updated_at fresh on row updates.
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Players: the roster. Guests are flagged so we can filter them out of certain stats if we want.
create table players (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  display_name  text,
  is_guest      boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create unique index players_name_unique on players (lower(name));

create trigger players_set_updated_at
before update on players
for each row execute function set_updated_at();

-- Sessions: one night of poker.
-- discrepancy_cents = sum(buy_ins) - sum(reported cash_outs); positive means chips short.
-- needs_review is set when the discrepancy exceeds the auto-reconcile threshold.
create table sessions (
  id                 uuid primary key default gen_random_uuid(),
  played_at          date not null,
  notes              text,
  reconciled         boolean not null default false,
  discrepancy_cents  integer not null default 0,
  needs_review       boolean not null default false,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index sessions_played_at_idx on sessions (played_at desc);

create trigger sessions_set_updated_at
before update on sessions
for each row execute function set_updated_at();

-- Buy-ins: one row per buy-in event. Rebuys are additional rows for the same (session, player).
create table buy_ins (
  id            uuid primary key default gen_random_uuid(),
  session_id    uuid not null references sessions(id) on delete cascade,
  player_id     uuid not null references players(id) on delete restrict,
  amount_cents  integer not null default 4000 check (amount_cents > 0),
  created_at    timestamptz not null default now()
);

create index buy_ins_session_idx on buy_ins (session_id);
create index buy_ins_player_idx on buy_ins (player_id);

-- Cash-outs: exactly one per (session, player). Stores both reported and adjusted amounts
-- so reconciliation is fully reversible. adjusted_amount_cents defaults to reported value
-- and is overwritten by the reconciliation step.
create table cash_outs (
  id                       uuid primary key default gen_random_uuid(),
  session_id               uuid not null references sessions(id) on delete cascade,
  player_id                uuid not null references players(id) on delete restrict,
  reported_amount_cents    integer not null check (reported_amount_cents >= 0),
  adjusted_amount_cents    integer not null check (adjusted_amount_cents >= 0),
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  unique (session_id, player_id)
);

create index cash_outs_session_idx on cash_outs (session_id);
create index cash_outs_player_idx on cash_outs (player_id);

create trigger cash_outs_set_updated_at
before update on cash_outs
for each row execute function set_updated_at();
