---
pillar: <name>
file: cornerstones
status: template
---

# Cornerstones — <name> pillar

The cornerstones are the IA-level constraints the maintainer holds on every change in this pillar. They are upstream of gates: when a structural question arises, the maintainer resolves it by reading these cornerstones, not by analogy to the most recent change.

## How to author this file

For each recurring structural question in this pillar's authoring, write a cornerstone. Pattern:

- **Cornerstone N — Short title.** One paragraph stating the rule. One paragraph naming the failure mode this rule prevents. Cite `retrospectives/LSN-NNN-{slug}.md` for the canonical case if one exists.

The documentation pillar's cornerstones (`pillars/documentation/cornerstones.md`) are a worked example:
- Cornerstone 1 — Discoverability without context
- Cornerstone 2 — Aspect-level deep dive with single canonical source
- Cornerstone 3 — Configuration is a separate audience surface
- Cornerstone 4 — Three audiences, AI-maintained consistency
- Cornerstone 5 — One canonical home per content type

## Cornerstone 1 — <short title>

<Rule statement.>

<Failure mode this rule prevents. Cite retrospectives/LSN-NNN if applicable.>

## Cornerstone 2 — <short title>

...
