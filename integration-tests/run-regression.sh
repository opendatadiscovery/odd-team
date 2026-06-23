#!/usr/bin/env bash
# run-regression.sh — the ONE recipe to run a stream's FULL e2e regression: ISOLATED, SERIALIZED, TORN-DOWN.
#
# The robust parallel-stream test foundation (adrs/drafts/parallel-stream-test-foundation.md):
#   - ISOLATION  builds + runs in the stream's namespace (own image tag / compose project / container names /
#                Postgres / ports) so it never collides with another stream. Point it at the stream's worktree
#                with ODD_PLATFORM_DIR=../odd-platform-<id>.
#   - SERIALIZATION  the WHOLE regression runs under a machine-wide flock (state/locks/heavy-e2e.lock), so only
#                ONE heavy regression runs at a time and gets the box to itself — fast + reliable. flock
#                auto-releases when this process exits (crash-safe; no stale locks). Cheap runs (the unit build,
#                a targeted API probe on an isolated stack) do NOT take the lock and parallelise freely.
#   - TEARDOWN   tears the stream's stack down (compose down -v) when done — no leftovers contending for hours.
#
# Usage:
#   integration-tests/run-regression.sh <stream-id> [suite ...]
#     <stream-id>   lowercase namespace, e.g. ctrib030 (default worktree ../odd-platform-<id>).
#     [suite ...]   suites to run; default the FULL set: feature-complete known-bugs multi-stack ingestion-e2e.
#   Overrides (pass INLINE — never `export`, settings.json denies it; see run-suite.sh):
#     ODD_PLATFORM_DIR=<path>            the stream's odd-platform worktree (default ../odd-platform-<id>)
#     ODD_API_PORT=<n> ODD_DB_PORT=<n>   pin host ports (default: a free pair auto-discovered ONCE, reused by all suites)
#     ODD_SUT=<working|ref:X|published[:v]>  what to build (default working = the worktree, uncommitted included)
#     LOCK_WAIT=<seconds>                max wait for the heavy-e2e lock (default 7200)
#     NO_TEARDOWN=1                      leave the stack up after the run (debugging)
set -uo pipefail   # deliberately NOT -e: a suite returning non-zero must NOT skip teardown / lock release

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/.." && pwd)"
ID="${1:-}"; [ -z "$ID" ] && { echo "usage: run-regression.sh <stream-id> [suite ...]"; exit 1; }
ID="$(printf '%s' "$ID" | tr '[:upper:]' '[:lower:]')"   # compose project names must be lowercase
shift || true
SUITES=("$@"); [ "${#SUITES[@]}" -eq 0 ] && SUITES=(feature-complete known-bugs multi-stack ingestion-e2e)
WT="${ODD_PLATFORM_DIR:-$(cd "$ROOT/../odd-platform-$ID" 2>/dev/null && pwd || true)}"
[ -n "$WT" ] && [ -e "$WT/.git" ] || { echo "ERROR: stream worktree not found at ../odd-platform-$ID (set ODD_PLATFORM_DIR)"; exit 1; }
COMPOSE="$ROOT/lineage/_extractor/probe-stacks/odd-minimal.docker-compose.yml"
LOCKDIR="$ROOT/state/locks"; LOCKFILE="$LOCKDIR/heavy-e2e.lock"; HOLDER="$LOCKDIR/heavy-e2e.holder"
TAG="odd-platform:odd-team-sut-$ID"
mkdir -p "$LOCKDIR"

find_free_port() {  # $1 = preferred start; prints the first free TCP port >= start
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
    sys.exit("no free port")
PY
}
# Start the stream-SUT port search ABOVE the per-spec e2e stacks' FIXED ports (the multi-stack/ingestion
# helpers hardcode DB 15432-15437 and API 18080-18090 — e.g. odd-notifications' webhook-stub binds :18090).
# Starting at 18100/15500 keeps the per-stream SUT clear of them, so a stream's own multi-stack run can't
# collide its SUT with a per-spec stack (the 2026-06-23 ctrib030 :18090 ↔ webhook-stub bind failure).
API_PORT="${ODD_API_PORT:-$(find_free_port 18100)}"
DB_PORT="${ODD_DB_PORT:-$(find_free_port 15500)}"

