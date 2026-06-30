---
playbook: decompose-epic
status: active
since: 2026-06-30
applies_to: universal (wired to pillar:contributor first — any request too big for one shippable slice)
---

# PROTOCOL decompose-epic

A request too big for one shippable PR is **decomposed into independently-shippable slices before any code** — never one-shot, never a big-bang branch. Each slice ships **user-observable value**, carries its own spec → plan → tests → PR, and rides its own gates. The epic itself is never a single `/contribute` run; it is a spine that coordinates slices.

The split mechanism is gsd-core's **SPIDR** (Mike Cohn's story-splitting), and the per-slice success-criteria are **goal-backward** (gsd-core `roadmapper`). The worked reference in this workspace is the #1825 search overhaul: `state/roadmap-unified-search.md` (the spine) + `state/search-overhaul-decomposition.md` (the paste-ready slices).

## trigger

Fire when, after `spec-gate.md` scouting, **any** size signal holds:

1. **Vision body.** The issue says *"overhaul / unify / redesign"*, or *"to be decomposed into slices; a design will follow."*
2. **Compound capability.** The work names ≥2 independent user actions joined by "and" (search core **and** filters **and** columns **and** saved-searches). Each "and" is a candidate split point.
3. **Core-engine rework spanning surfaces.** It reworks a shared engine (search, lineage, ingestion) AND touches multiple UI/API surfaces — too many files / too much context for one plan to stay under ~50 % (a single plan that needs >3–5 files or >2–3 tasks is over budget — see `plan-contract.md`).
4. **Architecturally significant** (G-C7: migration / auth-posture / breaking contract) **and** multi-PR. The ADR comes first (the spine), then decomposition.

Do **not** fire for a single bounded change that ships in one PR — decomposing it is over-engineering. If unsure, ask: *"can this be one reviewable PR that ships observable value?"* Yes → one slice, skip this protocol.

## inputs

- The epic issue (quoted data, G-C8) + its `spec-gate.md` output (the WHAT, falsifiable).
- The **spine**: the approved/agreed ADR + PRD that fix the architectural decisions. If the epic is architecturally significant and no ADR exists → **STOP, write the ADR first** (G-C7 / `deep-research.md`); decomposition without the spine invents architecture per slice.
- The ontology scout (`/code-walk`, `concepts.yaml`, `feature-flows*`) — the existing surfaces the slices converge.

## procedure

### 1. Fix the spine before splitting

Confirm the ADR/PRD that fixes the load-bearing decisions (the index shape, the contract, the backward-compat constraint). The spine is what keeps the slices coherent; without it, slice N+1 contradicts slice N. Architecturally significant + no ADR → run `deep-research.md` → ADR first (G-C7), then return here.

### 2. Split along SPIDR axes — one axis per split, vertical only

For each oversized chunk, pick the axis that fits and split:

| Axis | Question | Resulting first slice |
|---|---|---|
| **Spike** | Is there an unknown that must be researched before this can be planned? | A research-only slice (its only "done" is *we know enough to plan the rest*). |
| **Paths** | Happy path + error/edge paths? | Happy path first (it proves the slice works); edge paths follow. |
| **Interfaces** | More than one surface (API · web · CLI)? | The integration-driving surface first (usually the API/contract), then the consumers. |
| **Data** | Multiple data scopes (one kind vs all kinds; one user vs many; small vs large)? | Smallest scope first (one asset kind, current user), then widen. |
| **Rules** | Multiple business rules addable incrementally (basic filter → complex facet logic)? | Minimum-viable rules first; complex policy in a follow-up slice. |

**Anti-patterns — reject:**
- **Splitting by technical layer** ("slice 1: schema, slice 2: API, slice 3: UI"). That is horizontal — each slice ships nothing a user can observe. Prefer a **vertical slice** (the thin end-to-end thread: index + query + one filter + the row) that ships observable value, then thicken.
- **Two axes at once.** Split on one; re-evaluate the smaller pieces.
- **A "foundation" slice with no user-observable truth** — allowed ONLY when a later slice genuinely requires the shared substrate AND the foundation lands behind the first vertical thread that exercises it (the index ships *with* the first query that uses it, not as a dead table).

