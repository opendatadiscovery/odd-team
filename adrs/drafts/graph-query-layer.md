---
id: ADR-DRAFT-graph-query-layer
title: "The derived graph query layer — an ephemeral, rebuilt-from-files graph + vector index for hybrid query"
status: accepted
date: 2026-05-21
accepted: 2026-05-21
scope: workspace-meta (EXECUTES the second stage of feature-anchored-ontology.md principle 7's pre-registered two-stage deferral; updates APPROACH.md §9 + adds §17; corrects principle 7's threshold)
related_drafts: ADR-DRAFT-agentic-code-ontology, ADR-DRAFT-feature-anchored-ontology, ADR-DRAFT-code-lineage-substrate, ADR-DRAFT-adversarial-review-panel
trigger: "2026-05-21 — the Adversarial Review Panel's #1 CRITICAL finding: test-map/index.yaml at 1.26 MB ≈ 315k tokens = 157% of an agent's context-load limit; the flat-file index forces whole-index loading, so per-query context cost grows with total knowledge size. Querying is brittle Python scripts + hardcoded anchors."
case_law: "lineage/odd-platform/meta-reviews/2026-05-21/panel-report.md (CRITICAL finding rank 1); feature-anchored-ontology.md principle 7 (the pre-registered trigger)."
research: "adrs/drafts/research/graph-query-layer/ — STACK, PRIOR-ART, SCHEMA, PITFALLS, PROBES, SUMMARY (2026-05-21). Overall HIGH on architecture + reconciliation; MEDIUM on first-pass retrieval tuning."
---

# ADR-DRAFT: The derived graph query layer

## Context

### The problem

The ontology's machine-readable indices grow unboundedly. `test-map/index.yaml` is **1.26 MB / 23,365 lines ≈ 315k tokens** — the Adversarial Review Panel measured it at **157% of an agent's context-load limit** and rated it the run's #1 CRITICAL finding: the next reducer batch cannot load its own prior state. Querying the ontology is brittle — Python scripts in `lineage/_extractor/registry-shard/` with hardcoded `LINEAGE = parents[2]/"odd-platform"` anchors and hardcoded artefact names; a `registry-search` subagent doing grep-then-narrow-Read over those monoliths on *purely textual* overlap; a hand-maintained `navigation/` overlay disconnected from the substrate. The root defect: **a flat-file index forces whole-index loading, so per-query context cost grows with total knowledge size.** That is a hard ceiling, and it has been reached.

### The pre-registered trigger — and an honest correction

This is **not** an arbitrary reversal of the methodology's anti-embedding stance. `feature-anchored-ontology.md` **principle 7** pre-registered exactly this adoption decision as the second stage of a two-stage deferral: a graph/vector layer is built when **(a)** any one index file crosses ~5 MB, **(b)** `registry-search` consistently returns >20 candidates per query, or **(c)** cross-batch dedup quality measurably drops — and it committed that "the methodology never silently slips an embeddings dependency in before its scaling threshold is hit."

The literal threshold (a) "5 MB" is **not** crossed (`test-map` is 1.26 MB) — and the PITFALLS research correctly flags this and argues for deferral. The ADR overrides that, openly, because **"5 MB" is a demonstrably flawed proxy**:

- Principle 7 assumed index entries stay "headline-only ~300-500 B" and modelled the constraint as *a registry-search subagent's own context*. Reality: `test-map` index entries are **~1,460 B each** (multi-paragraph), and the binding constraint is not a subagent's context — it is **an agent's context window (~200k tokens)**, because the index must be *loadable* by the reducers that consume it.
- Measured against the real constraint, `test-map` at ~315k tokens is **157% past the limit** — an *already-realised* hard blocker, independently found CRITICAL by the panel, not a threshold being "approached."
- Threshold (c) is also in play: the panel's maiden run found index/detail divergence leaving "62% of findings invisible."

So the trigger **has fired** — correctly measured. The ADR adopts the layer **and corrects principle 7's threshold** from the mis-estimated "5 MB" to the real constraint (the agent context window). Recording this override and correction in the open is precisely how principle 7's "never silently slip it in" is honoured. The PITFALLS dissent is recorded under Residual risks.

