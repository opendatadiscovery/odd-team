---
artefact: sme-consultations
repo: odd-platform
purpose: |
  On-demand Subject Matter Expert (SME) consultation notes — per APPROACH.md §19.
  Each file answers one specific domain question raised during feature
  extraction, requirement assumption, or feature reflection. The notes are
  flat reference material — dated, citable, source-grounded.
---

# SME consultations — odd-platform

Per `APPROACH.md` §19 (rev 11). Each file in `detail/` is one consultation produced by the `odd-sme` subagent (`.claude/agents/odd-sme.md`).

## How to read a consultation note

Each `YYYY-MM-DD-{slug}.md` carries:

- **Frontmatter**: `consulted_at`, `consulted_by` (which caller asked), `consultation_question`, `confidence_overall`.
- **TL;DR**: 2-4 sentences with the bottom-line answer.
- **Question scope**: what the caller asked + sub-questions + explicit out-of-scope.
- **Domain plausibility / Industry vocabulary / Implicit requirements / Operator workflows / Competitor comparison**: depending on the consultation archetype (one or two of these will be load-bearing per note).
- **Recommended framing**: a one-sentence product framing the caller can incorporate directly.
- **Caveats and uncertainty**: explicit limits of the consultation, things marked `confidence: LOW`.
- **Citations**: every URL + workspace file referenced, with `last_verified_status` and timestamp.

## When to consult, when not to

Spawn the SME when:

- A shoebox thread is approaching graduation and the maintainer / feature-flow-builder wants to validate the hypothesis against domain expectations.
- A feature-reflector is generating user-facing hypotheses and needs industry-vocabulary alignment.
- A file-analyser encounters a node whose product purpose is unclear and the hypothesis fits a recognizable data-catalog pattern.
- The maintainer is planning a new feature and wants to ground the framing in real operator workflows + competitor parallels.

Do NOT spawn the SME for:

- Pure code-level questions (what does this method do? — that's file-analyser's job).
- Documentation drift (is this URL stale? — that's doc-gap-finder's job).
- Cross-sidecar emergence (where does this concept recur? — that's concept-merger's job).
- Bug filing (what's the right severity? — that's the maintainer's call).
- Anything answerable from `concepts.yaml` + `system-mission.md` alone — read those first.

## Freshness rule

Consultations are **point-in-time observations**, not live state. Competitor pages update; ODD's own docs evolve; operator-workflow conventions drift. If a consultation note is >30 days old and the question is re-raised, the caller spawns a fresh consultation rather than reusing the stale note. The stale note remains for audit-trail purposes.

## What goes here, what does NOT go here

| Goes here | Does NOT go here |
|---|---|
| Domain plausibility checks for hypotheses | Backlog items (file in `backlog/` or via `/log-issue`) |
| Industry vocabulary alignments | ADR-worthy decisions (file in `adrs/drafts/`) |
| Implicit-requirement enumerations | Per-node enrichment (file at `lineage/{repo}/understanding/`) |
| Operator-workflow grounding | Cross-sidecar concepts (file in `concepts/detail/`) |
| Competitor comparisons (with citations) | Finalized feature flows (file at `feature-flows/detail/F-NNN.yaml`) |

## Directory layout

```
lineage/odd-platform/sme-consultations/
├── README.md                                       (this file)
└── detail/
    └── YYYY-MM-DD-{slug}.md                        (one file per consultation; dated)
```

`detail/` is created on first consultation (not pre-created with a `.gitkeep` — the directory's first use commits its existence).

## Cross-references

- `APPROACH.md` §19 — the SME consultation pattern (universal); §13 — Layer 0 (system mission anchor) — your primary internal source.
- `.claude/agents/odd-sme.md` — the ODD-domain SME contract.
- `lineage/odd-platform/system-mission.md` — pillars, audiences, architectural pillars.
- `lineage/odd-platform/concepts.yaml` — canonical vocabulary.
