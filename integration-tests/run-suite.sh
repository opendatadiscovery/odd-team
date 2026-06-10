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

# --- UI-e2e rail (Playwright; integration-tests/e2e) ---
# PERSISTENT SHARED STACK (do NOT churn up/down per run). We bring odd-minimal up ONCE if it is not
# already healthy, then run playwright with ODD_STACK_EXTERNAL=1 so its global-setup/teardown neither
# re-create nor `down -v` the stack. Rationale (2026-06-08 e2e:FAIL — "3 passed then mass ECONNREFUSED"):
# the old per-run `up` + `down -v` churn races the shared FIXED-project stack — a concurrent run, a
# still-settling prior teardown, or a second invocation tears `probe-stacks` down MID-RUN, so every later
# spec hits ECONNREFUSED. A persistent reused stack removes that race AND is far faster. IPv4 (127.0.0.1)
# health URL avoids any ::1/localhost resolution ambiguity. Stack is LEFT UP; stop it with
# `(cd integration-tests/e2e && npm run stack:down)` when finished. `--fresh` forces a clean recreate.
e2e_outcome="n/a"
if [ "${#E2E[@]}" -gt 0 ]; then
  if [ -n "$dry" ]; then
    echo "+ (cd $HERE/e2e && ODD_STACK_EXTERNAL=1 npx playwright test ${E2E[*]})   [dry-run]"
    e2e_outcome="DRY-RUN-OK"
  elif ! command -v npx >/dev/null 2>&1; then
    echo "  → SKIP ui-e2e: Node/npx not found. One-time: (cd integration-tests/e2e && npm install && npm run browser)"
    e2e_outcome="SKIPPED(no-node)"
  elif [ ! -d "$HERE/e2e/node_modules" ]; then
    echo "  → SKIP ui-e2e: deps not installed. One-time: (cd integration-tests/e2e && npm install && npm run browser)"
    e2e_outcome="SKIPPED(no-deps)"
  else
    # --- SUT materialisation: the artifact under test is a RUN-TIME parameter (default = working tree). LSN-033.
    #     build-sut.sh re-materialises odd-platform:odd-team-sut from $ODD_SUT (working|main|ref:X|published[:v])
    #     on EVERY run, so regression is measured against the subject you chose — never a frozen image. Tests +
    #     compose stay SUT-agnostic. An explicit $ODD_PLATFORM_IMAGE (raw image ref) bypasses this.
    sut_ok=1; sut_desc=""; sut_id=""
    if [ -z "${ODD_PLATFORM_IMAGE:-}" ]; then
      if sut_out="$("$HERE/build-sut.sh")"; then
        sut_desc="$(printf '%s\n' "$sut_out" | sed -n 's/^SUT_DESC=//p')"
        sut_id="$(printf '%s\n' "$sut_out" | sed -n 's/^SUT_IMAGE_ID=//p')"
        export ODD_PLATFORM_IMAGE="odd-platform:odd-team-sut"
      else
        echo "  x SUT build failed -- aborting e2e (not a test failure)."; e2e_outcome="FAIL(sut-build)"; sut_ok=0
      fi
    else
      sut_desc="explicit raw image (build-sut bypassed): $ODD_PLATFORM_IMAGE"
      sut_id="$(docker images --no-trunc -q "$ODD_PLATFORM_IMAGE" 2>/dev/null | head -1)"
    fi
    if [ "$sut_ok" = 1 ]; then
    COMPOSE="$ROOT/lineage/_extractor/probe-stacks/odd-minimal.docker-compose.yml"
    HEALTH="http://127.0.0.1:18080/actuator/health"
    # Make the artifact under test UNMISSABLE (LSN-033): source kind (built vs pulled), image, digest.
    echo "  ===================================================================="
    echo "  SYSTEM UNDER TEST (what the e2e rail runs against):"
    echo "    source: ${sut_desc:-unknown}"
    echo "    image : ${ODD_PLATFORM_IMAGE}"
    echo "    digest: ${sut_id:-<unknown>}"
    echo "  ===================================================================="
    running_id="$(docker inspect -f '{{.Image}}' probe-odd-platform 2>/dev/null || true)"
    [ -n "$sut_id" ] && [ "$sut_id" != "$running_id" ] && { echo "  -> SUT differs from the running stack -> recreating it with this image"; ODD_E2E_FRESH=1; }
    [ "${ODD_E2E_FRESH:-}" = "1" ] && { echo "  -> --fresh: recreating odd-minimal..."; docker-compose -f "$COMPOSE" down -v >/dev/null 2>&1 || true; }
    if curl -fsS --max-time 5 "$HEALTH" 2>/dev/null | grep -q UP; then
      echo "  → odd-minimal already healthy — reusing it (persistent)."
    else
      echo "  → bringing up odd-minimal (persistent; reused by later runs)…"
      docker-compose -f "$COMPOSE" up -d
      curl -fsS --retry 40 --retry-delay 3 --retry-all-errors --retry-connrefused --max-time 5 "$HEALTH" >/dev/null 2>&1 \
        || { echo "  ✗ odd-minimal did not become healthy at $HEALTH within ~120s — aborting e2e (not a test failure)."; e2e_outcome="FAIL(stack-unhealthy)"; }
    fi
    if [ "$e2e_outcome" != "FAIL(stack-unhealthy)" ]; then
      run_now="$(docker inspect -f '{{.Image}}' probe-odd-platform 2>/dev/null || true)"
      if [ -n "$sut_id" ] && [ "$run_now" = "$sut_id" ]; then echo "  -> confirmed: the stack is running the SUT image shown above."
      else echo "  -> WARNING: the stack is running image $run_now, which does NOT match the SUT digest $sut_id."; fi
      echo "+ (cd $HERE/e2e && ODD_STACK_EXTERNAL=1 npx playwright test ${E2E[*]})"
      if ( cd "$HERE/e2e" && ODD_STACK_EXTERNAL=1 npx playwright test "${E2E[@]}" ); then e2e_outcome="PASS"; else e2e_outcome="FAIL"; fi
    fi
    fi
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
  echo "- odd-platform working-tree HEAD: ${stack_sha} (the SUT only when ODD_SUT=working)"
  [ -n "${sut_desc:-}" ] && echo "- e2e SUT: ${sut_desc}  (image ${ODD_PLATFORM_IMAGE:-?}, digest ${sut_id:-?})"
  echo "- protocols: ${PROTO_IDS[*]}"
  echo "- api probes: ${PROBES[*]:-none}; ui e2e: ${E2E[*]:-none}; manual: ${MANUAL[*]:-none}"
  echo "- outcome: ${outcome}"
  echo "- machine traces: lineage/odd-platform/probe-runs/ (api) · integration-tests/e2e/test-results/ (e2e, on failure)"
  echo "- evidence/notes: <captured values from the probe-run yaml / Playwright report; or the manual observation>"
  echo ""
} >> "$log"
echo "logged → ${log#$ROOT/}  (outcome: $outcome)"
