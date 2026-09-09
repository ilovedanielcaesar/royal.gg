---
name: agy
description: Delegate front-end work to Google Antigravity CLI (Gemini 3.8 Flash, medium thinking) while Claude Code orchestrates - scope it, write the spec, then review the diff and verify the build. Use when the user types /agy, asks to hand work to Gemini/Antigravity, or asks for UI, component, CSS, layout or animation work that Gemini is better at.
---

# Delegating to Antigravity (Gemini)

You are the **orchestrator**. Gemini is the implementer. You keep responsibility for
correctness — a delegated task is not done until you have reviewed the diff yourself.

Gemini's strength is the **front end**. Send it the pixels; keep the arithmetic.

## What to send it

Good handoffs — Gemini is genuinely better than you at these:
- React components, Tailwind class work, layout and responsive behaviour
- CSS: the felt/card visual language, gradients, shadows, sticky headers, grid
- Animation: card and chip motion, reveal-on-scroll, `prefers-reduced-motion` paths
- The `design_archetypes/*.html` mocks — self-contained pages, its ideal shape
- Turning a settled mock into real `src/` components

Keep for yourself — the failure mode here is silent and corrupts real data:
- Anything touching money representation. **Integer cents, never floats.**
- Reconciliation math, and the rule that original values are never overwritten
- Supabase migrations and RLS policies
- Lifetime-stats logic, which must never reset on payout

## The loop

### 1. Scope it yourself first
Read the relevant files **before** delegating. A vague spec produces a bad diff and
costs more than doing the work yourself. You should know which files ought to change.

### 2. Write the spec
Include: the goal, the exact files in scope, the visual authority it must obey, and
how Gemini should verify its work. Be explicit about what is *out* of scope — it will
happily restyle things you never asked about.

For anything visual, name the binding documents in the spec, because Gemini will
invent a palette otherwise:
- `design_archetypes/_STYLE_CONTRACT.md` — the binding style guide for the redesigns
- `DESIGN.md` — Direction, Palette, Typography
- **No new colors and no chart libraries.** The palette is closed; charts are hand-rolled SVG.

Repeat the house rules in the spec: TypeScript strict, functional components with
hooks, Tailwind inline, one component per file named after the file in PascalCase,
split anything past ~200 lines.

### 3. Hand it off

```bash
.claude/skills/agy/run.sh "$SCRATCH/agy-last.md" "<spec>"
```

The wrapper pins the settings the user requested — **model `gemini-3.8-flash-medium`,
`--effort medium`, `--dangerously-skip-permissions`** — so they are never forgotten.
Do not call `agy --print` directly unless you deliberately need different settings.

- Medium thinking is encoded twice on purpose: in the model id and in `--effort`.
  Swap to `gemini-3.8-flash-high` only if the user asks for it.
- Headless print mode cannot prompt for tool permissions. Without the skip flag every
  `read_file`, `write_file` and `command` is auto-denied and the run returns *nothing*
  useful — that is what the "no output produced" error means. With it, Gemini approves
  its own shell commands. This is why step 4 is not optional.
- Wrap in `timeout 1800` and raise the Bash tool timeout; real tasks are slow.
- Read the output file for the final message rather than scraping terminal noise.
- If Claude Code's auto-mode classifier blocks the call, do not rewrite the command to
  evade it. Say so, and offer the user the `!` prefix to run the same wrapper themselves.

### 4. Review before believing anything

Never take Gemini's final message at face value. Always:

```bash
git diff --stat && git diff
npx tsc --noEmit
npm run build
```

Read the actual diff. Confirm the `AGENTS.md` invariants really hold — especially
integer-cents money handling, and that no original reconciliation values were
overwritten. For visual work, check it against the style contract rather than against
Gemini's description of what it did: the palette is closed, and a plausible-looking
`#0e3526` that is not `--felt-900` is still a regression.

### 5. Iterate in-thread

```bash
.claude/skills/agy/run.sh --continue "$SCRATCH/agy-last.md" "<follow-up>"
```

`--continue` resumes the most recent conversation in this workspace, so corrections are
far cheaper than a fresh run. `--conversation <id>` resumes a specific one.

## Running several at once

Only for genuinely independent tasks. Give each its own git worktree so they cannot
collide on the same files:

```bash
git worktree add ../royal-task-a -b task-a
agy --model gemini-3.8-flash-medium --effort medium --dangerously-skip-permissions \
    --add-dir ../royal-task-a --print "<spec>"
```

Review each branch and merge them yourself. Clean up with
`git worktree remove ../royal-task-a`.

## When NOT to delegate

- One-line or few-line edits — handoff overhead exceeds the work.
- Money, reconciliation, or migrations. See the list at the top.
- Tasks where you have not yet read the code. Scope first, always.

## Environment notes

- Binary is `agy` (`~/.local/bin/agy`), currently 1.1.28. `agy models` lists model ids;
  `agy update` upgrades the CLI.
- Settings live at `~/.gemini/antigravity-cli/settings.json`. The alternative to the
  skip flag is a `permissions.allow` list there, using `action(target)` rules such as
  `read_file(.)`, `write_file(src/)`, `command(regex:npm run (build|lint))`. The user
  chose auto-approve instead; do not quietly switch them back.
- `--sandbox` adds terminal restrictions for a session. Not on by default — pass it
  through the wrapper if the user wants a run held back.
- `--add-dir <path>` is repeatable, for work spanning more than this repo.

## Reporting to the user

Say what Gemini changed, what **you** independently verified, and anything you rejected
or fixed afterward. Never relay Gemini's self-report as though it were a verified result.
