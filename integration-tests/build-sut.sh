#!/usr/bin/env bash
# build-sut.sh — materialise the System Under Test (SUT) image from a SELECTED SOURCE.
#
# The SUT — which artifact a test runs against — is a RUN-TIME parameter, NOT a property of any test.
# Tests and the compose stack are SUT-agnostic: they reference the STABLE tag `odd-platform:odd-team-sut`,
# and THIS script re-materialises that tag from the chosen source on EVERY run. So regression is always
# measured against the subject you chose — never a frozen snapshot. See retrospectives/LSN-033.
#
# Usage:  build-sut.sh [SUT]        (or export ODD_SUT; default `working`)
#   working            (DEFAULT)  the odd-platform working tree — UNCOMMITTED changes included
#                                 ("run the suite on what I'm building right now")
#   main                          HEAD of origin/main (throwaway git worktree) — the integration baseline
#   ref:<tag|sha>                 a specific git ref (throwaway worktree) — a release candidate / a bisect point
#   published                     pull ghcr ...:latest, retag — the MOVING "current release" pointer
#                                 (odd-platform CI keeps :latest == the newest semver release). Answers
#                                 "does the current released build have this?" but is NOT reproducible over time.
#   published:<version>           pull ghcr ...:<version> (e.g. published:0.27.13), retag — a PINNED, reproducible
#                                 release. odd-platform ships semver 0.x.y (85+ tags as of 2026-06). PREFER this
#                                 for a reproducible RED proof or a fixed baseline; :latest drifts as releases ship.
#
# Emits (stdout, last lines, machine-readable):
#   SUT_DESC=<human description>
#   SUT_IMAGE=odd-platform:odd-team-sut
#   SUT_IMAGE_ID=sha256:...
#
# Portable: no absolute paths. Overrides: ODD_PLATFORM_DIR=<path>  JAVA_HOME_17=<jdk17 path>
set -euo pipefail

SUT="${1:-${ODD_SUT:-working}}"
TAG="odd-platform:odd-team-sut"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE="$(cd "$HERE/.." && pwd)"
PLATFORM="${ODD_PLATFORM_DIR:-$(cd "$WORKSPACE/../odd-platform" 2>/dev/null && pwd || true)}"
[ -n "$PLATFORM" ] && [ -d "$PLATFORM/.git" ] || { echo "ERROR: odd-platform repo not found (set ODD_PLATFORM_DIR)" >&2; exit 1; }

find_jdk17() {
  if [ -n "${JAVA_HOME_17:-}" ] && [ -x "${JAVA_HOME_17}/bin/javac" ]; then echo "$JAVA_HOME_17"; return; fi
  for d in "$HOME"/.local/jdks/jdk-17* /usr/lib/jvm/*temurin-17* /usr/lib/jvm/*17-openjdk* /usr/lib/jvm/java-17-*; do
    [ -x "$d/bin/javac" ] && { echo "$d"; return; }
  done
}
JDK="$(find_jdk17 || true)"
[ -n "$JDK" ] || { echo "ERROR: no JDK 17 found (set JAVA_HOME_17)" >&2; exit 1; }

# Build the odd-platform image from a checked-out source dir, WITH the UI bundled (the e2e drives the SPA).
jib_from() {  # $1 = an odd-platform source checkout
  JAVA_HOME="$JDK" "$1/gradlew" -p "$1" :odd-platform-api:jibDockerBuild --image="$TAG" -x test
}

case "$SUT" in
  working)
    sha="$(git -C "$PLATFORM" rev-parse --short HEAD 2>/dev/null || echo '?')"
    git -C "$PLATFORM" diff --quiet 2>/dev/null && dirty="" || dirty="+uncommitted"
    desc="working tree @ ${sha}${dirty}"
    echo "-> SUT: building from the odd-platform working tree (${desc})..." >&2
    jib_from "$PLATFORM" >&2
    ;;
  main|ref:*)
    if [ "$SUT" = "main" ]; then ref="main"; else ref="${SUT#ref:}"; fi
    # Resolve FRESHLY from origin — never a stale LOCAL branch. Fetch the ref and build at FETCH_HEAD
    # (uniform for a branch / tag / fetchable sha). Fall back to a local ref ONLY if origin won't serve
    # it (e.g. a sha already present locally); otherwise error loudly rather than build the wrong commit.
    if git -C "$PLATFORM" fetch -q origin "$ref" 2>/dev/null; then
      src="FETCH_HEAD"
    elif git -C "$PLATFORM" rev-parse --verify -q "${ref}^{commit}" >/dev/null; then
      src="$ref"; echo "-> SUT: '$ref' not fetchable from origin; using the local commit." >&2
    else
      echo "ERROR: cannot resolve ref '$ref' (not fetchable from origin, not present locally)" >&2; exit 1
    fi
    wt="$(mktemp -d)/odd-sut"
    # Best-effort cleanup that NEVER fails the build: odd-platform's codegen writes some generated files
    # as root inside the worktree, so rm leaves root-owned leftovers in /tmp (harmless, ephemeral) — and a
    # cleanup failure must not clobber a SUCCESSFUL build's exit code. Every step is `|| true`. (LSN-033.)
    trap 'git -C "$PLATFORM" worktree remove --force "$wt" 2>/dev/null || true; rm -rf "$(dirname "$wt")" 2>/dev/null || true; git -C "$PLATFORM" worktree prune 2>/dev/null || true' EXIT
    git -C "$PLATFORM" worktree add -q --detach "$wt" "$src"
    desc="${ref} @ $(git -C "$wt" rev-parse --short HEAD)"
    echo "-> SUT: building from ${desc} (throwaway worktree, working tree untouched)..." >&2
    jib_from "$wt" >&2
    ;;
  published|published:*)
    if [ "$SUT" = "published" ]; then ver="latest"; else ver="${SUT#published:}"; fi
    img="ghcr.io/opendatadiscovery/odd-platform:${ver}"
    desc="published ${img}"
    echo "-> SUT: pulling ${img}..." >&2
    docker pull "$img" >&2
    docker tag "$img" "$TAG"
    ;;
  *) echo "ERROR: unknown ODD_SUT '$SUT' (working | main | ref:<tag|sha> | published[:version])" >&2; exit 2 ;;
esac

id="$(docker images --no-trunc -q "$TAG" | head -1)"
echo "SUT_DESC=${desc}"
echo "SUT_IMAGE=${TAG}"
echo "SUT_IMAGE_ID=${id}"
