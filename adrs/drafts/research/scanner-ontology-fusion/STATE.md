# STATE.md — current state of the two pipelines, ahead of rev-13 fusion design

*(Research thread of the rev-13 scanner ↔ ontology fusion design phase. Per `playbooks/deep-research.md`. Read once; later threads pivot on this picture.)*

## TL;DR

Two pipelines run side-by-side in this workspace with **zero formal interface**. The **scanner pipeline** is a top-down, doc-as-requirements registry — humans write scanner definitions, sessions execute them, findings convert to backlog items the maintainer ships per-PR (`scanners/` → `findings/` → `backlog/` + `issues/`). Load-bearing artefacts: 29 scanner definitions, 10 findings files, 165 backlog items, 16 upstream-issue drafts. The **ontology pipeline** is a bottom-up, code-as-truth pipeline — agents enrich a heuristic-extracted substrate into per-node sidecars, reducers compose cross-file emergence, layer-4 builders compose feature flows + product-owner reflections (`lineage/_extractor/` → `lineage/odd-platform/` artefacts). Load-bearing artefacts: 929 substrate nodes, 212 per-node `understanding/` sidecars, 113 feature flows, 542 concept-detail entries, 103 surfaced doc-gaps, 124 shoebox threads, 11 SME-curated probe runs. The two have **one tiny one-way leak today** (`doc-gap-finder` cross-references one scanner findings file by name) and otherwise neither side reads the other's outputs.

---

## Pipeline A — Scanner (doc-as-requirements, top-down)

### Inputs

- **Scanner definitions** — 29 markdown files under `scanners/{adrs,docs,navigation,spec,tests}/` (17 of them in `docs/` across the 4 subcategories: `accuracy/` 6, `completeness/` 2, `coverage/` 4, `quality/` 3; `scanners/README.md:30-50`).
- **Target repos read as black boxes** — `../documentation` (markdown source); `../odd-platform` (Java + React); `../odd-collectors` (Python); `../opendatadiscovery-specification` (OpenAPI). Read-only.
- **Coverage manifests** — `state/coverage/*.yaml`, one per scanner (currently 6 files: `docs-accuracy-config-options.yaml`, `docs-accuracy-feature-behavior.yaml`, `docs-coverage-undocumented-features.yaml`, `docs-quality-duplication.yaml`, `docs-quality-outbound-urls.yaml`, `docs-quality-rendering.yaml`).
- **Navigation layer as pointers** — `navigation/features.yaml`, `navigation/repos.yaml`, `navigation/architecture.md`, plus 22 `navigation/domains/*.md` files (`alerting.md`, `attachments.md`, `authentication.md`, …). The scanner is required to read the relevant domain file before scanning (`scan/SKILL.md:14-18`).

### Skills / Agents

- `.claude/skills/enumerate/SKILL.md` — generates / refreshes a scanner's coverage manifest from its scope.
- `.claude/skills/scan/SKILL.md` — picks the next 10-15 unscanned items, applies the scanner's method, writes findings, updates coverage + navigation.
- `.claude/skills/triage/SKILL.md` — converts findings into atomic backlog items OR upstream-issue drafts.
- `.claude/skills/implement/SKILL.md` + `.claude/skills/review/SKILL.md` + `.claude/skills/log-issue/SKILL.md` — close the loop into actual commits on a target repo.
- **No subagent.** The scanner is run by the **session itself**, not via a Claude Code subagent contract. There's no `scanner-runner.md` in `.claude/agents/`. The 14 `.claude/agents/*.md` files belong to the ontology pipeline.

### Outputs

