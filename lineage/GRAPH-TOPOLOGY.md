# The ontology graph — topology

This is the human map of the ODD knowledge graph: every **node label**, every
**edge type**, where each one's **source of truth** lives, how its **identity**
is formed, and which **layer** owns it. Read this to understand what the graph
contains and how to traverse it. It is the companion to the machine builder
(`lineage/_extractor/src/lineage_extractor/graph_query/`) and the methodology
(`APPROACH.md`).

> **The one rule that explains everything else.** The graph is a *projection*.
> Canonical truth is **files in the repo**; the graph + vector index under
> `lineage/{repo}/graph/` are **derived, git-ignored, rebuilt every run, never
> hand-edited**. To change what the graph says, edit a source file and rebuild.
> Every node and every edge carries `source_file:source_line` — a graph element
> with no provenance is a build bug. (`adrs/drafts/graph-query-layer.md`.)

---

## The two halves of the graph

A Principal engineer's mental model has two halves, and so does this graph:

1. **Derived knowledge & gaps** — what analysis *found*: concepts, features,
   findings, and the gap-shaped nodes (`ImplicitADR`, `DocGap`, `TestGap`,
   `RefactoringScope`). These are regenerated each run and may churn.
2. **Ground-truth anchors** — the real, human-ratified, external surfaces the
   knowledge is pinned to: the live **docs**, the published **ADR** log, the
   **GitHub issue** tracker, the **test** suite. These are committed and
   citable. (`adrs/drafts/ground-truth-lineage.md`.)

The naming asymmetry **is** the documentation: `ADR` (ratified) vs `ImplicitADR`
(a derived candidate); `Test` (exists) vs `TestGap` (to write); `Doc`
(content-bearing) vs `DocGap` (a divergence). Never collapse a ground-truth label
into its gap sibling — a regenerated candidate must never overwrite a ratified
decision.

```
                          ┌──────────────────────────────────────────┐
   external reality  ──▶  │  GROUND-TRUTH ANCHORS (committed, real)    │
   (docs / ADRs /         │   Doc · ADR · Issue · Test                 │
    issues / tests)       └───────▲───────────────────▲────────────────┘
                                  │ DESCRIBES          │ COVERS/VALIDATES
                                  │ REALISES           │ REGRESSES/ENFORCES
                                  │ PROMOTED_TO        │ TRACKS/FILED_AS
                          ┌───────┴───────────────────┴────────────────┐
   code analysis    ──▶  │  DERIVED KNOWLEDGE & GAPS                    │
   (sidecars,            │   CodeNode · Sidecar · Concept · Feature ·  │
    reducers)            │   Finding · ImplicitADR · DocGap · TestGap ·│
                         │   RefactoringScope · FeatureReflection ·    │
                         │   ShoeboxThread                             │
                         └─────────────────────────────────────────────┘
```

---

## Node labels

Status: **active** = projected today · **planned** = constant defined, projected
in a later ground-truth-lineage phase. Live counts: `graph/build-info.yaml`.

