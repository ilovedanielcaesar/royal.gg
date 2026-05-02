-- Disable Row Level Security on Phase-1 tables for solo localhost development.
--
-- Supabase enables RLS by default on new tables. With RLS on and zero policies,
-- every read/write from the anon key is denied (error 42501).
--
-- This is appropriate while there's no auth and the app only runs on localhost.
-- ⚠ Before deploying publicly, replace this with proper policies (see Phase 3 in CLAUDE.md):
--    1. Add Supabase Auth.
--    2. Re-enable RLS on each table.
--    3. Write policies that scope reads/writes to the authenticated user(s).

alter table players   disable row level security;
alter table sessions  disable row level security;
alter table buy_ins   disable row level security;
alter table cash_outs disable row level security;
