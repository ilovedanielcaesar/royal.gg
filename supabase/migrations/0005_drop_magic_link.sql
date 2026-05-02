-- Drop the magic-link-era helper. The app now signs users up directly with
-- username + password (synthetic email under the hood), so the
-- username->email lookup RPC is no longer needed.
drop function if exists get_email_by_username(citext);

-- Update is_admin() to compare against the synthetic admin email.
-- The admin username is hardcoded to 'will' here; if you change it, also
-- change VITE_ADMIN_USERNAME in .env.local. The synthetic email pattern is
-- "<username>@royal.gg.local" — see syntheticEmail() in src/lib/supabase.ts.
create or replace function is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select coalesce((auth.jwt() ->> 'email') = 'will@royal.gg.local', false);
$$;

revoke all on function is_admin() from public;
grant execute on function is_admin() to anon, authenticated;