| Label | Layer | Source of truth (canonical file) | Identity key | Status |
|---|---|---|---|---|
| `CodeNode` | 1 substrate | `nodes.jsonl` (+ stubs from edges) | `{repo} {lang} {package} {kind}:{descriptor}` | active |
| `Sidecar` | 2 enrichment | `understanding/{slug}.md` | sidecar `node_id` | active |
| `Finding` | 2 enrichment | a sidecar's `bugs`/`security`/`performance`/`stress` section | `{node_id}#{section}` | active |
| `Concept` | 3 reducer | `concepts/detail/{type}/{slug}.yaml` | `{type}:{slug}` | active |
| `ImplicitADR` | 3 reducer | `implicit-adrs/detail/ADR-CANDIDATE-NNN.md` | `ADR-CANDIDATE-NNN` | active |
| `RefactoringScope` | 3 reducer | `refactoring-scopes/detail/REFACTOR-NNN.md` | `REFACTOR-NNN` | active |
| `DocGap` | 3 reducer | `doc-gaps/detail/DOC-GAP-NNN.md` | `DOC-GAP-NNN` | active |
| `TestGap` | 3 reducer | `test-map/detail/TEST-GAP-NNN.yaml` | `TEST-GAP-NNN` | active |
| `Feature` | 4a compose | `feature-flows/detail/F-NNN.yaml` | `F-NNN` | active |
| `FeatureReflection` | 4b reflect | `feature-reflections/detail/F-NNN.yaml` | `F-NNN` | active |
| `ShoeboxThread` | note-first | `shoebox/detail/SHB-NNN.md` | `SHB-NNN` | active |
| **`Doc`** | **GT docs** | **`doc-nodes.jsonl` + `doc-understanding/{slug}.md`; prose referenced from `../documentation`** | **`documentation {docs-rel-path}#{anchor}`** | **active** |
| **`ADR`** | GT decisions | `adrs/ADR-NNN-*.md` frontmatter (+ published log page) | `ADR-NNN` | planned (P2) |
| **`Issue`** | GT issues | `lineage/{repo}/github-issues.json` (offline snapshot) | `{repo}#{number}` | planned (P3) |
| **`IssueDraft`** | GT issues | `issues/{repo}/{PREFIX}-NNN.md` | `{PREFIX}-NNN` | planned (P3) |
| **`Test`** | GT tests | the test file (via a `test_axis` extractor) | `{test-file}::{class}::{method}` | planned (P4) |

The `Doc` label was **upgraded** by the ground-truth-lineage layer from a
bare-URL stub (a URL a sidecar mentioned, no body, no vector) to a
**content-bearing, embedded** node — one per documentation heading/anchor.

---

## Edge types

Structural edges (lowercased in `edges.jsonl`, uppercased in the graph) come
straight from the substrate. Join-fabric + ground-truth edges are projected.

### Structural (from `edges.jsonl`)
| Type | From → To | Meaning |
|---|---|---|
| `DECLARED_IN` | symbol → file | universal containment |
| `IMPORTS` | file → file/symbol | import graph |
| `EXPOSES` | controller/router → handler | HTTP/CLI/event surface |
| `CONFIGURES` | config-prefix/properties → consumer | configuration provenance |
| `MOUNTS` | shell/parent → widget | UI composition |
| `CALLS` / `WIRES` / `REFERENCES` | symbol → symbol | call / routing / loose links |

### Join fabric (projected from sidecars + reducers)
| Type | From → To | Meaning |
|---|---|---|
| `ENRICHED_BY` | CodeNode → Sidecar | a node's semantic enrichment |
| `SURFACES_FINDING` | Sidecar → Finding | a finding the sidecar raised |
| `MENTIONS_CONCEPT` | Sidecar → Concept | concept usage |
| `IMPLIES_ADR` | Sidecar → ImplicitADR | a decision the code embodies |
| `HAS_DOC_GAP` / `HAS_TEST_GAP` / `HAS_REFACTOR_SCOPE` | Sidecar → gap | a surfaced gap |
| `LINKS_DOC` | Sidecar → Doc | code→doc link (the WebFetched URL, now resolved to a content-bearing Doc node when it matches) |
| `PART_OF_FEATURE` | CodeNode → Feature | feature composition |
| `REFLECTED_BY` | Feature → FeatureReflection | top-down reflection |
| `CONTRADICTS` | FeatureReflection → Sidecar/Doc/ImplicitADR | intent-vs-impl drift |
| `CANONICALISES` | Concept → Concept | dedup / canonical vocabulary |

