#!/usr/bin/env bash
# Run a local integration-test suite (or one protocol): resolve protocols → their
# automation probes → run via the probe runtime → append a run-log entry.
# Protocol docs (protocols/IT-NNN-*.md) are the source of truth; the probe is the
# automation rail. Local-only; portable (no hardcoded paths). Requires: Docker
# running, uv, the odd-platform image cached.
#
# Usage:
#   integration-tests/run-suite.sh --list
#   integration-tests/run-suite.sh <suite-name>      # e.g. smoke | feature-complete | I2-attachment-storage
#   integration-tests/run-suite.sh IT-NNN            # a single protocol
#   integration-tests/run-suite.sh <...> --dry-run   # validate + show what would run, no stack
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"   # integration-tests/
ROOT="$(cd "$HERE/.." && pwd)"                          # odd-team workspace root
RUNTIME="$ROOT/lineage/_extractor"
PROTODIR="$HERE/protocols"
SUITES="$HERE/suites.yaml"
LOGDIR="$HERE/run-log"

# Auto-detect a user-space Node (mirrors run-platform-tests.sh's JDK detection) so the
# UI-e2e rail works after a `~/.local/node` install without a manual PATH export.
for _nb in "$HOME/.local/node/bin" "$HOME"/.local/node-*/bin; do
  [ -x "$_nb/node" ] && case ":$PATH:" in *":$_nb:"*) ;; *) PATH="$_nb:$PATH"; export PATH ;; esac
done

arg="${1:-}"; dry=""
[ "${2:-}" = "--dry-run" ] && dry="--dry-run"
[ -z "$arg" ] && { echo "usage: run-suite.sh <suite> | IT-NNN | --list [--dry-run]"; exit 1; }

if [ "$arg" = "--list" ]; then
  python3 - "$SUITES" <<'PY'
import sys, yaml
s = (yaml.safe_load(open(sys.argv[1])) or {}).get('suites', {})
for name, v in s.items():
    ps = v.get('protocols') or []
    print(f"{name:24} {v.get('description','')}")
    print(f"{'':24} protocols: {', '.join(ps) if ps else '(none yet)'}")
PY
  exit 0
fi

# Resolve the protocol id list: a suite name → its protocols, or a single IT-NNN.
mapfile -t PROTO_IDS < <(python3 - "$SUITES" "$arg" <<'PY'
import sys, yaml
suites = (yaml.safe_load(open(sys.argv[1])) or {}).get('suites', {})
arg = sys.argv[2]
if arg in suites:
    for p in (suites[arg].get('protocols') or []):
        print(p)
elif arg.startswith('IT-'):
    print(arg)
PY
)
[ "${#PROTO_IDS[@]}" -eq 0 ] && { echo "no protocols for '$arg' (try --list)"; exit 1; }

# For each protocol: locate its doc + read its automation rail from frontmatter.
# Rails: P-NNN (API probe → probe-runtime) | e2e:<spec> (UI Playwright → e2e/) | manual.
PROBES=(); E2E=(); MANUAL=()
for it in "${PROTO_IDS[@]}"; do
  f=$(ls "$PROTODIR/$it"-*.md 2>/dev/null | head -1 || true)
  if [ -z "$f" ]; then echo "WARN: protocol $it has no doc in protocols/ — skipping"; continue; fi
  autom=$(python3 - "$f" <<'PY'
import sys, re
t = open(sys.argv[1]).read()
m = re.search(r'^automation:\s*"?([^"\n]+)"?', t, re.M)
print((m.group(1).strip() if m else ''))
PY
)
  low=$(printf '%s' "$autom" | tr '[:upper:]' '[:lower:]')
  case "$low" in
    ''|manual|none) MANUAL+=("$it") ;;
    e2e:*)          E2E+=("${autom#[eE]2[eE]:}") ;;
    *)              PROBES+=("$autom") ;;
  esac
done

