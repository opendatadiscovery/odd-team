---
adr_slug: parallel-contribution-operating-model
title: "Parallel contribution operating model — ad-hoc N streams via a live registry, per-stream isolation, and abandonment GC"
status: proposed
date: "2026-06-22"
supersedes_intent: "promotes adrs/drafts/parallel-contribution-infra.md (the findings/inventory) into a decided operating model"
trigger: "maintainer directive 2026-06-22 — overhaul /contribute + /review for multiple parties on different issues, ad-hoc, 3-4+; kill the abandoned-work / collision / misunderstanding failure modes"
---

# Parallel contribution operating model

> **What this is.** `adrs/drafts/parallel-contribution-infra.md` is the **research** — the shared-resource
> inventory (R1-R9), the obstacles (O1-O10), the runtime validation. **This ADR is the decision**: the
> operating model that turns that research into a fast, robust, safe way to run **N ad-hoc `/contribute` and
> `/review` streams at once**. It is `proposed` — the maintainer approves it before the wiring is built.

## Context

The contributor pillar already works **per-issue** (`/contribute` resolves one GitHub issue end-to-end;
`/review` verifies one item). The gap the maintainer named is not batching — it is **concurrency**: today a
run assumes it is the only writer of a set of single-instance resources, so two runs on different issues
collide, and a run that trusts another stream's *record* mis-models reality. The lived result this week:

- **Abandoned work** — a session ends mid-flight leaving uncommitted code in a worktree, a held stack on a
  port, and a registry/record entry frozen at a stale phase. Nobody reclaims it; the next stream can't tell
  if it's live.
- **Collisions** — the shared SUT image tag, compose ports, the `odd-team` git index, `lineage/**`, and the
  shared `main` branch (O6/LSN-038 actually pushed unreviewed code to public `main`).
- **Misunderstandings** — a record cited a stale SHA (O9), a lineage lock was mis-attributed to the wrong
  stream (O8), a status said `planned` while the tree was mid-implement (O4).

What already exists: the `state/active-streams.yaml` registry (built, **hand-maintained**), the findings doc,
the push-safety retrospective (LSN-038). What's missing: the **wiring** that keeps the registry true without
hand-maintenance, the **ergonomics** that make a stream's isolation derived rather than hand-rolled, and an
**abandonment-GC** mechanism — which does not exist at all today.

Requirement (maintainer, verbatim intent): start one issue, add another ad-hoc, review one while another is
in progress; **not** limited to two — 3-4 for small-scoped items, emerging ad-hoc.

## Decision — the operating model

### 1. The registry is the live coordination substrate — for *every writer*, not just contributors

