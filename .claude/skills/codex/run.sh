#!/usr/bin/env bash
# Delegate a task to Codex CLI. Usage: run.sh <output-file> <prompt> [extra codex args...]
# Resume instead: run.sh --resume <output-file> <prompt>
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"

MODEL="gpt-5.6-sol"
EFFORT="high"
SANDBOX="workspace-write"

RESUME=0
if [[ "${1:-}" == "--resume" ]]; then RESUME=1; shift; fi

OUT="${1:?usage: run.sh [--resume] <output-file> <prompt> [extra args...]}"; shift
PROMPT="${1:?missing prompt}"; shift

COMMON=(-m "$MODEL" -c "model_reasoning_effort=\"$EFFORT\"" -o "$OUT")

# `codex exec resume` accepts neither --cd nor -s, so cd into the repo instead
# and let the resumed session keep its original sandbox.
cd "$REPO" || exit 1

if (( RESUME )); then
  exec codex exec resume --last "${COMMON[@]}" "$@" "$PROMPT"
else
  exec codex exec --cd "$REPO" -s "$SANDBOX" "${COMMON[@]}" "$@" "$PROMPT"
fi
