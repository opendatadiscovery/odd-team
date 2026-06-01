#!/usr/bin/env bash
# Run odd-platform tests (unit + Testcontainers integration) locally — the
# pre-push gate a maintainer runs before opening a PR.
#
# Prepares + checks the local toolchain (a JDK 17 + a running Docker), then runs
# gradle. Portable by design: auto-detects a user-space JDK 17 and the sibling
# odd-platform repo, with NO absolute paths baked in (CLAUDE.md Rule 5).
#
# Usage:
#   scripts/run-platform-tests.sh --check                    # verify toolchain only (no build)
#   scripts/run-platform-tests.sh                            # run the whole odd-platform-api suite
#   scripts/run-platform-tests.sh --tests "*RegressionPin*"  # run a subset (the landmine pins)
#   scripts/run-platform-tests.sh --tests "*ServiceTest"     # e.g. the service-layer unit tests
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
echo "+ JAVA_HOME=\$JDK17 ./gradlew :odd-platform-api:test $*"
exec ./gradlew :odd-platform-api:test --no-daemon --console=plain "$@"
