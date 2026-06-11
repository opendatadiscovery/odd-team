---
pillar: adr
status: active
since: 2026-05-30
---

# ADR Pillar — the bar

## Why this pillar exists

The ODD codebase embodies dozens of architecturally-significant decisions that were never written down — backbone choices a new contributor has to reverse-engineer from the code before they can safely change anything. The adr-archaeologist surfaces those as `ADR-CANDIDATE-NNN`; this pillar turns the ratified ones into **published** Architecture Decision Records under Developer Guides → "Architectural Decision Log", so the WHY of the platform is captured once, descriptively, with code evidence — and referenced from the ontology so the graph knows which decisions govern which code.

A published ADR is read by contributors deciding whether a change is safe. A wrong or invented ADR is worse than none: it asserts intent the core team never had and sends the reader confidently in the wrong direction.

## The bar: a contributor can trust it to explain WHY

Every published ADR holds the standard a Principal engineer would hold on a decision log they signed. Concretely:

- **Descriptive, not prescriptive** — reconstructed from the code, never decreed (Cornerstone 1 / Gate A3). The voice is "the platform does X because Y, as `<file:line>` shows."
- **Wisdom-tested** — only candidates that pass the adr-archaeologist 3-question test become ADRs; gaps never do (Cornerstone 2 / Gate A1).
- **Code-evidenced** — every claim cites the `file:line` that embodies it, re-verified against the substrate commit (Cornerstone 3 / Gate A2).
- **Homed once** — one ADR per page under the decision log; never conflated with the workspace's internal methodology ADRs (Cornerstone 4).
- **Human-ratified** — published only after the maintainer ratifies; the ontology edge is recorded after the fact, never auto-created (Cornerstone 5).
- **Published** — verified live on the site, same GitBook hazards as any doc page (Gate 8 + the ≤200-char / YAML-parse rules). An ADR-log page describing a decision whose behaviour is not yet in a published odd-platform release rides the documentation release train like any release-gated doc (`adrs/drafts/release-train-doc-gating.md`).

## Success signals

- A new contributor reads an ADR, follows its Evidence citations to the code, and the code matches the decision exactly.
- Every published ADR carries complete ontology frontmatter — the extractor projects the `ADR` node + `PROMOTED_TO` / `REALISES` / `SUPERSEDED_BY` edges with no manual fixup.
- The decision log reads as a coherent record of how the platform got the shape it has, not a pile of speculation.
- A regenerated candidate never overwrites a ratified, published decision (Cornerstone 6).

## Failure signals (any one means the bar slipped)

- An ADR makes a claim with no `file:line` evidence, or evidence that no longer matches the current code.
- A gap / missing-feature is published as an ADR (it belongs in refactoring-scopes / backlog / an upstream issue).
- Prescriptive language ("we must", "going forward we will") decreeing architecture the core team never ratified.
- A `PROMOTED_TO` edge auto-created from a candidate before a human ratified it.
- Workspace-internal jargon (`ADR-CANDIDATE-NNN`, sidecar, agent names, `REFACTOR-NNN`) printed on the published page.
- A published ADR conflated with an `odd-team/adrs/` methodology decision.

## What authoring sessions load

`CLAUDE.md` + this file + `cornerstones.md` + `canonical-homes.md` + `gates.md` + `authoring.md`. The case-law for each gate lives in `retrospectives/`.

## Scope

This pillar governs the **Architectural Decision Log** under `../documentation/docs/developer-guides/architecture-decision-log/` and the ontology references to it. It does not govern the candidate-generation step (that is the adr-archaeologist's contract) nor the workspace's internal methodology ADRs in `odd-team/adrs/` (those are about the ontology method, not the platform). Security-exploit findings never become ADRs — they route through the issues / responsible-disclosure flow, as in the documentation pillar.
