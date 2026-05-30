---
directory: pillars/adr
purpose: shepherd reverse-engineered ADR candidates into published Architecture Decision Records
status: active
---

# ADR Pillar

## What this pillar is

The ADR pillar governs the process that turns reverse-engineered **implicit-ADR candidates** into **published Architecture Decision Records** on `docs.opendatadiscovery.org` (Developer Guides → Architectural Decision Log) and references them in the ontology. The candidates are surfaced as `ADR-CANDIDATE-NNN` in `lineage/{repo}/implicit-adrs.md` by the adr-archaeologist subagent; this pillar shepherds the ones a maintainer ratifies into descriptive, code-evidenced ADRs reviewed to the documentation pillar's bar, and records the ontology edges *after* publication.

A published ADR is a decision record a new ODD contributor can trust to explain WHY the platform is built the way it is, with the `file:line` evidence to verify it.

## Session boot — what to load

When working an ADR item (authoring or reviewing), load in this order:

1. **`CLAUDE.md`** (workspace root) — the universal framework: identity, mission, workflow phases, universal gates, skill protocol.
2. **`pillars/adr/pillar.md`** — this pillar's bar, success/failure signals.
3. **`pillars/adr/cornerstones.md`** — Cornerstones 1-6 (the non-negotiable invariants).
4. **`pillars/adr/canonical-homes.md`** — the content-type homing table + the ontology-contract frontmatter schema.
5. **`pillars/adr/gates.md`** — the universal gates (by reference) + ADR-specific Gates A1-A4 + the Pre-authoring stance check.
6. **`pillars/adr/authoring.md`** — the published-ADR page template + GitBook rules + the `Sources:` footer format.

## The source and the home

- **Candidate source (not published):** `lineage/{repo}/implicit-adrs.md` — `ADR-CANDIDATE-NNN` entries produced by the adr-archaeologist (`.claude/agents/adr-archaeologist.md`).
- **Canonical home (published):** `docs/developer-guides/architecture-decision-log/ADR-NNNN-{slug}.md` in `../documentation`, with the log index at `.../architecture-decision-log/README.md`.

## The case-law

Gate violations and the lessons that produced these rules live in `retrospectives/` as `LSN-NNN-{slug}.md`. Cite them by ID in gates; never inline a full case in a pillar file.

## Related

- The documentation pillar (`pillars/documentation/`) — published ADRs are doc pages, so its GitBook hazards (≤200-char description, no `: ` YAML hazard, live-site verification) apply.
- The playbooks the gates invoke: `playbooks/*.md`.
- The internal methodology ADRs (`odd-team/adrs/`, about the ontology method) — a **distinct** concept; never conflated with published platform ADRs (Cornerstone 4).
