---
trigger: any reducer subagent (concept-merger / adr-archaeologist / doc-gap-finder / test-coverage-mapper) is about to refresh its artefact after a batch of new sidecars has landed
applies_to: cross-pillar — universal to the agentic-code-ontology layer
goal: cut per-batch reducer-token consumption ~40-60% by reading new sidecars + a compact head-of-prior, not the full prior artefact
case_law: 2026-05-12 batch F — test-coverage-mapper agent hit a stream idle timeout BEFORE writing (investigator-log.md:14-16). Cause: 45 sidecars + 7103-line prior test-map.yaml + 5197-line prior concepts.yaml = reducer session budget exhausted. Incremental mode prevents the recurrence.
---

# Reducer incremental mode — PROTOCOL

## When to fire

Default for every refresh of `lineage/{repo}/{concepts.yaml | implicit-adrs.md | refactoring-scopes.md | doc-gaps.md | test-map.yaml}` after a batch of `/enrich` invocations has landed new sidecars. Skipped (falls back to FULL) only when:

- Prior artefact is absent or corrupt.
- The reducer's `prompt_version` has bumped MAJOR or MINOR.
- The maintainer passes `--full`.
- The prior artefact lacks the `processed_node_ids:` frontmatter field (pre-v0.2 reducer output — first run after this playbook lands triggers a one-shot FULL backfill).

## Inputs (what the orchestrating skill passes to the subagent)

```
MODE: incremental
NEW_SIDECAR_FILES: <newline-separated paths — sidecars whose node_id is NOT in PROCESSED_NODE_IDS>
PROCESSED_NODE_IDS: <newline-separated node IDs the prior artefact already considered>
PRIOR_HEAD: <compact summary of prior artefact — see §Compact-head shape below>
CURATED_ENTRIES: <verbatim content of entries flagged `maintainer_curated: true` in the prior artefact>
NEXT_AVAILABLE_ID: <e.g., DOC-GAP-096 / ADR-CANDIDATE-062 / TEST-GAP-253 — derived from PRIOR_HEAD>
PRIOR_ARTEFACT_PATH: <where to write — the reducer reads the prior body verbatim and APPENDS+ANNOTATES>
```

Inputs unchanged from FULL mode: `REPO`, `WORKSPACE_ROOT_ABS`, `SIDECAR_DIR_ABS`, canonical-vocab path / live-URL inputs.

## Compact-head shape (per reducer)

| Reducer | PRIOR_HEAD body |
|---|---|
| concept-merger | One line per concept: `{category}/{slug}: {canonical_name} (contributing_node_count, sec_overall, perf_overall)`. ~84 lines for ODD's current catalog vs 5197 lines of the full catalog. |
| adr-archaeologist | One line per ADR candidate: `ADR-CANDIDATE-NNN [SEVERITY] {title} (surfaced_by N sidecars)`. Plus one line per refactoring scope: `REFACTOR-NNN [SEVERITY] {category}/{title}`. |
| doc-gap-finder | One line per finding: `DOC-GAP-NNN [SEVERITY] [CATEGORY] {title}`. ~95 lines vs 1297 of the full artefact. |
| test-coverage-mapper | One line per gap: `TEST-GAP-NNN [CRITICALITY] [CATEGORY] {behaviour-snippet}`. ~252 lines vs 7103 of the full YAML. |

The compact head is built by the orchestrating skill via a simple grep/awk. Each reducer's output schema declares the regex shape so the skill can extract it deterministically.

## Subagent responsibilities under incremental mode

1. **Read NEW_SIDECAR_FILES end-to-end.** These contribute net-new content; PROCESSED_NODE_IDS are out of scope.
2. **Treat PRIOR_HEAD as the ID-space ledger.** Do NOT re-derive existing entries' bodies. Reuse their IDs when a new sidecar strengthens them; mint NEXT_AVAILABLE_ID + 1, +2, … for genuinely new entries.
3. **Preserve CURATED_ENTRIES verbatim.** A `maintainer_curated: true` entry's prose is the maintainer's voice. The reducer may update the entry's auto-derived fields (`contributing_files`, `nodes`, `evidence`) when new sidecars contribute; it must not rewrite the prose.
4. **Emit a STRENGTHENS annotation when a new sidecar extends an existing entry.** Format: `STRENGTHENS {id} (added surfaced_by: {sidecar-slug})` in a per-batch refresh note at the head of the artefact.
5. **Append new entries; never rewrite existing ones.** The prior artefact body is read by the orchestrating skill and concatenated with the reducer's delta. The reducer outputs ONLY the delta plus the updated frontmatter.

