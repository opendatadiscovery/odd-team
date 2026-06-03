#!/usr/bin/env bash
# Run odd-platform's CI gate locally — the pre-push gate a maintainer (or the
# /loop) runs before pushing to the public repo.
#
# Replicates the GitHub gate faithfully: .github/workflows/run-pr-tests.yaml's
# run_tests job runs `./gradlew odd-platform-api:build -PbundleUI=false`, and
# `build` runs the WHOLE `check` lifecycle — `test` + `checkstyleMain` +
# `checkstyleTest` (+ any future quality task) — then `assemble`. So a no-arg run
# runs that SAME lifecycle task (not a hand-picked subset), and even a fast
# targeted run includes BOTH checkstyle tasks. Either way a Checkstyle violation
# (e.g. a test line >120 chars) REDs the gate here exactly as it REDs CI — even
# though every test passes (Checkstyle emits no JUnit XML, which is why a green
# test run can still fail the build). Running only `:odd-platform-api:test` (the
# old behaviour) was blind to that whole class — see the 2026-06-03 PR #1743.
#
# Prepares + checks the local toolchain (a JDK 17 + a running Docker), then runs
# gradle. Portable by design: auto-detects a user-space JDK 17 and the sibling
# odd-platform repo, with NO absolute paths baked in (CLAUDE.md Rule 5).
#
# Usage:
#   scripts/run-platform-tests.sh --check                    # verify toolchain only (no build)
#   scripts/run-platform-tests.sh                            # FULL CI replica: build = test + checkstyle + assemble
#   scripts/run-platform-tests.sh --tests "*RegressionPin*"  # fast: filtered tests + FULL checkstyle (no assemble)
#   scripts/run-platform-tests.sh --tests "*ServiceTest"     # e.g. the service-layer unit tests + checkstyle
#
# Deviations from CI (deliberate): drops `--scan` (build-scan telemetry to
# gradle.com, not build logic); `--tests` mode runs `test + checkstyleMain +
# checkstyleTest` instead of the full `build` (skips `assemble` for a fast inner
# loop — `assemble` is still covered by a no-arg run before push).
#
# Overrides: ODD_PLATFORM_DIR=<path>  JAVA_HOME_17=<jdk17 path>
set -euo pipefail

WORKSPACE_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PLATFORM_DIR="${ODD_PLATFORM_DIR:-$(cd "$WORKSPACE_ROOT/../odd-platform" 2>/dev/null && pwd || true)}"

die() { echo "ERROR: $*" >&2; exit 1; }

# --- JDK 17 (odd-platform requires Temurin 17: CI java-version 17, Jib base
#     eclipse-temurin:17-jdk). Prefer an explicit override, else a user-space
#     ~/.local/jdks install, else a system JVM. ---
find_jdk17() {
  if [ -n "${JAVA_HOME_17:-}" ] && [ -x "${JAVA_HOME_17}/bin/javac" ]; then echo "$JAVA_HOME_17"; return; fi
  for d in "$HOME"/.local/jdks/jdk-17* /usr/lib/jvm/*temurin-17* /usr/lib/jvm/*17-openjdk* /usr/lib/jvm/java-17-* ; do
    [ -x "$d/bin/javac" ] && { echo "$d"; return; }
  done
}
JDK17="$(find_jdk17 || true)"
if [ -z "$JDK17" ]; then
  cat >&2 <<'MSG'
JDK 17 not found. Install it user-space (no sudo required):
  mkdir -p ~/.local/jdks && cd ~/.local/jdks \
    && curl -fsSL -o t.tgz "https://api.adoptium.net/v3/binary/latest/17/ga/linux/x64/jdk/hotspot/normal/eclipse" \
    && tar xzf t.tgz && rm t.tgz
Then re-run this script (it auto-detects ~/.local/jdks/jdk-17*).
MSG
  exit 1
fi
export JAVA_HOME="$JDK17"
echo "JDK 17       : $JAVA_HOME"
echo "             $("$JAVA_HOME/bin/java" -version 2>&1 | head -1)"

# --- Docker (Testcontainers-backed integration tests need a running daemon) ---
if docker info >/dev/null 2>&1; then
  echo "Docker       : $(docker version --format '{{.Server.Version}}' 2>/dev/null) (running) — integration tests OK"
else
  echo "Docker       : NOT running — Testcontainers integration tests WILL FAIL (unit tests still run)" >&2
fi

[ -d "$PLATFORM_DIR" ] || die "odd-platform repo not found at '$PLATFORM_DIR' (set ODD_PLATFORM_DIR)"
echo "Platform repo: $PLATFORM_DIR"

if [ "${1:-}" = "--check" ]; then
  echo "toolchain OK — ready to run odd-platform tests."
  exit 0
fi

cd "$PLATFORM_DIR"

# Pick the gradle tasks to mirror CI (`odd-platform-api:build`). A no-arg run
# uses the full `build` exactly as the GitHub run_tests job does (test +
# checkstyle + assemble). A targeted `--tests "<pat>"` run CANNOT use `build`/
# `check` — neither accepts `--tests` (that option belongs to the `test` task) —
# so it lists tasks explicitly: both checkstyle tasks PLUS the filtered `test`.
# That runs CI's exact style gate over both source sets, minus `assemble`, for a
# fast inner loop (assemble is still covered by a no-arg run before push).
# ORDER MATTERS: `--tests` (appended via "$@") binds to the LAST task name on the
# command line, so `test` must come last or gradle rejects `--tests` on checkstyle.
case " $* " in
  *" --tests "*) GRADLE_TASKS=(:odd-platform-api:checkstyleMain :odd-platform-api:checkstyleTest :odd-platform-api:test) ;;
  *)             GRADLE_TASKS=(:odd-platform-api:build) ;;
esac

echo "+ JAVA_HOME=\$JDK17 ./gradlew ${GRADLE_TASKS[*]} -PbundleUI=false $*"
exec ./gradlew "${GRADLE_TASKS[@]}" --no-daemon --console=plain -PbundleUI=false "$@"
