# CLAUDE.md

This file gives Claude context about the project. Read this before making changes.

## Project Overview

**Royal.gg** is a personal poker tracking web app for a weekly home game. The goal is to replace the spreadsheet currently used to track buy-ins, cash-outs, and player performance over time.

### Background

- A group of friends plays poker every weekend
- Standard buy-in: $40
- Stakes: $0.25 / $0.50 (SB/BB)
- Players sometimes rebuy after busting
- Payouts happen periodically (every few months), but the app should track lifetime stats — not reset on payout
- Data integrity matters: chip miscounts need to be reconcilable

### Why we're building this

The previous spreadsheet had four problems we're explicitly solving:
1. Manual adjustments when chip counts didn't reconcile were painful
2. Adding new guest players meant restructuring the sheet
3. Payouts wiped historical progression — we want a permanent record
4. The UI was ugly — we want something that feels good to use

## Tech Stack

- **Frontend:** React (Vite) + TypeScript + Tailwind CSS
- **Backend / DB:** Supabase (Postgres + auth + realtime)
- **Hosting:** Vercel (free tier, connects directly to GitHub)
- **Package manager:** npm

Pick boring, well-supported libraries. No experimental stuff.

## Core Domain Concepts

These terms are used throughout the codebase. Use them consistently.

- **Session:** one night of poker. Has a date, a list of participants, and ends with everyone's final chip count.
- **Buy-in:** $40 deposit into a session. A player can have multiple buy-ins per session (rebuys).
- **Cash-out:** the dollar value of a player's chips at the end of the session.
- **Net:** `cash_out - total_buy_ins` for a session. Positive = won, negative = lost.
- **Reconciliation:** the process of distributing chip miscounts. The sum of all cash-outs MUST equal the sum of all buy-ins for a session. If chips are miscounted, the difference is distributed proportionally among winners (see Reconciliation Rules below).
- **Payout:** a real-money settlement event. Does NOT reset lifetime stats. Lifetime stats track the entire history regardless of how many payouts have occurred.

## Reconciliation Rules

When the sum of reported cash-outs ≠ sum of buy-ins, we have a discrepancy (almost always due to miscounted chips). The rule:

1. Calculate the discrepancy: `total_buy_ins - total_cash_outs`
2. If the discrepancy is small (< $5 by default, configurable), distribute it proportionally among **winners only** (players with positive net before adjustment), weighted by their winnings
3. If the discrepancy is large, flag the session for manual review — do NOT auto-adjust
4. Always log the original reported numbers AND the adjusted numbers — never overwrite

## Key Features (build in this order)

### Phase 1 — Core tracking (MVP)
- Create a session (date, select participants from roster)
- Track buy-ins per player during the session (default $40, allow rebuys)
- Enter cash-outs at end of session
- Auto-reconcile per the rules above
- View list of past sessions

### Phase 2 — Stats & leaderboards
- Lifetime leaderboard (total winnings/losses per player)
- Per-player track record: W/L count, expected value E(X), variance Var(X)
- Cumulative net graph per player over time

### Phase 3 — Polish
- Animations (cards, chips — see design doc)
- Multi-user access (currently single-user is fine for MVP testing)
- Mobile-friendly (we'll be using this on phones at the table)

## Conventions

### Code style
- TypeScript strict mode on
- Functional React components with hooks
- Co-locate components with their styles (Tailwind classes inline)
- One component per file, named the same as the file (PascalCase)
- Keep files small. If a component file passes ~200 lines, split it.

### File structure
```
src/
  components/    # reusable UI components
  features/      # feature-specific code (sessions, players, stats)
  lib/           # utilities, supabase client, math helpers
  types/         # shared TypeScript types
  pages/         # route-level components
```

### Database
- Use Supabase migrations (`supabase/migrations/`) for schema changes — never edit the DB schema by hand in the dashboard if it can be avoided
- Always include `created_at` and `updated_at` on tables
- Use UUIDs for primary keys
- Money is stored as integer cents, NEVER floats. `$40.00` is `4000`. Display formatting happens at the UI layer.

### Naming
- Tables: snake_case, plural (`players`, `sessions`, `buy_ins`, `cash_outs`)
- Columns: snake_case
- TS variables: camelCase
- Components: PascalCase

## Branching and releases

Settled 2026-09-07. Trunk-based, sized for one person with a Vercel auto-deploy.

- **`main` is the trunk** and is what Vercel serves. It must always be
  deployable. It is GitHub's default branch.
- **Branches are named for the work, not the version** — `phase-5-settings`,
  `fix-group-switcher`. They live days and are deleted after merging. A version
  number names a point in time, which is what a tag is for; a branch names a
  line of work.
- **Every phase goes through a PR**, even working alone: it is where the diff
  gets read before it lands, where CI runs, and where the reasoning is kept.
- **Releases are tags**, `git tag -a v1.1.0`. Not branches.
- **`v1.1.0` is the one exception**, and a temporary one. It predates this
  convention and is currently the integration branch for the multi-group work:
  phase branches PR into it, and when Phase 5 lands it fast-forwards into
  `main`, gets tagged `v1.1.0`, and is deleted. No branch is named after a
  version again after that.

CI (`.github/workflows/ci.yml`) runs typecheck, build and lint on every PR.
Lint uses `--max-warnings 1`, the known baseline — a ratchet that fails on a
second warning. Lower it as warnings are fixed; never raise it.

The smoke tests are **not** in CI and should not be added: they need
`SUPABASE_DB_URL` against the real project, and this repo is public. They are a
local gate, run before any migration is pushed.

## Things to be careful about

- **Floating point money is forbidden.** Always integer cents. `0.1 + 0.2 !== 0.3` in JS.
- **Reconciliation must be reversible.** Store original values alongside adjusted values.
- **Lifetime stats never reset.** Payouts are recorded as events but do not affect the historical record.
- **Don't trust user input on the frontend.** Validate cash-out totals server-side too (or in a Supabase function).

## Project Status

We are at the very beginning. Repo is empty. Start with project scaffolding (Vite + React + TS + Tailwind) and a basic Supabase setup. Don't over-engineer Phase 1.

## How to work with me (the human)

- I'm not super experienced with git, SSH, or modern web tooling. Explain commands when they're new.
- I'm using Antigravity IDE.
- Ask before making major architectural decisions. Suggest defaults but flag tradeoffs.
- When in doubt about scope, build the smaller thing first and we'll iterate.