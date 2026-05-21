---
research: graph-query-layer
artifact: PROBES
date: 2026-05-21
mode: research (single-thread)
overall_confidence: MEDIUM
---

# PROBES — proving the derived graph+vector query layer beats grep/Python

## Why this artefact exists

The ontology's query surface is `grep + jq + targeted Read` over sharded indexes — concretely the `registry-search` subagent (`.claude/agents/registry-search.md`), self-described as *"the bridge ... until the vector store"*. Three failure pressures forced this ADR:

1. **Monolith past context limit.** `lineage/odd-platform/test-map/index.yaml` is 1.26 MB — an index meant to be *loaded* exceeded the agent's context-load budget (the "157% of the limit" incident). The query layer must never reproduce that.
2. **Brittle traversal.** "What depends on node Y" today is a hand-written `jq` join over `edges.jsonl`; "what is affected if I change F" has no query at all — it is a manual sidecar crawl.
3. **Synonym blindness.** Grep over sharded indexes (registry-search Rule 2) misses a finding phrased with different vocabulary — the exact dedup gap that motivated the deferred vector store.

The agentic-ontology STACK (`research/agentic-code-ontology/STACK.md` lines 17, 29-30) deliberately *deferred* graph DB + vector store, citing diff-friendliness and Anthropic's "agentic search first" guidance. This ADR re-opens that decision now that the substrate has grown (35 MB, ~1370 YAML files, 147 understanding sidecars). **The deferral was correct then; the probes here decide whether it is still correct.** The query layer is **derived and ephemeral** — rebuilt from the JSONL/YAML/Markdown source of truth, never hand-edited, never the diff surface. That property is load-bearing for probe family 4.

This artefact extends — does not replace — the substrate's `PROBES.md` (existence-of-capability) and the agentic-ontology's `PROBES.md` (semantic faithfulness). Those validate *what the substrate contains*. This validates *whether the new query layer retrieves it correctly, boundedly, reproducibly, and cheaply enough to retire the Python scripts*.

## Retrieval metrics, translated to this context