# --- teardown + lock-holder cleanup: ALWAYS runs (flock auto-drops when fd 9 closes on exit) ---
teardown() {
  if [ "${NO_TEARDOWN:-}" = "1" ]; then echo "  -> NO_TEARDOWN=1: leaving stack '$ID' up (compose project $ID)"; else
    echo "  -> teardown: docker compose -p $ID down -v"
    ODD_STREAM="$ID" ODD_API_PORT="$API_PORT" ODD_DB_PORT="$DB_PORT" docker compose -p "$ID" -f "$COMPOSE" down -v >/dev/null 2>&1 || true
  fi
  rm -f "$HOLDER" 2>/dev/null || true
}
trap teardown EXIT

# --- SERIALIZE: acquire the machine-wide heavy-e2e flock ---
exec 9>"$LOCKFILE"
if ! flock -n 9; then
  echo "  -> heavy-e2e lock currently held by: $(cat "$HOLDER" 2>/dev/null || echo '<unknown>'). Waiting up to ${LOCK_WAIT:-7200}s..."
  flock -w "${LOCK_WAIT:-7200}" 9 || { echo "  x could not acquire the heavy-e2e lock in time — aborting (NOT a test failure)."; exit 3; }
fi
printf '%s pid=%s since=%s\n' "$ID" "$$" "$(date -Is)" > "$HOLDER"
echo "============================================================================"
echo "  heavy-e2e lock ACQUIRED — stream '$ID' has the machine to itself ($(date +%H:%M:%S))"
echo "  namespace: image=$TAG  project=$ID  api=:$API_PORT  db=:$DB_PORT  worktree=$WT"
echo "============================================================================"

# --- ISOLATION: build the SUT ONCE from the stream's worktree ---
echo "=== build SUT $TAG ($(date +%H:%M:%S)) ==="
if ! sut_out="$(ODD_STREAM="$ID" ODD_PLATFORM_DIR="$WT" ODD_SUT_TAG="$TAG" "$HERE/build-sut.sh" 2>&1)"; then
  printf '%s\n' "$sut_out" | tail -20; echo "  x SUT build FAILED — aborting (NOT a test failure)."; exit 2
fi
printf '%s\n' "$sut_out" | grep -E '^SUT_(DESC|IMAGE|IMAGE_ID)='
SUT_IMG="$(printf '%s\n' "$sut_out" | sed -n 's/^SUT_IMAGE=//p')"

# --- run each suite isolated against that one image (same stack reused across suites: ports pinned) ---
declare -A OUTCOME
for suite in "${SUITES[@]}"; do
  echo "=== RUN $suite ($(date +%H:%M:%S)) ==="
  if ODD_STREAM="$ID" ODD_PLATFORM_DIR="$WT" ODD_API_PORT="$API_PORT" ODD_DB_PORT="$DB_PORT" ODD_PLATFORM_IMAGE="$SUT_IMG" "$HERE/run-suite.sh" "$suite"; then
    OUTCOME[$suite]="exit 0"
  else
    OUTCOME[$suite]="exit $? (read the run-log / log for actual pass-fail counts — exit code is not the verdict)"
  fi
done

echo "============================================================================"
echo "  regression complete for stream '$ID' ($(date +%H:%M:%S)) — teardown + lock release follow"
day="$(date +%Y-%m-%d)"
for suite in "${SUITES[@]}"; do echo "  $suite: ${OUTCOME[$suite]}  → integration-tests/run-log/${day}-${suite}.md"; done
echo "============================================================================"
# teardown + flock release run in the EXIT trap.