### Ground-truth lineage (OSLC-derived) — `adrs/drafts/ground-truth-lineage.md`
| Type | From → To | Meaning | Status |
|---|---|---|---|
| **`DESCRIBES`** | **Doc → Concept/Feature/CodeNode** | **the page documents this (reverse of `LINKS_DOC`)** | **active** |
| **`DOC_REFERENCES`** | **Doc → Doc** | **intra-manual hyperlink** | **active** |
| `PROMOTED_TO` | ImplicitADR → ADR | candidate ratified into a published decision | planned (P2) |
| `REALISES` | CodeNode → ADR | code satisfies a decision (OSLC `satisfiedBy`) | planned (P2) |
| `SUPERSEDED_BY` | ADR → ADR | decision lifecycle | planned (P2) |
| `FILED_AS` | IssueDraft → Issue | on-disk draft → real filed issue | planned (P3) |
| `TRACKS` | Finding/RefactoringScope → Issue | OSLC `trackedBy` | planned (P3) |
| `CLOSED_BY` | Issue → CodeNode | the PR/commit that closed it | planned (P3) |
| `COVERS` | Test → CodeNode | SPDX `TEST_OF` | planned (P4) |
| `VALIDATES` | Test → Feature | OSLC `validatedBy` | planned (P4) |
| `REGRESSES` | Test → Issue/Finding | regression test for a known bug | planned (P4) |
| `ENFORCES` | Test → ADR | test pins an architectural decision | planned (P4) |

Edges are traversed both directions, so the audit-critical inverses
(`ADR ←REALISES←`, `Feature ←VALIDATES←`, `Doc ←DESCRIBES→ code`) come for free.

---

## The documentation layer in detail (Phase 1, active)

**What's committed (the SoT for `Doc` nodes):**
- `lineage/{repo}/doc-nodes.jsonl` — one row per heading/anchor section:
  `id`, `repo_rel_path`, `page_title`, `heading_path`, `anchor`, `level`,
  `content_hash`, `live_url` (a guess), `summary_group`, `in_summary`, `links[]`.
  **Mechanical, regenerable, idempotent** (`extractors/docs.py`, no LLM/network).
- `lineage/{repo}/documentation/_manifest.yaml` — the upstream commit anchor +
  completeness (denominator from `SUMMARY.md`, `missing`/`orphan` lists).
- `lineage/{repo}/doc-understanding/{slug}.md` — the **agentic** per-page sidecar
  (the `doc-analyser` subagent): `describes` (concepts/features/code → `DESCRIBES`
  edges), the **verified** live URL + resolved slug, and doc-claim-vs-code drift.

**What's NOT committed (the maintainer's call, 2026-05-29):** the section
**prose**. It stays in `../documentation` (already the canonical manual). The
graph **embedder reads it at build time** to produce the doc vectors —
**zero prose duplication**. `content_hash` is the drift anchor: if the live
prose no longer hashes to the committed value, the node is flagged `drifted`.

**Identity vs the live URL.** A `Doc` node's identity is its `documentation
{docs-rel-path}#{anchor}` id — stable across GitBook slug rewrites. The live URL
is a *re-verified attribute*, never the identity, because GitBook derives the
slug from the page title at render time and rewrites it (e.g.
`attachments.md` → `.../data-entity-attachments`). `docs-ingest` stores a guess;
`doc-analyser` records the authoritative resolved slug via WebFetch.

---

## How freshness & consistency are kept (the "no drift" contract)

Each ground-truth surface is a **derived-but-committed mirror** of an upstream —
the `go.sum`/generated-code pattern. The guarantee reduces to one rule: **a
mirror is generated, never hand-authored** (humans edit only a survive-refresh
`maintainer_curated`/`Maintainer notes` block). A never-hand-authored file can
only be *fresh* or *stale*, never a competing source of truth.

- **Drift, two tiers:** tier-0 = the upstream commit anchor in `_manifest.yaml`;
  tier-1 = per-node `content_hash` (tells you *which* nodes changed → re-embed
  only the delta, via the `(text-hash, model-id)` embed cache).
