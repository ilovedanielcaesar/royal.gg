---
name: codex
description: Delegate a coding task to OpenAI Codex CLI (ChatGPT) while Claude Code orchestrates - decompose the task, write the spec, then review the diff and verify the build. Use when the user types /codex, asks to hand work to ChatGPT/Codex/GPT, or asks for multi-agent delegation of implementation work.
---

# Delegating to Codex

You are the **orchestrator**. Codex is the implementer. You keep responsibility for
correctness — a delegated task is not done until you have reviewed the diff yourself.

## The loop

### 1. Scope it yourself first
Read the relevant files **before** delegating. A vague spec produces a bad diff and
costs more than doing the work yourself. You should know which files ought to change.

### 2. Write the spec
Include: the goal, the exact files in scope, the invariants that apply (money as
integer cents, reconciliation reversibility), and how Codex should verify its work.
Be explicit about what is *out* of scope — Codex will happily refactor things you
never asked about.

### 3. Hand it off

```bash
.claude/skills/codex/run.sh "$SCRATCH/codex-last.md" "<spec>"
```

The wrapper pins the settings the user requested — **model `gpt-5.6-terra`, reasoning
effort `high`, sandbox `workspace-write`** — so they are never forgotten. Do not call
`codex exec` directly unless you deliberately need different settings.

- `workspace-write` lets Codex read anywhere and write only inside the repo, with no
  network. It can still run `tsc` and `npm run build` to verify its own work.
- Wrap in `timeout 900` and raise the Bash tool timeout; real tasks are slow.
- Read the output file for the final message rather than scraping terminal noise.

### 4. Review before believing anything

**Codex has been observed fabricating results when its shell commands fail.** Never
take its final message at face value. Always:

```bash
git diff --stat && git diff
npx tsc --noEmit
```

Read the actual diff. Confirm the `AGENTS.md` invariants really hold — especially
integer-cents money handling, and that no original reconciliation values were
overwritten.

### 5. Iterate in-thread

```bash
.claude/skills/codex/run.sh --resume "$SCRATCH/codex-last.md" "<follow-up>"
```

Resuming keeps Codex's context, so corrections are far cheaper than a fresh run.

## Running several at once

Only for genuinely independent tasks. Give each its own git worktree so they cannot
collide on the same files:

```bash
git worktree add ../royal-task-a -b task-a
codex exec --cd ../royal-task-a -s workspace-write -m gpt-5.6-terra \
  -c model_reasoning_effort="high" -o a.md "<spec>"
```

Review each branch and merge them yourself. Clean up with
`git worktree remove ../royal-task-a`.

## When NOT to delegate

- One-line or few-line edits — handoff overhead exceeds the work.
- Anything touching reconciliation math or money representation. Do that yourself;
  the failure mode is silent and corrupts real data.
- Tasks where you have not yet read the code. Scope first, always.

## Environment notes

Codex's sandbox needs unprivileged user namespaces. On this machine that required
installing `bubblewrap` **and** adding `/etc/apparmor.d/bwrap` (granting `userns` to
`/usr/bin/bwrap`), because Ubuntu 24.04 sets
`kernel.apparmor_restrict_unprivileged_userns=1`. If Codex ever reports
`bwrap: loopback: Failed RTM_NEWADDR`, that profile was unloaded — reload it with
`sudo apparmor_parser -r /etc/apparmor.d/bwrap`.

## Reporting to the user

Say what Codex changed, what **you** independently verified, and anything you rejected
or fixed afterward. Never relay Codex's self-report as though it were a verified result.
