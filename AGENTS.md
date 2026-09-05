# AGENTS.md

You are being invoked by **Codex CLI**, usually as a delegated sub-agent of Claude Code,
which is acting as the orchestrator on this repo. Claude will hand you a scoped spec,
then review your diff and run the build. Write code as if it will be code-reviewed —
because it will be.

## Read these first

- `CLAUDE.md` — full project context, domain concepts, conventions. **Authoritative.**
- `DESIGN.md` — visual spec. Do not introduce new colors or chart libraries.

Read them before your first edit. Everything below is a summary, not a replacement.

## Non-negotiable invariants

These cause real, silent data corruption if broken:

1. **Money is integer cents. Never floats.** `$40.00` is `4000`. Formatting happens at
   the UI layer only. `0.1 + 0.2 !== 0.3`.
2. **Reconciliation must be reversible.** Always store original reported values
   alongside adjusted values. Never overwrite the originals.
3. **Lifetime stats never reset.** Payouts are recorded as events; they do not touch
   the historical record.
4. **Don't trust frontend input.** Cash-out totals get validated server-side too.
5. **Schema changes go in `supabase/migrations/`** — never by hand in the dashboard.

## Conventions

- TypeScript strict mode. Functional components with hooks. One component per file,
  PascalCase, named the same as the file.
- Keep files under ~200 lines; split when they grow past it.
- Tailwind classes inline, co-located with the component.
- Tables/columns `snake_case`; TS variables `camelCase`.
- Boring, well-supported libraries only. No experimental dependencies.
- Do not add a dependency without saying so explicitly in your final message.

## How to report back

Your final message is read by Claude Code, not by a human scrolling a terminal. So:

- State **what you changed**, file by file.
- State **what you actually ran to verify it** (`npx tsc --noEmit`, `npm run build`)
  and paste the real result.
- **If a command fails or you could not run it, say so plainly. Never guess an answer
  or state an unverified result as fact.** Reporting "I could not verify this" is
  correct and useful. Fabricating a passing result is the worst outcome here.
- Flag anything you changed that was outside the spec you were given.