## Output shape (the delta the reducer writes)

```yaml
---
processed_node_ids: <newline-separated — UNION of prior PROCESSED_NODE_IDS + the new sidecar IDs>
generated_at: <ISO timestamp>
generated_at_commit: <git rev-parse HEAD>
sidecar_count: <updated>
prompt_version: <same as prior unless schema bumped>
batch_refresh_note: |
  <one paragraph: which sidecars landed this batch, how many new entries,
   how many existing entries strengthened, the highest-leverage finding>
---

## Top 20 by leverage  ← per the Top-20-head convention; refreshed each batch

<exactly 20 ranked entries: id, severity, triangulation_count, one-line title>
<ranked by (triangulation_count × severity_weight); the rest live in the tail>

## What's here

<unchanged — short prose explanation of the artefact's purpose>

## Summary

<unchanged>

## Refresh note (batch <batch_id>)

<the reducer's batch-specific delta narrative>

## Findings (existing — verbatim copy from prior; orchestrator concatenates)

<the orchestrator handles this section by copying from the prior artefact;
 the reducer does not re-emit it>

## New entries (this batch)

<appended: the NEXT_AVAILABLE_ID-numbered entries derived from NEW_SIDECAR_FILES>
```

## Top-20-head section convention (universal)

Every reducer artefact carries a `## Top 20 by leverage` section IMMEDIATELY after the frontmatter. Ranking is `triangulation_count × severity_weight` where:

- `triangulation_count` = number of distinct sidecars contributing to the finding (1 for a single-sidecar finding; N for a cross-batch pattern)
- `severity_weight`: `HIGH=4, MEDIUM=2, LOW=1, CRITICAL=8`

The maintainer reads 20 lines and absorbs the batch's highest-leverage findings without scrolling. The rest of the artefact (full entries, evidence, cross-references) lives in the tail for SQL-like drill-down.

A finding leaves the Top 20 head when newer findings outrank it. The Top 20 is auto-recomputed each batch; it is NOT maintainer-curated.

## Why this is mechanical, not heuristic

- `NEW_SIDECAR_FILES` is set-difference: `Glob(*.md) − PROCESSED_NODE_IDS`. No judgment call.
- `NEXT_AVAILABLE_ID` is max-existing + 1. No judgment call.
- `PRIOR_HEAD` is a grep + awk. No judgment call.
- `CURATED_ENTRIES` is grep for `maintainer_curated: true`. No judgment call.

The reducer's judgment lives entirely in: (a) deciding which new entries strengthen existing IDs vs mint new ones, (b) writing the Refresh note narrative. Everything else is deterministic.

## Exit criteria

- The refreshed artefact has Top 20 head, Refresh note, and new entries.
- `processed_node_ids` in frontmatter is the UNION of prior + new (every sidecar accounted for).
- No existing entry's prose was rewritten (audit: diff prior_body vs new_body for the existing-entries section should be ONLY appended `STRENGTHENS` annotations and updated auto-derived fields).
- The Top 20 head re-ranks deterministically (same triangulation_count × severity_weight everywhere; ties broken by ID).

## Fail-modes (escalate, don't paper over)

- Sidecar in NEW_SIDECAR_FILES references a node-id that already appears in PROCESSED_NODE_IDS → the orchestrating skill mis-computed the diff; abort + ask maintainer to re-run with `--full`.
- The reducer wants to rewrite an existing entry's prose → block; the entry is either maintainer-curated (preserve verbatim) or the reducer should emit a new entry that supersedes the old (with explicit cross-reference).
- PRIOR_HEAD parsing yields NEXT_AVAILABLE_ID lower than the highest ID in the prior artefact → the artefact has been hand-edited inconsistently; report + ask maintainer to triage.

## Cross-references

- `APPROACH.md` §9 — cost discipline (this playbook is the executable form)
- `adrs/drafts/agentic-code-ontology.md` revision 2 — reducer pattern + Top-20-head convention
- `.claude/agents/concept-merger.md` / `adr-archaeologist.md` / `doc-gap-finder.md` / `test-coverage-mapper.md` — the subagents that consume MODE+NEW_SIDECAR_FILES+PRIOR_HEAD+CURATED_ENTRIES
- `lineage/odd-platform/investigator-log.md:14-16` (batch F test-coverage-mapper timeout) — the case-law trigger
