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
#   ODD_STREAM=<id> integration-tests/run-suite.sh <suite>   # ISOLATED env: own image tag + compose project +
#       container names + a FREE host port pair — parallel-safe across /contribute + /review (no shared stack).
#       Pin ports with ODD_API_PORT/ODD_DB_PORT; build the SUT from your worktree with ODD_PLATFORM_DIR=<path>.
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

# Docker Compose CLI: prefer the v2 plugin ('docker compose'). The legacy v1 python binary
# crashes with KeyError: 'ContainerConfig' when RECREATING a container against modern Docker
# engines (the image-inspect key v1 reads was removed) — fatal for any 'up -d' over a running
# stack whose image drifted (exactly the SUT-changed path). Fallback to v1 warns loudly.
if docker compose version >/dev/null 2>&1; then
  COMPOSE_CMD=(docker compose)
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE_CMD=(docker-compose)
  echo "WARNING: Compose v2 plugin not found — using legacy docker-compose v1, which crashes on container recreate (ContainerConfig) against modern Docker engines." >&2
else
  COMPOSE_CMD=()
fi

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

# --- System Under Test: materialise ONCE for the WHOLE run (LSN-033). BOTH rails (api-probe + ui-e2e)
#     bring up the SAME odd-minimal compose, so they MUST test the same image. build-sut.sh re-materialises
#     odd-platform:odd-team-sut from $ODD_SUT (working|main|ref:X|published[:v]); an explicit
#     $ODD_PLATFORM_IMAGE bypasses it. Skipped for manual-only / dry runs (no stack needed).
# --- Per-session isolation (parallel /contribute + /review streams) ----------------------------------------
# Default (ODD_STREAM unset) = the single shared persistent stack (probe-* on 18080/15432, tag odd-team-sut) —
# today's behaviour, byte-identical. ODD_STREAM=<id> gives a FULLY ISOLATED environment: its own SUT image tag
# (odd-platform:odd-team-sut-<id>), its own compose project + container names (<id>-odd-platform / <id>-database),
# its own FREE host port pair (auto-discovered; pin with ODD_API_PORT/ODD_DB_PORT), and its own base URL — so two
# sessions never share an image, port, container, or network. Both rails inherit it: Playwright via ODD_BASE_URL,
# the api-probe runner via ODD_BASE_URL / ODD_*_CONTAINER. (adrs/drafts/parallel-contribution-infra.md §4-5;
# state/active-streams.yaml is the cross-stream id/port ledger the /contribute + /review skills read + register.)
find_free_port() {  # $1 = preferred start port; prints the first free TCP port >= start (best-effort; tiny race)
  python3 - "$1" <<'PY'
import socket, sys
start = int(sys.argv[1])
for p in range(start, start + 500):
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        s.bind(("127.0.0.1", p)); s.close(); print(p); break
    except OSError:
        s.close()
else:
    sys.exit(f"no free TCP port in [{start}, {start + 500})")
PY
}
STREAM="$(printf '%s' "${ODD_STREAM:-}" | tr '[:upper:]' '[:lower:]')"   # Docker Compose project names must be lowercase
if [ -n "$STREAM" ]; then
  [ "$STREAM" != "${ODD_STREAM:-}" ] && echo "  -> note: ODD_STREAM lowercased to '$STREAM' (Docker Compose project names must be lowercase)."
  export ODD_STREAM="$STREAM"
  export COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-$STREAM}"
  export ODD_SUT_TAG="${ODD_SUT_TAG:-odd-platform:odd-team-sut-$STREAM}"
  export ODD_API_PORT="${ODD_API_PORT:-$(find_free_port 18090)}"
  export ODD_DB_PORT="${ODD_DB_PORT:-$(find_free_port 15442)}"
  export ODD_BASE_URL="${ODD_BASE_URL:-http://127.0.0.1:$ODD_API_PORT}"
  export ODD_BACKEND_CONTAINER="$STREAM-odd-platform"
  export ODD_DB_CONTAINER="$STREAM-database"
  HEALTH_BASE="$ODD_BASE_URL"; BACKEND_CONTAINER="$ODD_BACKEND_CONTAINER"
  echo "  -> ISOLATED stream '$STREAM': image=$ODD_SUT_TAG  project=$COMPOSE_PROJECT_NAME  api=:$ODD_API_PORT  db=:$ODD_DB_PORT  base=$ODD_BASE_URL"
else
  HEALTH_BASE="http://127.0.0.1:18080"; BACKEND_CONTAINER="probe-odd-platform"
fi

sut_ok=1; sut_desc=""; sut_id=""
if { [ "${#PROBES[@]}" -gt 0 ] || [ "${#E2E[@]}" -gt 0 ]; } && [ -z "$dry" ]; then
  if [ -z "${ODD_PLATFORM_IMAGE:-}" ]; then
    if sut_out="$("$HERE/build-sut.sh")"; then
      sut_desc="$(printf '%s\n' "$sut_out" | sed -n 's/^SUT_DESC=//p')"
      sut_id="$(printf '%s\n' "$sut_out" | sed -n 's/^SUT_IMAGE_ID=//p')"
      # Use the tag build-sut.sh actually built (it honours ODD_SUT_TAG → the per-stream tag), not a hardcoded
      # shared tag — otherwise an isolated stream would point its stack at the wrong (shared) image.
      sut_img="$(printf '%s\n' "$sut_out" | sed -n 's/^SUT_IMAGE=//p')"
      export ODD_PLATFORM_IMAGE="${sut_img:-${ODD_SUT_TAG:-odd-platform:odd-team-sut}}"
    else
      echo "  x SUT build failed -- aborting the run (not a test failure)."; sut_ok=0
    fi
  else
    sut_desc="explicit raw image (build-sut bypassed): $ODD_PLATFORM_IMAGE"
    sut_id="$(docker images --no-trunc -q "$ODD_PLATFORM_IMAGE" 2>/dev/null | head -1)"
  fi
  if [ "$sut_ok" = 1 ]; then
    echo "  ===================================================================="
    echo "  SYSTEM UNDER TEST (BOTH the api-probe and ui-e2e rails run against this):"
    echo "    source: ${sut_desc:-unknown}"
    echo "    image : ${ODD_PLATFORM_IMAGE}"
    echo "    digest: ${sut_id:-<unknown>}"
    echo "  ===================================================================="
  fi
