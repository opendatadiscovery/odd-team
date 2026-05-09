---
name: code-walk
description: Run the feature-advisor query-time subagent over the full ontology to produce a structured impact assessment for a proposed feature or change. Maintainer asks "I want to add X — what's affected?" The agent reads sidecars + concepts.yaml + implicit-adrs.md + refactoring-scopes.md + doc-gaps.md + test-map.yaml + existing adrs/ + live ODD docs (via WebFetch), and emits `lineage/{repo}/feature-walks/{date}-{slug}.md` — a planning aid the maintainer reads BEFORE writing code.
argument-hint: ["<question>"] [--repo <repo>] | --show <slug-or-date> | --list [<repo>]
allowed-tools: Read Grep Glob Bash(date *) Bash(ls *)
---

# /code-walk — query-time impact walk (DOC-164 slice 9)

The first **query-time** skill in the agentic-code-ontology layer. Where slices 5-8 BUILT the ontology, slice 9 USES it: the maintainer types a free-form question about a proposed feature or change, the `feature-advisor` subagent reads the full ontology + live docs, and emits a structured impact assessment.

A walk answers: *what concepts does this touch, what implicit / explicit ADRs constrain the design, what refactoring scopes overlap, what doc gaps does it open or close, what test gaps does it open or close, and what's the rough implementation skeleton anchored on existing patterns.*

The walk is a **planning aid**, not an implementation. The maintainer reads it, applies judgment, decides what to do next (implement / scope down / draft an ADR / log a refactoring sprint).

## Argument forms

| Form | Behaviour |
|---|---|
| `/code-walk "<question>" [--repo <repo>]` | Default. Spawn feature-advisor on the question. Produces `lineage/{repo}/feature-walks/{date}-{slug}.md`. Repo defaults to `odd-platform`. |
| `/code-walk` (no args) | Prompt maintainer for the question via `AskUserQuestion`, then proceed as above. |
| `/code-walk --show <slug-or-date>` | Read-only. Print an existing walk from `lineage/{repo}/feature-walks/`. |
| `/code-walk --list [<repo>]` | Read-only. List all walks for the repo with date + slug + maintainer_question first line. |

## Prerequisites

- `lineage/{repo}/understanding/{slug}.md` sidecars exist (i.e. `/enrich` has been run).
- `lineage/{repo}/concepts.yaml` exists (i.e. `/concepts` has been run).
- `lineage/{repo}/implicit-adrs.md` exists (i.e. `/find-implicit-adrs` has been run).
- `lineage/{repo}/refactoring-scopes.md` exists (i.e. `/find-implicit-adrs` slice-8-fix has been run).
- `lineage/{repo}/doc-gaps.md` exists (i.e. `/doc-gap-check` has been run) — recommended.
- `lineage/{repo}/test-map.yaml` exists (i.e. `/test-coverage` has been run) — recommended.
- `adrs/` directory exists (drafts + accepted ADRs).

If a recommended artefact is missing, the walk still proceeds but flags the absence in `ontology_coverage_gaps`.

## Protocol

### 1. Orient

Read these (skip if loaded this session):
- `CLAUDE.md` — quality bar
- `adrs/drafts/agentic-code-ontology.md` — slice 9 in slice progression
- `.claude/agents/feature-advisor.md` — the subagent's system prompt

### 2. Capture the question

If the maintainer passed the question as the first argument, use it verbatim.

If no argument was passed, use `AskUserQuestion`:

> 1. "What feature or change do you want to walk? Free-form. The agent reads the full ontology and produces a structured impact assessment. Examples: 'I want to add per-data-entity alert recipient routing' or 'I'm thinking about adding rate-limiting to the GenAI proxy — what's affected?'"

### 3. Resolve inputs

Derive these (the skill does this; the agent receives them as inputs):

- **REPO**: from `--repo` flag or default `odd-platform`.
- **WORKSPACE_ROOT_ABS**: `pwd`.
- **REPO_ROOT_ABS**: `<workspace>/../{repo}` (the target repo).
- **SIDECAR_DIR_ABS**: `<workspace>/lineage/{repo}/understanding/`. Confirm at least one sidecar exists; otherwise abort with "no sidecars — run `/enrich` first."
- **CONCEPTS_YAML_PATH**: `<workspace>/lineage/{repo}/concepts.yaml`. Confirm exists; otherwise abort with "no concepts — run `/concepts` first."
- **IMPLICIT_ADRS_PATH**: `<workspace>/lineage/{repo}/implicit-adrs.md`. Confirm exists.
- **REFACTORING_SCOPES_PATH**: `<workspace>/lineage/{repo}/refactoring-scopes.md`. Confirm exists.
- **DOC_GAPS_PATH**: `<workspace>/lineage/{repo}/doc-gaps.md`. If missing, pass empty + flag.
- **TEST_MAP_PATH**: `<workspace>/lineage/{repo}/test-map.yaml`. If missing, pass empty + flag.
- **EXISTING_ADRS_DIR_ABS**: `<workspace>/adrs/`.
- **SUBSTRATE_LAST_SCAN_COMMIT**: parse `<workspace>/lineage/{repo}/manifest.yaml`'s `last_scan_commit`.
- **SLUG**: derive from the question. Pick 3-6 salient words; kebab-case; max ~50 chars (e.g. `per-data-entity-alert-routing`, `genai-proxy-rate-limiting`, `attachment-storage-validation`). Avoid stop words.
- **TARGET_PATH**: `lineage/{repo}/feature-walks/{date}-{slug}.md`. Use `Bash(date +%Y-%m-%d)` for the date prefix.

