---
playbook: stream-coordination
status: active
since: 2026-06-22
applies_to: [pillar:contributor, skill:contribute, skill:review]
---

# PROTOCOL stream-coordination

The one protocol every parallel stream runs to stay out of every other stream's way. It makes
`state/active-streams.yaml` the **live** source of truth (never the records), gives each stream an isolated
shared-resource namespace, respects the serialized resources, and bakes in the O6/LSN-038 push-safety guard.
A "stream" is one `(role, work-item)`: `contributor` / `reviewer` / `probe-run` / `enrich` / `reducer` /
`maintainer`. Decision + rationale: `adrs/drafts/parallel-contribution-operating-model.md` (the inventory it
builds on: `adrs/drafts/parallel-contribution-infra.md`, R1-R9 / O1-O10).

## trigger

- A `/contribute` run — at **intake** (register) and at every **terminal** (GATE-2 merged / blocked / abandoned).
- A `/review` run — at **intake** (register a read-only `reviewer`) and at the **verdict** (clear).
- Any `/probe-run`, `/enrich`, or reducer/`/next-batch` batch that writes `lineage/**` — register for the
  duration it holds the lineage lock (R9; the most common lineage holder is a probe-run, not a contributor — O8).

## inputs

- `state/active-streams.yaml` — the live registry (READ first, always).
- the work item (CTRIB-NNN / the issue URL) + this run's role.
- the **live** working trees — `git -C ../odd-platform rev-parse HEAD` + branch + `status`, the same for
  `../documentation`, and `docker ps`. A record is a *claim*; the working tree is the *truth* (O4/O8/O9).

## procedure

1. **READ** the registry before touching any shared resource. Note every live entry's `owns_write`, its
   isolation namespace (worktree / image tag / ports), and the `shared_resources` holders + `next_free` values.

2. **VERIFY LIVE over record.** Re-derive the true state from the working trees + `docker ps`; do **not** trust
   another stream's `status`/`head`. If the registry has drifted (a stale head, a wrong lock holder, unowned
   dirt), **reconcile it** — rewrite the entry from what you observe, with a `verified-at` timestamp. Specific
   checks: `git -C ../odd-platform rev-parse HEAD` (vs the recorded `head`); `git status lineage/` (who holds
   R9 — read the `probe_run_id` in `feature-flows.yaml`, never guess a stream); `docker ps` (which ports/images
   are live).

3. **PICK a non-colliding namespace** from `shared_resources.*.next_free`: a stream id (kebab; e.g. `ctrib029`),
   a worktree path `../odd-platform-<id>`, a SUT image tag `odd-platform:odd-team-sut-<id>`, a compose project
   `<id>` + container names `<id>-*` + a free host-port pair. Never reuse a port/tag/worktree a live entry holds.

4. **REGISTER** your entry (or refresh it): `id`, `role`, `work_item`, `issue`, `phase`, `status`, `started`/
   `updated`, the `isolation` block, `owns_write` (every path/resource you will write — others avoid them),
   `reads_only` (reviewers), and `wants` (serialized resources you are waiting on). Commit the registry with an
   explicit-path atomic commit (never `git add -A`).

5. **ISOLATE** (only the code-writing roles — `contributor`; reviewers are read-only on the repos and skip
   this): create the worktree, build into your per-stream image tag, drive your own compose stack on your ports.
   **PUSH-SAFETY FIRST (mandatory — see below).** The cheap buckets (unit via `ODD_PLATFORM_DIR`, a targeted API
   stack on your ports) parallelise freely; the heavy e2e regression does not (step 6).