fi

# --- API-probe rail (probe-runtime) — runs against the SUT above (inherits the exported $ODD_PLATFORM_IMAGE) ---
# Probes run LIVE here, so the result is fresh regardless of when the probe was last blessed. Probe-STALENESS is
# an ONTOLOGY-freshness concern (enforced by /probe-run), NOT a system-regression failure — wiring it into this
# gate as a FATAL silently killed the api rail for weeks and trained everyone to ignore `api:FAIL` (2026-06-19,
# the IT-124 lesson). So pass --allow-stale: staleness becomes a visible warning, while a probe that actually
# MISBEHAVES still fails the rail (api:FAIL is then a REAL signal). Re-bless stale probes via /probe-run, not here.
api_outcome="n/a"
if [ "${#PROBES[@]}" -gt 0 ] && [ "$sut_ok" = 1 ]; then
  batch=""; [ "${#PROBES[@]}" -gt 1 ] && batch="--batch"
  echo "+ (cd $RUNTIME && uv run python probe-runtime/runner.py ${PROBES[*]} --allow-stale $batch $dry)"
  if ( cd "$RUNTIME" && uv run python probe-runtime/runner.py "${PROBES[@]}" --allow-stale $batch $dry ); then api_outcome="PASS"; else api_outcome="FAIL"; fi
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
if [ "${#E2E[@]}" -gt 0 ] && [ "$sut_ok" = 1 ]; then
  if [ -n "$dry" ]; then
    echo "+ (cd $HERE/e2e && ODD_STACK_EXTERNAL=1 npx playwright test ${E2E[*]})   [dry-run]"
    e2e_outcome="DRY-RUN-OK"
  elif ! command -v npx >/dev/null 2>&1; then
    echo "  → SKIP ui-e2e: Node/npx not found. One-time: (cd integration-tests/e2e && npm install && npm run browser)"
    e2e_outcome="SKIPPED(no-node)"
  elif [ ! -d "$HERE/e2e/node_modules" ]; then
    echo "  → SKIP ui-e2e: deps not installed. One-time: (cd integration-tests/e2e && npm install && npm run browser)"
    e2e_outcome="SKIPPED(no-deps)"
  elif [ ${#COMPOSE_CMD[@]} -eq 0 ]; then
    echo "  → SKIP ui-e2e: no Docker Compose CLI found (need the v2 plugin 'docker compose', or legacy 'docker-compose')."
    e2e_outcome="SKIPPED(no-compose)"
  else
    # The SUT image (printed once at the top) is already exported as $ODD_PLATFORM_IMAGE and built. Recreate
    # the persistent stack only if it is not already running that exact image (digest), then confirm before testing.
    COMPOSE="$ROOT/lineage/_extractor/probe-stacks/odd-minimal.docker-compose.yml"
    HEALTH="$HEALTH_BASE/actuator/health"
    running_id="$(docker inspect -f '{{.Image}}' "$BACKEND_CONTAINER" 2>/dev/null || true)"
    [ -n "$sut_id" ] && [ "$sut_id" != "$running_id" ] && { echo "  -> e2e: running stack image != SUT -> recreating with the SUT image"; ODD_E2E_FRESH=1; }
    [ "${ODD_E2E_FRESH:-}" = "1" ] && { echo "  -> --fresh: recreating odd-minimal..."; "${COMPOSE_CMD[@]}" -f "$COMPOSE" down -v >/dev/null 2>&1 || true; }
    if curl -fsS --max-time 5 "$HEALTH" 2>/dev/null | grep -q UP; then
      echo "  -> odd-minimal already healthy -- reusing it (persistent)."
    else
      echo "  -> bringing up odd-minimal (persistent; reused by later runs)..."
      "${COMPOSE_CMD[@]}" -f "$COMPOSE" up -d
      curl -fsS --retry 40 --retry-delay 3 --retry-all-errors --retry-connrefused --max-time 5 "$HEALTH" >/dev/null 2>&1 \
        || { echo "  x odd-minimal did not become healthy at $HEALTH within ~120s -- aborting e2e (not a test failure)."; e2e_outcome="FAIL(stack-unhealthy)"; }
    fi
    if [ "$e2e_outcome" != "FAIL(stack-unhealthy)" ]; then
      run_now="$(docker inspect -f '{{.Image}}' "$BACKEND_CONTAINER" 2>/dev/null || true)"
      if [ -n "$sut_id" ] && [ "$run_now" = "$sut_id" ]; then echo "  -> confirmed: the e2e stack is running the SUT image."
      else echo "  -> WARNING: the e2e stack is running image $run_now, which does NOT match the SUT digest $sut_id."; fi
      echo "+ (cd $HERE/e2e && ODD_STACK_EXTERNAL=1 npx playwright test ${E2E[*]})"
      if ( cd "$HERE/e2e" && ODD_STACK_EXTERNAL=1 npx playwright test "${E2E[@]}" ); then e2e_outcome="PASS"; else e2e_outcome="FAIL"; fi
    fi
  fi
fi

# --- combined verdict ---
parts=()
[ "$sut_ok" = 0 ] && parts+=("SUT-BUILD-FAILED")
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