- `findings/{scanner-id}/YYYY-MM-DD[-batch-N].md` — raw, timestamped, per scanner (10 files total today, e.g. `findings/docs-accuracy-config-options/2026-04-21-platform.md:1-40`).
- `backlog/{docs,tests,navigation,spec}/{ID}.md` — atomic work items, format frozen in `backlog/README.md:7-40`. **165 items today** (all under `backlog/docs/`, `backlog/navigation/`, `backlog/tests/`, `backlog/spec/`; no critical/high/medium/low directories — priority is a frontmatter field).
- `issues/{repo}/{PREFIX}-NNN.md` — 16 paste-ready upstream-issue drafts (10 `PLT-*` for odd-platform, 6 `COL-*` for odd-collectors). The split is the work-vs-handoff statement of `CLAUDE.md` "What this workspace is (and isn't)."
- **In-place mutations** of `navigation/domains/*.md` and `navigation/architecture.md` (mandatory per `scan/SKILL.md:70-74`).
- **In-place mutations** of `state/PROGRESS.md` + `state/file-registry.yaml`.

### Write contracts (the load-bearing claim)

- **The triage skill is the ONLY place backlog items are written.** Every other skill is read-only on `backlog/` (status flips by `/implement` and `/review` mutate frontmatter, not create files).
- **The scan skill is the ONLY place findings are written.** Findings are append-only by date.
- Status lifecycle gates which skill may flip what — `backlog/README.md:62-75` enumerates them.

### Frequency

Per-batch, human-paced. A scan session typically runs 10-15 items; a triage session converts one findings file into backlog items; an implement+review pair ships a batch as one PR per target repo. Driven by `/scan`, `/triage`, `/implement`, `/review` invocations — no autonomous loop.

---

## Pipeline B — Ontology (code-as-truth, bottom-up + top-down)

### Inputs

- **The substrate scan** of `../odd-platform` runs the deterministic extractor under `lineage/_extractor/src/lineage_extractor/`. Tree-sitter via per-axis extractors (`extractors/{controllers,config_prefixes,openapi_tags,ui_components,ui_routes,ui_shell}.py` + `extractors/concepts.py`). Output: `lineage/odd-platform/nodes.jsonl` (**929 lines**), `lineage/odd-platform/edges.jsonl` (**479 lines**), `lineage/odd-platform/manifest.yaml` (commit anchor `ede5d277`, 2026-05-26).
- **The live documentation** — every reducer + analyser is required to WebFetch `docs.opendatadiscovery.org/*` for any claimed link (`file-analyser.md:27-30`, Rule 1).
- **The canonical concepts page** — `documentation/docs/main-concepts.md` anchors `concepts.yaml`.
- **The mission anchor** — `lineage/odd-platform/system-mission.md` (527 lines), produced once per substrate scan by `domain-extractor`.

### Agents (the 14 `.claude/agents/*.md` files)

| Agent | Role | Layer |
|---|---|---|
| `domain-extractor.md` | Reads docs + concepts catalog → emits `system-mission.md` (8-12 pillars) | Layer 0 |
| `file-analyser.md` | Reads one source node end-to-end + Stress Protocol → emits per-node sidecar | Layer 2 |
| `concept-merger.md` | Reduces sidecars → `concepts.yaml` | Layer 3 |
| `doc-gap-finder.md` | Reduces sidecars + WebFetch → `doc-gaps.md` | Layer 3 |
| `adr-archaeologist.md` | Reduces sidecars → `implicit-adrs.md` + `refactoring-scopes.md` | Layer 3 |
| `test-coverage-mapper.md` | Reduces sidecars → `test-map.yaml` | Layer 3 |
| `feature-flow-builder.md` | Composes entry-point chains → `feature-flows.yaml` + per-feature detail | Layer 4a |
| `feature-reflector.md` | Top-down product-owner pass per feature → `feature-reflections/detail/F-NNN.yaml` | Layer 4b |
| `methodology-reviewer.md` | Periodic self-audit of the methodology → `meta-reviews/{date}/` | Meta |
| `odd-sme.md` | Maintainer-curated SME consultation pattern | Consultation |
| `probe-runner.md` | Runs probes against a local docker-compose mirror → `probe-runs/*.yaml` | Verification |
| `feature-advisor.md` | Query-time impact assessment for a proposed change → `feature-walks/` | Query |
| `graph-retriever.md` | Iterative graph-query retriever | Query |
| `registry-search.md` | (Legacy; being superseded by graph-retriever) | Query |