- **Completeness:** `complete ⟺ missing==[] AND orphan==[]`, denominator always
  from the upstream's own index (docs: `SUMMARY.md`), never the mirror's own
  listing — this is the fix for the recurring "100% of my own subset" failure.
- **Triggers:** git-diff-driven + on-demand (`/ingest-docs`). **No daemon** —
  local-only, no recurring infrastructure (`APPROACH.md` Rule 12).

---

## Using the graph

```bash
cd lineage/_extractor      # the venv lives here

# refresh the documentation layer (mechanical) after ../documentation changes
uv run lineage-extractor docs-ingest odd-platform

# rebuild the ephemeral graph + vectors from all canonical files
uv run lineage-extractor graph-build odd-platform

# hybrid query — vector entry points + bounded traversal, every hit cited
uv run lineage-extractor query odd-platform "attachment storage configuration"

# the agentic primitives the graph-retriever / doc-analyser subagents use
uv run lineage-extractor graph-search odd-platform "<text>" --label Doc --json
uv run lineage-extractor graph-node  odd-platform "<node_id>" --json
uv run lineage-extractor graph-neighbours odd-platform "<node_id>" --json
```

The build cache is keyed on a content signature of every canonical file —
*including* the upstream docs prose (`../documentation/docs/**.md`), so editing a
doc page and rebuilding correctly re-embeds the changed sections.

---

## Cross-references

- `adrs/drafts/ground-truth-lineage.md` — the decision (this layer).
- `adrs/drafts/research/ground-truth-lineage/` — the prior-art research (DOC-INGESTION / TRACEABILITY-TAXONOMY / CONSISTENCY-MAINTENANCE).
- `adrs/drafts/graph-query-layer.md` — the canonical-vs-derived contract.
- `adrs/drafts/code-lineage-substrate.md` — the substrate (`nodes.jsonl`/`edges.jsonl`).
- `adrs/drafts/feature-anchored-ontology.md` — features, pillars, the test matrix.
- `APPROACH.md` — the full methodology.
- `lineage/_extractor/src/lineage_extractor/graph_query/config.py` — the machine
  list of every label + edge constant (the authority this doc describes).

## ADR layer — ACTIVE (2026-05-30, ground-truth Phase 2)

The `ADR` node + `PROMOTED_TO` / `REALISES` edges are now projected (pilot: ADR-0001). As-built source-of-truth (refines the original `adrs/`-frontmatter sketch above):

- **`ADR` node** — identity `ADR-NNNN`; sourced from the **published** ADR pages under `../documentation/docs/developer-guides/architecture-decision-log/ADR-*.md` (frontmatter `adr_id`/`title`/`status`/`date`), materialised by `extractors/adrs.py` (`adrs-ingest`) into `lineage/{repo}/adr-nodes.jsonl` (generated mirror; `content_hash` for drift).
- **`PROMOTED_TO`** — `ImplicitADR` (`ADR-CANDIDATE-NNN`) → `ADR`, from the workspace backlog item `backlog/adr/ADR-NNNN.md` frontmatter `promoted_from` (kept out of the published page for audience isolation; recorded only after human ratification — the graph records, never triggers).
- **`REALISES`** — `CodeNode` → `ADR`, from the backlog item's `realises` list (code-node ids resolve to edges; non-code refs become the `realises_external` attribute).
- **`SUPERSEDED_BY`** — `ADR` → `ADR`, from `superseded_by`.

Verified clean `graph-build`: `ADR`=1, `PROMOTED_TO`=1 (ADR-CANDIDATE-001→ADR-0001), `REALISES`=1 (AlertController→ADR-0001), `SUPERSEDED_BY`=0; `adrs-ingest` deterministic; pytest 43 passed. Pillar: `pillars/adr/`. Process mirrors documentation: implicit-adrs → `/triage` → `backlog/adr` → `/implement` (published page) → `/review` → ontology.
