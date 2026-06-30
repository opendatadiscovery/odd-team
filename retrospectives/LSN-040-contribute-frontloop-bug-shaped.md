---
id: LSN-040
title: Bug-shaped /contribute had no front-of-loop for an epic — #1825 missed the idea of the feature
date: 2026-06-30
domain: contributor
severity: high
gates_informed:
  - G-C17 (spec-gate — understand the WHAT)
  - G-C18 (decompose-epic — no big-bang)
  - G-C19 (plan-contract + adversarial plan-check)
  - playbooks/spec-gate.md
  - playbooks/decompose-epic.md
  - playbooks/plan-contract.md
  - .claude/agents/plan-checker.md
status: closed
---

# LSN-040: Bug-shaped /contribute had no front-of-loop for an epic — #1825 missed the idea of the feature

## What happened
A `/contribute` run was pointed at **[#1825](https://github.com/opendatadiscovery/odd-platform/issues/1825)** — the *unified asset search* overhaul, an **epic** whose own body says *"to be decomposed into slices after filing; a design ADR will fix the technical approach."* The skill was built end-to-end for **bugs** (reproduce → RED/GREEN failing test → one plan → one PR) and had no path for a feature/epic: there is nothing to "reproduce", no gate that forces understanding the WHAT, no step that recognises "this is too big — decompose it", no falsifiable plan contract, and no check of the plan before the human sees it. The run could not pin *the idea of the feature* and could not tackle the design; the maintainer's verdict was "a total disaster." The **right** structure was subsequently hand-built ad-hoc in "search-overhaul ideation" sessions — `prds/0003-unified-asset-search.md` → `adrs/drafts/unified-asset-search.md` (rev 3, decisions D1–D11, security first-class) → `state/roadmap-unified-search.md` → `state/search-overhaul-decomposition.md` (slices ST-1..ST-N) → `contributor/CTRIB-047`/`CTRIB-048`. That recovery proves the shape was reachable; the skill simply had no machinery to reach it.

## Why it slipped
The contributor pillar's first cornerstone was **"Reproduce-first"** — a bug-class entry gate. The whole front-of-loop that gsd-core (`open-gsd/gsd-core`) treats as the core discipline — **spec-phase** (a quantitative ambiguity gate on the WHAT), **SPIDR** decomposition, the **phase-researcher** open-questions-RESOLVED gate, the planner's **`must_haves`** falsifiable contract, and an **adversarial plan-checker** that runs before execution — had no executable home in this workspace. The only pre-code check on a contributor plan was a **human reading prose at GATE 1**, which makes the maintainer the QA gate — the exact failure `CLAUDE.md` forbids ("the maintainer is not the QA gate"). Under time pressure the run did what a bug-shaped loop does: skip to a single plan against an *assumed* feature shape.

## Rule that emerged
Three contributor gates, three universal playbooks, and one adversarial subagent, imported from gsd-core and adapted to this workspace (the ontology is the scout; GitHub issues + the CTRIB/`state/` artifacts are the tracker):
- **G-C17 — understand before you design.** The entry gate is shape-dependent: **reproduce-first** for a clear bug; **`playbooks/spec-gate.md`** for a feature or an ambiguous-correct-behaviour bug — the WHAT is scored to **ambiguity ≤ 0.20**, grounded in the ontology + live docs + `odd-sme`, before any HOW. Designing against an assumed feature shape is disqualifying.
- **G-C18 — decompose epics; never big-bang.** **`playbooks/decompose-epic.md`** SPIDR-splits an epic into independently-shippable, user-observable slices (never a horizontal/technical-layer split; 100 % requirement coverage), each its own run; the epic is never one `/contribute`.
- **G-C19 — falsifiable plan + adversarial plan-check.** **`playbooks/plan-contract.md`** makes the plan a `must_haves` contract (user-observable truths + artifacts + key_links/wiring), and **`.claude/agents/plan-checker.md`** (fresh context, assume-flawed, goal-backward) PASSES it before the human — coverage, wiring, and silent scope-reduction are machine-checked.

Wired into `.claude/skills/contribute/SKILL.md` (Phase A epic-classifier + spec-gate; Phase C `must_haves` + plan-check before GATE 1) and `pillars/contributor/{pillar,gates}.md`.

## Forcing question
"Is this one shippable PR with a falsifiable WHAT — or an epic I'm about to one-shot against an assumed feature shape, with no decomposition and no checked plan?"

## References
- #1825; `adrs/drafts/unified-asset-search.md` (rev 3); `prds/0003-unified-asset-search.md`; `state/roadmap-unified-search.md`; `state/search-overhaul-decomposition.md`; `contributor/CTRIB-047.md`, `contributor/CTRIB-048.md`.
- Source methodology: gsd-core (`open-gsd/gsd-core`) — `gsd-core/workflows/spec-phase.md`, `gsd-core/references/spidr-splitting.md`, `agents/gsd-phase-researcher.md`, `agents/gsd-planner.md`, `agents/gsd-plan-checker.md`.
- `CLAUDE.md` — "the maintainer is not the QA gate"; "understand before you act".
- Related: `LSN-035` (reuse/impact miss caught at the maintainer's review, not at planning); `LSN-031` (user-facing behaviour only visible on the running system); `LSN-013` (research must not be punted).
