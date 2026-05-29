---
name: ingest-docs
description: Ingest the live documentation manual into the ontology as ground-truth Doc nodes, then enrich them with doc→ontology DESCRIBES links. Runs the mechanical doc extractor (docs-ingest → doc-nodes.jsonl, split by heading/anchor, prose referenced from ../documentation), rebuilds the graph (embeds the doc prose), spawns the doc-analyser subagent per un-enriched page (live-URL verification + DESCRIBES to the concepts/features/code each page documents + doc-claim-vs-code drift), and reports the consistency dashboard. Per adrs/drafts/ground-truth-lineage.md (Phase 1).
argument-hint: "[<repo>] [--mechanical-only] [--pages <glob>] [--show] [--full]"
allowed-tools: Read Grep Glob Bash(*) WebFetch Write
---

# Ingest docs — the documentation ground-truth layer (ground-truth-lineage Phase 1)

Bring the published documentation manual (`../documentation/docs/**`, live at
`https://docs.opendatadiscovery.org/`) into the ontology as first-class,
searchable, traversable **`Doc`** nodes, and wire the reverse **`DESCRIBES`**
links so a maintainer can start at a doc section and reach the implementing
code / concept / feature — and vice-versa.

**Source-of-truth contract (do not violate):** doc prose is *referenced, not
copied*. `../documentation` stays the sole prose SoT. The committed artefacts are
addressing only (`doc-nodes.jsonl`), the per-page agentic sidecars
(`doc-understanding/*.md`), and the drift/completeness manifest
(`documentation/_manifest.yaml`). The graph + vectors are derived/ephemeral.
`adrs/drafts/ground-truth-lineage.md` + `lineage/GRAPH-TOPOLOGY.md`.

## Argument forms

| Form | Behaviour |
|---|---|
| `/ingest-docs [<repo>]` | Default. Full pipeline: mechanical ingest → graph-build → enrich every **un-enriched** page with `doc-analyser` → graph-build → `docs-verify`. (default repo `odd-platform`) |
| `/ingest-docs --mechanical-only [<repo>]` | Cheap refresh: `docs-ingest` + `graph-build` + `docs-verify`. No agentic pass. Use after a small `../documentation` edit to refresh addressing + embeddings + drift. |
| `/ingest-docs --pages "<glob>" [<repo>]` | Enrich only pages matching the docs-relative glob (e.g. `configuration-and-deployment/**`). |
| `/ingest-docs --full [<repo>]` | Re-enrich ALL pages (re-run `doc-analyser` even on already-enriched pages). Use after a `doc-analyser` prompt-version bump. |
| `/ingest-docs --show [<repo>]` | Read-only. Print the `docs-verify` consistency dashboard. No build, no subagent. |

## Prerequisites

- `../documentation` is cloned (the prose SoT; the build reads it).
- The extractor venv is installed (`lineage/_extractor`, `uv sync --extra embeddings` for the doc vectors; graph-only still works without).
- `lineage/{repo}/concepts.yaml` + `feature-flows.yaml` exist (the `doc-analyser` binds DESCRIBES against them).
- `WebFetch` available — `doc-analyser` verifies each page's live URL (the authoritative GitBook slug); stale verification is forbidden.

## Protocol

### 1. Orient (skip if loaded this session)

- `lineage/GRAPH-TOPOLOGY.md` — the graph map (labels, edges, the doc layer).
- `adrs/drafts/ground-truth-lineage.md` — the decision + consistency contract.
- `.claude/agents/doc-analyser.md` — the subagent's system prompt.
- `playbooks/live-site-verification.md` (Gate 8) + `playbooks/reducer-incremental-mode.md`.

### 2. Mechanical ingest (deterministic, no LLM)

```bash
cd lineage/_extractor
uv run lineage-extractor docs-ingest <repo>
```

Writes `doc-nodes.jsonl` + `documentation/_manifest.yaml`. Surfaces completeness
(`missing`/`orphan` vs `SUMMARY.md` — the upstream-authoritative denominator).
A non-empty `missing` is a real upstream/SUMMARY inconsistency — surface it, do
not paper over it.

### 3. Build the graph (embeds doc prose from upstream)

```bash
uv run lineage-extractor graph-build <repo>
```

Confirm `Doc` nodes now carry vectors (`vector_count` rises). Cold build is
minutes; warm is seconds (the `(text-hash, model-id)` embed cache re-embeds only
changed sections).

### 4. Enrich un-enriched pages (agentic — the DESCRIBES layer)

Compute the page set to enrich:

- default → pages in `doc-nodes.jsonl` with no `doc-understanding/{slug}.md` (run `docs-verify <repo> --json` and read `enrichment.unenriched_examples`, or diff the page set against `doc-understanding/`).
- `--pages <glob>` → pages matching the glob.
- `--full` → all pages.

Spawn the **`doc-analyser`** subagent **per page**, in parallel batches of ~5
(non-conflicting — each writes its own `doc-understanding/{slug}.md`). Pass each
the input block from `.claude/agents/doc-analyser.md` (REPO, DOC_PAGE,
DOC_PAGE_ABS, DOC_NODES_PATH, LIVE_URL_GUESS, CONCEPTS_YAML_PATH, TARGET_PATH).
The agent reads the page, WebFetches the live URL (records the resolved slug +
status), graph-searches + confirms the concepts/features/code it documents
(DESCRIBES), and records doc-claim-vs-code drift.

> **Cost note (APPROACH.md §9 / minimal-resources):** the agentic pass is one
> subagent per page (~100 pages). It is the expensive half. For an overnight
> unattended run, drive this skill via `/loop` or batch it; the mechanical layer
> (steps 2-3) already makes docs searchable, so the DESCRIBES enrichment can
> land incrementally.

### 5. Rebuild + verify

```bash
uv run lineage-extractor graph-build <repo>     # project the new DESCRIBES edges + embed any prose
uv run lineage-extractor docs-verify <repo>      # the consistency dashboard
```

`docs-verify` reports the three axes: completeness (SUMMARY denominator),
content drift (committed hash vs live upstream prose), and DESCRIBES enrichment
coverage + live-URL status. Surface it to the maintainer.

### 6. Follow-ups

- `doc_claim_vs_code` findings the `doc-analyser` surfaced feed `/doc-gap-check`
  (the existing code↔doc drift reducer) — run it to triage DOC-NNN candidates.
- A non-zero `drift` count in `docs-verify` means `../documentation` changed
  since the last `docs-ingest` — re-run step 2.

## Exit

Report: pages ingested (sections), completeness (missing/orphan), vectors,
DESCRIBES enrichment coverage (`N/total`), live-URL statuses, and any drift or
doc-claim-vs-code findings worth a DOC-NNN. Never self-mark a doc page "done" —
enrichment coverage is the honest metric.
