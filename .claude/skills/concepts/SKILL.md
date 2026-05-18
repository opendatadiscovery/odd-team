---
name: concepts
description: Run the concept-merger reducer subagent over the per-node enrichment sidecars to produce or refresh `lineage/{repo}/concepts.yaml` — the deduplicated concept catalog with cross-axis equivalences and canonicalisation candidates. Anchored on `documentation/docs/main-concepts.md` for the canonical vocabulary. Maintainer-curated entries preserved across refreshes.
argument-hint: [<repo>] [--show] [--diff]
allowed-tools: Read Grep Glob Bash(ls *) Bash(find *) Bash(jq *) Bash(diff *) WebFetch
---

# Concept catalog (DOC-164 slice 6+)

Build or refresh the cross-sidecar concept catalog at `lineage/{repo}/concepts.yaml`. The catalog clusters every per-node sidecar's `concepts` block by semantic equivalence, anchors names against the canonical vocabulary in `documentation/docs/main-concepts.md`, and surfaces canonicalisation candidates for the maintainer to decide on.

This skill is the second reducer in the agentic-code-ontology layer (per `adrs/drafts/agentic-code-ontology.md` rev 2). The first per-node enrichment slice was `/enrich` (slice 5). `/concepts` consumes the sidecars `/enrich` produced.

## Argument forms

| Form | Behaviour |
|---|---|
| `/concepts [<repo>]` | Default. Run `concept-merger` in **incremental mode** (per `playbooks/reducer-incremental-mode.md`) against `lineage/{repo}/understanding/` (default repo: `odd-platform`). Refreshes `lineage/{repo}/concepts.yaml` by appending+annotating only the sidecars whose `node_id` is not yet in the prior catalog's `processed_node_ids`. Preserves any concept entries flagged `maintainer_curated: true` from a prior version. |
| `/concepts --full [<repo>]` | Forces FULL mode — re-reads every sidecar and regenerates the catalog from scratch. Use when prior catalog is corrupt, `prompt_version` bumped, or after a schema change. |
| `/concepts --show [<repo>]` | Read-only. Print the existing catalog's summary (concept counts per category, top-N concepts by node-count, canonicalisation candidates list). No subagent invocation; no writes. |
| `/concepts --diff [<repo>]` | Read-only. Compare the existing `concepts.yaml` to a freshly-generated one (in a temp file) and surface the diff. Useful for previewing what a refresh would change before committing it. |

## Incremental input resolution

Before spawning the subagent in default (`incremental`) mode, the skill computes:

- `PROCESSED_NODE_IDS` — read from prior `concepts.yaml`'s frontmatter `processed_node_ids:` field. If the field is missing (pre-v0.2 catalog), fall back to `--full` for this run.
- `NEW_SIDECAR_FILES` — `Glob lineage/{repo}/understanding/*.md` minus the set whose YAML frontmatter `node_id:` is in `PROCESSED_NODE_IDS`. Empty set → report "Nothing to refresh (no new sidecars)" and exit without invoking the subagent.
- `PRIOR_HEAD` — one line per concept from prior `concepts.yaml`, derived via `grep -E '^  - name:'` + per-entry `contributing_files` length count. Use the compact-head shape from `playbooks/reducer-incremental-mode.md`.
- `CURATED_ENTRIES` — verbatim YAML of every concept entry with `maintainer_curated: true`, extracted by parsing the prior catalog.

These four values + `MODE: incremental` get passed to the subagent in place of the legacy `EXISTING_CATALOG` block.

## Prerequisites

- `lineage/{repo}/understanding/{slug}.md` sidecars exist (i.e. `/enrich` has been run at least once).
- `documentation/docs/main-concepts.md` is reachable (either local at `../documentation/docs/main-concepts.md` or live at `https://docs.opendatadiscovery.org/main-concepts`). The skill prefers the local file (faster, no rate limits); WebFetches the live URL only as a fallback.
- The `concept-merger` subagent at `.claude/agents/concept-merger.md` is loaded.

## Protocol

### 1. Orient

Read these (skip if already loaded this session):

- `CLAUDE.md` — quality bar
- `adrs/drafts/agentic-code-ontology.md` — the layered ADR + reducer pattern
- `.claude/agents/concept-merger.md` — the subagent's system prompt
- The active pillar's `cornerstones.md` (currently `pillars/documentation/cornerstones.md`) — Cornerstone 2 is the canonical-vocabulary discipline this skill upholds

### 2. Resolve inputs

- **Sidecar set**: `Glob` `lineage/{repo}/understanding/*.md`. Confirm at least one sidecar exists; otherwise report "no sidecars to merge — run `/enrich` first" and exit.
- **Existing catalog** (if any): `lineage/{repo}/concepts.yaml`. If present, capture its `maintainer_curated`-flagged entries to pass to the subagent for preservation.
- **Canonical-vocab source**: prefer `../documentation/docs/main-concepts.md` (local sibling repo). Fallback: WebFetch `https://docs.opendatadiscovery.org/main-concepts`. Pass the path/content to the subagent.
- **Substrate state**: read `lineage/{repo}/manifest.yaml`'s `last_scan_commit` so the produced catalog can record `generated_at_commit`.

