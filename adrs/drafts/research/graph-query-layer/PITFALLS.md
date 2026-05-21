---
research: graph-query-layer
artifact: PITFALLS
date: 2026-05-21
mode: research (single-thread)
overall_confidence: MEDIUM
---

# PITFALLS — failure modes of a derived ephemeral graph-DB + vector layer over the ontology files

## What this artefact is

The proposal under examination: on each local run, **derive an ephemeral graph DB + vector embeddings (local free model) from the canonical files** (substrate nodes/edges + agent-written sidecar Markdown + reducer outputs), and answer queries via hybrid retrieval (vector similarity + deterministic graph traversal). Files stay canonical and human-readable; the derived layer is disposable and git-ignored. Stated scale: **~2,500 vectors, ~400 nodes**.

This artefact catalogues the failure modes that layer introduces, each with mechanism + cited 2024-2026 evidence + a concrete mitigation scoped to ODD's single-maintainer / OSS / no-budget / local-only constraints. It builds directly on `agentic-code-ontology/PITFALLS.md` (the LLM-enrichment failure catalogue P1-P15) and `agentic-code-ontology/STABILITY.md` (the cost + determinism analysis) — those artefacts already establish that the *generation* side is anchored, hash-keyed, and probe-gated. This artefact covers the *query/retrieval* side, which is new surface.

The framing is the same as the parent artefact: a derived index that is *confidently wrong* is worse than no index, because every consumer downstream — scanners, the `registry-search` subagent, the maintainer — defers to it. The bar is not "retrieval will sometimes miss"; it is "every result traces to a canonical `file:line`, and the failure mode is visible degradation, not silent confident error."

A blunt finding stated up front and revisited in the final section: **at ~2,500 vectors and ~400 nodes the named adoption threshold in `feature-anchored-ontology.md` principle 7 is nowhere near hit.** Most of the pitfalls below are real *in general*; several are not yet load-bearing *at this scale*. The honest engineering answer is that this layer is premature, and the artefact says so concretely rather than cataloguing risks for a thing that should not be built yet.

---

## P1 — Embedding staleness vs the canonical files

**Mechanism.** The canonical files (sidecars, reducer index/detail shards, substrate `nodes.jsonl`) change every batch. The derived embeddings are a *snapshot* of those files at embed-time. If a sidecar's `understanding` text is edited and the vector is not regenerated, every query that should surface the new text retrieves against the stale vector. Because the proposal makes the graph/vector layer *ephemeral and rebuilt per run*, the window is bounded to one run — but within a run, any file touched after the embed step is invisible to retrieval, and any run that reuses a cache (P2) inherits stale vectors keyed to old content.