### 3. Goal-backward each slice — observable truths + total coverage

For every slice, state the goal as an **outcome, not a task** ("a user can share a search via its URL", not "add URL sync"), then derive **2–5 user-observable truths** (each verifiable by a human driving the running system). Then check coverage both ways:

- Every requirement from the spec maps to **exactly one** slice — no orphan, no duplicate.
- Every slice's truths trace back to a requirement — a slice that supports no requirement is scope creep; cut or defer it.

Order slices by genuine dependency (a slice depends on another only if it consumes its contract/output); independent slices are parallel tracks (see `stream-coordination.md`).

### 4. Write the two artifacts

- **`state/{slug}-decomposition.md`** — the paste-ready sub-issue bodies. Each slice carries: a title (`ST-N — <outcome>`), the user-observable goal + 2–5 truths, **scope IN / OUT (+ why)**, the **SPIDR axis** it came from, its dependencies, the milestone, the spine refs (ADR decision IDs), and a one-line *"ships X to the user."*
- **`state/roadmap-{slug}.md`** — the spine: the one-line strategy, how the tracks interlock (an ASCII map), the sequence (step → what → unblocks), parked items, and the open maintainer decisions (release-planning authority stays human).

### 5. Map to GitHub — the bot does not create issues

The `odd-contributor[bot]` is policy-barred from creating GitHub issues (`playbooks/github-write.md` — comments + draft PRs only). So slices are **paste-ready** and filed by the maintainer:

- **Default:** the maintainer creates each sub-issue (paste the body), then links it under the epic via GitHub's native **sub-issue** control (parent/child rollup). Each child carries the epic's milestone (G-C11).
- The maintainer may explicitly authorise the bot to create them once via the Issues + `sub_issues` API — a deliberate crossing of the standing policy, scripted on a granted token.

Each filed slice then runs the **normal single-slice flow**: intake → `spec-gate.md` → reproduce/verify (if it has a broken state) → `design-before-build.md` → `plan-contract.md` + plan-check → GATE 1 → build + tests → GATE 2. The maintainer is the merge gate on every slice.

## exit

- `state/{slug}-decomposition.md` + `state/roadmap-{slug}.md` exist; the spine ADR/PRD is cited.
- Every slice is **independently shippable** (one reviewable PR) and **user-observable** (≥1 truth a human can drive) — no horizontal/layer-only slice, no dead-foundation slice.
- 100 % requirement coverage: every spec requirement → exactly one slice; every slice → ≥1 requirement.
- The filing path is stated (maintainer creates the sub-issues + links them under the epic; milestone carried).
- The first slice is identified and ready to enter the single-slice flow.

## on-fail

- **A "slice" is not independently shippable or has no observable truth** → re-split (wrong axis, or a horizontal cut); a vertical thread always exists.
- **It was actually one PR's worth of work** → collapse back to a single slice; do not over-decompose (volume is not progress).
- **Architecturally significant with no ADR** → `deep-research.md` → ADR first (G-C7), then decompose.
- **Slices keep contradicting each other** → the spine is underspecified; strengthen the ADR before continuing.

## case-law

- `retrospectives/LSN-040-contribute-frontloop-bug-shaped.md` — #1825 was an epic; the skill had no decompose path, so the right structure (PRD-0003 → ADR rev 3 → roadmap → ST-1..N slices) was hand-built ad-hoc in "ideation sessions" instead of produced by a repeatable protocol. This playbook makes that structure the normal mode.
- Worked reference: `state/roadmap-unified-search.md` + `state/search-overhaul-decomposition.md` (the #1825 spine + slices — the template for the two artifacts).
- `feedback_reuse_platform_ui_patterns` + `feedback_research_before_proposing` (auto-memory) — slices converge existing ODD surfaces; scout them before splitting.
- Source: gsd-core `gsd-core/references/spidr-splitting.md` (the axes + the no-horizontal-split rule) + `agents/gsd-roadmapper.md` (goal-backward phase truths + total coverage).