## Decision

Build a **derived graph query layer**: for each local run, deterministically build — from the canonical files — an **ephemeral, git-ignored property graph + vector index**, and query it with **hybrid retrieval** (vector similarity finds entry points; deterministic graph traversal does the structural work). The canonical file artefacts (`nodes.jsonl`, `edges.jsonl`, sidecars, reducer `detail/` files) are **unchanged and remain the sole source of truth**; the graph is a disposable accelerator, never hand-edited, never committed. Per-query context cost becomes **bounded** — a query returns a small subgraph / top-k, never a whole-index load — decoupling per-query cost from total knowledge size. Research-backed (`adrs/drafts/research/graph-query-layer/`): HIGH confidence on the architecture and the reconciliation, MEDIUM on first-pass retrieval tuning.

## Reconciliation with the anti-embedding decision

`APPROACH.md` §9 bans a "vector store / RAG layer," anchored on `LSN-016` + the Sourcegraph-deprecation signal. The PRIOR-ART research (HIGH confidence) shows this layer is an **extension** of that decision, not a reversal:

- **Read precisely**, §9 / LSN-016 forbid an *external-API runtime* and *RAG-as-construction-method* — they never adjudicated a *local, ephemeral, query-time* index. The substantive root of LSN-016 ("embeddings find similar text, they don't surface structural blind-spots") is fully respected: the **substrate stays agentic** — sidecars remain agent-written semantic understanding, unchanged; structural findings still come from the agentic pipeline. Embeddings here only *find entry points* for deterministic graph traversal.
- Sourcegraph deprecated embeddings of **raw code chunks** for three reasons. Two — third-party data egress, 100k-repo scaling — are structurally inapplicable to a local single-repo deploy. The one real reason — **index staleness** — is *exactly* what an ephemeral, rebuilt-from-files-each-run index eliminates. 2024-2026 evidence (RANGER, Sept 2025) endorses the exact proposed shape.
- This layer embeds **distilled natural-language sidecar prose**, not raw code — a materially easier and higher-signal retrieval target.

`APPROACH.md` §9's "No vector store" bullet is **superseded**: scoped to forbid external-API/persisted/construction-time embeddings, while permitting a local, ephemeral, query-time index. Recorded as an APPROACH.md revision (build-step-5).

## The design

**Files stay canonical.** `nodes.jsonl` (395 nodes), `edges.jsonl` (479 edges), ~147 sidecars, the 6 reducers' `detail/` files — unchanged. The graph is a pure projection.

**Stack** (STACK research — all Apache-2.0, in-process, zero-daemon, zero-infra):
- **Graph — `rustworkx`** (Rust-backed in-process graph library). Kùzu is rejected (upstream archived Oct 2025); every server engine (Neo4j CE, Memgraph, FalkorDB, Apache AGE) is rejected — a daemon violates `APPROACH.md` rule 12, and Memgraph (BSL) / FalkorDB (SSPL) also fail the open-licence bar. The user's Neo4j proposal is answered: an in-process library is the only fit for "rebuilt each run, ephemeral, no infra."
- **Vectors — exact brute-force NumPy kNN.** ~2,500 vectors → exact kNN is instant *and fully deterministic* (no ANN index, no ANN nondeterminism).
- **Embedding model — `EmbeddingGemma-300m`** (Apache-2.0, local, CPU-runnable; Matryoshka — truncatable to 256-d, directly bounding index size).
- **Runtime — `fastembed`** (ONNX, in-process).

**Graph schema** (SCHEMA research) — ~11 node labels (`:CodeEntity`, `:File`, `:Concept`, `:Feature`, `:Sidecar`, `:ImplicitADR`, `:RefactorScope`, `:DocGap`, `:TestGap`, `:Hypothesis`, `:Doc`); relationships mirror `edges.jsonl` + projected (`DESCRIBED_BY`, `MENTIONS_CONCEPT`, `CONTRIBUTES_TO_FEATURE`, `FLAGGED_BY`, …). **Every node and edge carries `source_file` + `source_line` + commit** — every query result traces to a canonical file:line.