### Outputs

| Artefact | Path | Count / size |
|---|---|---|
| Substrate | `nodes.jsonl` + `edges.jsonl` + `manifest.yaml` | 929 nodes / 479 edges |
| Per-node sidecars | `lineage/odd-platform/understanding/*.md` | **212 sidecars** |
| Concept catalog | `lineage/odd-platform/concepts.yaml` + `concepts/detail/{audiences,canonicalisation_candidates,entities,operations,invariants}/*.yaml` | catalog_version 8; **542 per-axis detail entries** |
| Feature flows | `lineage/odd-platform/feature-flows.yaml` + `feature-flows/detail/F-NNN.yaml` | **113 feature flows** |
| Feature reflections | `lineage/odd-platform/feature-reflections/detail/*.yaml` | **1 detail file** (Layer 4b is nascent) |
| Doc gaps | `lineage/odd-platform/doc-gaps.md` (1416 lines; 103 DOC-GAP IDs surfaced) + `doc-gaps/detail/*.yaml` | **103 unique DOC-GAP-NNN** |
| Implicit ADRs | `lineage/odd-platform/implicit-adrs.md` (1512 lines) | candidates only |
| Refactoring scopes | `lineage/odd-platform/refactoring-scopes.md` (2845 lines) | candidates only |
| Test map | `lineage/odd-platform/test-map.yaml` (8678 lines) | per-feature 4-class matrix |
| Shoebox | `lineage/odd-platform/shoebox/detail/SHB-*.md` | **124 SHB threads** |
| SME consultations | `lineage/odd-platform/sme-consultations/` | README only (pattern shipped; no captured sessions yet) |
| Probes | `lineage/odd-platform/probes/P-*.yaml` | sample of 9 + LSN-019 probe |
| Probe runs | `lineage/odd-platform/probe-runs/2026-05-19-*.yaml` | **9 captured runs + 1 batch report** |
| Meta-reviews | `lineage/odd-platform/meta-reviews/{date}/` | **6 review dirs** (2026-05-21, 21-a1, 22, 22-a1, 26, validation) |
| Retrieval feedback | `lineage/odd-platform/retrieval-feedback/` | README only |
| Graph cache | `lineage/odd-platform/graph/.cache/` | ephemeral query-time artefacts |
| Rollups | `lineage/odd-platform/rollups/` | per-axis YAML reductions |

### Write contracts

- **`file-analyser` is the ONLY writer of per-node sidecars.** One sidecar per node per invocation.
- **Each Layer-3 reducer is the SOLE writer of its top-level artefact.** `concept-merger` owns `concepts.yaml`; `doc-gap-finder` owns `doc-gaps.md`; `adr-archaeologist` owns `implicit-adrs.md` + `refactoring-scopes.md`; `test-coverage-mapper` owns `test-map.yaml`.
- **`feature-flow-builder` is the SOLE writer of `feature-flows.yaml` + `feature-flows/detail/*.yaml`.** `feature-reflector` is the SOLE writer of `feature-reflections/detail/*.yaml`.
- **`probe-runner` is the SOLE writer of `probe-runs/*.yaml` and merges measured values back into sidecars + `feature-flows.yaml` + `test-map.yaml`.**
- Strict layering rule (`APPROACH.md §3, "Rule of layering"`): substrate doesn't read sidecars; sidecars don't read each other; reducers don't read source code; feature-reflector doesn't re-read source code.

### Frequency

Batch-driven, autonomous. `/next-batch` (the batch driver skill) picks themes from `state/sprint-themes.yaml`, spawns 5 file-analyser subagents in parallel, then 5 reducers in parallel, merges deltas, refreshes coverage, commits, pushes — designed for `/loop` overnight runs without maintainer input.

