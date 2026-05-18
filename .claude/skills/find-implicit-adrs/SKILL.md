---
name: find-implicit-adrs
description: Run the adr-archaeologist reducer subagent over the per-node enrichment sidecars + concepts.yaml + existing adrs/. Applies the 3-question wisdom test (per Nygard 2011 / adr.github.io / AWS Prescriptive Guidance) to distinguish DELIBERATE architectural decisions from IMPLEMENTATION GAPS. Emits TWO artefacts: `lineage/{repo}/implicit-adrs.md` (real ADR candidates only — backbone decisions, classified as promote / extend-existing / drift / unique-load-bearing) AND `lineage/{repo}/refactoring-scopes.md` (gap-shaped findings — absent features, missing validation, buggy defaults — actionable as DOC-NNN / TEST-NNN / SEC-NNN / PERF-NNN backlog items, NOT as ADRs).
argument-hint: [<repo>] [--show] [--diff]
allowed-tools: Read Grep Glob Bash(ls *) Bash(jq *) Bash(diff *)
---

# Find implicit ADRs (DOC-164 slice 8+)

Run the **adr-archaeologist** reducer to surface the architectural decisions ODD's codebase embodies but that aren't yet written down in `adrs/` AND, critically, to separate them from implementation gaps that the substrate also surfaces. The reducer reads every per-node sidecar's `implicit_adrs` + `bugs_limitations_corner_cases` blocks + concepts.yaml's security/performance aggregates, applies the **3-question wisdom test** to each candidate (per Nygard 2011 / adr.github.io / AWS Prescriptive Guidance) to determine whether it qualifies as an ADR (deliberate architectural decision with rationale + structural impact) or as a refactoring scope (gap-shaped finding that doesn't belong in the ADR catalog), and produces two artefacts ranked + classified accordingly.

The 3-question wisdom test (see `.claude/agents/adr-archaeologist.md` Rule 0 for full text):
1. Is the absence (or pattern) intentional, with a stated rationale?
2. Does it have structural impact, or is it a missing feature within an existing structure?
3. Would adding the absent thing be refactoring or a structural change?

If 2 of 3 questions lean "gap" → `refactoring-scopes.md`. Otherwise → `implicit-adrs.md`.

**Why this matters (case-law):** slice 8's first run promoted "GenAI requests not authenticated" as ADR-005. The maintainer reviewed: that's not an architectural decision — that's a limited/buggy implementation. Polluting the ADR catalog with gap-shaped findings burns trust in the catalog as a decision log. Refactoring scopes are valuable but they have their own home. See `~/.claude/projects/.../memory/feedback_adr_vs_refactoring_scope.md` for the rule.

This is the third reducer in the agentic-code-ontology layer (per `adrs/drafts/agentic-code-ontology.md` rev 2). The first per-node enrichment slice was `/enrich`. The first reducer was `/concepts`. The second reducer was `/doc-gap-check`. `/find-implicit-adrs` (slice 8) consumes the same sidecars + concepts.yaml + the existing ADR set.

## Argument forms

| Form | Behaviour |
|---|---|
| `/find-implicit-adrs [<repo>]` | Default. Run `adr-archaeologist` in **incremental mode** (per `playbooks/reducer-incremental-mode.md`) against the sidecar set + `adrs/`. Refreshes `lineage/{repo}/implicit-adrs.md` AND `lineage/{repo}/refactoring-scopes.md` by appending+annotating only the sidecars whose `node_id` is not yet in the prior artefacts' `processed_node_ids`. |
| `/find-implicit-adrs --full [<repo>]` | Forces FULL mode — re-reads every sidecar and regenerates both artefacts from scratch. Use when prior artefacts are corrupt, `prompt_version` bumped, or after a wisdom-test re-calibration. |
| `/find-implicit-adrs --show [<repo>]` | Read-only. Print the existing report's summary (counts per category + severity, top-5 candidates). |
| `/find-implicit-adrs --diff [<repo>]` | Read-only. Compare existing report to a fresh run; surface the diff. |

## Incremental input resolution

Before spawning the subagent in default (`incremental`) mode, the skill computes:

- `PROCESSED_NODE_IDS` — UNION of the `processed_node_ids:` frontmatter from BOTH `implicit-adrs.md` AND `refactoring-scopes.md`. If either field is missing, fall back to `--full`.
- `NEW_SIDECAR_FILES` — sidecars whose `node_id` is not in `PROCESSED_NODE_IDS`. Empty set → exit.
- `PRIOR_HEAD_ADRS` — one line per existing ADR candidate from `implicit-adrs.md`, derived via `grep -E '^## ADR-CANDIDATE-'` + severity tag. Compact-head shape per the playbook.
- `PRIOR_HEAD_SCOPES` — one line per existing refactoring scope from `refactoring-scopes.md`, derived via `grep -E '^### REFACTOR-'` + severity + category tags.
- `CURATED_ENTRIES` — verbatim Markdown of every entry flagged `maintainer_curated: true` across both artefacts.
- `NEXT_AVAILABLE_ID` — max existing `ADR-CANDIDATE-NNN` + 1; max existing `REFACTOR-NNN` + 1.

These get passed to the subagent in place of the legacy "full prior artefact" block.

## Prerequisites

- `lineage/{repo}/understanding/{slug}.md` sidecars exist (i.e. `/enrich` has been run).
- `adrs/` directory exists (drafts + accepted ADRs).
- `concepts.yaml` exists (recommended — the reducer cross-references concept-level patterns).

## Protocol

### 1. Orient

Read these (skip if loaded this session):
- `CLAUDE.md` — quality bar
- `adrs/drafts/agentic-code-ontology.md` — the layered ADR + reducer pattern
- `.claude/agents/adr-archaeologist.md` — the subagent's system prompt

### 2. Resolve inputs

- **Sidecar set**: `Glob` `lineage/{repo}/understanding/*.md`. Confirm at least one exists; otherwise report "no sidecars — run `/enrich` first" and exit.
- **Existing ADRs**: `Glob` `adrs/**/*.md`. Build an index of titles + Decision-section headlines.
- **Existing implicit-adrs.md**: capture maintainer-curated entries (preserve verbatim).
- **Substrate state**: `last_scan_commit` from manifest.yaml.

### 3. Spawn the adr-archaeologist subagent

Invoke via `Agent` tool with `subagent_type: adr-archaeologist`. Construct the prompt:

```
REPO: <repo>
WORKSPACE_ROOT_ABS: <absolute>
SIDECAR_DIR_ABS: /home/.../lineage/{repo}/understanding/
CONCEPTS_YAML_PATH: /home/.../lineage/{repo}/concepts.yaml
EXISTING_ADRS_DIR_ABS: /home/.../adrs/
EXISTING_IMPLICIT_ADRS: <verbatim or "(none)">
EXISTING_REFACTORING_SCOPES: <verbatim or "(none)">
SUBSTRATE_LAST_SCAN_COMMIT: <from manifest.yaml>
TARGET_ADR_PATH: lineage/{repo}/implicit-adrs.md
TARGET_SCOPES_PATH: lineage/{repo}/refactoring-scopes.md
SIDECAR_COUNT: <N>
```

The subagent's tool surface per its frontmatter: `Read, Glob, Grep, Write`. It writes BOTH files and replies with `Wrote ADRs: ...` + `Wrote scopes: ...` + `Summary: ...`.

### 4. Validate

After completion:
- Confirm BOTH `lineage/{repo}/implicit-adrs.md` AND `lineage/{repo}/refactoring-scopes.md` exist.
- Parse YAML frontmatter on each.
- Verify each ADR candidate has `category`, `support_count`, `surfaced_by`, `decision_statement`, `evidence`, `proposed_action`, `severity`.
- Verify each refactoring scope has `category`, `surfaced_by`, `statement`, `evidence`, `proposed_remedy`, `severity`, `suggested_backlog_grouping`.
- **Spot-check 3-5 ADR candidates against the wisdom test**: read the candidate's evidence; mentally apply the 3 questions; if 2 of 3 lean "gap," the candidate is misclassified — flag for review and ask the subagent to reclassify (or surface to maintainer for verdict).
- Spot-check 3-5 refactoring scopes: do they cite real sidecar lines? Is the proposed_remedy actionable?
- Verify NO candidate appears in both files.

### 5. Report

- Report paths (both files)
- ADR counts: `<P> promote / <E> extend-existing / <D> drift / <U> unique-load-bearing = <Na> total ADR candidates (<H> HIGH, <M> MEDIUM, <L> LOW)`
- Refactoring scope counts: `<Ns> total scopes (<C> CRITICAL, <H> HIGH, <M> MEDIUM, <L> LOW); <K> candidates failed the wisdom test and were reclassified from ADR to scope`
- Top-5 HIGH ADR candidates + Top-5 CRITICAL refactoring scopes (one-liners)
- Drift count (drift ADRs warrant immediate attention — code/ADR disagreement)
- Cross-references between files (where a refactoring scope deviates from a co-surfaced ADR)
- Suggested next: maintainer triages ADR candidates into `adrs/drafts/` AND triages refactoring scopes into backlog items (DOC-NNN / TEST-NNN / SEC-NNN / PERF-NNN) or sprint groupings ("GenAI hardening sprint", "Authorization audit batch", etc.).

## Rules

- **Cross-reference, don't duplicate.** Every candidate is checked against `adrs/`. A `promote` candidate must NOT match an existing ADR's title or decision-statement.
- **Severity is anchored.** HIGH = load-bearing decision; MEDIUM = pattern-shaping; LOW = stylistic. Don't inflate.
- **Drift findings get extra scrutiny.** A `drift` finding (existing ADR vs current code disagreement) requires citation of both the ADR section AND the contradicting sidecars. The skill rejects drift findings with thin evidence.
- **Single-sidecar load-bearing decisions are valid.** Recurrence is a signal, not a requirement. AlertManager's "operator-delegated network auth" is HIGH-severity even from one sidecar.
- **Maintainer-curated preservation.** `maintainer_curated: true` entries survive verbatim across refreshes.

## Cross-references

- Subagent: `.claude/agents/adr-archaeologist.md`
- Inputs: `lineage/{repo}/understanding/*.md` + `adrs/**/*.md`
- Output: `lineage/{repo}/implicit-adrs.md`
- ADR: `adrs/drafts/agentic-code-ontology.md` rev 2 (slice 8 in slice progression)