**Evidence.** This is the single most-documented RAG failure of 2025. The "I Updated My Embedding Model and My RAG Broke" post-mortem ([decompressed.io](https://decompressed.io/learn/rag-observability-postmortem)) describes the *exact* shape: "the most expensive bugs are the ones that don't throw errors" — logs showed 200 OK, normal latency, zero errors, while retrieval returned "semantically adjacent but contextually wrong results." The production-versioning survey ([TianPan.co, 2026-04](https://tianpan.co/blog/2026-04-09-embedding-models-production-versioning-index-drift)) names this the "index drift problem." `agentic-code-ontology/PITFALLS.md` P5 ("stale ontology / abandonment") and the workspace's own LSN-001/LSN-002 are the same failure one layer up — a derived artefact that lied because nobody re-checked it against the source.

**Why it bites ODD specifically.** The whole methodology exists to *find* code-vs-doc drift. A retrieval layer that silently answers from stale vectors manufactures false confidence — the P15 documentation-contamination failure mode recapitulated at the index layer.

**Mitigation.**
- **Embed step is the last step of a run, gated on a clean tree.** The ephemeral layer is built *after* all sidecars/reducers for the run have committed; the build refuses to start if `git status` is dirty. A vector's content is always a committed file state.
- **Every vector carries `source_file` + `source_commit` + `content_sha256` in its metadata.** A retrieval result whose `source_commit != HEAD` is flagged `STALE` in the result payload — visible degradation, never silent.
- **The derived layer is never the source of truth.** Per the proposal's own premise: files are canonical. Any retrieval result is a *pointer* the consumer resolves by reading the canonical file at the cited `file:line`. The vector is an index into truth, not a substitute for it.
- Confidence: HIGH that this is mitigable; the per-run-rebuild design already bounds the staleness window to a single run.

## P2 — Per-run (re-)embedding cost and the content-hash cache that bounds it

**Mechanism.** "Rebuild the graph/vector layer each run" sounds cheap until the corpus is large or the run cadence is high. Embedding 2,500 chunks on every `/next-batch` invocation, every `/status`, every `/navigate` is wasted compute if 95% of chunks are unchanged. The naive ephemeral design — *delete and rebuild from zero each run* — has no cost ceiling; it scales linearly with run frequency, not with change volume.

**Evidence.** The incremental-embedding literature is unanimous on the fix. The RAG-factory technical guide ([NStarX, 2025](https://nstarxinc.com/blog/from-data-lake-to-rag-factory-the-technical-view-building-incremental-embedding-pipelines-without-melting-your-cloud-bill/)): "the most impactful approach to control embedding costs is to never recompute a vector you already have… compute a hash of its content and compare it against what is already stored — if the hash matches, skip the chunk. If 90% of your document corpus is unchanged, your embedding cost for that run should reflect roughly 10% of a full recompute, not 100%." This mirrors exactly the `content-hash-keyed caching` already adopted for the LLM-enrichment layer in `STABILITY.md` (§"Anchor on substrate-derived IDs") and `agentic-code-ontology/PITFALLS.md` P3.

**The cost at ODD's actual scale is small but not zero.** EmbeddingGemma-300M runs on CPU ([HuggingFace](https://huggingface.co/blog/embeddinggemma)) — a local free model, so there is no API line item; the cost is wall-clock + battery, not dollars. A cold embed of 2,500 short chunks on a CPU is on the order of seconds-to-low-minutes. The content-hash cache reduces a warm run to embedding only the batch's deltas (typically <50 chunks). The cost concern is therefore not "this is expensive" but "rebuilding from zero each run wastes the maintainer's wall-clock for no benefit."

**Mitigation.**
- **The cache is not optional — it is the design.** Persist `{content_sha256 → vector}` in a git-ignored local file (e.g. a SQLite table or a flat `.npy` + manifest). "Ephemeral" applies to the *graph DB and the ANN index*, not to the embedding cache, which is keyed by content and is safe to keep across runs because a hash collision is the only way it can be wrong.
- **The cache key is `(content_sha256, model_id, model_revision)`.** A model-version bump (P5) invalidates the whole cache by construction — see P5/P9.
- **Per-chunk hashing, not per-file.** The NStarX guide warns: "hashing the whole file triggers re-embedding of all chunks on a one-character change." Sidecar chunks are already small and individually addressable (one chunk per sidecar section), so chunk-level hashing is natural and avoids whole-file re-embed churn.
- Confidence: HIGH. The cache fully bounds the cost; the only failure is forgetting to build it and shipping the delete-and-rebuild naive path.

## P3 — Local embedding-model quality ceiling

**Mechanism.** The proposal mandates a *local free* embedding model (correct, per LSN-016 and the workspace's local-only rule). Local models under ~500M parameters have a real, measurable quality gap versus frontier closed models. A lower-quality embedding produces a retrieval surface with more false positives (P4) and more misses — and the maintainer cannot tell which, because retrieval failures are silent (P1).

**Evidence.** EmbeddingGemma-300M is "the highest-ranking text-only multilingual embedding model under 500M parameters on MTEB" ([HuggingFace](https://huggingface.co/blog/embeddinggemma)) — but "under 500M" is the operative qualifier. On the MTEB leaderboard, Cohere embed-v4 scores 65.2 and OpenAI text-embedding-3-large 64.6, while EmbeddingGemma is "comparable to 596M-parameter models" — i.e. competitive within its weight class, not with the frontier ([Ailog](https://app.ailog.fr/en/blog/guides/choosing-embedding-models), [BentoML](https://www.bentoml.com/blog/a-guide-to-open-source-embedding-models)). For *code* specifically the gap is wider: the strong open code-retrieval models (Nomic Embed Code, SFR-Embedding-Code) are **7B-class** ([Salesforce SFR](https://www.salesforce.com/blog/sfr-embedding-code/), [Nomic](https://www.morphllm.com/ollama-embedding-models)) — two orders of magnitude larger than EmbeddingGemma, and not "free to run on a laptop" in practice.

**Why it bites less than it first appears for ODD.** The corpus being embedded is **not raw code** — it is agent-written sidecar *prose* (the `understanding` field, `bugs_limitations_corner_cases`, reducer headlines). Sidecar text is natural-language technical English, which is exactly what a sub-500M general embedding model is *good* at — far better than it is at raw Java/TypeScript. The "code embedding needs a 7B model" evidence applies to embedding source files; it applies only weakly to embedding sidecar narratives. This materially de-risks P3 for the specific corpus the proposal targets.

**Mitigation.**
- **Embed sidecar prose, not source code.** The retrieval target is the semantic layer the agents already wrote. This sidesteps the code-embedding quality cliff entirely.
- **Pin the model with `model_id` + `revision` hash** in the cache key and in the run manifest (mirrors `STABILITY.md` §"Pin the model snapshot").
- **Vector retrieval is a *candidate generator*, never a *ranker of record*.** Final precision comes from the deterministic graph traversal (P10) and from the consumer reading the canonical file. A weak embedding that surfaces a slightly-wrong top-5 is acceptable when the graph edges and the `file:line` resolution do the precision work.
- **Probe the retrieval quality** — see P11/P12 and `agentic-code-ontology/PROBES.md`. A held-out set of "query → expected canonical node" pairs measures recall@k for the local model; if it falls below a floor, the layer is not adopted.
- Confidence: MEDIUM. The prose-not-code argument is sound but unverified for ODD's actual sidecar corpus; a probe set settles it.

## P4 — Vector-search false positives on technical text

**Mechanism.** Bi-encoder embeddings average contextual qualifiers into a single dense vector. On technical text — where two passages can share 90% of their tokens (`incrementViewCount` vs `decrementViewCount`; "Spring bean factory for MinIO" vs "Spring bean factory for S3") and differ only in the one token that flips the meaning — cosine similarity reports them as near-identical. The retrieval layer surfaces a *plausible-but-wrong* node, and because the prose reads correctly the maintainer has no error signal.

**Evidence.** The InfoQ banking case study ([InfoQ](https://www.infoq.com/articles/reducing-false-positives-retrieval-augmented-generation/)) documents "context preservation failures where the model incorrectly retrieves answers that are technically correct but completely out of context… because bi-encoders' dense vectors average out contextual qualifiers" — their example pair "How do I buy stocks after hours?" vs "How do I buy stocks" scoring as near-equal is structurally identical to the ODD code case. Identifier-embedding research is blunter: "identifiers with opposing meanings are incorrectly considered to be similar" and "practically all techniques struggle with abbreviations" ([IdBench, arxiv 1910.05177](https://arxiv.org/pdf/1910.05177)); CodeBERT "does not intrinsically encode deeper code logic" ([EmergentMind](https://www.emergentmind.com/topics/codebert-embeddings)). The Meilisearch guide names the general failure "over-generalization… documents only loosely related to the query intent" ([Meilisearch](https://www.meilisearch.com/blog/semantic-vs-vector-search)).

**Why it bites ODD specifically.** ODD's domain is full of near-synonym pairs that differ by exactly the load-bearing token — the `agentic-code-ontology/PITFALLS.md` P1 misleading-name failure (`UserManager` that is a notification dispatcher) now appears at the *retrieval* layer, not just the generation layer.

**Mitigation.**
- **Hybrid retrieval, not vector-only.** Pair every vector query with a deterministic lexical/keyword pass (BM25 or exact substring on identifiers + file paths). The lexical pass catches the `incrementViewCount`/`decrementViewCount` distinction the dense vector blurs. Fusion is covered in P11.
- **Graph traversal disambiguates.** A vector hit is only promoted if it is graph-reachable from the query's anchor node along a typed edge. A semantically-similar-but-structurally-unconnected node is dropped.
- **Never present a vector hit as an answer — present it as a candidate the consumer verifies** by reading the canonical `file:line` (P13).
- **Score-threshold floor.** Cosine below a calibrated floor returns "no confident match" rather than the least-bad hit (the DeepLearning.AI no-results discussion ([forum](https://community.deeplearning.ai/t/how-to-deal-with-no-results-retrieval/421021)) — surfacing "nothing matched" beats surfacing a false positive).
- Confidence: MEDIUM. Hybrid + graph + verification reduce false positives substantially but do not eliminate them; the residual is accepted as a known trade-off (consistent with the parent artefact's "what we will NOT prevent").

## P5 — Determinism: reproducible embeddings, model pinning, ANN nondeterminism

**Mechanism.** Three independent determinism risks. (a) **Embedding nondeterminism** — the same text run through the same model on different hardware (or different batch sizes) produces bitwise-different vectors, because GPU/CPU floating-point reduction is non-associative. (b) **Model-version drift** — a model pulled by alias (`embeddinggemma:latest`) silently changes when the registry updates, shifting the entire vector space. (c) **ANN nondeterminism** — approximate-nearest-neighbour indexes (HNSW) return different neighbours depending on insertion order and graph-construction randomness.

**Evidence.**
- **(a)** "Matrix-vector multiply often results in different floating-point values on different GPUs, since GPUs accumulate in different orders" ([Hawkeye, arxiv 2603.20421](https://arxiv.org/pdf/2603.20421)); "hidden batch-size dependence in GPU inference kernels" ([Thinking Machines Lab](https://thinkingmachines.ai/blog/defeating-nondeterminism-in-llm-inference/)); the floating-point non-associativity analysis ([arxiv 2408.05148](https://arxiv.org/html/2408.05148v3)) and "Valori" ([arxiv 2512.22280](https://arxiv.org/pdf/2512.22280)) confirm only fixed-point arithmetic yields bit-identical results — a general embedding model will not be bit-identical across machines.
- **(b)** Model deprecation/rollover is a documented, scheduled event: `text-embedding-gecko@003` retired 2025-05-24, `text-embedding-004` deprecated 2026-01-14 ([HackerNoon](https://hackernoon.com/your-embedding-model-will-deprecate-heres-what-to-do), [firebase/genkit #4551](https://github.com/firebase/genkit/issues/4551)). Local models are pulled from registries that re-tag too.
- **(c) — the key mitigating fact for ODD.** HNSW is approximate by construction: "results aren't always the true k closest neighbours," and benchmark runs "shift rankings by up to three positions" depending on data characteristics ([Elasticsearch HNSW](https://www.elastic.co/search-labs/blog/hnsw-knn-search-early-termination), [HNSW recall study, arxiv 2405.17813](https://arxiv.org/pdf/2405.17813)). **But brute-force exact kNN "performs an exhaustive search and therefore guarantees an exact vector search result"** ([Elastic kNN docs](https://www.elastic.co/docs/solutions/search/vector/knn)), and "brute-force nearest-neighbour search might be the best choice when dataset size is limited" ([Zilliz](https://zilliz.com/learn/learn-hnswlib-graph-based-library-for-fast-anns)). **At ~2,500 vectors, exact brute-force kNN is sub-millisecond and eliminates ANN nondeterminism entirely.** There is no engineering reason to run an approximate index at this scale; doing so would import nondeterminism for a speed-up the corpus does not need.

**Mitigation.**
- **Use exact brute-force kNN, not HNSW/IVF.** At 2,500 vectors × 768 dims a full scan is a single small matrix multiply — fast, and *deterministic in ranking* given fixed vectors. This removes risk (c) outright. Adopting an ANN index is a decision deferred until the corpus is orders of magnitude larger (and is itself one face of principle 7's threshold).
- **Pin `model_id` + exact `revision` hash; treat a model bump as a full cache rebuild.** Mirrors `STABILITY.md` anti-pattern 8.
- **Accept embedding nondeterminism; engineer for *rank* stability, not *bit* stability.** Per `STABILITY.md` §1: bit-identical is not achievable. Cache the vectors (P2) so within one machine the same content always yields the same stored vector; cross-machine bitwise drift is then irrelevant because each machine rebuilds its own cache and ranking is stable within it. Pin BLAS threading (`OMP_NUM_THREADS=1`) if intra-machine reproducibility of the embed step itself is wanted.
- **Probe-test rank stability** — re-embed a fixed probe set twice, assert top-k rank identity within a machine (mirrors `STABILITY.md` Probe 1).
- Confidence: HIGH. The exact-kNN-at-this-scale fact is decisive; the embedding-nondeterminism residual is real but the cache neutralises it operationally.

## P6 — The graph DB becoming a new unbounded artefact

**Mechanism.** "Query, don't load" is the promise: instead of a reducer loading a 700 KB monolith into context, it queries a graph DB and pulls only the sub-graph it needs. The failure: a *query* that traverses an unbounded number of hops, or matches an unbounded number of nodes, returns a result set as large as the monolith it replaced — the cost was moved, not bounded. An unbounded `MATCH (a)-[*]->(b)` Cypher-style traversal on a connected graph can return the whole graph.

**Evidence.** This is the well-known graph-query blow-up — variable-length path queries are worst-case exponential in path length. The workspace's own `feature-anchored-ontology.md` revision-2 trigger is precisely this shape one layer up: reducer context "grows linearly per batch" until artefacts hit 700 KB and reducers "stream-idle timeout" / "rate-limit hit." Moving the storage to a graph DB does **not** by itself bound per-query cost; only a *bounded query contract* does.

**Why it bites ODD specifically.** At ~400 nodes the graph is small enough that even a whole-graph return is ~400 nodes — *today this is not a real problem*. The pitfall is latent: it becomes real only if the node count grows by orders of magnitude, at which point it is one of the things principle 7's threshold is meant to catch. Naming it now prevents a future maintainer from assuming "query-not-load" is self-bounding.

**Mitigation.**
- **"Query-not-load" only bounds cost if queries are bounded.** Every query the layer exposes must declare a max-hop depth (default ≤2) and a max-result-cardinality (default ≤50). Unbounded `[*]` traversals are not in the query API.
- **The bounded-query contract is the actual mechanism**, not the graph DB. The existing `registry-search` subagent already implements this without a graph DB — `max_candidates: 5`, read-only `Grep`/`Read`, returns 0-5 verbatim candidates + a verdict. That is a bounded query over the sharded index files. A graph DB is not required to get the bound; the *sharded-index + bounded-search-subagent* shape (`feature-anchored-ontology.md` principles 6-7) already delivers it.
- **At 400 nodes, do not introduce a graph DB at all** — see the final section. NetworkX-in-memory (≈zero install, MIT) or the substrate's existing `edges.jsonl` traversed with a 30-line BFS is sufficient and adds no dependency.
- Confidence: HIGH that the bounded-query contract is the real lever; HIGH that at 400 nodes the unboundedness is not yet a live problem.

## P7 — Operational and dependency weight in a local-only methodology

**Mechanism.** The methodology's defining constraint is *local-only, zero-infrastructure, single unfunded maintainer* (CLAUDE.md; APPROACH.md §5 rule 12; LSN-016). Every dependency added — a graph DB engine, a vector DB, an embedding-model runtime, their transitive native libraries — is weight the maintainer must install, version-pin, keep working across OS upgrades, and debug when it breaks. A local-only methodology that requires a Docker daemon, a native graph engine, and a GPU runtime is no longer "point Claude Code at the workspace and go" (the portability promise in CLAUDE.md §"Portability").

**Evidence — and a sharp 2025 cautionary case.** **Kuzu, the leading embedded graph DB, was acquired by Apple in October 2025 and its open-source repository archived** ([gdotv Weekly Edge, 2025-10-17](https://gdotv.com/blog/weekly-edge-adieu-kuzu-state-of-the-graph-17-october-2025/)). A workspace that had adopted Kuzu as its "lightweight embedded graph DB" in mid-2025 would now be on an unmaintained dependency, facing a migration to a community fork (Ladybug) or to DuckDB's `DuckPGQ` extension ([gdotv, 2025-10-24](https://gdotv.com/blog/weekly-edge-kuzu-forks-duckdb-graph-cypher-24-october-2025/)). This is the dependency-weight risk made concrete: the *embedded* graph-DB category is young and churning, and a solo maintainer cannot absorb a forced migration. The general portability hazard is also documented in the embedding-on-the-move analysis ([Medium](https://medium.com/@rawangaonkarrr/embeddings-on-the-move-model-deprecation-and-the-hidden-cost-of-transition-10c95f973fc9)).

**Mitigation.**
- **Prefer a library over a server; prefer a file over a daemon.** If a graph layer is built at all, NetworkX (pure-Python, MIT, in-memory, no native deps) over any embedded-DB engine; the brute-force kNN is ~20 lines of NumPy over any vector DB. The substrate's `edges.jsonl` is already the graph — it does not need re-housing.
- **No Docker, no server process, no GPU requirement** for the query layer. EmbeddingGemma on CPU satisfies this ([HuggingFace](https://huggingface.co/blog/embeddinggemma)).
- **The dependency budget is a first-class acceptance criterion.** Adopting this layer must not change the bootstrap from "read APPROACH.md, run Claude Code" to "also install and maintain N services." If it does, it fails the portability gate.
- **Pin and vendor-check every dependency**; record `model_id`, library versions in the run manifest so a future break is diagnosable.
- Confidence: HIGH. The Kuzu case is decisive evidence that the embedded-graph-DB category is too unstable for a solo OSS maintainer to depend on in 2026.

## P8 — Repeating the deprecated-embeddings mistake

**Mechanism.** LSN-016 and `feature-anchored-ontology.md` principle 7 record a deliberate decision: **no vector store / no embeddings until a named scaling threshold is hit.** The risk is that this research, by enumerating mitigations in detail, becomes a de-facto green light — the layer gets built because the *how* was worked out, not because the *threshold* was reached. That is the LSN-013 failure (research punted into a decision) inverted: research that quietly authorises a premature build.

**Evidence.** `feature-anchored-ontology.md` principle 7 is explicit and pre-registered: the vector store is built when **(a)** any one index file crosses ~5 MB, **OR (b)** `registry-search` consistently returns >20 candidates per query, **OR (c)** cross-batch dedup quality drops measurably (maintainer-triggered merge-fixups rise). It further states: "The deferral order is honoured strictly; the methodology never silently slips an embeddings dependency in before its scaling threshold is hit." The deprecation literature independently shows the layer is *not free to add and revert* — adopting embeddings creates a corpus that must be re-embedded on every model deprecation ([HackerNoon](https://hackernoon.com/your-embedding-model-will-deprecate-heres-what-to-do); the embedding-spaces-are-incompatible result, [Medium / Stafford](https://medium.com/data-science-collective/different-embedding-models-different-spaces-the-hidden-cost-of-model-upgrades-899db24ad233)). An embeddings dependency added prematurely is not a cheap experiment; it is a standing maintenance liability.

**Mitigation.**
- **Gate the build on principle 7's thresholds, measured — not on this artefact's existence.** Before any embedding code is written, the maintainer records the current values: largest index file size (MB), median `registry-search` candidate count, merge-fixup rate. The build proceeds only if a threshold is crossed.
- **This artefact is a *contingency plan*, not an authorisation.** Its correct use: when a threshold *is* hit, the maintainer already knows the failure modes and mitigations. Its incorrect use: treating "the pitfalls are mitigable" as "therefore build it now."
- See the final section for the explicit threshold check against the stated ~2,500-vector / ~400-node scale.
- Confidence: HIGH. Principle 7 is unambiguous; the only risk is procedural (ignoring it), and the mitigation is to make the threshold check a literal pre-build step.

## P9 — The deprecated-embeddings re-embed liability (model churn over time)

**Mechanism.** Distinct from P8's "don't build it early" — this is "once built, it carries a recurring tax." Embedding models deprecate on vendor schedules; local models get re-tagged in registries. Each change forces a full re-embed of the entire corpus, because **vectors from two models occupy incompatible spaces and cannot be compared** — a half-migrated index silently compares apples to oranges.

**Evidence.** "Vectors from different models cannot be compared with cosine similarity… like overlaying GPS coordinates from different map projections" ([decompressed.io post-mortem](https://decompressed.io/learn/rag-observability-postmortem)). "Different embedding models produce incompatible vector spaces… update documents before switching the query embedding model to ensure queries and documents are always in the same semantic space" (web survey of migration practice). Re-embed cost scales with corpus: ~$10 / 1M docs on a hosted small model, ~$500 / 50M docs ([HackerNoon](https://hackernoon.com/your-embedding-model-will-deprecate-heres-what-to-do)) — for ODD's 2,500 chunks on a *local* model the dollar cost is zero and the wall-clock is seconds, so the *cost* of a re-embed is trivial. The liability is not cost; it is the **silent half-migrated-index correctness trap** and the recurring maintainer attention it demands.

**Why it bites less for ODD — and where it still bites.** Because the layer is *ephemeral and rebuilt per run*, a model change is handled by simply bumping `model_id` and rebuilding from zero next run — there is no long-lived index to half-migrate. This is a genuine structural advantage of the ephemeral design over a persistent vector DB. The residual bite: the *content-hash cache* (P2) is persistent and keyed by content; if the model changes and the cache key does not include `model_id`, the cache serves vectors from the old model into the new run's space — the exact half-migrated trap.

**Mitigation.**
- **Cache key MUST be `(content_sha256, model_id, model_revision)`.** A model bump changes the key, invalidates every entry, forces a clean re-embed. This single rule converts P9 from a trap into a non-event.
- **The ephemeral graph/ANN layer is rebuilt per run anyway** — no persistent index to migrate. Lean on this; do not add a persistent vector DB that would re-introduce the migration problem.
- **One model, recorded in the run manifest.** Never mix vectors from two models in one index — enforced by the cache key + the per-run rebuild.
- Confidence: HIGH. The ephemeral design plus a correct cache key makes this fully mitigable.

## P10 — Hybrid-retrieval fusion failure modes

**Mechanism.** Hybrid retrieval fuses two ranked lists — vector similarity and graph traversal (or vector + lexical). Fusion has its own failure surface. **Score-based fusion** (weighted sum of similarity scores) is broken because the two scores live in incomparable spaces — cosine ∈ [0,1], BM25 unbounded, graph "distance" is hop-count. **Rank-based fusion (RRF)** fixes the scale problem but has a different failure: when the two result lists are *disjoint* — no document in both — RRF cannot fuse, it merely interleaves, and the maintainer gets an arbitrary mix rather than a consensus ranking.

**Evidence.** "The naive approach uses weighted combination of scores, which is flawed because BM25 and cosine similarity scores exist in different spaces… BM25 scores are unbounded, while cosine similarity lives in [0,1]" ([avchauzov, 2025](https://avchauzov.github.io/blog/2025/hybrid-retrieval-rrf-rank-fusion/)). "Min-Max normalization is very sensitive to outliers — a single document with an unusually high BM25 score could skew the entire list" ([same / BigDataBoutique](https://bigdataboutique.com/blog/reciprocal-rank-fusion-how-it-works-and-when-to-use-it)). The RRF disjoint-list failure is documented: "if search results are totally disjoint… RRF will simply interleave the results. The algorithm only truly begins to 'fuse' and re-sort when documents start appearing in multiple lists" ([OpenSearch](https://opensearch.org/blog/introducing-reciprocal-rank-fusion-hybrid-search/)).

**Why it bites ODD specifically.** ODD's two retrieval channels are *deliberately different in kind*: vector similarity over fuzzy prose, deterministic graph traversal over typed edges. Disjoint result lists are not an edge case here — they are the *expected* case (a vector hit on a sidecar's prose and a graph hit on an `imports` edge often surface different nodes). Naive RRF on these will interleave, not fuse.

**Mitigation.**
- **Use RRF, never weighted-score fusion** — eliminates the scale-incomparability failure ([OpenSearch is the de-facto default across Elasticsearch / Azure AI Search / Weaviate / MongoDB Atlas](https://opensearch.org/blog/introducing-reciprocal-rank-fusion-hybrid-search/)).
- **Treat graph traversal as a *hard filter*, not a fusion input.** The cleanest design for ODD is not "fuse two soft rankings" but "vector generates candidates; graph reachability filters them; the filtered set is presented with provenance." This sidesteps the disjoint-list problem because the graph is a boolean gate, not a ranked list to merge.
- **When the lists genuinely must be fused, surface the fusion basis** — label each result `vector-only` / `graph-only` / `both`, so a maintainer reading a `vector-only` result knows the graph did not corroborate it.
- **Probe fusion quality** with query→expected-node pairs; if RRF interleaving produces low precision@k, fall back to the filter design.
- Confidence: MEDIUM. RRF + graph-as-filter is a sound design; "fusion" in the proposal's loose sense hides real failure modes that the filter framing avoids.

## P11 — Retrieval-quality evaluation gap (silent recall failure)

**Mechanism.** Retrieval failures are *silent* — a query that misses the right node returns *something*, with no error. Without a measured recall@k against known-correct answers, the maintainer cannot tell a healthy retrieval layer from a broken one. This is P7 of the parent artefact ("evaluation gap") specialised to retrieval: the layer ships, and "is retrieval 90% or 50% accurate?" has no answer.

**Evidence.** The post-mortem's core lesson: standard monitoring (logs, latency, error rate) is blind to retrieval degradation — "logs showed 200 OK… retrieved results appeared plausible but were semantically misaligned" ([decompressed.io](https://decompressed.io/learn/rag-observability-postmortem)). The fix it prescribes: "canary queries" and "retrieval stability monitoring." The theoretical-limitations result is a hard ceiling worth knowing: "the number of top-k subsets of documents capable of being returned… is limited by the dimension of the embedding" ([arxiv 2508.21038](https://arxiv.org/abs/2508.21038)) — at 768 dims this ceiling is far above ODD's 2,500-vector scale, so it is not binding here, but it means recall *cannot* be assumed perfect even with a flawless model.

**Mitigation.**
- **A retrieval probe set is mandatory before adoption** — extend `agentic-code-ontology/PROBES.md` with `(query, expected_canonical_node_id)` pairs the maintainer hand-authors. Measure recall@5 and MRR. Floor: recall@5 ≥ 0.9 on the probe set, or the layer is not adopted.
- **Canary queries each run** — a fixed handful of queries with known answers; a run whose canaries regress surfaces a warning, not a silent pass (mirrors `STABILITY.md` Probe 2 noise-floor).
- **The probe set is human-authored and version-controlled** — never LLM-generated (parent artefact P13 gameability).
- Confidence: HIGH that a probe set closes the gap; the probe set is cheap (hand-authored pairs) and is the same discipline already established for the generation layer.

## P12 — Provenance and trust: every result must trace to a canonical `file:line`

**Mechanism.** The derived layer's results must be *verifiable*, not *trusted*. If a retrieval result is a free-text snippet or an embedding-derived summary with no pointer back to the canonical file, the consumer (a reducer, a scanner, the maintainer) has no way to check it — and a false positive (P4) or stale hit (P1) is absorbed as fact. The methodology's entire claim to correctness rests on `code_anchor: file:line` being present and resolvable (parent artefact's cross-cutting theme 1; CLAUDE.md Gate 9).

**Evidence.** RAG provenance is a 2025-2026 consensus requirement: "it is essential that the pipeline maintains a robust and auditable link between the specific chunks retrieved and the segments of the generated output" ([FINOS AI Governance](https://air-governance-framework.finos.org/mitigations/mi-13_providing-citations-and-source-traceability-for-ai-generated-information.html)); "preserves document provenance by embedding and retrieving only extracted source content, rather than LLM-generated summaries, enabling span-level traceability" ([arxiv 2603.14170](https://arxiv.org/html/2603.14170)); "without proper citations, RAG becomes a black box" ([Ailog](https://app.ailog.fr/en/blog/guides/citation-sourcing-rag)). The workspace's own Gate 9 bans "looks right / presumably / safe to assume" without `VERIFIED via {fetch/grep/read}`.

**Mitigation.**
- **Every vector embeds a *chunk of a canonical file*, and every retrieval result carries `source_file`, `source_lines`, `source_commit`.** No vector is created from an LLM-generated summary of a file — only from the file's own committed content (the sidecar Markdown *is* the canonical artefact, so embedding its text is embedding canonical content; this is the FINOS "embed extracted source content, not summaries" rule satisfied by construction).
- **A retrieval result is a pointer, not an answer.** The consumer's required next step is to read the canonical file at the cited range. The derived layer never *answers*; it *locates*.
- **Results failing provenance resolution are dropped, not shown.** If `source_file:source_lines` does not resolve against `HEAD`, the result is discarded with a `STALE`/`UNRESOLVED` log line — visible degradation (parent artefact theme 4).
- Confidence: HIGH. Because the embedded corpus *is* the canonical sidecar files, provenance is structural, not bolted on — this is the strongest single argument that the layer, *if* built, can be made trustworthy.

---

## Sources

### Embedding staleness, model deprecation, migration
- [I Updated My Embedding Model and My RAG Broke: A Post-Mortem (decompressed.io)](https://decompressed.io/learn/rag-observability-postmortem)
- [Your Embedding Model Will Deprecate. Here's What to Do (HackerNoon)](https://hackernoon.com/your-embedding-model-will-deprecate-heres-what-to-do)
- [Embeddings on the Move: Model Deprecation and the Hidden Cost of Transition (Medium / Rawangaonkar)](https://medium.com/@rawangaonkarrr/embeddings-on-the-move-model-deprecation-and-the-hidden-cost-of-transition-10c95f973fc9)
- [Different Embedding Models, Different Spaces: The Hidden Cost of Model Upgrades (Medium / Stafford)](https://medium.com/data-science-collective/different-embedding-models-different-spaces-the-hidden-cost-of-model-upgrades-899db24ad233)
- [Embedding Models in Production: Selection, Versioning, and the Index Drift Problem (TianPan.co)](https://tianpan.co/blog/2026-04-09-embedding-models-production-versioning-index-drift)
- [Google text-embedding-004 Deprecation & Migration (firebase/genkit issue #4551)](https://github.com/firebase/genkit/issues/4551)

### Local embedding model quality
- [Welcome EmbeddingGemma, Google's new efficient embedding model (HuggingFace)](https://huggingface.co/blog/embeddinggemma)
- [Best Embedding Models 2025: MTEB Scores & Leaderboard (Ailog RAG)](https://app.ailog.fr/en/blog/guides/choosing-embedding-models)
- [The Best Open-Source Embedding Models in 2026 (BentoML)](https://www.bentoml.com/blog/a-guide-to-open-source-embedding-models)
- [Ollama Embedding Models: Benchmarks, VRAM, and Which to Use (Morph)](https://www.morphllm.com/ollama-embedding-models)
- [SFR-Embedding-Code: A Family of Embedding Models for Code Retrieval (Salesforce)](https://www.salesforce.com/blog/sfr-embedding-code/)

### Vector-search false positives on technical / code text
- [Reducing False Positives in RAG Semantic Caching: a Banking Case Study (InfoQ)](https://www.infoq.com/articles/reducing-false-positives-retrieval-augmented-generation/)
- [Semantic search vs Vector search (Meilisearch)](https://www.meilisearch.com/blog/semantic-vs-vector-search)
- [IdBench: Evaluating Semantic Representations of Identifier Names in Source Code (arxiv 1910.05177)](https://arxiv.org/pdf/1910.05177)
- [CodeBERT Embeddings (EmergentMind)](https://www.emergentmind.com/topics/codebert-embeddings)
- [On the Theoretical Limitations of Embedding-Based Retrieval (arxiv 2508.21038)](https://arxiv.org/abs/2508.21038)
- [How to deal with no results retrieval? (DeepLearning.AI forum)](https://community.deeplearning.ai/t/how-to-deal-with-no-results-retrieval/421021)

### Determinism — embedding nondeterminism and ANN vs exact kNN
- [Defeating Nondeterminism in LLM Inference (Thinking Machines Lab)](https://thinkingmachines.ai/blog/defeating-nondeterminism-in-llm-inference/)
- [Impacts of floating-point non-associativity on reproducibility (arxiv 2408.05148)](https://arxiv.org/html/2408.05148v3)
- [Hawkeye: Reproducing GPU-Level Non-Determinism (arxiv 2603.20421)](https://arxiv.org/pdf/2603.20421)
- [Valori: A Deterministic Memory Substrate for AI Systems (arxiv 2512.22280)](https://arxiv.org/pdf/2512.22280)
- [kNN search in Elasticsearch — exact brute-force guarantees (Elastic Docs)](https://www.elastic.co/docs/solutions/search/vector/knn)
- [HNSW: Faster approximate KNN search with early termination (Elasticsearch Labs)](https://www.elastic.co/search-labs/blog/hnsw-knn-search-early-termination)
- [HNSWlib: A Graph-based Library for Fast ANN Search — brute-force best for small datasets (Zilliz)](https://zilliz.com/learn/learn-hnswlib-graph-based-library-for-fast-anns)
- [The Impacts of Data, Ordering, and Intrinsic Dimensionality on Recall in HNSW (arxiv 2405.17813)](https://arxiv.org/pdf/2405.17813)

### Per-run cost / content-hash incremental embedding
- [Building Incremental Embedding Pipelines Without Melting Your Cloud Bill (NStarX)](https://nstarxinc.com/blog/from-data-lake-to-rag-factory-the-technical-view-building-incremental-embedding-pipelines-without-melting-your-cloud-bill/)
- [Building Production RAG: Architecture, Chunking, Evaluation & Monitoring 2026 Guide (PremAI)](https://blog.premai.io/building-production-rag-architecture-chunking-evaluation-monitoring-2026-guide/)

### Hybrid-retrieval fusion
- [Introducing reciprocal rank fusion for hybrid search (OpenSearch)](https://opensearch.org/blog/introducing-reciprocal-rank-fusion-hybrid-search/)
- [Hybrid retrieval with reciprocal rank fusion: solving the score normalization problem (avchauzov)](https://avchauzov.github.io/blog/2025/hybrid-retrieval-rrf-rank-fusion/)
- [Reciprocal Rank Fusion (RRF): How It Works and When to Use It (BigData Boutique)](https://bigdataboutique.com/blog/reciprocal-rank-fusion-how-it-works-and-when-to-use-it)

### Operational / dependency weight — embedded graph DB churn
- [The Weekly Edge: Adieu Kuzu — Kuzu acquired by Apple, repo archived (gdotv, 2025-10-17)](https://gdotv.com/blog/weekly-edge-adieu-kuzu-state-of-the-graph-17-october-2025/)
- [The Weekly Edge: Kuzu Forks, DuckDB Goes Graph (gdotv, 2025-10-24)](https://gdotv.com/blog/weekly-edge-kuzu-forks-duckdb-graph-cypher-24-october-2025/)
- [Kùzu, an extremely fast embedded graph database (The Data Quarry)](https://thedataquarry.com/blog/embedded-db-2/)

### Provenance / citation grounding
- [Providing Citations and Source Traceability for AI-Generated Information (FINOS AI Governance Framework)](https://air-governance-framework.finos.org/mitigations/mi-13_providing-citations-and-source-traceability-for-ai-generated-information.html)
- [Citation-Enforced RAG for Fiscal Document Intelligence (arxiv 2603.14170)](https://arxiv.org/html/2603.14170)
- [RAG Citations and Sources: Ensuring Response Traceability (Ailog RAG)](https://app.ailog.fr/en/blog/guides/citation-sourcing-rag)
- [What does it mean for a generated answer to be "grounded" (Milvus AI Reference)](https://milvus.io/ai-quick-reference/what-does-it-mean-for-a-generated-answer-to-be-grounded-in-the-retrieved-documents-and-why-is-grounding-crucial-for-trustworthiness-in-rag-systems)

### Workspace cross-references (local)
- `adrs/drafts/research/agentic-code-ontology/PITFALLS.md` — the LLM-enrichment failure catalogue P1-P15 this artefact extends.
- `adrs/drafts/research/agentic-code-ontology/STABILITY.md` — cost + determinism analysis; content-hash caching, model pinning, the stochasticity ceiling.
- `adrs/drafts/feature-anchored-ontology.md` principle 7 — the pre-registered two-stage deferral with named adoption thresholds for exactly this graph/vector layer.
- `retrospectives/LSN-016` — the "no vector store / no embeddings" anchor; the prior pivot one layer below.
- `retrospectives/LSN-013` — research-punted-on-a-draft; the failure this artefact must not invert into (research authorising a premature build).
- `CLAUDE.md` Gate 9 — factual-claim provenance; the banned-phrase discipline the provenance pitfall (P12) enforces at the retrieval layer.

---

## The single highest risk

**The single highest risk is not any technical failure mode above — it is building this layer at all, right now, at the stated scale.**

`feature-anchored-ontology.md` principle 7 pre-registered three named adoption thresholds, and the stated scale of this proposal does not come close to any of them:

| Threshold (principle 7) | Trigger value | Stated / current scale | Hit? |
|---|---|---|---|
| (a) largest index file size | ~5 MB | sharded index files are tens of KB; the largest *monolith* before sharding was ~766 KB | **No — ~7× under** |
| (b) `registry-search` candidates per query | consistently >20 | `registry-search` runs `max_candidates: 5` and has not been reported saturating | **No** |
| (c) cross-batch dedup quality | measurably dropping (merge-fixups rising) | no rising merge-fixup signal recorded | **No** |

At **~2,500 vectors and ~400 nodes**, the problems a graph DB + vector index solve do not yet exist. The substrate's `edges.jsonl` already *is* the graph; a 30-line breadth-first traversal answers every graph query a 400-node graph can pose. The sharded-index + `registry-search`-subagent shape (principles 6-7) already delivers bounded "query-not-load" retrieval **with zero new dependencies** — and the Kuzu-acquired-and-archived case (P7) is hard evidence that the embedded-graph-DB category is too unstable for a solo unfunded maintainer to safely depend on in 2026.

Adopting the layer now would: import an embedding-model dependency that carries a permanent re-embed liability on every model deprecation (P9); add an operational/portability tax that breaks the "point Claude Code at the workspace and go" bootstrap (P7); and introduce false-positive (P4) and fusion (P10) failure surfaces — all to solve a scaling problem the methodology has explicitly measured itself as **not yet having**. That is the LSN-013 failure inverted: a worked-out *how* mistaken for a justified *whether*.

**The recommended posture: do not build the graph-query layer yet.** Keep this artefact and its siblings as the contingency plan. Make the principle-7 threshold check a literal pre-build step — the maintainer records the three current values, and the build proceeds only when one is crossed. When that day comes, the highest *technical* risk will be **P1 embedding staleness** — silent, error-free, and directly corrosive to the methodology's core purpose of finding drift — and it is mitigated by the per-run rebuild, the `(content_sha256, model_id, model_revision)` cache key, and the absolute rule that every result is a provenance-carrying pointer into a canonical file, never an answer in itself.