---

## Shared / overlap region

| Surface | Read by Scanner | Read by Ontology |
|---|---|---|
| `../documentation/docs/**` (live + source) | yes — every `docs/*` scanner | yes — `domain-extractor`, `file-analyser` (WebFetch), `doc-gap-finder` |
| `../documentation/docs/SUMMARY.md` | yes — coverage scanners | yes — `doc-gap-finder`, `domain-extractor` |
| `../documentation/docs/main-concepts.md` | indirectly | yes — `concept-merger` anchor |
| `../odd-platform/` source code | yes — accuracy / config / consumer-read scanners | yes — substrate extractor + `file-analyser` 1-hop walks |
| `../odd-platform/odd-platform-specification/openapi.yaml` | yes — spec scanners | yes — `openapi_tags` extractor |
| `navigation/domains/*.md` + `navigation/architecture.md` | yes — mandatory scanner pre-read; mutated post-scan | **no** — ontology doesn't read or write here |
| `adrs/` | yes — `scanners/adrs/completeness.md` | yes — `adr-archaeologist` cross-refs |
| `retrospectives/LSN-*.md` | yes — cited from scanner definitions | yes — cited from agent contracts |

**Conceptually related but neither pipeline reads as a primary input:** `../odd-collectors/` Python is in the scanner's scope (collectors-config scanner, collectors test scanners) but **not in the ontology's substrate** today — the substrate's `manifest.yaml` covers only `odd-platform`. This is the biggest "neither pipeline reads it" asymmetry.

---

## Today's air-gap — the zero formal interfaces

**Pipeline A awareness of Pipeline B:** ZERO. Verified by grep:

```
$ grep -r "feature-flows\|sidecar\|lineage/" scanners/ .claude/skills/scan/ .claude/skills/triage/ .claude/skills/enumerate/
(no output)
```

No scanner definition references `feature-flows.yaml`, `doc-gaps.md`, `concepts.yaml`, `implicit-adrs.md`, `refactoring-scopes.md`, or any `lineage/` path. The triage skill doesn't dedupe against `doc-gaps.md`'s 103 DOC-GAP-NNN findings. The enumerate skill doesn't consult the substrate's 929 nodes. The scan skill's "load existing findings" step (`scan/SKILL.md:32-36`) is scoped to `findings/*/` only — the **103 already-surfaced doc-gaps in `lineage/odd-platform/doc-gaps.md` are invisible to it**, even though they were produced by the same project's other half. Backlog items reference `lineage` only as the data-platform concept (29 hits on `backlog/docs/*.md`), never as an artefact path.

**Pipeline B awareness of Pipeline A:** ONE half-leak. The `doc-gap-finder` agent contract (`.claude/agents/doc-gap-finder.md`) cross-references the scanner findings file `findings/docs-coverage-undocumented-features/2026-05-08.md` by name in 2 places, and `lineage/odd-platform/doc-gaps.md` cites a single F-054 from that same file (1 hit). Beyond that, ontology agents have **no awareness** of `scanners/`, `backlog/`, `issues/`, `state/coverage/`, or `state/PROGRESS.md`. The substrate doesn't ingest backlog items as a node kind; the feature-flow-builder doesn't suppress features the scanner has already triaged; `doc-gap-finder` doesn't write back to the scanner with "stop emitting DOC-GAP-041; backlog already has DOC-088 covering it."

**Net.** Each side discovers gaps about the same docs / same code, and ships them via two independent loops with two independent IDs (DOC-NNN ⊥ DOC-GAP-NNN) and two independent quality bars. The doc-as-product surface is doubly audited; the deduplication is by maintainer memory, not by tooling.

---

## Counts (the disk truth as of 2026-05-27)