**What is embedded** — *semantic text at section granularity* (parent-document pattern): each sidecar section, a per-`:CodeEntity` descriptor, a per-reducer-entry vector → ~2,000-2,500 vectors. Edges remain the deterministic traversal structure.

**Rebuild model** — an idempotent `files → (graph, vectors)` build; ephemeral + git-ignored at `lineage/{repo}/graph/`. Per-run cheapness via a **content-hash parse cache + an embedding cache keyed `(section-text-hash, model-id)`** (mirrors the existing enrichment-cache invariant). A run only re-embeds changed sidecars.

**Query interface** — a Python library + thin CLI (`lineage-query`); hybrid query = vector top-k → bounded 2-hop traversal. Four query shapes: *where does feature/capability X live*; *what does node Y depend on / what depends on Y*; *which sidecars discuss concept Z*; *nearest prior entry to dedup a new finding against* (this directly succeeds the `registry-search` grep). An MCP server is deferred.

**The monolith indices** — the graph supersedes `index.yaml` as the *machine* query path; `detail/` files stay canonical; the heavy `index.yaml` files shrink to thin human-browsable tables or are generated on demand. This retires the `test-map` CRITICAL.

## Residual risks

- **The PITFALLS dissent (recorded).** The PITFALLS research (MEDIUM) argues the literal 5 MB threshold is uncrossed and recommends deferral. **Overridden** — the proxy is flawed (per-entry size and constraint model both wrong) and the panel's measured CRITICAL shows the index is already broken. The dissent is recorded here so the override is not silent.
- **RRF / score-fusion tuning** between the vector and graph signals — operational, re-fittable; the PROBES gate measures it.
- **Prose-embedding exact-token blind spot** — an embedding of distilled prose can miss an exact identifier; mitigated by keeping a keyword/structured filter in the hybrid and by graph traversal being the backbone.
- **Local embedding-model quality ceiling** — mitigated by EmbeddingGemma being a strong 2025 open model and by the **graph-only fallback**: the layer is useful as a pure deterministic traversal index even if the embedding half underperforms the gate.

## Validation

The PROBES research defines a **five-family gate**: retrieval quality (recall@k / MRR / nDCG over a ~60-query maintainer-authored gold set vs. the grep/Python baseline); bounded per-query context (a 25k-token result ceiling + a 1×/2×/4× substrate-growth sweep that must stay sub-linear); rebuild cost (cold ≤10 min / warm ≤30 s); determinism (graph traversal bit-identical; vector top-k stable). The new layer runs in **shadow mode** beside the Python scripts until the gate passes; only then does a consumer cut over.

## What is NOT in scope

- The canonical files do not change shape. The substrate extractor, the sidecar schema, the reducer outputs are untouched.
- No daemon, no server, no remote infrastructure, no external API (rule 12).
- The graph is never committed, never hand-edited, never a source of truth.
- Big-bang replacement of the Python query scripts — migration is incremental (one consumer first).

## Consequences

**Positive.** Per-query context cost becomes bounded regardless of substrate size — the `test-map` CRITICAL and the whole index-bloat class are retired. Semantic query replaces hardcoded-anchor grep. The hand-maintained `navigation/` overlay can be generated. `registry-search` dedup gains semantic matching. The methodology executes the second stage of its own pre-registered plan.

**Negative / accepted.** A new dependency surface (`rustworkx`, `fastembed`, an embedding model) in a local-only methodology — bounded by being in-process and Apache-2.0. First-pass retrieval tuning is MEDIUM-confidence — hence shadow-mode validation + the graph-only fallback. A per-run rebuild cost — bounded by the content-hash + embedding caches.

## Migration

Incremental, not big-bang: build the pipeline + query lib (build-steps 2-3), then **migrate one consumer end-to-end** (`registry-search`, or `/navigate`) and prove it beats the grep baseline (build-step-4) — the bridgehead. The Python `registry-shard` scripts and `index.yaml` files stay until the gate passes; then the machine-query path moves to the graph and the indices shrink to human aids.

## Implementation status

