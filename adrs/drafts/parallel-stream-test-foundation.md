---
adr_slug: parallel-stream-test-foundation
title: "Robust parallel-stream test infrastructure — isolation + serialization + teardown"
status: proposed
date: "2026-06-23"
supersedes_findings: adrs/drafts/parallel-contribution-infra.md (the inventory/findings; this is the decided foundation)
trigger: "maintainer directive 2026-06-23 — stop patching; build a robust, repeatable, fast foundation for N simultaneous contributors + reviewers with no shared infra and main as the only integration point"
---

# Robust parallel-stream test infrastructure

## Context

N `/contribute` + `/review` streams run concurrently on **one** machine. PR #164 gave each stream a namespace
(worktree + image tag + compose project + container names + its own Postgres + a free host-port pair), which
prevents **collisions**. But three problems remained — surfacing as flaky / timed-out e2e and "patch on patch"
(CTRIB-030 #1758, 2026-06-23):

1. **Contention.** N heavy JVM+Postgres stacks on one box compete for CPU/RAM/IO. *Namespace isolation is not
   resource partitioning.* A stack running concurrently with a SUT build + other streams' stacks goes slow →
   Playwright timeouts (`1.0m`) and seeding failures (`0ms`) in specs **unrelated** to the change under test.
2. **Leftovers.** Stacks are left running for hours — observed: a `:18080` stack **up 13 h** after its stream
   had merged. Dead-weight contention with no owner.
3. **Un-enforced serialization.** The protocol says "heavy e2e one-at-a-time," but nothing *enforces* it, so a
   regression overlaps neighbours' live stacks.

## Decision

A three-part foundation. **The only shared integration point is `main`**; everything else is a disposable
per-stream sandbox.

1. **Isolation prevents collisions.** Every stream = its own worktree (off `origin/main`, own branch) + image
   tag `odd-platform:odd-team-sut-<id>` + compose project `<id>` + container names `<id>-*` + its own Postgres
   (own volume) + a free host-port pair. *(Done for the odd-minimal SUT stack — PR #164.)* The per-spec
   `multi-stack`/`ingestion-e2e` stacks are **not** individually parameterised — they are covered by
   serialization (#2): only one stream runs the heavy e2e at a time, so those stacks are never used
   concurrently, and teardown (#3) removes them after.

2. **Serialization prevents contention on the heavy path.** The FULL e2e regression runs under a machine-wide
   **`flock`** lock (`state/locks/heavy-e2e.lock`). Only ONE heavy regression runs at a time, so it gets the
   machine to itself — *fast and reliable*. `flock` auto-releases when the holding process exits (crash-safe; no
   stale locks). **Cheap runs parallelise freely** and never take the lock: the unit build (Testcontainers uses
   random host ports + Ryuk per run) and a targeted API probe against an isolated stack.

3. **Teardown prevents leftovers.** A stream tears down its stack(s) the instant its tests finish (the
   orchestrator runs `docker compose -p <id> down -v`). The `/streams gc` janitor reconciles `docker ps` +
   worktrees against the registry and GCs orphan `<id>-*` stacks/containers/volumes + stale entries
   (crash cleanup) — never sweeping a **live** stream's stack (O10).

## Mechanism

- **`integration-tests/run-regression.sh <id>`** — the ONE recipe: reserve the namespace → build the SUT once
  from the stream's worktree → **acquire the `flock`** (block until free; the registry shows the stream is
  `wants: heavy-e2e`) → run all suites isolated against that one image → **tear down** → release (flock drops on
  exit). Robust, repeatable; the run-log records the SUT digest == the committed SHA.
- **`flock`** — the serialization primitive (POSIX advisory file lock; auto-release on process exit).
- **`run-suite.sh`** — the per-suite runner is unchanged (already stream-aware via `ODD_STREAM`); the
  orchestrator wraps it. A single `run-suite.sh` call still works standalone for a one-off suite.
- **`/streams gc`** — extended to `docker compose -p <id> down -v` any orphan `<id>-*` / terminal stack.
- **`active-streams.yaml`** — the visibility layer: a stream writes `wants: heavy-e2e` while it queues for the
  flock and clears it on release, so a human/another session sees who holds the heavy lock (the lock itself is
  `flock`, the registry is the human-readable mirror).

## Trade-offs

- Streams **queue** for the heavy e2e (not infinitely parallel). This is the honest "fast": concurrent heavy
  runs are *slower* (contention) and flaky; serialised runs each get the machine and finish quickly. Cheap
  parallelism (unit, targeted API) is preserved, so a stream is rarely idle.
- Per-spec stacks stay fixed-name — simpler than parameterising every MinIO/LDAP/collector compose — because
  serialization + teardown make concurrent use impossible. (If true parallel heavy e2e is ever needed, those
  stacks get the same `<id>` treatment as a follow-up.)
- **Port map (SUT must not collide with a per-spec stack).** The per-spec e2e stacks hardcode host ports —
  DB `15432-15437`, API/service `18080-18090` (e.g. `odd-notifications`' webhook-stub binds `:18090`). The
  per-stream SUT therefore allocates from **`18100+` / `15500+`** (`run-regression.sh` `find_free_port` base),
  clear of that range — otherwise a stream's own `multi-stack` run collides its SUT with a per-spec stack (the
  2026-06-23 ctrib030 `:18090` ↔ webhook-stub bind failure). **Follow-up:** `run-suite.sh`'s standalone
  `find_free_port` base (18090/15442) needs the same bump for direct (non-orchestrator) stream runs.

## Consequences

- A stream's regression is reproducible and uncontended — no mid-run timeouts from a neighbour's stack.
- No stack outlives its stream; the machine returns to idle between heavy runs.
- `main` is the sole integration point; every stream is a sandbox created on start and destroyed on finish.