| Pipeline A (Scanner) | Count |
|---|---|
| Scanner definitions (`scanners/**/*.md` minus README) | **29** (17 in `docs/`, 2 in `adrs/`, 3 in `navigation/`, 2 in `spec/`, 7 in `tests/`) |
| Findings files (`findings/**/*.md` minus README) | **10** |
| Backlog items (`backlog/**/*.md` minus README) | **165** (all under docs/navigation/tests/spec) |
| Upstream-issue drafts (`issues/**/*.md` minus README) | **16** (10 PLT, 6 COL) |
| Coverage manifests (`state/coverage/*.yaml`) | **6** |
| Navigation domain files (`navigation/domains/*.md`) | **22** |

| Pipeline B (Ontology) | Count |
|---|---|
| Substrate nodes / edges (`nodes.jsonl` / `edges.jsonl`) | **929 / 479** |
| Per-node sidecars (`lineage/odd-platform/understanding/*.md`) | **212** |
| Feature flows (`feature-flows/detail/F-*.yaml`) | **113** |
| Feature reflections (`feature-reflections/detail/*.yaml`) | **1** |
| Concept catalog detail entries (`concepts/detail/**/*.yaml`) | **542** (across 5 axes) |
| Doc-gaps surfaced (unique DOC-GAP-NNN IDs in `doc-gaps.md`) | **103** |
| Doc-gap detail YAMLs (`doc-gaps/detail/*.yaml`) | sample only (the bulk lives inline in `doc-gaps.md`) |
| Shoebox threads (`shoebox/detail/SHB-*.md`) | **124** |
| SME consultation captures | **0** (pattern shipped; no sessions yet) |
| Probe definitions (`probes/P-*.yaml`) | sample of **9** (full corpus pending probe-define) |
| Probe runs (`probe-runs/*.yaml`) | **9** + 1 batch report |
| Meta-reviews (`meta-reviews/{date}/`) | **6 review dirs** |
| Implicit ADRs / refactoring scopes (line counts) | 1512 / 2845 lines |
| Test map (lines) | 8678 lines |
| Agent contracts (`.claude/agents/*.md`) | **14** |
| Skill contracts (`.claude/skills/*/SKILL.md`) | **23** |

**Pipeline A's biggest single-feature gap cluster (`doc-gaps.md` summary):** Auth Mode (15 findings), Data Entity (11), Notifications (8), RBAC (8). **Pipeline B has been doing more discovery, with deeper evidence (Stress Protocol categories A-F, probe-verified vs static-inferred confidence), than Pipeline A has during the same window** — and the maintainer has been the only deduplication channel between the two. This is the rev-13 design problem in one sentence.

---

## Sources

- `scanners/README.md:1-90` — scanner pipeline contract.
- `scanners/docs/{accuracy,completeness,coverage,quality}/*.md` — 17 doc scanner definitions.
- `.claude/skills/{scan,triage,enumerate}/SKILL.md` — scanner protocols.
- `backlog/README.md:1-90` — work item format + lifecycle.
- `issues/README.md:1-30` — handoff convention.
- `APPROACH.md §0-3, §13-15` — ontology methodology (operating stance, four-layer architecture, Layer 0, Stress Protocol, Layer 4b).
- `APPROACH.md L9` (rev-13 paragraph) — the fusion problem statement, this thread's anchor.
- `.claude/agents/*.md` — 14 agent contracts.
- `lineage/_extractor/src/lineage_extractor/` — substrate extractor python layout.
- `lineage/odd-platform/` — every artefact directory listed in the counts table.
- `lineage/odd-platform/feature-flows/detail/F-001.yaml:1-40` — sample feature-flow detail format.
- `lineage/odd-platform/doc-gaps.md:1-30` + summary block — 103 surfaced DOC-GAP findings.
- `lineage/odd-platform/manifest.yaml:1-15` — substrate scan anchor (commit `ede5d277`, 2026-05-26).