If the `feature-walks/` directory doesn't exist, the agent's `Write` will create it (Write tool creates parent dirs).

### 4. Spawn the feature-advisor subagent

Invoke via `Agent` tool with `subagent_type: feature-advisor`. Construct the prompt:

```
REPO: <repo>
WORKSPACE_ROOT_ABS: <absolute>
REPO_ROOT_ABS: <absolute>
SIDECAR_DIR_ABS: <absolute>
CONCEPTS_YAML_PATH: <absolute>
IMPLICIT_ADRS_PATH: <absolute>
REFACTORING_SCOPES_PATH: <absolute>
DOC_GAPS_PATH: <absolute>
TEST_MAP_PATH: <absolute>
EXISTING_ADRS_DIR_ABS: <absolute>
SUBSTRATE_LAST_SCAN_COMMIT: <commit>
TARGET_PATH: lineage/{repo}/feature-walks/{date}-{slug}.md
SLUG: <slug>
QUESTION: |
  <verbatim>
```

Tools per the agent's frontmatter: `Read, Glob, Grep, WebFetch, Write`. The agent reads the ontology, fetches live docs (≤5 fetches), writes one file, replies with `Wrote: <path>` + `Confidence: ...`.

### 5. Validate

After the agent completes:
- Confirm `lineage/{repo}/feature-walks/{date}-{slug}.md` exists.
- Parse the YAML frontmatter; verify `artefact: feature-walk`, `prompt_version`, `slug`, `confidence_overall`, `ontology_inputs_consulted`.
- Verify the body has all named sections (Question, Restated as concepts, Affected nodes, Related concepts, ADRs to respect, Refactoring scopes touched, Doc gaps to address, Test gaps to cover, Suggested implementation skeleton, Ontology coverage gaps, Open questions for the maintainer, sources, confidence_per_section, Maintainer notes).
- **Spot-check 2-3 cited sources**: pick a random `affected_nodes.[i] ← {slug}.md:LINE` and confirm the sidecar exists; pick a random `adrs_to_respect.[i] ← <path>:LINE` and confirm the ADR exists.
- Verify no banned phrases ("probably", "likely", "should", "looks right", "presumably", "defensible") in the body. If found, flag the maintainer.
- Verify `Open questions for the maintainer` (if populated) doesn't punt research-answerable questions. Spot-check: if a question is "what auth mode does X use?" — that's research-punting; flag.

### 6. Report

- Path to the new walk.
- One-line confidence summary from the agent's exit.
- Counts: `<N> affected nodes, <C> concepts, <A> ADRs, <S> scopes, <D> doc gaps, <T> test gaps, <G> ontology coverage gaps, <O> maintainer-only open questions, <U> doc URLs fetched`.
- Top finding: the single most-load-bearing item the maintainer should consider (typically the highest-severity DEVIATES ADR or the highest-severity overlapping refactoring scope).
- Suggested next: `read the walk; decide whether to (a) implement now, (b) scope down, (c) draft an ADR alongside, (d) sequence behind a refactoring scope, (e) commission more enrichment for ontology gaps the walk surfaced`.

## --show form

Read the existing walk at `lineage/{repo}/feature-walks/{slug-or-date}.md`. If `<slug-or-date>` is a partial match, list candidates and pick the most recent. Print the body.

## --list form

`Glob` `lineage/{repo}/feature-walks/*.md`. For each, parse the frontmatter and print `<date> | <slug> | <first line of maintainer_question>`. Sort by date descending.

## Rules

- **Live URLs only for docs.** The agent enforces this internally (Rule 1). The skill verifies the agent's output's `sources` block doesn't claim doc content from anything other than `WebFetch`-cited URLs.
- **Maintainer is the decision-maker.** The walk is advisory. Don't auto-trigger `/implement`, don't auto-create backlog items, don't auto-draft ADRs. Surface findings; let the maintainer choose.
- **Don't pre-summarise the walk.** The walk's value is in its citations and structure. Reporting "TL;DR: this is fine, ship it" defeats the artefact. The skill reports counts and the top finding; the maintainer reads the walk for substance.
- **Walks accumulate as planning history.** Don't overwrite existing walks at the same slug — if a walk already exists for today's date + slug, append a numeric suffix (`-2`, `-3`).

## Cross-references

- Subagent: `.claude/agents/feature-advisor.md`
- Inputs: `lineage/{repo}/understanding/*.md` + `lineage/{repo}/concepts.yaml` + `lineage/{repo}/{implicit-adrs,refactoring-scopes,doc-gaps,test-map}.{md,yaml}` + `adrs/**/*.md` + live ODD docs
- Output: `lineage/{repo}/feature-walks/{date}-{slug}.md`
- ADR: `adrs/drafts/agentic-code-ontology.md` rev 2 (slice 9 in slice progression)
- Memory: `~/.claude/projects/.../memory/feedback_research_dont_punt.md` (the rule against punting research as "open questions")