6. **RESPECT the serialized resources** (`shared_resources`):
   - **`lineage/**` is single-writer (R9).** Run `/enrich`/`/probe-run`/a reducer ONLY when `lineage/**` is
     clean **and** unclaimed, *whoever* the holder is. If it is dirty from another activity, **do not** `/enrich`
     into it and **do not** commit/revert that activity's work (O10) — wait, or defer with a justification.
   - **The heavy e2e regression is one-at-a-time across ALL streams** — ENFORCED by a machine-wide `flock`
     (`state/locks/heavy-e2e.lock`), not just convention. Run it via **`integration-tests/run-regression.sh
     <id>`** (build the SUT once from your worktree → acquire the flock → run all suites isolated → tear down →
     release; `adrs/drafts/parallel-stream-test-foundation.md`). It blocks until the lock is free, so the running
     regression gets the machine to itself (fast + reliable); mirror it with a `wants: e2e` registry entry for
     visibility. Cheap runs (the unit build, a targeted API probe on your own isolated stack) do NOT take the
     lock and parallelise freely.
   - **The odd-team git index + `PROGRESS.md` (R5)** take explicit-path atomic commits only; keep new files
     untracked until the commit moment (a stray `git add -A` sweeps another stream's staged files — O3).
   - **The `documentation` `release/{version}` train (R6)** — per-stream docs worktree; same-name pushes only.
   - **Never `git checkout --` / revert / weaken a path you do not own** (O10) — *while its owner can still
     return*: route around it, the owner reconciles it. **O10 forbids _sweeping/reverting_ another stream's work,
     not _losing_ it.** **If no session will return** — you are the **only/last active session**, or `/streams`
     is GC-ing a **confirmed-abandoned** stream — unowned dirt must be **CAPTURED, not abandoned**: commit it with
     honest attribution ("orphaned from {activity}; preserved by the only/last session; not authored here"), or
     park it to `state/abandoned/<id>.patch`. Leaving it uncommitted then silently LOSES it. (Route-around is the
     in-flight rule; capture-before-finish is the last-session rule.)

7. **UPDATE** `phase`/`status`/`updated` per phase — the heartbeat the abandonment GC (`/streams`) reads.

8. **CLEAR** at terminal (GATE-2 merged / done / blocked / review-complete / abandoned): set `phase: complete`
   or remove the entry, and release the namespace (free the worktree + ports, drop the image tag) + any
   serialized hold. An abandoned stream's resources are reclaimed **only after its work is captured** (branch
   pushed, or the diff saved to `state/abandoned/<id>.patch`) — never silently lost (`/streams` enforces this).

## push-safety (O6 / LSN-038) — before ANY push, no exceptions

A worktree branch created with `worktree add -b <branch> origin/main` auto-tracks `origin/main`; a bare
`git push` then fast-forwards **shared `main`** with unreviewed code (and bypasses the G-C4 bot-only merge gate
on a human-admin push). With N streams every worktree is a fresh chance to mis-track, and the victim is the one
branch all streams share. CTRIB-028's stream actually did this (`retrospectives/LSN-038`). Therefore:

1. `git -C <clone> config push.default current` — **once per clone**; inherited by every worktree (`.git/config`).
2. Publish only with a same-name refspec: `git push -u origin <branch>` (or `git push origin <branch>:<branch>`).
3. **Assert before every push:** `test "$(git rev-parse --abbrev-ref @{u} 2>/dev/null)" != origin/main`, and the
   refspec's destination is never `main` / `master`. A push whose destination resolves to a shared release/main
   branch you did not intend is a hard stop.

## exit

- The registry has your live-verified entry (or a `complete`/removed one at terminal); no shared resource you
  hold is missing a named holder.
- Every push used a same-name refspec; none touched `main`.
- No `lineage/**` write happened against a dirty/claimed tree; no unowned path was swept.
- **If this is the only/last active session:** no orphaned working-tree change was left uncommitted — each was
  captured (committed with honest attribution) or parked to `state/abandoned/`. Nothing was lost.

## on-fail

- The registry disagrees with the live tree → trust the tree, reconcile the registry, proceed.
- A namespace you want is held by a live entry → pick the next free one; never co-tenant a port/tag/worktree.
- `lineage/**` is dirty and you need `/enrich` → defer with a justification (G-C10 "no refresh now + why");
  never sweep the owner's work.
- A push's upstream resolves to `origin/main` → STOP; fix the tracking (step push-safety) before any push.
- You are the only/last session and the tree carries unowned dirt → do **NOT** leave it (it will be lost);
  capture it (commit with honest attribution, or park to `state/abandoned/`). Route-around only applies while an
  owner can return. (Case-law 2026-06-22: the #1740 only-session almost lost a probe-run merge + a run-status IT
  + a sibling PR-body by treating them as route-around-able O10 dirt.)

## case-law

- `retrospectives/LSN-038` — a contrib branch tracking `origin/main` pushed unreviewed code to public `main`.
- `adrs/drafts/parallel-contribution-operating-model.md` (the decision) + `…-infra.md` (R1-R9 / O1-O10, the
  reviewer-session findings §8, the runtime validation §7).
- `state/active-streams.yaml` — the live registry this protocol reads/writes; its header is the same protocol.
- The 2026-06-22 CTRIB-029 (#1740) ∥ CTRIB-028 (#1754) run — two stacks coexisted on distinct ports/tags with
  zero interference; the misses (O8 mis-attributed lineage lock, O9 stale SHA) are why step 2 is verify-live.
