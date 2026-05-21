---
research: graph-query-layer
artifact: PRIOR-ART
date: 2026-05-21
mode: research (single-thread)
overall_confidence: HIGH
---

# PRIOR-ART — derived graph + vector index over agent-written semantic sidecars

Survey of 2024-2026 state of the art for the proposal: keep the agentic-ontology's Markdown
sidecars/reducers canonical, build a DERIVED + EPHEMERAL graph + vector index each run, query with
HYBRID retrieval (vector similarity to find entry points + deterministic graph traversal to expand).
The load-bearing question is whether `APPROACH.md` §2 + §9's "no embeddings" stance — founded on
Sourcegraph's deprecation and case-law `LSN-016` — kills this proposal or merely scopes it.
Confidence is **HIGH** that the proposal is reconcilable: the 2024-2026 ecosystem has converged on
*exactly* this two-stage shape (vectors find the door, the graph walks the house), and every one of
Sourcegraph's three deprecation reasons either does not apply or is already mitigated by the
proposal's own constraints. Builds on `adrs/drafts/research/agentic-code-ontology/PRIOR-ART.md`;
where that artefact assessed *construction*, this one assesses *query-time retrieval*.

## Key findings

1. **The 2024-2026 consensus IS hybrid graph+vector — and the proposal already matches it.** The
   practitioner community has "largely converged on a pattern: vectors for semantic entry-point
   retrieval, graphs for relational depth" ([Neo4j hybrid GraphRAG](https://neo4j.com/blog/developer/enhancing-hybrid-retrieval-graphrag-python-package/)).
   The proposal's "vector similarity to find entry points + deterministic graph traversal" is a
   verbatim instance of the converged design, not a novel bet. **Confidence: HIGH.**

