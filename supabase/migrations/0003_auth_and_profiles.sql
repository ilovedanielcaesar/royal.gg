-- Auth + profiles: link Supabase Auth users to player rows, add status, suit/card picks.
-- Money columns are unchanged. Existing rows are backfilled to status='active' (host/guests),
-- so they remain visible without requiring approval.

create extension if not exists "citext";

alter table players
  add column user_id      uuid references auth.users(id) on delete set null,
  add column username     citext,
  add column status       text not null default 'active'
    check (status in ('pending','active','rejected')),
  add column chosen_suit  text
    check (chosen_suit in ('spade','heart','diamond','club')),
  add column chosen_rank  text
    check (chosen_rank in ('A','K','Q','J','10','9','8','7','6','5','4','3','2'));

-- One auth user maps to at most one player.
create unique index players_user_id_unique
  on players (user_id)
  where user_id is not null;

-- Usernames must be unique (case-insensitive via citext).
create unique index players_username_unique
  on players (username)
  where username is not null;

-- Two active players can't claim the same card.
create unique index players_chosen_card_unique
  on players (chosen_suit, chosen_rank)
  where status = 'active' and chosen_suit is not null and chosen_rank is not null;

-- Lookup an auth email by username for PIN-login (security definer so anon
-- callers can resolve a username to an email without exposing auth.users).
create or replace function get_email_by_username(uname citext)
returns text
language sql
security definer
set search_path = public, auth
as $$
  select u.email
  from players p
  join auth.users u on u.id = p.user_id
  where p.username = uname
  limit 1;
$$;

revoke all on function get_email_by_username(citext) from public;
grant execute on function get_email_by_username(citext) to anon, authenticated;
