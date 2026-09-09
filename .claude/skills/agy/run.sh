#!/usr/bin/env bash
# Delegate a task to Google Antigravity CLI (Gemini). Usage: run.sh <output-file> <prompt> [extra agy args...]
# Continue the last conversation instead: run.sh --continue <output-file> <prompt>
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"

MODEL="gemini-3.8-flash-medium"   # medium thinking is encoded in the model id
EFFORT="medium"                   # ...and pinned again explicitly, so it survives a model swap
PRINT_TIMEOUT="30m"

CONTINUE=0
if [[ "${1:-}" == "--continue" ]]; then CONTINUE=1; shift; fi

OUT="${1:?usage: run.sh [--continue] <output-file> <prompt> [extra agy args...]}"; shift
PROMPT="${1:?missing prompt}"; shift

# --dangerously-skip-permissions is deliberate and was chosen by the user: headless
# print mode cannot prompt for tool permissions, so without it every read_file,
# write_file and command is auto-denied and the run returns nothing. It also means
# Gemini approves its own shell commands anywhere on this machine. Review the diff.
ARGS=(
  --model "$MODEL"
  --effort "$EFFORT"
  --print-timeout "$PRINT_TIMEOUT"
  --dangerously-skip-permissions
)
(( CONTINUE )) && ARGS+=(--continue)

cd "$REPO" || exit 1
mkdir -p "$(dirname "$OUT")"

agy "${ARGS[@]}" "$@" --print "$PROMPT" 2>&1 | tee "$OUT"
exit "${PIPESTATUS[0]}"