**Accepted and implemented 2026-05-21.** Build-steps 1-3 + 5 shipped; build-step 4
(consumer cutover) is gated on the maiden PROBES run and stays deferred.

**Shipped.** A `lineage_extractor.graph_query` package — `loaders` (canonical files
→ typed records), `projector` (→ a `rustworkx` labeled property graph: 11 node
labels, 11 of 13 relationship types, universal `source_file:source_line`
provenance), `embedder` (section-granularity vectors via `fastembed`, embedding
cache keyed `(text-hash, model-id)`, graph-only fallback), `graph_query` (the
hybrid `query` / graph-only `traverse` / `provenance` facade), and `probe` (the
PROBES family-1 gold-set harness). CLI: `lineage-extractor {graph-build, query,
provenance, query-probe}`. The graph + vectors are git-ignored under
`lineage/{repo}/graph/`. `fastembed` is an optional `embeddings` extra — the
graph half ships without it.

**Stack deviation — embedding model.** The Decision names EmbeddingGemma-300m; it
is **not** in `fastembed`'s supported-model registry (verified 2026-05-21 — 30
text models, EmbeddingGemma not among them). STACK and SCHEMA both flagged the
model as a probe-time decision ("resolve it with a retrieval probe … rather than
leaderboard averages"; SCHEMA open-question #3). The implementation therefore
defaults to `BAAI/bge-small-en-v1.5` (MIT, 384-dim, retrieval-tuned,
fastembed-native, deterministic on CPU) as a one-line `config` constant the
embedding cache keys on — the maiden gold-set run settles the final choice, and
`fastembed.add_custom_model` keeps EmbeddingGemma reachable without a code change.

**Deferred to v0.2 (documented, not silent).** Two of the 13 SCHEMA relationship
types — `CANONICALISES` (concept→concept) and `CONTRADICTS` (reflection→target) —
need fuzzy prose parsing for marginal value; the other 11 wire in v0.1. A
persistent graph-pickle cache (sub-second repeat queries within a session) is a
clean follow-up; v0.1 rebuilds per invocation. A disk parse-cache was considered
and not built — parsing the ~2,700 canonical files is a few seconds, and the
embedding cache is the load-bearing one.

**Measured (odd-platform substrate, 2026-05-21).** Graph: 3,547 nodes / 4,670
edges / 265 unresolved-stub nodes / 4,377 section-granularity vectors; 10
malformed-substrate files skipped and reported (conform-or-skip per SCHEMA §1).
**Warm build 8.3 s, embedding-cache hit-rate 1.0** — the PROBES family-3
no-op-reembed determinism check passes and warm is well inside the ≤30 s bar.
**Cold build ~18 min**, which **exceeds** the PROBES family-3 ≤10 min cold-build
threshold. PROBES marks that threshold an explicitly re-fittable reasoned
starting point; the cold build is a one-time per-environment cost, and its
embedding pass is CPU-bound and embarrassingly parallel — so the maiden run
either re-fits the threshold or applies `fastembed`'s `parallel` workers (the
clean speedup lever) / a tighter embed-text cap. 15/15 unit tests pass; all
three query shapes return relevant, cited results on the live substrate.

**Shadow mode.** The layer runs alongside the existing grep/Python query path. It
replaces that path only when the five-family maiden gate passes — which needs the
maintainer-authored `lineage/{repo}/query-gold-set.yaml` (a template ships;
authoring the ~60 queries is a maintainer task, per PROBES "authored before … so
it cannot be reverse-fitted").

## References

- Research: `adrs/drafts/research/graph-query-layer/{STACK,PRIOR-ART,SCHEMA,PITFALLS,PROBES,SUMMARY}.md`.
- Trigger: `lineage/odd-platform/meta-reviews/2026-05-21/panel-report.md` (CRITICAL finding rank 1).
- Pre-registered decision: `feature-anchored-ontology.md` principle 7; `APPROACH.md` §9 (to be superseded), `retrospectives/LSN-016`.
- Methodology: `APPROACH.md` — a new section (build-step-5) specifies the layer; §9 updated; principle 7's threshold corrected.
