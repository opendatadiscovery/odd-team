---
name: streams
description: The parallel-work janitor. Lists every active /contribute + /review + probe-run stream from state/active-streams.yaml, reconciles each against the LIVE working trees (never the records), flags STALE / ORPHANED streams, and offers resume / reclaim / discard — with the invariant that no resource is reclaimed until its work is captured. Run it to see what is in flight, to pick a non-colliding namespace before starting a stream, or to clean up after abandoned work.
argument-hint: "(none) | <stream-id> | gc"
allowed-tools: Read Grep Glob Bash(git *) Bash(docker *) Bash(ls *) Bash(cat *) Write Edit
---

# /streams — the parallel-contribution janitor

You maintain `state/active-streams.yaml` as the **live** coordination substrate for every parallel stream, and
you garbage-collect abandoned work. The operating model is `adrs/drafts/parallel-contribution-operating-model.md`;
the protocol every stream follows is `playbooks/stream-coordination.md`; the resource inventory is
`adrs/drafts/parallel-contribution-infra.md` (R1-R9 / O1-O10). This skill is the read + reconcile + GC view.

`$ARGUMENTS`: empty → the full dashboard. `<stream-id>` → focus one stream. `gc` → run the reclaim sweep.

## 1. Read + verify-live (never trust the record — O4/O8/O9)

Read `state/active-streams.yaml`. For **every** entry, re-derive the truth from the working trees and docker —
a record is a claim, the tree is the truth:

- `git -C ../odd-platform rev-parse HEAD` + `--abbrev-ref HEAD` + `git status --porcelain` (vs the recorded `head`/branch).
- the same for `../documentation` and every `../odd-platform-<id>` worktree (`git worktree list`).
- `git -C ../odd-platform status lineage/` + the `probe_run_id` in `lineage/odd-platform/feature-flows.yaml`
  (who actually holds the R9 lineage lock — never guess a stream; O8).
- `docker ps` (which `<id>-*` / `probe-*` stacks + ports + images are live).

Reconcile the registry to what you observe: fix stale heads, wrong lock holders, and the `unowned_dirty_state`
block. Stamp each touched entry with a `verified-at`. Commit the reconciliation (explicit path, atomic).

## 2. Classify each stream

- **LIVE** — `updated` within the heartbeat window (default **4h**) and a non-terminal `phase`; its worktree +
  stack match the record. Leave it; just report.
- **STALE** — `updated` older than the window AND a non-terminal `phase` (intake…pr-pending). The session likely
  ended mid-flight. Candidate for resume/reclaim.
- **ORPHANED** — a worktree / contrib branch / held port / image tag with **no** registry entry, OR an entry
  whose isolation no longer exists on disk. Also: `unowned_dirty_state` (dirty paths no entry claims — e.g. a
  probe-run's `lineage/**` residue, a stray spec). Surface it; never sweep it (O10).
- **COMPLETE** — terminal (`merged`/`done`/`blocked`/review-complete). Should already be cleared; clear it.

## 3. Offer per STALE / ORPHANED stream (the GC) — `gc` mode

For each, present the options; **never act destructively without the work captured or an explicit discard**:

- **resume** — the worktree + branch + record are intact; print the exact commands to re-attach (the
  `cd ../odd-platform-<id>`, the SUT tag, the ports) and the next pending DoD gate. Nothing is reclaimed.
- **reclaim** — free the namespace (remove the worktree, drop the image tag, release the ports, clear the
  registry entry) **only after the work is captured**: the contrib branch is pushed to origin, **or** its
  uncommitted diff is saved to `state/abandoned/<id>.patch` (with a one-line provenance header) and surfaced.
  Print what was captured + where before freeing anything.
- **discard** — maintainer-confirmed only. Even then, save the diff to `state/abandoned/<id>.patch` first
  (a discard is recoverable for one release cycle), then free the namespace.

**The invariant (non-negotiable):** abandoned work is never silently lost and never silently blocking. Every
reclaim either pushes the branch or parks the patch; every discard parks the patch and is human-confirmed.

## 4. The dashboard (default, no args)

Print a compact table: `id · role · work-item · phase · LIVE/STALE/ORPHANED · isolation (worktree/image/ports)
· lineage-lock? · last-verified`. Then:

- **Next-free namespace** — the lowest unused stream id pattern + the next free port pair + the next image tag,
  so a starting stream can copy them (the `shared_resources.next_free` values, re-derived live).
- **Serialized-resource status** — who holds `lineage/**` (R9), whether a heavy e2e regression is running
  (one-at-a-time — G-C2), and the `wants: e2e` queue order.
- **GC candidates** — the STALE/ORPHANED list with the recommended action each.

## Rules

- **Verify live over record, always** (O4/O8/O9). If the registry and the tree disagree, the tree wins; fix the
  registry.
- **Never sweep what you do not own** (O10). Unowned dirty state is reported for its owner to reconcile; this
  skill does not `git checkout --` / `git add` / revert another stream's paths. The single exception is a
  human-confirmed `discard`, and even then the diff is parked first.
- **Capture before reclaim.** No worktree is removed and no branch is deleted until its work is pushed or parked.
- **Atomic registry commits** (explicit path; never `git add -A` — R5/O3).
- This skill is **read-mostly + reconcile**; it does not run builds, suites, `/enrich`, or pushes of code. It
  curates the coordination substrate so the other skills run safely in parallel.
