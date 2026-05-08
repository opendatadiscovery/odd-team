---
name: find-implicit-adrs
description: Run the adr-archaeologist reducer subagent over the per-node enrichment sidecars to surface architectural decisions the code embodies but that aren't yet captured in `adrs/`. Cross-references against existing ADRs to classify each candidate as `promote` (new), `extend-existing` (the ADR exists but doesn't cover the recurring pattern), `drift` (code disagrees with ADR), or `unique-load-bearing` (single-sidecar but architecturally significant). Emits `lineage/{repo}/implicit-adrs.md`.
argument-hint: [<repo>] [--show] [--diff]
allowed-tools: Read Grep Glob Bash(ls *) Bash(jq *) Bash(diff *)
---

# Find implicit ADRs (DOC-164 slice 8+)

Run the **adr-archaeologist** reducer to surface the architectural decisions ODD's codebase embodies but that aren't yet written down in `adrs/`. The reducer reads every per-node sidecar's `implicit_adrs` block, clusters by recurring pattern, cross-references against `adrs/` (drafts and accepted), and produces a ranked list of promotion / extension / drift / unique-load-bearing candidates the maintainer triages into actual `adrs/drafts/{slug}.md` files.

This is the third reducer in the agentic-code-ontology layer (per `adrs/drafts/agentic-code-ontology.md` rev 2). The first per-node enrichment slice was `/enrich`. The first reducer was `/concepts`. The second reducer was `/doc-gap-check`. `/find-implicit-adrs` (slice 8) consumes the same sidecars + the existing ADR set.

## Argument forms

| Form | Behaviour |
|---|---|
| `/find-implicit-adrs [<repo>]` | Default. Run `adr-archaeologist` against the sidecar set + `adrs/`. Produces or refreshes `lineage/{repo}/implicit-adrs.md`. |
| `/find-implicit-adrs --show [<repo>]` | Read-only. Print the existing report's summary (counts per category + severity, top-5 candidates). |
| `/find-implicit-adrs --diff [<repo>]` | Read-only. Compare existing report to a fresh run; surface the diff. |

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
EXISTING_ADRS_DIR_ABS: /home/.../adrs/
EXISTING_IMPLICIT_ADRS: <verbatim or "(none)">
SUBSTRATE_LAST_SCAN_COMMIT: <from manifest.yaml>
TARGET_PATH: lineage/{repo}/implicit-adrs.md
SIDECAR_COUNT: <N>
```

The subagent's tool surface per its frontmatter: `Read, Glob, Grep, Write`. It writes the report and replies with `Wrote: ...` + `Candidates: ...`.

### 4. Validate

After completion:
- Confirm `lineage/{repo}/implicit-adrs.md` exists.
- Parse YAML frontmatter (`generated_at`, `total_candidates`, etc.).
- Verify each candidate has `category`, `support_count`, `surfaced_by`, `decision_statement`, `evidence`, `proposed_action`, `severity`.
- Spot-check 3-5 candidates: do their `surfaced_by` sidecar references resolve? Are the decision_statements non-trivial?

### 5. Report

- Report path
- Counts: `<P> promote / <E> extend-existing / <D> drift / <U> unique-load-bearing = <N> total`
- Severity: `<H> HIGH / <M> MEDIUM / <L> LOW`
- Top-5 HIGH candidates (one-liners with candidate IDs)
- Drift count (drift findings warrant immediate maintainer attention — code/ADR disagreement)
- Suggested next: `/test-coverage` (slice 8b) or `/code-walk <feature>` (slice 9 — feature-advisor) once implicit ADRs are reviewed.

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
