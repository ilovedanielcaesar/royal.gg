# royal.gg

A poker tracking web app for our weekly home game. Tracks buy-ins, cash-outs, lifetime winnings/losses, and player stats — without the pain of a spreadsheet.

## What it does

- Logs every poker session (who played, who bought in for how much, who cashed out for how much)
- Auto-reconciles chip miscounts at the end of the night
- Tracks lifetime stats per player (W/L, expected value, variance) — stats persist across payouts
- Leaderboard for biggest winners and losers all-time

## Stack

- React + TypeScript + Vite
- Tailwind CSS
- Supabase (Postgres + auth)
- Hosted on Vercel

## Local setup

Prereqs: Node.js 20+, npm, a Supabase account (free), a Vercel account (free, optional for now).

```bash
# clone the repo (you've already done this if you're reading this locally)
git clone git@github.com:ilovedanielcaesar/royal.gg.git
cd royal.gg

# install dependencies
npm install

# set up environment variables
cp .env.example .env.local
# then fill in your Supabase URL and anon key

# run the dev server
npm run dev
```

Open `http://localhost:5173` in your browser.

## Project structure

```
src/
  components/    # reusable UI components
  features/      # feature-specific code (sessions, players, stats)
  lib/           # utilities, supabase client, math helpers
  types/         # shared TypeScript types
  pages/         # route-level components
supabase/
  migrations/    # database schema changes
```

## Roadmap

**Phase 1 — MVP**
- [ ] Project scaffolding
- [ ] Supabase schema (players, sessions, buy_ins, cash_outs)
- [ ] Create a session + add participants
- [ ] Track buy-ins and rebuys
- [ ] Enter cash-outs and auto-reconcile
- [ ] List past sessions

**Phase 2 — Stats**
- [ ] Lifetime leaderboard
- [ ] Per-player stat page (W/L, E(X), Var(X))
- [ ] Cumulative winnings graph

**Phase 3 — Polish**
- [ ] Card and chip animations
- [ ] Mobile layout
- [ ] Multi-user auth

## Notes

- All money is stored as integer cents in the database. Don't introduce floats anywhere money is touched.
- Lifetime stats are never reset. Payouts are recorded as events but don't affect history.
- See `CLAUDE.md` for full architectural notes and domain rules.