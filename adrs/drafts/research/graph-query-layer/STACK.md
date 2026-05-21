---
research: graph-query-layer
artifact: STACK
date: 2026-05-21
mode: research (single-thread)
overall_confidence: HIGH
---

# STACK — Graph engine + embedding model + embedding runtime for the query layer

Decision-grade evaluation for the proposed **derived, ephemeral, rebuilt-each-run** query
layer over the agentic-code-ontology files. Scale is tiny and fixed: ~400 nodes,
~479 edges, ~2,500 embedding vectors. The methodology forbids remote infra and recurring
cost; APPROACH.md §5 rule 12 discourages any server/daemon. Every recommendation below is
therefore filtered through three hard constraints: **free OSS licence**, **embedded /
in-process (no daemon)**, **survives being torn down and rebuilt on every local run**.

---

## (a) Graph engine

| Engine | Licence | Embedded? | Native vector index | Python | Maturity | Fit verdict |
|---|---|---|---|---|---|---|
| **Kùzu** | MIT | **Yes** (in-process) | Yes — disk HNSW, bundled in 0.11.3 | First-class (`pip install kuzu`, wheels 3.7-3.14) | **Archived Oct 2025** | Strong tech, dead upstream — CAUTION |
| **DuckDB + DuckPGQ + VSS** | MIT (core); DuckPGQ unstated; VSS MIT | **Yes** (in-process) | VSS = HNSW, *experimental*; persistence behind a flag | First-class, huge install base | Core mature; **DuckPGQ self-described "research project, work in progress"** | Viable for SQL-shaped graph; PGQ immature |
| **rustworkx** | Apache-2.0 | **Yes** (pure library, prebuilt wheels) | No — bring-your-own kNN | First-class (Qiskit-maintained) | Mature, actively maintained, JOSS-published | **Best fit** for this scale |
| **NetworkX** | BSD-3 | **Yes** (pure Python) | No | First-class, ubiquitous | Mature, ubiquitous | Viable; slow at scale but scale is tiny |
| **igraph** | GPL-2.0 | **Yes** (library) | No | `python-igraph` wheels | Mature | Works, but **GPL** is a licence catch |
| Neo4j Community | **GPLv3** | Server (embeddable JVM lib exists but Java-only) | Yes (CE has vector index) | Via Bolt driver → needs running server | Mature | **Rejected** — daemon + GPLv3 + JVM |
| Memgraph | **BSL 1.1** (not OSI-open) | Server | Yes | Via client → needs running server | Mature | **Rejected** — daemon + non-open licence |
| FalkorDB | **SSPLv1** (not OSI-open) | Redis-module server | Yes (GraphBLAS-backed) | Via client → needs Redis daemon | Mature | **Rejected** — daemon + SSPL |
| Apache AGE | Apache-2.0 | **No** — PostgreSQL extension | Via `pgvector` companion | Via psycopg → needs running Postgres | Active (Sep 2025 release, PG18) | **Rejected** — requires a Postgres daemon |

### Reasoning

