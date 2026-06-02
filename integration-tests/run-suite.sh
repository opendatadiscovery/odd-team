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

# For each protocol: locate its doc + read the automation probe from frontmatter.
PROBES=(); MANUAL=()
for it in "${PROTO_IDS[@]}"; do
  f=$(ls "$PROTODIR/$it"-*.md 2>/dev/null | head -1 || true)
  if [ -z "$f" ]; then echo "WARN: protocol $it has no doc in protocols/ — skipping"; continue; fi
  probe=$(python3 - "$f" <<'PY'
import sys, re
t = open(sys.argv[1]).read()
m = re.search(r'^automation:\s*"?([^"\n]+)"?', t, re.M)
v = (m.group(1).strip() if m else '')
print('' if v.lower() in ('', 'manual', 'none') else v)
PY
)
  if [ -n "$probe" ]; then PROBES+=("$probe"); else MANUAL+=("$it"); fi
done

echo "suite/protocol: $arg"
echo "  protocols : ${PROTO_IDS[*]}"
echo "  automated : ${PROBES[*]:-none}"
echo "  manual    : ${MANUAL[*]:-none}"
for m in "${MANUAL[@]:-}"; do [ -n "$m" ] && echo "  → MANUAL $m: open protocols/$m-*.md and execute sections 2-5 by hand, then log to run-log/."; done

outcome="n/a"
if [ "${#PROBES[@]}" -gt 0 ]; then
  batch=""; [ "${#PROBES[@]}" -gt 1 ] && batch="--batch"
  echo "+ (cd $RUNTIME && uv run python probe-runtime/runner.py ${PROBES[*]} $batch $dry)"
  if ( cd "$RUNTIME" && uv run python probe-runtime/runner.py "${PROBES[@]}" $batch $dry ); then outcome="PASS"; else outcome="FAIL"; fi
fi

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
  echo "- automation probes: ${PROBES[*]:-none}; manual: ${MANUAL[*]:-none}"
  echo "- outcome: ${outcome}"
  echo "- machine traces: lineage/odd-platform/probe-runs/ (per automated probe)"
  echo "- evidence/notes: <captured values from the probe-run yaml; or the manual observation>"
  echo ""
} >> "$log"
echo "logged → ${log#$ROOT/}  (outcome: $outcome)"
