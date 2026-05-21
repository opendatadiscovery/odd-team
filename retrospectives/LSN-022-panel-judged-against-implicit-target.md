---
id: LSN-022
title: The Adversarial Review Panel judged the methodology against an implicit, undefined "target"
date: 2026-05-21
domain: ontology / methodology-governance
severity: high
gates_informed:
  - APPROACH.md §16.2 — the explicit target
  - APPROACH.md §5 Rule 16
  - lineage/{repo}/meta-reviews/target.md
  - .claude/agents/panel-*.md — Rule 0
status: closed
---

# LSN-022: The panel judged against an implicit "target"

## What happened

The Adversarial Review Panel — itself the fix for LSN-021, shipped 2026-05-21 — ran its maiden review and produced a verdict whose central sentence read: *"The methodology is fundamentally sound and is the right architecture for **the target**."* On reading it, the maintainer asked the obvious question — *what target?* — and found there was no answer on disk. "The target" had never been written down. Each of the six expert agents and the chair judged *"is the methodology on track to hit the target"* against its own implicit, unstated notion, synthesised privately from `APPROACH.md` §1, the `CLAUDE.md` mission, and session context. The chair did draft a 'definition-of-done' — but only on the maiden run, only *after* the six experts had already finished assessing, and buried at the foot of the report; it was never an input any reviewer anchored on.

## Why it slipped

The panel was built to catch exactly this failure — an implicit gestalt every reader fills in differently — and committed it about itself. It is a direct recurrence of the methodology's own rev-3 failure: Layers 1-5 had assumed the agent knew what "feature" meant, and the fix was to make the mission explicit (`system-mission.md`, Layer 0, §13). One level up, the panel's reviewers assumed they knew what "the target" meant. Every panel agent prompt and the chair prompt used "target" / "on track to hit the target" without ever pointing at a defined artefact. "The target" is a *fluent* — a phrase that sounds load-bearing while carrying no shared, checkable content — and a verdict measured against a fluent is itself a fluent. Nobody had written the rule "name the yardstick before you grade against it" because the yardstick felt self-evident; it was not.

## Rule that emerged

The target becomes an **explicit, written, versioned, maintainer-improvable artefact**. For ODD: `lineage/{repo}/meta-reviews/target.md` — a one-line mission, a set of measurable "hit" conditions, an "on-track vs hit" split, a per-axis map; maintainer-owned and refined over time. Generalized + customization instructions: `APPROACH.md` §16.2 (and §16.6 bootstrapping). Every panel expert gains **Rule 0** — read the explicit target first, and open the Phase-1 report with a `target_lens` block reflecting the target through that expert's own axis; assess every score and finding against that explicit bar. The chair gains a Rule 0 + a `## target` report section that reproduces the yardstick *before* the verdict. The `/panel` skill passes `TARGET_PATH` to every agent. An implicit target is no longer reachable: a reviewer handed no `target.md` flags its absence as a HIGH finding.

## Forcing question

Before judging "on track to hit the target" — *where is the target written down, who owns it, and did this reviewer read it first?*

## References

- `lineage/odd-platform/meta-reviews/target.md` — the explicit target artefact (the rule's home for ODD).
- `APPROACH.md` §16.2 (the explicit target, generalized + customization) + §5 Rule 16 + the rev-6 history entry.
- `.claude/agents/panel-{adversary,methodologist,economist,engineer,practitioner,skeptic,chair}.md` — Rule 0.
- `.claude/skills/panel/SKILL.md` — passes `TARGET_PATH` to every agent.
- `lineage/odd-platform/meta-reviews/2026-05-21/panel-report.md` — the maiden report whose "the target" sentence exposed the gap.
- Related: `LSN-021` (the panel itself — LSN-022 is a flaw in its maiden form); `APPROACH.md` §13 (the rev-3 `system-mission.md` fix — the same implicit-gestalt class, one layer down).