echo "suite/protocol: $arg"
echo "  protocols : ${PROTO_IDS[*]}"
echo "  api probes: ${PROBES[*]:-none}"
echo "  ui e2e    : ${E2E[*]:-none}"
echo "  manual    : ${MANUAL[*]:-none}"
for m in "${MANUAL[@]:-}"; do [ -n "$m" ] && echo "  → MANUAL $m: open protocols/$m-*.md and execute sections 2-5 by hand, then log to run-log/."; done

# --- API-probe rail (probe-runtime) ---
api_outcome="n/a"
if [ "${#PROBES[@]}" -gt 0 ]; then
  batch=""; [ "${#PROBES[@]}" -gt 1 ] && batch="--batch"
  echo "+ (cd $RUNTIME && uv run python probe-runtime/runner.py ${PROBES[*]} $batch $dry)"
  if ( cd "$RUNTIME" && uv run python probe-runtime/runner.py "${PROBES[@]}" $batch $dry ); then api_outcome="PASS"; else api_outcome="FAIL"; fi
fi

# --- UI-e2e rail (Playwright; integration-tests/e2e — self-contained, brings its own stack) ---
e2e_outcome="n/a"
if [ "${#E2E[@]}" -gt 0 ]; then
  if [ -n "$dry" ]; then
    echo "+ (cd $HERE/e2e && npx playwright test ${E2E[*]})   [dry-run]"
    e2e_outcome="DRY-RUN-OK"
  elif ! command -v npx >/dev/null 2>&1; then
    echo "  → SKIP ui-e2e: Node/npx not found. One-time: (cd integration-tests/e2e && npm install && npm run browser)"
    e2e_outcome="SKIPPED(no-node)"
  elif [ ! -d "$HERE/e2e/node_modules" ]; then
    echo "  → SKIP ui-e2e: deps not installed. One-time: (cd integration-tests/e2e && npm install && npm run browser)"
    e2e_outcome="SKIPPED(no-deps)"
  else
    echo "+ (cd $HERE/e2e && npx playwright test ${E2E[*]})"
    if ( cd "$HERE/e2e" && npx playwright test "${E2E[@]}" ); then e2e_outcome="PASS"; else e2e_outcome="FAIL"; fi
  fi
fi

# --- combined verdict ---
parts=()
[ "$api_outcome" != "n/a" ] && parts+=("api:$api_outcome")
[ "$e2e_outcome" != "n/a" ] && parts+=("e2e:$e2e_outcome")
[ "${#MANUAL[@]}" -gt 0 ] && parts+=("manual:${#MANUAL[@]}-pending")
outcome="${parts[*]:-n/a}"

[ -n "$dry" ] && { echo "dry-run: no run-log entry written."; exit 0; }

# Append the human-readable, suite-level run-log entry (the reproducible record).
mkdir -p "$LOGDIR"
day=$(date +%Y-%m-%d)
stack_sha=$(git -C "$ROOT/../odd-platform" rev-parse --short HEAD 2>/dev/null || echo unknown)
log="$LOGDIR/${day}-${arg}.md"
{
  echo "## ${day} — suite/protocol: ${arg}"
  echo "- runner: (fill: AI-assisted <model> | human <name>)"
  echo "- stack_commit (odd-platform): ${stack_sha}"
  echo "- protocols: ${PROTO_IDS[*]}"
  echo "- api probes: ${PROBES[*]:-none}; ui e2e: ${E2E[*]:-none}; manual: ${MANUAL[*]:-none}"
  echo "- outcome: ${outcome}"
  echo "- machine traces: lineage/odd-platform/probe-runs/ (api) · integration-tests/e2e/test-results/ (e2e, on failure)"
  echo "- evidence/notes: <captured values from the probe-run yaml / Playwright report; or the manual observation>"
  echo ""
} >> "$log"
echo "logged → ${log#$ROOT/}  (outcome: $outcome)"