`state/active-streams.yaml` is the single source of truth for "who is touching what right now." Every actor
that writes a shared resource registers: `contributor`, `reviewer`, `probe-run`, `enrich`, `reducer`,
`maintainer` (O8's lesson — the most common `lineage/**` lock-holder was a probe-run, not a contributor).
The protocol each run follows (already documented in the file's header; this ADR makes it **enforced by the
skills**, §7):

1. **READ** at intake — before touching any shared resource.
2. **VERIFY LIVE over record** — `git -C <repo> rev-parse HEAD` + branch + `git status` + `docker ps`, and
   reconcile the registry if it drifted. A record is a claim; the working tree is the truth (O4/O8/O9).
3. **REGISTER** — id, role, work-item, the isolation namespace, `owns_write` (paths it will write), `wants`
   (serialized resources it is waiting on), and a `verified-at` timestamp.
4. **PICK NON-COLLIDING** resources from `shared_resources.next_free`.
5. **UPDATE** `phase`/`status`/`updated` per phase (the heartbeat — §4 depends on it).
6. **CLEAR** at terminal (merged / done / blocked / abandoned) — release the namespace + serialized holds.

### 2. Per-stream isolation, *derived* not hand-rolled

A stream claims a short `id` (e.g. `ctrib029`) and every shared resource is namespaced by it — proven live
this session (two stacks coexisted). The model is in findings §4; the **decision** is to make it ergonomic so
"start a stream" is one step, not a hand-assembled recipe:

| Resource | Built knob (to add) |
|---|---|
| odd-platform worktree | `../odd-platform-<id>` (git worktree off `origin/main`) |
| SUT image tag | `build-sut.sh` gains `ODD_SUT_TAG` (default the stable tag) — findings §5.1 |
| compose project/names/ports | `run-suite.sh` gains a **stream-id mode** templating `COMPOSE_PROJECT_NAME`, `<id>-*` names, a free port pair, the health URL; the compose file parameterises them — findings §5.2-3 |
| docs worktree | `../documentation-<id>` off the release train |

The cheap, fully-isolatable buckets (**unit** via `ODD_PLATFORM_DIR`, a **targeted API stack** on the stream's
own ports) parallelise freely — that is where the velocity comes from. The expensive one is gated (§5).

### 3. The ad-hoc lifecycle (start / add / review — interleaved, never coupled)

A stream is exactly one `(role, work-item)`. There is **no batch coupling**: `/contribute` resolves one issue;
`/review` verifies one item; a third stream reviews a different item — all concurrently, coordinated only
through the registry. Adding a stream is "claim an id + isolate + register"; it never waits on another stream
except at a **serialized resource** (§5). Concurrency is **not capped by the model** — it is capped by (a) the
serialized e2e gate and (b) machine resources; 3-4 cheap streams is comfortable, more is fine until the e2e
queue or RAM is the bottleneck.

### 4. Abandonment GC — the missing mechanism (kills the "abandoned work" pain)

A new `/streams` command (and a fold into `/orient`) is the janitor the model lacks today. It:

- **Lists** every registry stream with its live-verified state and a **staleness verdict**: `updated` older
  than a heartbeat window (proposed: **4h**) **and** a non-terminal `phase` → `STALE`; an orphaned worktree /
  held port / contrib branch with no live registry owner → `ORPHANED`.
- **Reconciles** — re-derives each stream's true state from the working tree (never the record), flags
  `unowned_dirty_state`, and rewrites the registry to match reality.
- **Offers per stale/orphaned stream**: **resume** (re-attach: the worktree + branch + record are intact),
  **reclaim** (free the worktree/ports/registry slot — **only after the work is captured**: the contrib
  branch is pushed *or* the uncommitted diff is saved to `state/abandoned/<id>.patch` + surfaced), or
  **discard** (maintainer-confirmed; never silent).
- **The invariant**: *no stream's resources are reclaimed until its work is captured or the maintainer
  explicitly discards.* Abandoned work is never silently lost and never silently blocks — it is surfaced,
  parked, and the resource is freed.

### 5. The serialized resources are the real constraints on N (everything else parallelises)

| Resource | Rule | Why it's the binding constraint |
|---|---|---|
| `lineage/**` + the embedding (R9) | single-writer; no `/enrich`/`/probe-run`/reducer while it is dirty **or** claimed, *whoever holds it* | concurrent rewrites + re-embeds corrupt the tree + index (O8) |
| heavy e2e regression (`feature-complete`/`multi-stack`/`ingestion-e2e`) | **one at a time across ALL streams**, never concurrent with a possible maintainer run; a `wants: e2e` queue in the registry | shared persistent stack (R4) + CPU/RAM; this is what actually caps heavy-gate throughput, not the model |
| odd-team git index + `PROGRESS.md` (R5) | explicit-path atomic commits only; new files untracked until the commit moment; **(better)** a per-stream bookkeeping worktree merged at the gate | a stray `git add` sweeps another stream's staged files (O3) |
| documentation `release/{version}` train (R6) | per-stream docs worktree; same-name pushes; the release gate merges | shared integration branch |

### 6. Push-safety is non-negotiable for parallel streams (O6 / LSN-038)

`git config push.default current` **once per clone** (inherited by every worktree); never leave a contrib
branch tracking `origin/main`; assert `@{u} != origin/main` before every push. The shared-`main` blast radius
(an unreviewed push to public `main`, bypassing G-C4) makes this a hard gate in the stream-coordination
protocol, not advice.

### 7. The skill wirings (what changes in `/contribute` and `/review`)

A new shared playbook **`playbooks/stream-coordination.md`** owns the read→verify→register→update→clear
protocol (§1) + the push-safety gate (§6); both skills compose it:

- **`/contribute`** — Phase A intake runs stream-coordination: read the registry, **verify live state over the
  CTRIB record**, reserve an `id` + free ports, create a worktree **by default when any other stream is
  active**, register a `contributor` entry. GATE-2 (merge) / `blocked` / session-end clears it. The 12-phase
  loop and the two human gates are unchanged — only the isolation + registration wrap them.
- **`/review`** — intake registers a **read-only `reviewer`** entry (O7 — a reviewer is a stream too; it
  contends for the index, must NOT `/enrich`, and `git checkout -- lineage/` after any suite run). The verdict
  clears it. `/review` stays per-item and ad-hoc; "batch:" remains available but is never required.

## The concrete change list (built only after this ADR is approved)

1. `build-sut.sh` — `ODD_SUT_TAG` (default the stable tag); echo it in `SUT_IMAGE=`.
2. `run-suite.sh` — stream-id mode (templated project/names/ports/health) + an `ODD_STREAM` env; keep the
   persistent shared stack as the single-stream default.
3. `lineage/_extractor/probe-stacks/odd-minimal.docker-compose.yml` — parameterise names + ports.
4. `playbooks/stream-coordination.md` — the read/verify/register/update/clear + push-safety protocol.
5. `.claude/skills/contribute/SKILL.md` — wire stream-coordination into Phase A + the gate-clear.
6. `.claude/skills/review/SKILL.md` — wire reviewer registration at intake + verdict-clear.
7. `/streams` command + `state/abandoned/` — the GC janitor (§4); fold a stale-stream summary into `/orient`.
8. `pillars/contributor/pillar.md` + `gates.md` — a new cornerstone ("a stream registers, isolates, verifies
   live, and is reclaimable only after its work is captured") + the push-safety gate reference.

## Consequences

- **Fast** — the cheap buckets parallelise with derived namespaces; starting/adding a stream is one step; no
  stream waits except at a serialized gate.
- **Effective** — N ad-hoc streams (contribute + review on different issues), capped by the e2e queue + RAM,
  not by the model; 3-4 small-scoped streams is the comfortable target, more is allowed.
- **Robust** — the registry + live-verification + GC eliminate the stale-record mis-modeling (O4/O8/O9) and
  the abandoned-work loss; every shared resource has a named, live-verified holder.
- **Safe** — per-stream isolation + the lineage/index/e2e serialization + the push-safety gate prevent
  cross-stream corruption and the shared-`main` blast radius. The two human gates and the read-only-reviewer
  rule are unchanged.

## Open decisions for the maintainer (the genuine choices)

1. **Abandonment GC trigger** — a manual `/streams` janitor (run when you notice drift) vs. an auto-sweep at
   every `/contribute` + `/review` intake (more robust, slightly slower start). *Recommendation: auto-sweep at
   intake (cheap — it's a registry read + a few `git`/`docker` checks) + a manual `/streams` for on-demand.*
2. **Bookkeeping isolation** — per-stream `odd-team` worktree (fully removes the index race, more setup) vs.
   the explicit-path atomic-commit discipline (zero setup, relies on discipline). *Recommendation: keep the
   discipline now; add the worktree option behind `/streams` if the index race actually bites.*
3. **Concurrency cap** — advisory (the registry shows load; you decide) vs. enforced (refuse a new stream past
   N). *Recommendation: advisory — the serialized gates self-throttle; a hard cap fights the ad-hoc need.*
4. **Build the script ergonomics (§change-list 1-3) now**, or keep the validated hand-rolled recipe and wire
   only the coordination (4-8)? *Recommendation: the coordination + GC (4-8) deliver the robustness; the
   ergonomics (1-3) are a smaller follow-up — sequence robustness first.*

Sources: `adrs/drafts/parallel-contribution-infra.md` (§1-8, R1-R9, O1-O10); `state/active-streams.yaml` (the
built registry + its protocol header); `.claude/skills/{contribute,review}/SKILL.md`; `retrospectives/LSN-038`
(push-to-main); the live CTRIB-029 ∥ CTRIB-028 run (two stacks coexisted; zero interference). All 2026-06-22.