Standard IR metrics ([Pinecone, offline evaluation](https://www.pinecone.io/learn/offline-evaluation/); [Weaviate, retrieval metrics](https://weaviate.io/blog/retrieval-evaluation-metrics)) map onto methodology queries as follows. Each ontology query has a hand-labelled **answer set** = the node-ids / sidecar paths a maintainer agrees are correct hits.

| Metric | Formula | Translation here | When it is the right metric |
|---|---|---|---|
| **Recall@k** | relevant-in-top-k / all-relevant | Did the top-k results contain *every* node the maintainer labelled? | Order-unaware. Primary for completeness queries — "what depends on Y", "which sidecars discuss Z" — where a missed node is a silent gap ([Pinecone](https://www.pinecone.io/learn/offline-evaluation/): "coverage matters more than ranking"). |
| **MRR** | mean of 1/rank-of-first-hit | How near the top is the *first* correct node? | For single-answer queries — "where does feature X live", "nearest prior entry to dedup against". MRR "only considers the first relevant item" ([Pinecone](https://www.pinecone.io/learn/offline-evaluation/)) — wrong for multi-answer queries. |
| **nDCG@k** | DCG@k / IDCG@k, DCG = Σ relᵢ/log₂(1+i) | Graded: a *primary* node ranked above a *peripheral* one scores higher. | For ranked, graded-relevance queries — "what is affected if I change F", where the answer set has tiers (direct caller vs 3-hop). nDCG is the MTEB **Retrieval** default and BEIR's headline metric ([Weaviate](https://weaviate.io/blog/retrieval-evaluation-metrics); [BEIR, arXiv 2104.08663](https://arxiv.org/abs/2104.08663)). |
| **Hit rate** | ≥1 relevant in top-k | Cheap binary screen. | First-pass smoke check before computing the full triad. |

`k` follows production convention, not training convention ([Pinecone](https://www.pinecone.io/learn/offline-evaluation/) notes Spotify used k=1 in training, k=30 in production). Here **k=10** for ranked queries (the maintainer's realistic scan depth, and BEIR's `nDCG@10` standard), **k=20** for completeness queries (recall needs headroom).

## The query gold set

Per [EvidentlyAI](https://www.evidentlyai.com/llm-guide/rag-evaluation) and the Stanford IR-book ([NLP IR-book §8](https://nlp.stanford.edu/IR-book/html/htmledition/information-retrieval-system-evaluation-1.html): *"50 information needs has usually been found to be a sufficient minimum"*), the gold set is **maintainer-authored**, ~60 queries (above the 50-minimum, below the 100-300 production band — sized for OSS single-maintainer capacity). Each entry:

```yaml
- id: GQ-007
  question: "What depends on DataEntityRepositoryImpl?"      # natural language, as a maintainer would ask
  intent: depends-on                                          # one of the six classes below
  answer_set:                                                 # hand-labelled, commit-pinned
    - { node: "odd-platform java ... DataEntityServiceImpl", grade: 3 }   # 3 = primary
    - { node: "odd-platform java ... SearchServiceImpl",     grade: 1 }   # 1 = peripheral
  pinned_commit: 6b54ea4
  metric: recall@20                                           # the metric this query is scored by
```

Six query classes — the realistic methodology questions, each mapped to its metric:

| Class | Example question | Metric | Why this metric |
|---|---|---|---|
| `feature-locate` | "Where does the activity feed live?" | MRR | One canonical home; first hit is the answer. |
| `depends-on` | "What depends on `SecurityConstants.java`?" | recall@20 | A missed dependent is a silent gap. |
| `concept-discuss` | "Which sidecars discuss the auth-mode concept?" | recall@20 | Completeness over a cross-axis join. |
| `dedup-nearest` | "Nearest prior finding to this draft finding ⟨text⟩?" | MRR | Replaces `registry-search`'s core job — surface the one entry to strengthen. |
| `impact-of-change` | "What is affected if I change `feature-flows/detail/F-008.yaml`?" | nDCG@10 | Graded — direct callers outrank 3-hop reachables. |
| `cross-axis-join` | "Every config-key-consumer with a `caveats` field but no doc link." | recall@20 + exact-set | Deterministic invariant; answer set is exhaustive, not sampled. |

The gold set is committed at `lineage/{repo}/query-gold-set.yaml`, grows on every blind-spot incident (one new query per LSN, same rule as the substrate's PROBES.md), and is **authored before** the query layer is built so it cannot be reverse-fitted. Answer sets are pinned to a commit SHA; a substrate refresh past that SHA triggers a maintainer re-label of any query whose nodes moved.

## Probe family 1 — retrieval quality vs the grep/Python baseline

**Measures:** whether hybrid retrieval (vector similarity + deterministic graph traversal, fused with Reciprocal Rank Fusion — [Weaviate, hybrid search](https://weaviate.io/blog/hybrid-search-explained); RRF `score = Σ 1/(k+rankᵢ)`, k=60) returns the maintainer's labelled answer set better than the status quo.

**How:** Run all ~60 gold-set queries through (a) the **baseline** — `registry-search`'s grep+jq+Read path, or the equivalent hand-written `jq` for join classes — and (b) the **candidate** graph+vector layer. Score each query by its assigned metric. Report per-class means and the paired delta. The cross-axis-join class is scored as an **exact-set match** against the deterministic graph result (not sampled) — these are invariants, and a graph traversal that drops one row is a hard fail regardless of recall average.

**Pass bar:** the candidate must **strictly beat or match** the baseline on every class, and clear absolute floors:

- `feature-locate`, `dedup-nearest`: **MRR ≥ 0.75** AND ≥ baseline. (Hybrid retrieval is reported to lift recall@10 from 65-78% to ~91% over dense-only — [Medium, hybrid search](https://ashutoshkumars1ngh.medium.com/hybrid-search-done-right-fixing-rag-retrieval-failures-using-bm25-hnsw-reciprocal-rank-fusion-a73596652d22) — so the layer should clear baseline comfortably; if it does not, RRF weighting is mistuned.)
- `depends-on`, `concept-discuss`: **recall@20 ≥ 0.90** AND ≥ baseline.
- `impact-of-change`: **nDCG@10 ≥ 0.80** AND ≥ baseline (BEIR-grade retrieval territory — [BEIR](https://arxiv.org/abs/2104.08663)).
- `cross-axis-join`: **exact-set match = 100%** (graph traversal is deterministic; anything below 100% is an extractor/edge bug).

A class where the candidate *ties* the baseline but clears the floor is acceptable — the layer's value there is bounded context and determinism, proven by families 2 and 4. A class where the candidate *loses* to grep blocks acceptance: the new layer must never retrieve worse than what it replaces.

## Probe family 2 — bounded context

**Measures:** per-query result size and token cost, and that they stay **bounded as the substrate grows** — the explicit anti-goal of the 1.26 MB index.

**How:** For each gold-set query, capture (a) result-payload size in tokens (the bytes the agent actually loads — node records + traversal results, *not* the whole index), and (b) peak working-context tokens during the query. Then run the **growth test**: replay the full gold set against the substrate at three sizes — current (~1370 YAML files), a synthetic 2× (duplicate-and-perturb the corpus), and 4× — and plot result-payload tokens vs corpus size.

**Pass bar:**

- **Absolute ceiling:** every query's result payload ≤ **25k tokens** (≈ one-eighth of a 200k window — a query result must leave room for the agent's actual task). No query may force a monolith load.
- **Growth bound:** result-payload tokens must be **flat or sub-linear** in corpus size across the 1×/2×/4× sweep. The fail signature is the index-load failure mode: payload scaling linearly with the corpus. A correct derived layer returns a top-k slice whose size is governed by `k`, not by `N`.
- **Regression guard:** no single query result exceeds **100% of the per-load limit** — the literal threshold the test-map index breached. This is the non-negotiable line.

## Probe family 3 — rebuild cost

**Measures:** wall-clock to build the ephemeral graph + embedding index from the JSONL/YAML/Markdown source of truth — cold vs warm content-hash cache.

**How:** The layer is derived, so it is rebuilt, not migrated. Measure: (a) **cold build** — empty cache, full graph construction + embed every node; (b) **warm build** — content-hash cache populated, one sidecar changed, rebuild. Per [GraphRAG incremental indexing](https://github.com/microsoft/graphrag/discussions/354) and [incremental-indexing strategies](https://medium.com/@vasanthancomrads/incremental-indexing-strategies-for-large-rag-systems-e3e5a9e2ced7), each node carries a content hash; an unchanged hash reuses the cached embedding and graph fragment, so warm rebuild cost scales with the *changeset*, not the corpus.

**Pass bar:**

- **Cold build ≤ 10 min** for the current substrate on a maintainer laptop (one-time per environment; tolerable).
- **Warm rebuild ≤ 30 s** for a single-sidecar change — fast enough to run inside the `/next-batch` loop after every delta-merge without stalling the batch.
- **Cache correctness:** a warm rebuild after a no-op change (no hash changes) re-embeds **zero** nodes. A non-zero count means the content-hash key is unstable (e.g. includes a timestamp) — a bug, because it both wastes cost and breaks family 4's determinism guarantee.
- **Cost ceiling:** embedding spend per cold build ≤ **$2** at current corpus size; warm rebuilds effectively free. Aligns with the agentic-ontology PROBES cost discipline ($15-60/refresh) and APPROACH.md §9.

## Probe family 4 — determinism / regression

**Measures:** same source files + same pinned embedding model → same retrieval results. This is why the layer is *ephemeral and derived* — the source of truth stays diff-reviewable JSONL/YAML; the query layer is a reproducible projection.

**How:** Determinism is **not free** — embedding APIs are documented to return slightly different vectors for identical input across runs ([OpenAI community, embedding determinism](https://community.openai.com/t/embedding-model-determinism-big-difference/1207498); [Non-Determinism of "Deterministic" LLM Settings, arXiv 2408.04667](https://arxiv.org/pdf/2408.04667)). The protocol therefore tests **ranking stability**, not bit-identical vectors:

1. **Pinned-model rebuild ×3** — build the index three times from an unchanged, commit-pinned substrate with a pinned embedding-model version. Run the gold set against each.
2. **Frozen-baseline check** — store one accepted run's per-query ranked result lists as `lineage/{repo}/query-baseline.yaml`. Every subsequent rebuild diffs against it.
3. **Graph-traversal exactness** — the `cross-axis-join` and `depends-on` classes are pure graph queries with no embedding step; these must be **bit-identical** across all three runs (a deterministic traversal over a deterministic graph).

**Pass bar:**

- **Graph-traversal classes:** 100% identical results across the 3 runs. Any drift is a graph-construction bug.
- **Vector/hybrid classes:** **top-k set identical** across 3 runs (the *membership* of top-k is stable even if intra-set order wobbles by one position); **MRR/nDCG variance ≤ 0.02** across runs. Larger variance means the embedding noise is leaking into rankings — pin a local/quantised model or add a deterministic tie-break (e.g. node-id sort) on equal fused scores.
- **Frozen-baseline:** an unexplained ranking change against `query-baseline.yaml` blocks the rebuild from being accepted until the maintainer classifies it as *expected* (substrate changed) or *regression* (layer changed). Caught regressions become permanent regression queries — same rule as the substrate's PROBES.md.

## The maiden acceptance gate

The graph+vector query layer **replaces the Python/grep query path** only when all five hold in one evaluation run, on a substrate pinned to a single commit:

| # | Gate | Threshold |
|---|---|---|
| 1 | **Retrieval quality** (family 1) | Candidate ≥ baseline on **every** query class, and clears every absolute floor in the thresholds table. |
| 2 | **Bounded context** (family 2) | Every query ≤ 25k-token result payload; growth flat/sub-linear across 1×/2×/4×; **zero** queries > 100% of per-load limit. |
| 3 | **Rebuild cost** (family 3) | Cold ≤ 10 min; warm ≤ 30 s; no-op rebuild re-embeds 0 nodes; cold-build embedding spend ≤ $2. |
| 4 | **Determinism** (family 4) | Graph classes bit-identical ×3; vector classes top-k-stable, metric variance ≤ 0.02 ×3; frozen baseline captured. |
| 5 | **Adversarial** | 3 maintainer-authored queries for capabilities that **do not exist** (capability-negation / cross-product-fabrication / synonym-swap-with-negation — the agentic-ontology Type-4 patterns). Layer must return **empty / "no node"**, not a confident wrong node. ≥ 2 of 3 PASS. |

If **any** gate fails: the layer does **not** replace the Python path. Classify the failure (retrieval-tuning / edge-extraction bug / cache bug / determinism leak / fabrication) and log a follow-up via `playbooks/follow-up-on-disk.md`. Until the maiden gate passes, the graph+vector layer runs **in shadow** — answering alongside the grep/Python path, its disagreements logged — so it accrues evidence without being trusted. This mirrors the substrate's probe-driven-not-coverage-%-driven acceptance: trust is earned by measured wins over the incumbent, not asserted.

## Ongoing checks

| Cadence | Check | Action on fail |
|---|---|---|
| **Every substrate refresh** | Full gold set re-run; family 1 + 2 thresholds re-asserted; frozen-baseline diff (family 4). | Regression → block the refresh's query layer; classify; log follow-up. |
| **Every refresh** | 3 fresh maintainer-authored adversarial queries (≥ 2/3 PASS). | < 2/3 → retrieval over-eager; re-tune RRF / similarity floor. |
| **Every `/next-batch` delta-merge** | Warm-rebuild time (family 3) sampled; no-op re-embed count = 0. | Warm rebuild > 30 s or non-zero no-op re-embed → cache-key bug; fix before next batch. |
| **Per LSN incident** | One new gold-set query added, targeting the missed retrieval — permanent regression. | (Growth mechanism, not a fail mode.) |
| **Per embedding-model bump** | Re-pin model version; re-capture `query-baseline.yaml`; re-run family 1 + 4. | Quality drop vs prior baseline → do not adopt the new model. |
| **Quarterly** | Maintainer re-labels a 10% sample of gold-set answer sets to catch substrate drift in the labels themselves. | Stale labels → re-label; the gold set is only as good as its maintenance. |

## Thresholds table — reasoned and re-fittable

Every number is a calibration starting point, re-fit after the maiden run. The *reasoning* travels with the number so a future maintainer can move it deliberately.

| Threshold | Value | Reasoning | Re-fit signal |
|---|---|---|---|
| Gold-set size | ~60 queries | Above Stanford IR-book's 50-minimum ([IR-book §8](https://nlp.stanford.edu/IR-book/html/htmledition/information-retrieval-system-evaluation-1.html)); below the 100-300 production band ([TestQuality, gold sets](https://testquality.com/llm-regression-testing-pipeline/)) — sized for single-maintainer capacity. | If per-class means swing > 0.1 between refreshes, the set is too small per class — grow it. |
| `k` (ranked / completeness) | 10 / 20 | k=10 = maintainer scan depth + BEIR `nDCG@10` standard; k=20 gives recall headroom. | If answer sets routinely exceed 20, raise the completeness `k`. |
| MRR floor (`feature-locate`, `dedup-nearest`) | 0.75 | First hit at rank 1-2 on average; below this the maintainer scrolls. | Tighten toward 0.85 once stable. |
| recall@20 floor (`depends-on`, `concept-discuss`) | 0.90 | A missed dependent is a silent gap — the LSN-001/002 class of harm. | Tighten toward 0.95; never loosen. |
| nDCG@10 floor (`impact-of-change`) | 0.80 | BEIR-grade retrieval ([BEIR](https://arxiv.org/abs/2104.08663)); graded relevance properly rewarded. | Re-fit after observing real impact-query usage. |
| cross-axis-join exactness | 100% | Deterministic graph traversal; anything less is an edge-extraction bug, not a tuning miss. | Never loosen — this is a correctness invariant. |
| Result-payload ceiling | 25k tokens | ≈ ⅛ of a 200k window — a query result must leave room for the agent's task. | Re-fit to the working model's context window. |
| Per-load hard limit | 100% of limit | The literal line the 1.26 MB test-map index breached. | Never loosen — this is the failure this ADR exists to prevent. |
| Cold rebuild | ≤ 10 min | One-time per environment; tolerable on a laptop. | Re-fit to corpus growth; parallelise embedding if breached. |
| Warm rebuild | ≤ 30 s | Must fit inside the `/next-batch` loop without stalling a batch. | If breached, the content-hash cache granularity is wrong. |
| Cold-build embedding spend | ≤ $2 | Consistent with APPROACH.md §9 cost discipline; warm rebuilds effectively free. | Re-fit to embedding-model pricing. |
| Determinism: metric variance | ≤ 0.02 across 3 runs | Embedding APIs are non-deterministic ([arXiv 2408.04667](https://arxiv.org/pdf/2408.04667)); 0.02 absorbs vector noise without masking a real ranking regression. | If variance exceeds this, pin a local model or add an id-sort tie-break. |
| Adversarial PASS | ≥ 2 of 3 | Same floor as substrate + agentic-ontology PROBES Type-4. | Raise to 3/3 once the layer is mature. |

## Sources

### Retrieval evaluation metrics
- [Pinecone — Evaluation Measures in Information Retrieval](https://www.pinecone.io/learn/offline-evaluation/) — recall@k / precision@k / MRR / MAP / nDCG formulas; choosing `k`; per-metric strengths and weaknesses.
- [Weaviate — Evaluation Metrics for Search and Recommendation](https://weaviate.io/blog/retrieval-evaluation-metrics) — when to use which metric; nDCG = MTEB Retrieval default; MAP = MTEB Reranking default; rank-aware vs rank-unaware.
- [Stanford NLP IR-book §8 — Information retrieval system evaluation](https://nlp.stanford.edu/IR-book/html/htmledition/information-retrieval-system-evaluation-1.html) — "50 information needs has usually been found to be a sufficient minimum."
- [Towards Data Science — DCG@k and NDCG@k in RAG pipelines](https://towardsdatascience.com/how-to-evaluate-retrieval-quality-in-rag-pipelines-part-3-dcgk-and-ndcgk/) — DCG/IDCG/nDCG worked through for RAG retrieval.

### BEIR / heterogeneous retrieval benchmarking
- [BEIR: A Heterogeneous Benchmark for Zero-shot Evaluation of IR Models, arXiv 2104.08663](https://arxiv.org/abs/2104.08663) — `nDCG@10` as the de facto standard; BM25 a robust baseline; hybrid/late-interaction models lead at higher compute cost.

### RAG / hybrid-search evaluation
- [EvidentlyAI — A complete guide to RAG evaluation](https://www.evidentlyai.com/llm-guide/rag-evaluation) — building a ground-truth retrieval dataset; per-query correct-sources labelling; precision@k / recall@k / hit-rate / nDCG@k.
- [Weaviate — Hybrid Search Explained](https://weaviate.io/blog/hybrid-search-explained) — sparse+dense fusion; Reciprocal Rank Fusion `1/(k+rank)`, k=60 convention.
- [Hybrid Search Done Right — BM25 + HNSW + RRF](https://ashutoshkumars1ngh.medium.com/hybrid-search-done-right-fixing-rag-retrieval-failures-using-bm25-hnsw-reciprocal-rank-fusion-a73596652d22) — hybrid lifts recall@10 from 65-78% to ~91% over dense-only.
- [TestQuality — LLM Regression Testing Pipeline: gold sets](https://testquality.com/llm-regression-testing-pipeline/) — production gold sets 100-300 examples for regression metrics.

### Rebuild / incremental indexing / caching
- [microsoft/graphrag — incremental indexing discussion](https://github.com/microsoft/graphrag/discussions/354) — cache reuse so unchanged documents skip re-extraction and re-embedding.
- [Incremental Indexing Strategies for Large RAG Systems](https://medium.com/@vasanthancomrads/incremental-indexing-strategies-for-large-rag-systems-e3e5a9e2ced7) — per-document content hash; rebuild only changed docs + their embeddings.

### Determinism / reproducibility
- [OpenAI Developer Community — Embedding Model Determinism](https://community.openai.com/t/embedding-model-determinism-big-difference/1207498) — identical input yields slightly different embeddings across runs.
- [Non-Determinism of "Deterministic" LLM Settings, arXiv 2408.04667](https://arxiv.org/pdf/2408.04667) — system-config (batch size, hardware) drives non-determinism even at temperature 0.

### Workspace-internal references
- `adrs/drafts/research/agentic-code-ontology/PROBES.md` — Type-4 adversarial patterns; cost discipline; ≥2/3 floor.
- `adrs/drafts/research/agentic-code-ontology/STACK.md` (lines 17, 29-30) — the original graph-DB / vector-store deferral this ADR re-opens.
- `adrs/drafts/research/code-lineage-substrate/PROBES.md` — probe-driven-not-coverage-%-driven acceptance; regression-probe-per-incident rule.
- `.claude/agents/registry-search.md` — the grep+jq+Read baseline; self-described "bridge until the vector store."
- `lineage/odd-platform/test-map/index.yaml` — the 1.26 MB monolith; the bounded-context failure this artefact prevents.
- `lineage/README.md` — "A SQLite read-mirror is on the roadmap"; current `jq`-based query mechanics.
- `APPROACH.md` §7 (probe protocol), §9 (cost discipline).

## Confidence + open questions

**Overall: MEDIUM.** The retrieval-evaluation methodology is HIGH confidence — recall@k / MRR / nDCG, gold-set construction, the 50-query minimum, and hybrid-search/RRF practice are all well-established and directly cited. What lowers it to MEDIUM is that the **threshold values are uncalibrated**: MRR ≥ 0.75, recall@20 ≥ 0.90, nDCG@10 ≥ 0.80, the 25k-token ceiling, and the ≤ 0.02 determinism variance are reasoned starting points, not measurements — they are explicitly re-fittable after the maiden run, and the maiden run has not happened. The bounded-context and determinism families are HIGH confidence as *protocol* (the failure modes are concrete and the tests directly target them); the rebuild-cost numbers are MEDIUM (laptop-dependent, embedding-model-dependent).

**Open questions for the maiden run, not for the maintainer to pre-decide:**
1. **RRF vs weighted fusion.** RRF (k=60) is the assumed fusion. If `feature-locate` MRR underperforms, a tuned dense/sparse weight may beat rank-only fusion — decide from family-1 numbers.
2. **Embedding model choice** is a STACK-artefact decision, not a PROBES one — but family 4's determinism bar (≤ 0.02 variance) may *force* a local/quantised model if a hosted API's vector noise leaks into rankings. Flag for STACK.
3. **Graded-relevance labelling cost.** `impact-of-change` needs 0/1/3 grades, not binary labels — more maintainer effort per query. If it proves too costly, fall back to binary recall@k for that class and drop nDCG.
4. **Shadow-mode duration.** "Run in shadow until the maiden gate passes" needs a wall-clock or batch-count bound so the layer is not perpetually-shadowed; set it once the first refresh's numbers are in.