### 3. Spawn the concept-merger subagent

Invoke via the `Agent` tool with `subagent_type: concept-merger` (after `.claude/agents/concept-merger.md` is loaded; in this session general-purpose is the fallback). Construct the prompt as:

```
REPO: <repo>
WORKSPACE_ROOT_ABS: <absolute>
SIDECAR_DIR_ABS: /home/.../lineage/{repo}/understanding/
DOC_MAIN_CONCEPTS_PATH: <absolute path to ../documentation/docs/main-concepts.md, or the live URL if only the URL is reachable>
SUBSTRATE_LAST_SCAN_COMMIT: <from manifest.yaml>
EXISTING_CATALOG: <verbatim content of lineage/{repo}/concepts.yaml if present, else "(none)">
SIDECAR_FILES: <newline-separated list of sidecar paths>
SIDECAR_COUNT: <N>
TARGET_PATH: lineage/{repo}/concepts.yaml
```

The subagent's tool surface is `Read, Glob, Grep, Write` per its frontmatter. It writes the catalog and replies with `Wrote: ...` + `Catalog: ...`.

### 4. Validate the resulting catalog

After the subagent reports completion:

- Confirm `lineage/{repo}/concepts.yaml` exists.
- Parse it as YAML (Bash `python -c "import yaml; yaml.safe_load(open('...'))"` or skip if no Python available).
- Verify the four top-level lists exist: `entities`, `operations`, `invariants`, `audiences`. Empty lists are fine; missing keys are an error.
- Verify each concept entry has `name`, `nodes`, `contributors`, `evidence`. Missing fields = log warning + report.
- Verify every `nodes` entry references a real node ID — sample-check 5 random entries via `jq` against `lineage/{repo}/nodes.jsonl`. If a sample finds a fabricated node ID, that's a CRITICAL FAIL — the catalog is unreliable; report + ask the maintainer how to proceed.

### 5. Report

Concise output:

- Catalog path
- Counts: `<E> entities, <O> operations, <I> invariants, <A> audiences = <N> concepts`
- Cross-axis concepts: count concepts whose `axes_present` has ≥2 entries (these are the most valuable — they prove the cross-axis join works)
- Top-3 concepts by node-count (which concepts have the most contributing sidecars)
- Canonicalisation candidates count + brief list (one line each)
- Suggested next: `/find-implicit-adrs` (slice 8 — adr-archaeologist) once the catalog is reviewed; or `/enrich --batch <axis>` to grow the sidecar set if cross-axis coverage is weak.

## Rules

- **Live-URL-only doc rule applies here too.** The subagent's prompt requires that when it cites `documentation/docs/main-concepts.md`, the citation is from a file Read in this session — not pretraining recall. The skill provides the path/content; the subagent does not invent canonical-vocabulary entries from memory.
- **Maintainer-curated preservation.** If a concept entry in the existing `concepts.yaml` is flagged `maintainer_curated: true`, the subagent preserves its `name`, `description`, and `notes` verbatim. The `nodes`, `contributors`, and `evidence` fields may update if new sidecars contribute (they're auto-derived); the maintainer's prose stays.
- **Don't dedup canonicalisation candidates.** Even if a candidate appears similar to an existing entry, surface both. The maintainer is the only judge of canonical-vocabulary changes.
- **Reducer doesn't fix sidecar quality.** If a sidecar's `concepts` block is sparse or unclear, `concept-merger` notes the contribution but does not "fill in" missing concepts. Sparse sidecars surface as a quality finding for `/enrich --node <id>` to refresh, not for the reducer to paper over.
- **Skip auto-write on validation failure.** If the subagent's output fails schema validation, the file gets written to `lineage/{repo}/.concepts-staged.yaml` instead and the maintainer reviews before promoting to `concepts.yaml`. (Slice-6 MVP: simpler — write directly and report failure.)

## Failure modes to surface (not auto-fix)

- Subagent claims a concept appears in node X but X isn't in `nodes.jsonl` → catalog is rejected; maintainer iterates the prompt
- Canonical-vocabulary fetch failed (local file missing, WebFetch returned non-200) → catalog uses `canonical_in_docs: unknown` for entries that can't be classified; maintainer re-runs after fixing
- More than 30% of entries land in `canonicalisation_candidates` → either the canonical vocab is genuinely undersized (real signal worth maintainer review) OR the sidecars are noisy (refresh `/enrich` may help). Surface to maintainer rather than silently emit a low-quality catalog.

## Cross-references

- Subagent: `.claude/agents/concept-merger.md`
- Inputs: `lineage/{repo}/understanding/*.md` (per-node sidecars from `/enrich`)
- Output: `lineage/{repo}/concepts.yaml`
- Canonical-vocab source: `../documentation/docs/main-concepts.md` (local) or `https://docs.opendatadiscovery.org/main-concepts` (live)
- ADR: `adrs/drafts/agentic-code-ontology.md` rev 2 — agent set table, slice progression
- Cornerstone enforced: documentation pillar Cornerstone 2 (vocabulary anchored in `main-concepts.md`)