2. **Sourcegraph's three deprecation reasons do not transfer to the proposal.** Sourcegraph retired
   embeddings for (a) third-party data egress to OpenAI, (b) admin complexity of keeping the index
   fresh, (c) vector-DB scaling past 100K *repositories*
   ([How Cody understands your codebase](https://sourcegraph.com/blog/how-cody-understands-your-codebase)).
   The proposal: (a) embeds *locally* — no egress, same posture as Bloop/Continue.dev; (b) the index
   is *ephemeral, rebuilt each run* from canonical files, so there is no stale-index-maintenance
   problem to deprecate; (c) the corpus is one repo's ~400 sidecars, 3-4 orders of magnitude below
   Sourcegraph's pain threshold. **Confidence: HIGH.**

3. **The strongest published precedent — RANGER (Sept 2025) — embeds natural-language summaries of
   code, not raw code, and uses vectors only as graph entry points.** RANGER does dense retrieval to
   find candidate files as *entry points*, then traverses the dependency graph to reach related code
   that "may not appear in initial search results." It "embeds natural-language summaries of code,
   not raw source code itself ... extracting semantic abstractions rather than raw tokens" — and
   reports this "improves retrieval effectiveness while reducing embedding dimensionality and
   computational cost" ([RANGER, arXiv:2509.25257](https://arxiv.org/pdf/2509.25257)). This is the
   proposal's design, published, benchmarked, and winning. **Confidence: HIGH.**

4. **Embedding distilled natural-language descriptions retrieves *better* than embedding raw code
   for NL queries — at a generation cost the proposal has already paid.** Generating NL descriptions
   for code and indexing on them "significantly improv[es] search accuracy" because it aligns the
   NL-query space with the code's *intent* ([AugmentedCode, arXiv:2110.08512](https://arxiv.org/pdf/2110.08512)).
   The standard 2025 counter-argument — "generating descriptions introduces substantial computational
   overhead; a dedicated code-embedding model skips that step"
   ([Qodo](https://www.qodo.ai/blog/qodo-embed-1-code-embedding-code-retrieval/)) — *does not apply
   here*: the agentic ontology already produces the sidecars as its primary deliverable. The
   description-generation cost is sunk. The proposal embeds an artefact that exists anyway.
   **Confidence: HIGH.**

5. **Graph+vector beats vector-alone for multi-hop / structural questions; the gap narrows to zero
   for simple fact lookup.** GraphRAG-Bench (2025) "confirms that GraphRAG consistently outperforms
   vanilla RAG on complex reasoning and contextual summarization tasks, while the performance gap
   narrows for simple fact retrieval where vector search alone is sufficient"
   ([GraphRAG in Practice](https://towardsdatascience.com/graphrag-in-practice-how-to-build-cost-efficient-high-recall-retrieval-systems/)).
   The ontology's hardest questions (LSN-017 amplification chains, "what downstream cells flip if I
   fix this useEffect") are multi-hop and structural — where the graph half earns its keep.
   **Confidence: HIGH.**

6. **`LSN-016`'s actual ruling is narrower than "no embeddings ever."** Re-read in full, LSN-016
   bans (1) a programmatic *Anthropic API* runtime, and (2) a *RAG-system-as-the-construction-method*
   — "we are not going to create a RAG system, no external LLM usage is allowed." It does **not**
   adjudicate a *local, derived, query-time* index over already-canonical files. The §9 "no vector
   store" bullet extrapolated LSN-016's construction-time ruling onto query-time retrieval; that
   extrapolation is the gap this research closes. **Confidence: HIGH** (textual — quoted below).

---

## 1. GraphRAG, LazyGraphRAG, and when graph+vector beats vector-alone

### Microsoft GraphRAG (2024) — the eager baseline

GraphRAG's pipeline (LLM entity/relationship extraction → Leiden community detection → community
summaries) lifted answer comprehensiveness +26% and response diversity +57% over standard vector
retrieval on Microsoft's eval set
([Neo4j summary](https://neo4j.com/blog/developer/enhancing-hybrid-retrieval-graphrag-python-package/)).
The published critique is uniform: indexing cost ~1000× vector RAG, and **"GraphRAG does not
support incremental updates"** out of the box — "a notable constraint for dynamic environments"
([VectorRAG vs GraphRAG](https://www.falkordb.com/blog/vectorrag-vs-graphrag-technical-challenges-enterprise-ai-march25/)).
Load-bearing: that incremental-update problem exists *only because GraphRAG persists the graph*.
**The proposal sidesteps it entirely** — the graph is ephemeral, rebuilt each run from canonical
Markdown, so there is no persisted graph to patch and no temporal-versioning burden. It trades a
cheap per-run rebuild for the permanent elimination of a problem the 2025 literature is still
chasing (EraRAG, "up to an order of magnitude reduction in update time", exists *solely* to patch
this — [EraRAG, arXiv:2506.20963](https://arxiv.org/pdf/2506.20963)).

### LazyGraphRAG (Nov 2024) — the cost-shape proof, and a hybrid by construction

LazyGraphRAG is the single most important precedent for the proposal's *economics*. Indexing cost
is **"identical to vector RAG and 0.1% of full GraphRAG"**, with **"700× lower query cost"** for
global queries at **comparable answer quality**
([LazyGraphRAG, Microsoft Research](https://www.microsoft.com/en-us/research/blog/lazygraphrag-setting-a-new-standard-for-quality-and-cost/)).
Crucially it is *itself a graph+vector hybrid*: it "uses text chunk embeddings and chunk-community
relationships to first rank text chunks by similarity to the query, then rank communities" before
graph traversal. At a relevance-test budget of 500 (4% of GraphRAG's C2 query cost), LazyGraphRAG
**"significantly outperform[ed] vector RAG variants including the long-context version that
retrieves 64k tokens of input."** The lesson: a vector pass that *seeds* a graph pass beats a vector
pass that *is* the whole retrieval — even against a 64k-token context window. The proposal's "vector
finds entry points, graph expands" is the LazyGraphRAG ranking shape applied to a code ontology.

### Hybrid search measured gains — and the caveats that are real

Outside the graph framing, plain hybrid search (dense vector + sparse BM25, fused by Reciprocal Rank
Fusion) is the mature, well-measured baseline:

- **Measured gain.** Hybrid via RRF or convex score combination "consistently improves recall by
  15-30%" and "improves over both constituent methods across all metrics"
  ([Dense vs Sparse Retrieval](https://dev.to/vf-insights/dense-vs-sparse-retrieval-mastering-faiss-bm25-and-hybrid-search-4kb1),
  [BM25-to-Corrective-RAG benchmark, arXiv:2604.01733](https://arxiv.org/html/2604.01733v1)).
- **Solid caveat — dense-alone often loses to keyword-alone.** On a 2026 text-and-table benchmark,
  "on every metric except Recall@20, BM25 outperforms dense retrieval with text-embedding-3-large,
  one of the strongest commercial embedding models" ([same benchmark](https://arxiv.org/html/2604.01733v1)).
  This is the strongest contested-zone finding: it argues *against* shipping a vector-only index and
  *for* keeping a deterministic (graph / keyword) leg — which the proposal does by design.
- **Solid caveat — RRF score-fusion has sharp edges.** Min-Max normalization "can't fix the
  distribution mismatch"; BM25 outliers compress the vector component's distinctions; filters
  applied to one leg but not the other leak out-of-scope results
  ([Hybrid retrieval with RRF](https://avchauzov.github.io/blog/2025/hybrid-retrieval-rrf-rank-fusion/)).
  ODD-relevance: the fusion layer is a real implementation surface that needs explicit care, not a
  free lunch — the eventual ADR must specify the fusion rule and the filter-consistency rule.

**When graph+vector wins (solid):** multi-hop reasoning, state-sequence "what changed and why"
questions an embedding index physically cannot answer (an agent "can retrieve not just what's
currently true ... but the sequence of state changes that led to it — not possible with a flat
embedding index" — [Graph RAG vs Vector RAG for agent memory](https://agentmarketcap.ai/blog/2026/04/07/graph-rag-vs-vector-rag-agent-memory-neo4j-pgvector)),
contextual summarization, breadth-first "whole-dataset" questions. **When vector-alone is enough
(solid):** simple single-fact lookup (GraphRAG-Bench 2025). For ODD: the vector leg alone is fine
for "where is the view_count config key" but not for "trace the view_count amplification across UI →
thunk → controller → repo" — the latter is the class of question `LSN-017` exists to make answerable.

**Contested:** whether a knowledge graph is worth its construction cost *versus a well-tuned
hierarchical index* — the PageIndex camp argues graphs are over-engineering for many corpora
([GraphRAG vs PageIndex](https://medium.com/@umesh382.kushwaha/graphrag-vs-pageindex-when-knowledge-graphs-beat-vector-search-and-when-they-dont-25b10fad5fcb)).
**Moot for the proposal**: ODD's graph is not LLM-constructed — it is the *deterministic* substrate
edge graph (`edges.jsonl`: containment, calls, configures, exposes, mounts, references) that already
exists. The proposal pays zero LLM cost for the graph leg, so "is the graph worth its build cost"
does not bind.

## 2. Code knowledge graphs — Aider, Sourcegraph, CodexGraph, Cody, RANGER

The earlier `agentic-code-ontology/PRIOR-ART.md` covered Aider repo-map, Cody, Cursor, CodexGraph,
DeepWiki, and CGM in depth for the *construction* question. This section adds only what is new for
the *query-time retrieval* question, and the one 2025 paper that paper did not have.

**Aider repo-map.** Pure-deterministic: tree-sitter symbol graph + NetworkX PageRank, rendered to a
~1K-token Markdown map, regenerated per query, mtime-cached. *No embeddings, no vector index.* Aider
proves a deterministic graph leg, rendered compactly, is independently useful — it is the proposal's
graph-leg-without-the-vector-leg, and it works. ODD's substrate edge graph is the direct analogue.
([Aider repomap](https://github.com/Aider-AI/aider/blob/main/aider/repomap.py))

**CodexGraph (NAACL 2025).** Two-agent loop: a primary agent emits NL queries, a translation agent
converts them to Cypher over a Neo4j code graph; 36.02% on GPT-4o for SWE-bench
([CodexGraph](https://aclanthology.org/2025.naacl-long.7/)). The *graph-traversal-only* end of the
spectrum (no vector entry-point stage). Useful as a node/edge-taxonomy reference; the Neo4j
dependency is rejected for ODD per the earlier artefact. RepoGraph, a sibling, reports **+32.8%
relative improvement on SWE-bench** when its code graph is bolted onto existing agents (ICLR 2025) —
independent evidence that a structural graph leg materially lifts code-task accuracy.

**RANGER (arXiv:2509.25257, Sept 2025) — the load-bearing precedent.** RANGER is, to a close
approximation, the proposal — published and benchmarked. Design, quoted/paraphrased: (1) **dense
vector retrieval finds candidate files as entry points**; (2) **graph traversal over the AST/call
dependency graph expands** to "related code that may not appear in initial search results"; (3) **it
embeds natural-language summaries of code, not raw source** — "extracting semantic abstractions
rather than raw tokens ... improves retrieval effectiveness while reducing embedding dimensionality
and computational cost"; (4) measured: "adding graph traversal to vector retrieval yields measurable
improvements in both recall and precision ... compared to methods using only dense retrieval or only
lexical search" on RepoBench Python. Every one of the proposal's four design choices — derived
graph, vector-for-entry-point, graph-for-expansion, embed-prose-not-code — is independently
validated. RANGER (Sept 2025) predates LSN-016 (2026-05-08); the gap is simply that the §9 bullet
was authored on the Sourcegraph signal alone and this RANGER-class evidence was never folded in.
**ODD-relevance: VERY HIGH.**

**Codebase-Memory (arXiv:2603.27277, 2026).** Tree-sitter-based code knowledge graphs exposed to an
LLM for exploration *via MCP* — independent confirmation that the 2026 direction for code KGs is
deterministic-graph + agent-traversal + MCP surface, and a forward pointer for ODD's eventual query
surface ([Codebase-Memory](https://arxiv.org/html/2603.27277v1)). **Sourcegraph Cody** — the
deprecation — is covered in depth in §3 below, as *the* load-bearing question.

## 3. THE LOAD-BEARING QUESTION — Sourcegraph's embeddings deprecation, and whether it transfers

### Why Sourcegraph deprecated embeddings — the exact, sourced reasons

Sourcegraph's own engineering blog gives three reasons, verbatim
([How Cody understands your codebase](https://sourcegraph.com/blog/how-cody-understands-your-codebase),
corroborated by [Cody FAQ](https://sourcegraph.com/docs/cody/faq)):

1. **Third-party data egress.** *"Your code has to be sent to a 3rd party (OpenAI) for processing,
   and not everyone wants their code to be relayed in this way."*
2. **Operational complexity / staleness.** *"The process of creating embeddings and keeping them
   up-to-date introduces complexity that Sourcegraph admins have to manage."*
3. **Scaling ceiling.** *"As the size of a codebase increases, so does the respective vector
   database, and searching vector databases for codebases with >100,000 repositories is complex and
   resource-intensive."*

What replaced it: **native Sourcegraph Search** — "an adapted form of the BM25 ranking function
alongside other signals," fusing IDE-local files with remote multi-repo search, requiring "zero
additional config," code never leaving Sourcegraph infrastructure. Note what is *not* in the
published rationale: Sourcegraph gives **no measured recall/precision regression** and **no
chunk-boundary argument**. The deprecation reasons are operational and architectural (egress,
maintenance, scale), not retrieval-quality claims. This matters — it means the deprecation is not
evidence that "embeddings retrieve badly," only that "this particular embeddings *deployment* was
operationally wrong for Sourcegraph's product." (Confidence: HIGH that these are the reasons;
the absence of quality data is itself a sourced observation.)

### Does the reasoning transfer to embedding ODD's agent-written semantic sidecars? — point by point

The proposal embeds **distilled prose sidecars** (not raw code), into a **local, ephemeral, per-run**
index, used **only to find entry points** that a **deterministic graph traversal** then expands,
with the **Markdown files staying canonical**. Test each Sourcegraph reason against that:

| Sourcegraph deprecation reason | Transfers to the proposal? | Why |
|---|---|---|
| **(1) Third-party data egress to OpenAI** | **Does not transfer.** | The proposal's index is built *locally* on the maintainer's workstation — the same posture Bloop (on-device MiniLM) and Continue.dev (local transformers.js) already prove viable. APPROACH.md §9's "no remote infrastructure" rule *forces* this. No code, no sidecar prose, leaves the machine. Sourcegraph's #1 reason is structurally inapplicable. |
| **(2) Staleness / index-maintenance complexity** | **Inverted — the proposal's design *is* the fix.** | Sourcegraph's pain was a *persisted* embeddings index drifting from a moving codebase, needing admin-managed refresh. The proposal's index is **ephemeral: discarded and rebuilt every run** from the canonical Markdown. There is no long-lived index to go stale, no incremental-patch logic, no "index hygiene" cron. The proposal eliminates reason #2 by construction — and dodges the whole GraphRAG incremental-update literature (§1) in the same move. |
| **(3) Vector-DB scaling past 100K repositories** | **Does not transfer — off by 3-4 orders of magnitude.** | Sourcegraph's ceiling was >100,000 *repositories* in one enterprise vector DB. ODD's corpus is one repo's ≤~400 sidecar files. An ANN/brute-force index over a few hundred short prose docs is sub-millisecond on a laptop with zero infrastructure. The scaling reason addresses a regime ODD will never enter. |
| **(implicit) chunk-boundary damage** | **Does not transfer — the cleanest reason.** | The classic embedding-RAG failure is *arbitrary chunking*: a fixed window splits a function mid-body, so the vector represents half an idea. ODD does **not chunk** — each sidecar is an already-coherent semantic unit, one node's distilled understanding authored whole. The embedding unit = the meaning unit. Chunk-boundary damage is definitionally absent. |
| **(implicit) retrieval recall/precision** | **No transfer evidence from Sourcegraph** — independent evidence favours the proposal. | Sourcegraph published no quality regression. Independent evidence (§4): embedding *distilled NL descriptions* out-retrieves raw code on NL queries, and a graph leg downstream *recovers* whatever the vector leg's recall misses (RANGER, RepoGraph). The hybrid shape is the recall-insurance the contested data (§1: "dense-alone loses to BM25 on most metrics") says you need. |

**Net transfer verdict: the Sourcegraph reasoning transfers *partly*, and the part that transfers is
already mitigated.** Of three explicit reasons, two (#1 egress, #3 scale) are structurally
inapplicable to a local single-repo deployment; one (#2 staleness) is real *for persisted indexes*
and is exactly the failure the proposal's ephemeral-rebuild design eliminates. The two implicit
reasons (chunk boundaries, recall) do not bind. **What survives is a discipline, not a veto:** keep
the index local, ephemeral, never a maintained artefact — and the proposal already commits to all
three. (Confidence: HIGH.)

### What `LSN-016` and APPROACH.md §9 actually decided — and the gap

`LSN-016`'s Rule 2, quoted: *"the runtime is Claude Code sessions ... No programmatic Anthropic API
calls. No Agent SDK driver. No Batch API."* The maintainer's words in the incident: *"We are not
going to create a RAG system, no external LLM usage is allowed."* APPROACH.md §9: *"No vector store
/ RAG layer. Per LSN-016: the failure modes the approach defeats are structural blind-spots, not
'couldn't find a similar text' problems. Embeddings add operational complexity and an external
dependency ... Sourcegraph's 2024 deprecation ... is the industry signal."*

Read precisely, LSN-016 forbids two concrete things: (1) an external-API runtime, (2) RAG *as the
construction method* — do not let "retrieve similar text and summarize" stand in for the agentic
per-node interrogation that is the methodology's whole value. **Neither ruling reaches the
proposal.** Construction stays 100% agentic (file-analyser, Stress Protocol, reducers,
feature-reflector — all unchanged); the proposal only adds a *query-time* index, derived from
artefacts the pipeline already produced, running locally with no external API. The §9 bullet's two
stated objections — "operational complexity" and "an external dependency" — are exactly what the
proposal's local + ephemeral + library-only design removes. The §9 bullet generalised LSN-016's
construction-time, external-API ruling onto query-time local retrieval; that generalisation is the
gap. The honest update is not "§9 was wrong" — it was right *about construction* — it is "§9's scope
was drawn one category too wide, and the RANGER-class 2025 evidence post-dates the bullet."

## 4. Embedding NL semantic descriptions vs embedding raw code

The proposal's quietest but most favourable finding. Question: does embedding the *sidecar prose*
retrieve better than embedding the *source code*?

**Solid — NL descriptions align better with NL queries.** "Generating natural-language descriptions
for code snippets using LLMs and indexing snippets using these descriptions ... allows retrieval
systems to better align natural-language queries with relevant code snippets, significantly
improving search accuracy" ([AugmentedCode, arXiv:2110.08512](https://arxiv.org/pdf/2110.08512)).
"Code retrieval systems can be improved by leveraging descriptions to better capture the intents of
code snippets" ([Neural Code Search Revisited, arXiv:2008.12193](https://arxiv.org/pdf/2008.12193)).
The mechanism: a maintainer's query ("where do we silently drop metadata on ingestion") is in
*intent* space; raw code is in *token* space; the sidecar prose is *already in intent space* because
that is what the agentic enrichment distilled it into. The embedding compares like with like.

**Solid — RANGER chose this deliberately and benchmarked the win.** RANGER embeds "natural-language
summaries of code, not raw source code itself," reporting improved retrieval effectiveness *and*
lower embedding dimensionality/cost ([RANGER](https://arxiv.org/pdf/2509.25257)) — independent
confirmation on the exact code-retrieval task ODD cares about, Sept 2025.

**The 2025 counter-argument — and why it does not apply to ODD.** Current production counsel is:
"a dedicated code-embedding model can skip the description-generation step without sacrificing
performance, simplifying the system and reducing costs"
([Qodo Embed-1](https://www.qodo.ai/blog/qodo-embed-1-code-embedding-code-retrieval/)). Sound advice
*for a team whose only goal is code search* — there, generating descriptions is pure added cost.
**It does not apply to ODD because ODD already generates the descriptions** as its primary canonical
deliverable; they exist whether or not anything is embedded. The cost the Qodo argument warns
against is *sunk*. ODD is in the one situation where embedding NL descriptions is unambiguously
correct: the descriptions are free, higher-quality than auto-generated docstrings (agent-
interrogated, Stress-Protocol-hardened prose), and out-retrieve raw code on NL queries.
(Confidence: HIGH.)

**One honest caveat.** Embedding *only* the prose can miss a query naming a literal code token
absent from the prose (an exact identifier, an annotation string). Mitigation is standard and cheap,
and the proposal's own shape supplies it: the deterministic graph/keyword leg carries exact
identifier lookup (Aider-style symbol match; BM25 over node descriptors), so the prose-embedding's
blind spot is the keyword leg's home turf — the legs cover each other. The ADR should make this
explicit (index node descriptors alongside the prose vectors, or fuse a BM25 leg per §1's RRF caveats).

## Sources

Primary / load-bearing:
- [Sourcegraph — How Cody understands your codebase](https://sourcegraph.com/blog/how-cody-understands-your-codebase) — the three explicit deprecation reasons; BM25 replacement.
- [Sourcegraph — Cody FAQ](https://sourcegraph.com/docs/cody/faq) — corroborates "no embeddings on Cody Enterprise; replaced by Sourcegraph Search."
- [RANGER — Repository-Level Agent for Graph-Enhanced Retrieval, arXiv:2509.25257](https://arxiv.org/pdf/2509.25257) — vector-entry-point + graph-traversal; embeds NL summaries not raw code; measured recall/precision gains.
- [Microsoft Research — LazyGraphRAG: Setting a new standard for quality and cost](https://www.microsoft.com/en-us/research/blog/lazygraphrag-setting-a-new-standard-for-quality-and-cost/) — indexing cost = vector RAG = 0.1% of GraphRAG; 700× lower query cost; beats long-context vector RAG.
- [AugmentedCode — Examining the Effects of Natural Language Descriptions, arXiv:2110.08512](https://arxiv.org/pdf/2110.08512) — NL descriptions improve code-retrieval accuracy.

Graph + vector / hybrid:
- [Neo4j — Enhancing Hybrid Retrieval with Graph Traversal](https://neo4j.com/blog/developer/enhancing-hybrid-retrieval-graphrag-python-package/) — "vectors for entry-point, graphs for relational depth."
- [Graph RAG vs Vector RAG for Agent Memory](https://agentmarketcap.ai/blog/2026/04/07/graph-rag-vs-vector-rag-agent-memory-neo4j-pgvector) — state-sequence questions a flat embedding index cannot answer.
- [GraphRAG in Practice — cost-efficient high-recall retrieval](https://towardsdatascience.com/graphrag-in-practice-how-to-build-cost-efficient-high-recall-retrieval-systems/) — GraphRAG-Bench 2025: graph wins multi-hop, gap narrows for simple lookup.
- [VectorRAG vs GraphRAG: technical challenges (FalkorDB)](https://www.falkordb.com/blog/vectorrag-vs-graphrag-technical-challenges-enterprise-ai-march25/) — GraphRAG's incremental-update limitation.
- [EraRAG, arXiv:2506.20963](https://arxiv.org/pdf/2506.20963) — order-of-magnitude faster graph updates; the persisted-graph staleness problem is still open.
- [BM25 to Corrective RAG, arXiv:2604.01733](https://arxiv.org/html/2604.01733v1) — hybrid +8.1pp Recall@5; dense-alone loses to BM25 on most metrics.
- [Dense vs Sparse Retrieval — FAISS, BM25, Hybrid](https://dev.to/vf-insights/dense-vs-sparse-retrieval-mastering-faiss-bm25-and-hybrid-search-4kb1) — hybrid +15-30% recall.
- [Hybrid retrieval with Reciprocal Rank Fusion](https://avchauzov.github.io/blog/2025/hybrid-retrieval-rrf-rank-fusion/) — RRF score-fusion caveats; filter-consistency pitfall.
- [GraphRAG vs PageIndex](https://medium.com/@umesh382.kushwaha/graphrag-vs-pageindex-when-knowledge-graphs-beat-vector-search-and-when-they-dont-25b10fad5fcb) — contested view: graphs over-engineered for some corpora.

Code knowledge graphs:
- [CodexGraph (NAACL 2025)](https://aclanthology.org/2025.naacl-long.7/) — two-agent graph-query loop; SWE-bench 36.02%.
- [Aider repo-map source](https://github.com/Aider-AI/aider/blob/main/aider/repomap.py) — deterministic tree-sitter + PageRank graph leg, no embeddings.
- [Codebase-Memory, arXiv:2603.27277](https://arxiv.org/html/2603.27277v1) — 2026 deterministic-graph + agent-traversal + MCP direction.
- [Neural Code Search Revisited, arXiv:2008.12193](https://arxiv.org/pdf/2008.12193) — descriptions capture code intent for retrieval.
- [Qodo Embed-1](https://www.qodo.ai/blog/qodo-embed-1-code-embedding-code-retrieval/) — the counter-argument: dedicated code-embedding models skip description generation.

Workspace prior art (read first, built upon):
- `adrs/drafts/research/agentic-code-ontology/PRIOR-ART.md` — construction-side survey.
- `adrs/drafts/feature-anchored-ontology.md` — the feature-anchored ontology ADR this query layer sits beside.
- `APPROACH.md` §2 (Failure B), §9 ("No vector store / RAG layer"); `retrospectives/LSN-016`.

## Verdict on the embeddings tension

**The Sourcegraph reasoning transfers PARTLY — and the part that transfers is already neutralised by
the proposal's own constraints. The proposal is reconcilable with `LSN-016` and APPROACH.md §9.**

The case, tightly:

1. **Sourcegraph deprecated embeddings for three reasons; two are structurally inapplicable here**
   (full table in §3). Egress (#1) cannot happen — the index is local, library-only, no external
   API, as APPROACH.md §9's own "no remote infrastructure" rule mandates. The 100K-repository scaling
   ceiling (#3) is 3-4 orders of magnitude beyond ODD's one-repo, few-hundred-sidecar corpus.

2. **The one real reason — index staleness/maintenance (#2) — is the exact failure the proposal's
   design eliminates.** Sourcegraph's pain was a *persisted* index drifting from moving code under
   admin maintenance. The proposal's index is **ephemeral: rebuilt every run from the canonical
   Markdown, never persisted, never maintained** — which also sidesteps the entire open GraphRAG
   incremental-update literature. #2 converts from a risk into a non-event. The implicit failures
   (chunk boundaries, recall) do not bind either: ODD does not chunk, and the hybrid graph leg is the
   recall backstop the contested hybrid-search data says a vector leg needs.

3. **`LSN-016` forbids something else.** Its rulings: no external-API runtime, and no RAG *as the
   construction method* substituting for agentic per-node interrogation. The proposal keeps
   construction 100% agentic and adds only a *local query-time* index over already-canonical
   artefacts. APPROACH.md §9's "no vector store" bullet generalised LSN-016's construction-time,
   external-API ruling onto query-time local retrieval — right about construction, one category too
   wide about query.

4. **The 2024-2026 evidence actively endorses the proposal's exact shape.** RANGER (Sept 2025)
   *is* the proposal — derived graph, vector-for-entry-point, graph-for-expansion, embedding NL
   summaries not raw code — published with measured recall/precision gains. LazyGraphRAG proves the
   vectors-seed-the-graph ranking shape beats vector-alone at 4% query cost, beating even a
   64k-token long-context vector baseline. RepoGraph reports +32.8% on SWE-bench from a structural
   graph leg. Embedding distilled NL prose out-retrieves raw code on NL queries (AugmentedCode,
   Neural Code Search Revisited) — and the standard cost objection to generating descriptions does
   not apply, because ODD's sidecars are generated regardless.

**Recommendation for the ADR (per the no-open-questions discipline):** Adopt the proposal, scoped by
three non-negotiable constraints that map 1:1 onto the surviving Sourcegraph lesson — (a) the index
is built **locally**, no external API, library-only (a local embedding model + an in-process ANN /
sqlite-vss-class store); (b) the index is **ephemeral** — derived per run from the canonical
Markdown, never maintained or committed, so the files stay the single source of truth and there is
no staleness surface; (c) embeddings are **one leg of a hybrid**, never the whole retrieval — they
find entry points, the deterministic substrate edge graph (`edges.jsonl`) does the traversal, and a
keyword/identifier leg covers exact-token queries the prose-embedding misses (fuse via RRF, same
filters on every leg). APPROACH.md §9's "No vector store / RAG layer" bullet and `LSN-016` should be
amended to record this: **embeddings are forbidden as a *construction method* and as an *external-API
or persisted-index dependency*; a *local, ephemeral, derived* query-time vector leg inside a
graph+vector hybrid is permitted, and on 2024-2026 evidence is the correct design.** Extension of the
prior decision, not reversal — the same shape LSN-016 itself took toward the substrate it critiqued.

Overall confidence: **HIGH**. The Sourcegraph reasons are quoted from the primary source; the
transfer analysis is structural, each step checked against a constraint the proposal already commits
to in writing; the endorsing evidence (RANGER, LazyGraphRAG, RepoGraph, AugmentedCode) is 2024-2026,
primary or peer-reviewed, directly on the code-retrieval task. The one residual risk is operational,
not conceptual — RRF fusion tuning and the prose-embedding's exact-token blind spot — both flagged
as explicit ADR implementation surfaces, neither a reason to withhold adoption.