**The daemon constraint eliminates four of nine candidates outright.** Neo4j CE, Memgraph,
FalkorDB and Apache AGE are all server/client architectures. APPROACH.md §5 rule 12
discourages any daemon; an ephemeral rebuilt-each-run model makes a server actively
hostile — you would spin up, migrate, query, tear down a process every run. They also each
carry a licence or platform cost: Neo4j CE is **GPLv3**
([Neo4j CE page](https://neo4j.com/product/community-edition/), [issue #8331](https://github.com/neo4j/neo4j/issues/8331))
and JVM-only for true embedding; Memgraph is **BSL 1.1**
([Memgraph BSL.txt](https://github.com/memgraph/memgraph/blob/master/licenses/BSL.txt));
FalkorDB is **SSPLv1** ([FalkorDB licence docs](https://docs.falkordb.com/References/license.html)) —
neither BSL nor SSPL is recognised as open source by the OSI
([ArcadeDB comparison](https://arcadedb.com/blog/neo4j-alternatives-in-2026-a-fair-look-at-the-open-source-options/)).
Apache AGE is correctly Apache-2.0 and actively developed (release Sep 22 2025, PostgreSQL 18
support — [AGE release notes](https://age.apache.org/release-notes/)) but is *a PostgreSQL
extension*: it cannot exist without a running Postgres instance, which is the exact daemon
the methodology rules out.

**Kùzu is technically the closest fit but its upstream is dead.** Kùzu is a genuine
embedded property-graph database — "runs within your application process… does not require
installing any external dependencies or managing it as a DBMS server"
([Kùzu docs](https://kuzudb.github.io/docs/)) — MIT-licensed, with a *native disk-based
HNSW vector index* bundled in the 0.11.3 release (cosine/l2/l2sq/dotproduct metrics,
`CREATE_VECTOR_INDEX` / `QUERY_VECTOR_INDEX` from Python —
[Kùzu vector extension](https://kuzudb.github.io/docs/extensions/vector/)). It implements
Cypher, so deterministic graph traversal would be expressible declaratively. **However:
the GitHub repository was archived on 2025-10-10 and the sponsoring company (Kùzu Inc.)
abandoned the project** ([repo](https://github.com/kuzudb/kuzu),
[The Register, 2025-10-14](https://www.theregister.com/2025/10/14/kuzudb_abandoned/)).
v0.11.3 (the final release) still works and `pip install kuzu` wheels are published on PyPI
for Python 3.7-3.14 ([PyPI](https://pypi.org/project/kuzu/)), and the MIT licence permits
forks (community forks `bighorn` by Kineviz and `ryugraph` exist). But adopting an archived
database as the load-bearing engine of a query layer means **no security patches, no bug
fixes, no Python-3.15 wheels, and a fork bet** — for a workspace run by one spare-time
maintainer that is an unacceptable supply-chain risk.

**DuckDB is mature and embedded, but the graph half is research-grade.** DuckDB core is
MIT, in-process, and ubiquitous. The VSS extension gives HNSW, but it is explicitly
*experimental*: HNSW indexes only persist with `SET hnsw_enable_experimental_persistence =
true`, and the DuckDB team warns that WAL recovery for custom indexes is unimplemented, so
an unclean shutdown "can end up with data loss or corruption of the index"
([DuckDB VSS docs](https://duckdb.org/docs/current/core_extensions/vss)). The graph
extension DuckPGQ self-describes as "currently a research project and still a work in
progress" with "bugs, incomplete features, or unexpected behaviour"
([DuckPGQ homepage](https://duckpgq.org/)). For an *ephemeral* layer the VSS persistence
caveat is moot (we never restart — we rebuild), but staking the design on a research-grade
PGQ extension and an experimental VSS extension adds two fragile dependencies for a problem
that, at 400 nodes, does not need a database at all.

**At this scale, a graph database is over-engineering — and the brute-force kNN note is
decisive.** The brief flags it correctly: at ~2,500 vectors, exact brute-force kNN over a
single NumPy float32 matrix (`(2500, 768)` ≈ 7.3 MB) is one `matmul` — sub-millisecond,
*fully deterministic*, zero index to build, zero corruption surface. An approximate HNSW
index (Kùzu's or DuckDB's) buys nothing here except non-determinism and a build step. That
removes "native vector index" as a differentiator: **none of the in-memory libraries
needing it.** What remains is the graph half — and 400 nodes / 479 edges is a graph that
fits in memory trivially. **rustworkx** (Apache-2.0, prebuilt wheels, no compiler needed,
Qiskit-maintained, JOSS-published) gives directed graphs with arbitrary Python payloads on
nodes and edges, plus compiled-Rust traversal/shortest-path/centrality at 3-100× NetworkX
speed ([rustworkx benchmarks](https://www.rustworkx.org/benchmarks.html),
[Apache-2.0 LICENSE](https://github.com/Qiskit/rustworkx/blob/main/LICENSE),
[2025 SNA tool comparison](https://link.springer.com/article/10.1007/s13278-025-01409-y)).
NetworkX (BSD-3, pure-Python, zero build) is the no-dependency fallback — at this scale its
performance disadvantage is invisible, and it is the most universally understood graph API
in Python, which matters for a portable, agent-readable methodology. igraph works but is
**GPL-2.0** — a needless licence entanglement when Apache/BSD alternatives match it.

The ephemeral-rebuild model is the final tilt: rustworkx and NetworkX are *built* from the
JSONL files in milliseconds with a plain loop — no migration, no schema DDL, no index
warm-up, no file-format lock-in. That is exactly the "derived, rebuilt-each-run" shape the
proposal asks for. A database — even an embedded one — wants you to *persist*; a library
wants you to *construct*. The proposal wants construction.

---

## (b) Local embedding model

Corpus is technical English: Markdown sidecars (semantic prose about code), reducer outputs,
concept catalogues. Some content quotes identifiers / signatures, but it is overwhelmingly
*natural-language description of code*, not raw source. So the priority is **strong
general/technical retrieval**, not a pure code-search model — and a code-specialised model
must still be evaluated as a candidate.

| Model | Params | Dim (native / Matryoshka) | Max tokens | Licence | RAM (quantised) | Verdict |
|---|---|---|---|---|---|---|
| **EmbeddingGemma-300m** | 308M | 768 / 512·256·128 | 2048 | **Apache-2.0** | <200 MB | **Best fit** — top sub-500M MTEB, MRL, tiny |
| Qwen3-Embedding-0.6B | 595M | 1024 / 32-1024 | 32K | **Apache-2.0** | ~0.6-1.2 GB | Strong; instruction-aware; heavier |
| BGE-M3 | 568M | 1024 | 8192 | **MIT** | ~1 GB | Solid; long-context; dense+sparse+multivec |
| nomic-embed-text-v1.5 | 137M | 768 / 256+ | 8192 | **Apache-2.0** | ~274 MB | Good RAG baseline; needs task prefixes |
| Nomic Embed v2 | MoE | 768 / 256+ | 512 | Apache-2.0 | moderate | Short 512-token context is limiting |
| mxbai-embed-large-v1 | 335M | 1024 / MRL | 512 | Apache-2.0 | ~0.6 GB | Fine; 512-token context limiting |
| stella_en_1.5B_v5 | ~1.5B | 1024 / MRL | long | open | larger | Strong but oversized for the task |
| jina-code-embeddings-0.5b | 494M | 896 / 64-896 | 32K | **CC-BY-NC-4.0** | ~1 GB | **Licence-rejected** — non-commercial |
| jina-embeddings-v2-base-code | 161M | 768 | 8192 | Apache-2.0 | ~0.3 GB | OK code model; weaker on prose |

### Reasoning

**EmbeddingGemma-300m is the pick.** It is "the highest-ranking text-only multilingual
embedding model under 500M parameters on MTEB" at release
([Google Developers blog](https://developers.googleblog.com/en/introducing-embeddinggemma/),
[arXiv 2509.20354](https://arxiv.org/abs/2509.20354)). It is **Apache-2.0**, 308M params,
runs in **under 200 MB RAM quantised**, and supports **Matryoshka Representation Learning**
— the 768-d output truncates cleanly to 512/256/128
([HF announcement](https://huggingface.co/blog/embeddinggemma)). MRL matters directly here:
the original problem is *index files that grew unboundedly past an agent's context limit*.
Storing 256-d instead of 768-d vectors cuts the embedding-store footprint ~3× with minor
quality loss — a structural mitigation of the very bloat that triggered this ADR. Its
2048-token window comfortably holds a sidecar file or a reducer section. First-class
sentence-transformers support and an official ONNX export
(`onnx-community/embeddinggemma-300m-ONNX`) keep every runtime option open.

**The runner-up trade matters.** Qwen3-Embedding-0.6B is excellent (the 8B sibling topped
the MTEB multilingual leaderboard at 70.58 in June 2025, Apache-2.0 —
[Qwen3-Embedding blog](https://qwenlm.github.io/blog/qwen3-embedding/)) and its 32K context
and instruction-aware prefixes are attractive, but it is ~2× the parameters of
EmbeddingGemma for no quality gain *at this corpus*; notably, Google's own card shows the
medical-fine-tuned EmbeddingGemma at NDCG@10 0.886 *beating* Qwen3-Embedding-0.6B's 0.849
([HF announcement](https://huggingface.co/blog/embeddinggemma)). BGE-M3 (MIT, 8192 tokens,
dense+sparse+multi-vector — [BGE-M3 card](https://huggingface.co/BAAI/bge-m3)) is the choice
*if* long single-document embedding becomes important, but our chunked sidecars rarely
exceed 2K tokens. nomic-embed-text-v1.5 (Apache-2.0, 137M, MRL, 8192 tokens —
[nomic card](https://huggingface.co/nomic-ai/nomic-embed-text-v1.5)) is the lightest
credible fallback but scores below EmbeddingGemma on MTEB and mandates `search_query:` /
`search_document:` prefixes that add a foot-gun.

**A code-specialised model is the wrong tool here, and one is licence-blocked.**
jina-code-embeddings-0.5b posts the strongest code-retrieval numbers (78.72% MTEB-Code
average, 85.73% on COIR-CodeSearchNet — [Jina model page](https://jina.ai/models/jina-code-embeddings-0.5b/))
but ships under **CC-BY-NC-4.0** — non-commercial — which fails the workspace's free-OSS
bar for a public project. jina-embeddings-v2-base-code is Apache-2.0 and decent for
code+docstring search ([Jina news](https://jina.ai/news/elevate-your-code-search-with-new-jina-code-embeddings/)),
but our corpus is *prose about code*, not code, so a general top-tier model serves it
better than a code-tuned one. MTEB measures retrieval as one of several task families
(nDCG@10 over query→document ranking — [MTEB leaderboard overview](https://modal.com/blog/mteb-leaderboard-article)),
and on that axis a general 2025 model and a code model are close for documentation text —
so the licence-clean general model wins.

---

## (c) Embedding runtime

| Runtime | What it is | Daemon? | Determinism | Verdict |
|---|---|---|---|---|
| **fastembed** | Qdrant's ONNX-Runtime embedding lib | **No** — in-process | High (fixed ONNX graph, CPU) | **Best fit** — embedded, fast, light |
| sentence-transformers | PyTorch reference implementation | No — in-process | High on CPU | Strong fallback; heavier (Torch dep) |
| llama.cpp | GGUF C++ inference (`llama-embedding`) | No (CLI/lib) | High | Works; awkward Python ergonomics |
| Ollama | Local model server (HTTP `:11434`) | **Yes — background server** | High | **Rejected** — violates rule 12 |

### Reasoning

**Ollama is eliminated by the same rule that eliminated the server databases.** Ollama is a
*background daemon* exposing an HTTP API on `:11434`. Convenient, but APPROACH.md §5 rule 12
discourages exactly this, and an ephemeral rebuilt-each-run pipeline should not depend on a
separately-managed long-lived process. Rejected on architecture, not quality.

**fastembed is the pick.** It is Qdrant's embedding library built on **ONNX Runtime**, runs
**fully in-process** (no server), and is "optimized for running on standard machines even
with low resources." ONNX delivers sub-millisecond CPU latencies and large speedups over
PyTorch — reports cite 10-15× throughput gains and 60-80% lower memory
([FastEmbed ONNX overview](https://johal.in/fastembed-onnx-lightweight-embedding-inference-2025/),
[2025 embedding-runtime survey](https://www.morphllm.com/ollama-embedding-models)). It pairs
directly with EmbeddingGemma's official ONNX export. A fixed ONNX graph on CPU is
**deterministic** — the same text yields byte-identical vectors run to run, which matters
for a git-committed, reproducible methodology. One caveat: fastembed has shown *slower* than
sentence-transformers on some Apple-Silicon configurations
([fastembed issue #535](https://github.com/qdrant/fastembed/issues/535)) — at 2,500 vectors
the absolute time is trivial either way, so this does not change the pick.

**sentence-transformers is the explicit fallback.** It is the reference implementation, has
first-class EmbeddingGemma support with `truncate_dim=` for Matryoshka, and is also
in-process — but it pulls in the full PyTorch dependency (hundreds of MB) for a workload
ONNX handles in a fraction of the footprint. Recommended only if fastembed cannot load a
chosen model. llama.cpp's `llama-embedding` is a fine embedded option (GGUF, no daemon) but
its Python ergonomics are weaker than a `pip install fastembed` one-liner.

---

## Sources

- [Kùzu GitHub repository (archived 2025-10-10)](https://github.com/kuzudb/kuzu)
- [Kùzu documentation](https://kuzudb.github.io/docs/)
- [Kùzu vector extension docs](https://kuzudb.github.io/docs/extensions/vector/)
- [Kùzu releases](https://github.com/kuzudb/kuzu/releases)
- [kuzu on PyPI](https://pypi.org/project/kuzu/)
- [The Register — "KuzuDB graph database abandoned" (2025-10-14)](https://www.theregister.com/2025/10/14/kuzudb_abandoned/)
- [DuckDB graph queries guide](https://duckdb.org/docs/current/guides/sql_features/graph_queries)
- [DuckPGQ homepage (research-project status)](https://duckpgq.org/)
- [DuckPGQ community extension](https://duckdb.org/community_extensions/extensions/duckpgq)
- [DuckDB VSS extension docs (experimental HNSW persistence)](https://duckdb.org/docs/current/core_extensions/vss)
- [rustworkx benchmarks](https://www.rustworkx.org/benchmarks.html)
- [rustworkx Apache-2.0 LICENSE](https://github.com/Qiskit/rustworkx/blob/main/LICENSE)
- [2025 social-network-analysis tool comparison (Springer)](https://link.springer.com/article/10.1007/s13278-025-01409-y)
- [Neo4j Community Edition page](https://neo4j.com/product/community-edition/)
- [Neo4j licence declaration issue #8331 (GPLv3)](https://github.com/neo4j/neo4j/issues/8331)
- [Memgraph BSL 1.1 licence text](https://github.com/memgraph/memgraph/blob/master/licenses/BSL.txt)
- [FalkorDB licence docs (SSPLv1)](https://docs.falkordb.com/References/license.html)
- [ArcadeDB — "Neo4j Alternatives in 2026" (licence comparison)](https://arcadedb.com/blog/neo4j-alternatives-in-2026-a-fair-look-at-the-open-source-options/)
- [Apache AGE release notes (Sep 2025, PG18)](https://age.apache.org/release-notes/)
- [Apache AGE GitHub](https://github.com/apache/age)
- [EmbeddingGemma — Google Developers blog](https://developers.googleblog.com/en/introducing-embeddinggemma/)
- [EmbeddingGemma — Hugging Face announcement](https://huggingface.co/blog/embeddinggemma)
- [EmbeddingGemma — arXiv 2509.20354](https://arxiv.org/abs/2509.20354)
- [Qwen3-Embedding blog](https://qwenlm.github.io/blog/qwen3-embedding/)
- [Qwen3-Embedding-0.6B model card](https://huggingface.co/Qwen/Qwen3-Embedding-0.6B)
- [BGE-M3 model card](https://huggingface.co/BAAI/bge-m3)
- [nomic-embed-text-v1.5 model card](https://huggingface.co/nomic-ai/nomic-embed-text-v1.5)
- [BentoML — open-source embedding models guide 2025-2026](https://www.bentoml.com/blog/a-guide-to-open-source-embedding-models)
- [MTEB leaderboard overview (Modal)](https://modal.com/blog/mteb-leaderboard-article)
- [jina-code-embeddings-0.5b model page (CC-BY-NC-4.0)](https://jina.ai/models/jina-code-embeddings-0.5b/)
- [Jina code embeddings news](https://jina.ai/news/elevate-your-code-search-with-new-jina-code-embeddings/)
- [FastEmbed ONNX overview](https://johal.in/fastembed-onnx-lightweight-embedding-inference-2025/)
- [Ollama / embedding-runtime survey (Morph)](https://www.morphllm.com/ollama-embedding-models)
- [fastembed issue #535 — Apple-Silicon slowdown](https://github.com/qdrant/fastembed/issues/535)

---

## Recommendation

For an **ephemeral / local / free / zero-daemon** design, the stack is:

**(a) Graph engine — `rustworkx`** (Apache-2.0). At ~400 nodes / ~479 edges / ~2,500
vectors a graph database is over-engineering. rustworkx is a pure in-process library with
prebuilt wheels (no compiler, no daemon, no file-format lock-in), built from the JSONL
substrate in milliseconds on every run — exactly the rebuilt-each-run shape proposed.
It carries no vector index, which is *correct*: at 2,500 vectors, exact brute-force kNN over
a NumPy float32 matrix is a sub-millisecond, fully deterministic `matmul` — adopt that for
the vector half rather than an approximate HNSW index. `NetworkX` (BSD-3) is the
zero-dependency fallback if a pure-Python stack is preferred; its speed disadvantage is
invisible at this scale. **Explicitly reject** Neo4j CE / Memgraph / FalkorDB / Apache AGE
(all require a daemon; Memgraph BSL and FalkorDB SSPL are also not OSI-open). **Do not
adopt Kùzu** despite its strong embedded+HNSW design — upstream was archived October 2025,
meaning no patches and a fork bet that one spare-time maintainer should not take.

**(b) Embedding model — `EmbeddingGemma-300m`** (Apache-2.0). Highest-ranked sub-500M model
on MTEB, <200 MB quantised, 2048-token window (fits a sidecar), and Matryoshka truncation
to 256-d that *directly attacks the index-bloat problem* this ADR exists to solve. A
code-specialised model is the wrong tool — the corpus is prose about code — and the
strongest one (jina-code-embeddings-0.5b) is CC-BY-NC, licence-blocked anyway. Store **256-d
Matryoshka vectors** unless retrieval-quality probes show a measurable loss. Fallbacks:
BGE-M3 (MIT) if long-document embedding becomes important; nomic-embed-text-v1.5 if a
smaller footprint is needed.

**(c) Embedding runtime — `fastembed`** (ONNX Runtime, in-process). No daemon, low memory,
deterministic CPU inference, pairs with EmbeddingGemma's official ONNX export. **Reject
Ollama** — it is a background server and violates APPROACH.md §5 rule 12.
`sentence-transformers` is the fallback if fastembed cannot load the chosen model, at the
cost of a full PyTorch dependency.

**Overall confidence: HIGH.** Licences, embedded-vs-daemon status, and the Kùzu archival
are verified against primary sources; the rustworkx + brute-force-kNN pairing is the
direct, well-supported consequence of the stated tiny scale. The one genuinely open call is
EmbeddingGemma vs Qwen3-Embedding-0.6B — both Apache-2.0, both strong; resolve it with a
retrieval probe on the actual sidecar corpus rather than leaderboard averages.
