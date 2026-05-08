---
research: agentic-code-ontology
artifact: PRIOR-ART
date: 2026-05-08
mode: ecosystem
overall_confidence: HIGH
---

# PRIOR-ART — production tools building code KGs with LLMs

Survey of how 2024-2026-cutoff production tools and recent academic work build code-knowledge artefacts with LLMs. Opinionated on what is genuinely novel vs. marketing, what the consensus design is converging on, and what ODD's agentic-code-ontology should adopt vs. reject. Confidence is HIGH that the ecosystem has *not* converged on agent-driven semantic ontology yet — most production tools are still RAG-over-syntactic-extracts. The ADR's pivot is therefore **ahead of mainstream** on the construction side, but **on-trend** on the storage / linkage side.

## Key findings

1. **The 2024-2025 production stack is RAG, not KG.** Despite years of "knowledge graph" marketing, every shipped IDE-assistant (Cursor, Continue.dev, GitHub Copilot, Bloop, Sourcegraph Cody) actually runs **embeddings + reranking + tree-sitter for symbol-name resolution**, not a semantic graph. The graph rhetoric belongs to research papers and to Cognition's DeepWiki — the latter being the closest production-deployed analogue to ODD's pivot. ([How Cursor Indexes Codebases Fast](https://read.engineerscodex.com/p/how-cursor-indexes-codebases-fast), [Sourcegraph Cody architecture](https://sourcegraph.com/blog/how-cody-understands-your-codebase), [Bloop on Qdrant](https://qdrant.tech/blog/case-study-bloop/))

2. **Sourcegraph explicitly retired embeddings in 2024-2025.** Cody Enterprise abandoned vector embeddings for BM25 + Code Graph search. The published rationale matches one ODD already shares: third-party data exposure, indexing maintenance overhead, scalability ceiling. This is the single most important precedent for *not* defaulting to embeddings. ([How Cody understands your codebase](https://sourcegraph.com/blog/how-cody-understands-your-codebase))

3. **Aider's repo-map is the closest open-source analogue to what ODD wants.** Tree-sitter + PageRank + a 1-3K token markdown output regenerated per query. Token-budget-aware. SQLite-cached. Refresh on file mtime. It is *not* an LLM-built ontology — it is a deterministic syntactic graph with PageRank for relevance — but its **shape** (file-symbol graph rendered as a hierarchical text artefact, kept compact, refreshed cheaply) is the right physical-design pattern for ODD's substrate. ([repomap.py source](https://github.com/Aider-AI/aider/blob/main/aider/repomap.py), [Building a better repository map with tree sitter](https://aider.chat/2023/10/22/repomap.html))

4. **Microsoft GraphRAG defines the construction primitive ODD will need, but its *eager* form is too expensive.** GraphRAG's pipeline (TextUnits → entity extraction via LLM → relationship extraction → community detection (Leiden) → community summarization) is the canonical reference for **LLM-built knowledge graphs**. But the eager pipeline costs 1000× indexing-vs-vector-RAG. **LazyGraphRAG (Nov 2024) is the right reference**: it defers all LLM use to query time, achieving 0.1% of full-GraphRAG indexing cost while retaining accuracy. ODD's per-file agentic walk is structurally a "lazy + iterative-deepening" GraphRAG variant. ([Microsoft GraphRAG](https://microsoft.github.io/graphrag/), [LazyGraphRAG](https://www.microsoft.com/en-us/research/blog/lazygraphrag-setting-a-new-standard-for-quality-and-cost/))

5. **Cognition's DeepWiki is the only production-deployed precedent for "agent walks the repo and emits a wiki."** Indexed 50K+ public repos, refreshed every couple hours, exposes via MCP (`ask_question`, `read_wiki_contents`, `read_wiki_structure`). They publish almost no architectural detail; the inference is graph-style relationship analysis + LLM summarization, surfaced as a navigable wiki — not a queryable graph DB. **DeepWiki proves the *output shape* (markdown wiki + 3-tool MCP surface) is viable; it does not prove the *interior* (whether graph-shaped or doc-shaped) is the right choice.** ([DeepWiki announcement](https://cognition.ai/blog/deepwiki), [DeepWiki MCP Server](https://cognition.ai/blog/deepwiki-mcp-server))

6. **Academic 2024-2025 favours property-graph + Cypher + LLM-agent traversal over flat embedding RAG, but each paper concedes high cost.** CodexGraph (Neo4j + Cypher), CGM (graph integrated into LLM attention), the May 2025 KG-based code-gen paper (Neo4j + AST + LLM-generated descriptions) — all build typed graphs and let agents traverse via query language. Cost is universally 1.5×-4× a baseline retrieval, and refresh strategies are universally "not yet solved." This is consistent with ODD's own roadmap risk. ([CodexGraph](https://www.emergentmind.com/topics/codexgraph), [CGM paper](https://arxiv.org/pdf/2505.16901), [KG-based code generation](https://arxiv.org/html/2505.14394v1))

---

## 1. Sourcegraph Cody

**Ontology shape.** Originally vector embeddings (text-embedding-ada-002) over chunked source. **As of 2024-2025: BM25 keyword retrieval over Sourcegraph's Code Graph** — a precise-code-nav index built by per-language indexers (SCIP-based) that produces "go-to-definition / find-references" semantics. Tree-sitter is used for completion-type detection, *not* graph construction. ([How Cody understands your codebase](https://sourcegraph.com/blog/how-cody-understands-your-codebase))

**Construction method.** Per-language SCIP indexers run server-side; outputs uploaded to a Sourcegraph instance. The Code Graph is therefore **deterministic + syntactic**, not LLM-extracted. Cody composes context across three layers at query time: local file (editor), local repo, remote repo via Search API. ([Sourcegraph docs](https://sourcegraph.com/docs/cody))

**Refresh strategy.** Server-side reindexing per-repo, decoupled from the user's editor. Embeddings (when used) had explicit complexity around incremental updates that the team called out as a deprecation reason.

**Storage shape.** Code Graph data on the Sourcegraph instance; no vector DB in the current Enterprise stack. Pre-2024 used embeddings stored server-side.

**Failure modes acknowledged.** *Explicit deprecation rationale* for embeddings: (a) third-party data egress (OpenAI), (b) "complexity that Sourcegraph admins have to manage," (c) struggled at 100K+ repo scale. **This is the single most credible "we tried X, X failed, we now do Y" data-point in the entire prior-art space.** Cody also flagged Cody Free and Pro discontinuation in July 2025 — a market-fit signal as much as a technical one.

**ODD-relevance.** HIGH. Cody's deprecation justifies ODD's instinct to *not* default to embeddings, and validates the "code graph" framing. ODD's substrate is not a peer of SCIP (compiler-accurate cross-references) — it is a peer of Cody's *outer* layer (semantic-meaning annotations on the code graph). Use Cody as the precedent for **deterministic-base + LLM-enrichment-on-top**, not LLM-only.

---

## 2. Cursor

**Ontology shape.** **Pure RAG, no graph.** Cursor's `@codebase` is a vector index over AST-chunked code, retrieved by nearest-neighbor on the user's query embedding. Tree-sitter is used to AST-chunk; the AST is *not* persisted as a structure — only its leaves are embedded. ([How Cursor Indexes Codebases Fast](https://read.engineerscodex.com/p/how-cursor-indexes-codebases-fast))

**Construction method.** Files split via AST-aware chunking (depth-first traversal into sub-trees fitting token limits, sibling merging). Each chunk embedded (model unverified — likely OpenAI ada-002 or a custom code model). Vectors stored remotely with metadata (line ranges, obfuscated paths).

**Refresh strategy.** **Merkle tree of file hashes**, root synced server-side every 10 minutes. Hash mismatches identify changed files; only those upload new chunks. Embedding cache keyed on chunk-content (so unchanged chunks pay zero re-cost). ([Cursor secure codebase indexing](https://cursor.com/blog/secure-codebase-indexing))

**Storage shape.** **Turbopuffer** (vector DB) for chunk embeddings + metadata + obfuscated paths. Code content itself is *not* persisted server-side — it is fetched from the local client at query-resolution time after similarity hits. Merkle tree state stored as content proofs for cross-team sharing.

**Failure modes acknowledged.** "Reversing embeddings is possible in some cases" — they explicitly call out the security risk. The Merkle / content-proof scheme is explicitly framed as defense-in-depth against this. Team-share via simhash: 92% similarity across users in an org enables index reuse — which is itself an *acknowledgment* that recomputation is expensive.

**ODD-relevance.** MEDIUM. Cursor's storage / refresh discipline (Merkle tree, content cache, obfuscated paths) is genuinely best-in-class engineering and worth borrowing for any ODD substrate that ships beyond the maintainer's machine. But Cursor is *deliberately not* a knowledge-graph product, so its ontology shape is non-applicable. The **chunking strategy** (AST-aware, depth-first, merge siblings) is reusable. ODD should NOT adopt Cursor's "embed everything" pattern; that is the path Sourcegraph rejected.

---

## 3. Aider's repo-map (THE closest analogue)

**Ontology shape.** Directed graph: **nodes = files, edges = references-to-definitions** (from referencing file to defining file). Each edge weight combines: square-rooted reference frequency, ×50 multiplier for chat files, ×10 for snake_case/kebab-case/camelCase identifiers ≥8 chars, ÷10 for private symbols (`_`-prefixed). Self-loops (weight 0.1) on definition-only files prevent isolation. ([Repository Mapping System](https://deepwiki.com/Aider-AI/aider/4.1-repository-mapping), [repomap.py source](https://github.com/Aider-AI/aider/blob/main/aider/repomap.py))

**Construction method.** Tree-sitter via 130+ language `.scm` query files. Captures named `name.definition.*` and `name.reference.*` extract `def` / `ref` tags. For languages without reference queries (e.g., C++), Pygments lexer fallback supplies references. **No LLM in the construction loop.** Tags are tuples of `(rel_filename, abs_path, line, identifier, kind)`. ([Aider tree-sitter queries](https://github.com/Aider-AI/aider/tree/main/aider/queries))

**Refresh strategy.** **mtime-keyed cache.** `diskcache.Cache` (SQLite-backed) at `.aider.tags.cache.v{CACHE_VERSION}/`. Per-file cache key = absolute path; value = `{mtime, [Tag, ...]}`. Lookup compares cached mtime against current; reparse if stale. CACHE_VERSION bumps invalidate all entries when extraction logic changes. SQLite-error fallback to in-memory dict.

**Storage shape.** Two layers: (1) on-disk SQLite tag cache (per-file tags); (2) **the rendered map is in-memory, recomputed every query**, never persisted. The map output is hierarchical markdown rendered via grep-ast's `TreeContext`:
```
aider/
  repomap.py
    class RepoMap
      def __init__(...)
```
Lines truncated to 100 chars. Important / chat / mentioned files surfaced first; remaining files PageRank-ordered.

**Token budget.** Default 1K tokens (`--map-tokens`). Binary search over tag counts to fit budget within 15% error. With no chat files, budget expands via `map_mul_no_files` multiplier up to `max_context_window - 4096`.

**PageRank specifics.** NetworkX `nx.pagerank(personalization=...)`. Personalization vector boosts: chat files, explicitly mentioned filenames, files whose path components match mentioned identifiers. Each gets `100 / len(fnames)`. Post-rank, scores are *distributed* across outgoing edges weighted by edge weight: this gives a per-(file, identifier) ranking, not just per-file.

**Failure modes acknowledged.** The blog post is explicit about ctags-vs-tree-sitter being load-bearing — ctags required external installation, gave shallower output, lacked incremental support. Pygments fallback is acknowledged-as-imperfect. No documented benchmarks on graph quality.

**ODD-relevance.** HIGH — **this is the design that ODD's substrate physical layer should mirror**. Specifically:

- **Hierarchical markdown output**, not a graph DB query interface. Aider proves a 1K-token markdown artefact is the right physical format for an LLM-consumed code map. ODD's existing JSONL+YAML+Markdown plan in `code-lineage-substrate/SCHEMA.md` is the same shape.
- **mtime-keyed cache**, not a full reindex. Refresh cost is per-changed-file, not per-repo.
- **Token-budget binary search**. ODD's substrate will have the same constraint.
- **Personalization vector for query-time relevance**. The agentic-ontology equivalent is: highlight nodes the user's current question touches; defer the rest.
- **No LLM in construction.** This is the part ODD is *deliberately departing from* — but Aider's success at 130+ languages with pure deterministic extraction is the reference for "how much you can do without LLMs," and the bar ODD must beat to justify the LLM cost.

What ODD adds beyond Aider: **semantic enrichment per node** (what does this code *do*; what doc page; what implicit ADR; what missing test). Aider does *zero* semantic enrichment. That gap is exactly the agentic-ontology pivot.

---

## 4. GitHub Copilot Workspace / Coding Agent / Spaces

**Ontology shape.** None published. Copilot's repo understanding is opaque from outside. Copilot Spaces (May 2025 → GA Sept 2025) is a "context container" — pull in repos, issues, docs, custom instructions; persistently grounded for chat — but no graph or KG is described. ([GitHub Copilot features](https://docs.github.com/en/copilot/get-started/features), [Copilot evolution](https://devops.com/github-copilot-evolves-agent-mode-and-multi-model-support-transform-devops-workflows-2/))

**Construction method.** Inferred-but-not-confirmed: server-side indexing on the GitHub backend leveraging the existing code search infrastructure (which Sourcegraph users have long compared unfavorably to Cody's approach). Agent Mode and Coding Agent perform task-time exploration with built-in tools (file read, search) rather than relying on a precomputed graph.

**Refresh strategy.** Continuous via the GitHub backend. No published cadence.

**Storage shape.** Unknown. Spaces appear to be a logical container, not a persistent graph.

**Failure modes acknowledged.** None publicly. Notable gap.

**ODD-relevance.** LOW. Copilot's approach is "agent + tools at query-time, no persistent graph artefact" — closer to Aider's lazy-rebuild than to GraphRAG's eager-index. Useful as a *negative* precedent: a publicly-popular code agent product apparently does not need a persistent KG. This is a counter-data-point against the ADR's substrate-as-product framing.

---

## 5. Cognition Devin / DeepWiki (THE closest production analogue)

**Ontology shape.** A **wiki**, not a graph DB. DeepWiki produces "comprehensive architecture diagrams, direct links to sources, documentation, and more" per repo. The output is a navigable wiki with cited code snippets, queryable via MCP tools. ([Devin 2.0](https://cognition.ai/blog/devin-2), [DeepWiki](https://cognition.ai/blog/deepwiki))

**Construction method.** Cognition publishes minimal detail. The most specific public claim: "DeepWiki combines large language models with graph-style analysis of a repository's structure to extract key concepts, relationships, and workflows from source code, configuration files, and existing documentation." Inference: **LLM agents read repo content (code + READMEs + configs); a graph-style analysis builds relationships; the output is rendered into a markdown-wiki form**. This is structurally what the ODD ADR is proposing. ([DeepWiki on Miraheze](https://ai.miraheze.org/wiki/DeepWiki))

**Refresh strategy.** **Every couple hours, automatically.** No incremental claim. Indexed 50K+ public repos at scale, including codebases up to 5M LOC of COBOL or 500GB.

**Storage shape.** Wiki pages (markdown-like) + architecture diagrams (Mermaid?) + cited code links. Surfaced via MCP server with three tools: `ask_question`, `read_wiki_contents`, `read_wiki_structure`. ([DeepWiki MCP Server](https://cognition.ai/blog/deepwiki-mcp-server))

**Failure modes acknowledged.** Devin annual review (2025) lists Devin-as-a-whole's failure modes: ambiguous requirements, mid-task requirement changes, visual design without explicit components, non-verifiable outcomes. None of these specifically scope to DeepWiki, which is presented as universally-working. **No public cost data, no quality benchmarks, no acknowledged hallucination rate.** This is the largest credibility gap in the entire prior-art set.

**ODD-relevance.** **VERY HIGH** — but as a *output-shape* precedent, not an interior-architecture precedent.

- **DeepWiki proves the wiki-with-MCP shape is viable** at 50K-repo scale. ODD's substrate publishing as `code/` markdown pages under `docs.opendatadiscovery.org` (or local-to-the-workspace `pillars/code-ontology/`) is the directly-equivalent shape.
- **DeepWiki proves "LLM walks the repo, emits structured artefact" is production-deployable.** The publication absence around interior detail means ODD has to invent its own architecture, but the *outcome* is a known-good shape.
- **Two-hour refresh cadence** is a useful upper bound: cheaper than continuous, more useful than nightly. ODD's MVP cadence should land in the same band.

What ODD must do better than DeepWiki: **publish the architecture and quality numbers**. DeepWiki's opacity is a weakness; ODD's principal-engineer-publishing-bar means publishing them is part of the deliverable.

---

## 6. Sweep AI

**Ontology shape.** **Bipartite graph**: files (left) → entities (right). Initially-searched files become root nodes, expanded one degree. Lexical search seeds root selection in addition to vector search. ([Sweep code planning blog](https://github.com/sweepai/sweep/blob/main/docs/pages/blogs/ai-code-planning.mdx))

**Construction method.** Hybrid: lexical keyword search (matching task descriptions like "Refactor the ChatGPT.chat method" → code identifiers) + vector retrieval. GPT-4 used as a **context optimizer** at 10K-token windows to decide which directories to expand and which to prune.

**Refresh strategy.** Per-task on-demand, not persistent.

**Storage shape.** Vector DB + lexical index, no persistent graph.

**Failure modes acknowledged.** "Degree 2 neighbors can't fit in context" — explicit context-window pressure. They use entity extraction inside snippets to prune — i.e., the LLM is asked to identify which symbols matter, then expand only those.

**ODD-relevance.** MEDIUM. Sweep's **bipartite shape** (files × entities) is a good simplification of full property graphs. The "LLM as context optimizer" pattern is reusable: an agent decides what to deep-dive on. But Sweep is task-time, not persistent — ODD wants persistent.

---

## 7. Bloop

**Ontology shape.** Vector index over per-file MiniLM embeddings + tree-sitter for precise navigation. Two-stage RAG pipeline: (a) GPT-4 query rewrite to keyword query; (b) embed keyword query → Qdrant nearest-neighbor → context assembly → second GPT-4 prompt synthesizes answer. ([Bloop deep dive](https://www.blog.brightcoding.dev/2025/09/29/ai-powered-code-search-and-chat-for-your-codebase/), [Bloop GitHub](https://github.com/BloopAI/bloop))

**Construction method.** **On-device MiniLM embeddings** — explicit privacy choice. Tree-sitter for navigation (10+ languages). Tantivy for keyword indexing, Qdrant for vector storage.

**Refresh strategy.** Per-file rebuild on local change. All local.

**Storage shape.** Tantivy + Qdrant, on-device. Embeddings never leave the disk.

**Failure modes acknowledged.** Implicit: the on-device MiniLM model is smaller / less capable than server-side models; no semantic-graph claim.

**ODD-relevance.** LOW for ontology shape (no graph), HIGH as a **privacy / on-device precedent**. ODD's substrate runs on the maintainer's box; Bloop proves that semantic search at useful quality is achievable without server-side embedding pipelines.

---

## 8. Continue.dev

**Ontology shape.** Embeddings (transformers.js, local) + AST parsing via tree-sitter + ripgrep keyword search. No graph. ([Continue codebase indexing](https://docs.continue.dev/customize/context/codebase))

**Construction method.** Embeddings computed locally via transformers.js, stored in `~/.continue/index` (sqlite metadata in `~/.continue/index/index.sqlite`). Respects `.gitignore` + `.continueignore`.

**Refresh strategy.** On file change.

**Storage shape.** Local sqlite + vector store. Multi-step retrieval: nRetrieve=25 from vector DB → LLM re-rank → nFinal=5.

**Failure modes acknowledged.** `@Codebase` was **deprecated** in favour of MCP-based providers (DeepWiki MCP for public repos, Context7 MCP for public docs, custom MCP for internal). This is an explicit "we built it, we found a better surface" signal.

**ODD-relevance.** MEDIUM. Continue's `@Codebase` deprecation in favour of **MCP-based delegation** is a useful precedent: surface via standard tools, do not rebuild context-providers in-house. ODD's substrate eventually wants an MCP server (matches DeepWiki's three-tool surface). But Continue's *interior* — local embeddings + sqlite — is a Cursor-class RAG, not what ODD wants.

---

## 9. Anthropic cookbook / Skills / subagents

**Ontology shape.** **None specific to code KGs.** Anthropic's published patterns are agent-skills (a SKILL.md folder with instructions, scripts, resources), subagents (specialized assistants in their own context windows with persistent memory), and the multimodal sub-agents notebook. None of the Anthropic-published artefacts demonstrate "build a code KG and query it." ([Anthropic skills repo](https://github.com/anthropics/skills), [Sub-agents docs](https://code.claude.com/docs/en/sub-agents), [Cookbook](https://platform.claude.com/cookbook/))

**Construction method.** Subagent persistent memory (a directory that survives across conversations) is the closest hint at "agent builds knowledge over time." The Anthropic engineering blog calls out this pattern explicitly: "build up knowledge over time, such as codebase patterns, debugging insights, and architectural decisions." But there is no cookbook example that shows it being done at-scale for a code KG.

**Refresh strategy.** N/A — pattern, not a tool.

**Storage shape.** "Persistent memory directory" — filesystem.

**Failure modes acknowledged.** Implicit: agent-skills are described as "loaded dynamically to improve performance on specialized tasks." No KG-specific failure modes.

**ODD-relevance.** HIGH — **this is the architectural primitive ODD's substrate is built on**. Skills + subagents + persistent-memory-directory is *exactly* the construction pattern for an agent-built code ontology. Anthropic has published the primitives; nobody has published a cookbook example for code-KGs specifically. **ODD's agentic-code-ontology is plausibly the first publicly-documented, end-to-end implementation of "subagent walks the repo, emits a persistent-memory-directory ontology, surfaces it via MCP."** That is genuinely novel ground, *not* a re-implementation of someone else's pattern.

---

## 10. Academic / industry papers (2024-2025)

### Microsoft GraphRAG (2024)

The canonical reference for LLM-built knowledge graphs. Pipeline: TextUnits → entity extraction (LLM) → relationship extraction (LLM) → key claims extraction (LLM) → hierarchical clustering (Leiden) → community summaries (LLM, bottom-up). Query routes to Local Search (entity-level fan-out) or Global Search (community-summary aggregation) or DRIFT (local + community context). ([GraphRAG project](https://www.microsoft.com/en-us/research/project/graphrag/), [GraphRAG GitHub](https://github.com/microsoft/graphrag))

**Cost.** "Naive RAG" fails on multi-entity questions; GraphRAG hits 86% comprehensiveness vs 57% on the eval set (Edge et al., 2024). Indexing cost is the primary critique — ~1000× vs. vector RAG.

**Relevance to ODD.** HIGH for the *primitive*, MEDIUM for direct adoption. ODD's per-file agentic walk is an entity-extraction pass; ODD's edge / relation extraction can borrow GraphRAG's prompt patterns. Community detection is orthogonal — ODD already has a hierarchical IA (SUMMARY.md, pillars, scanners) that is conceptually equivalent.

### Microsoft LazyGraphRAG (Nov 2024)

The cost-optimization story. **Indexing cost identical to vector RAG, 0.1% of full GraphRAG.** Defers all LLM use to query time. Construction phase is NLP noun-phrase extraction (no LLM). At query time: rank text chunks by similarity, assess relevance sentence-by-sentence with LLM, recurse into sub-communities, extract subquery-relevant claims. Single tunable parameter: relevance test budget (tested at 100 / 500 / 1500). ([LazyGraphRAG announcement](https://www.microsoft.com/en-us/research/blog/lazygraphrag-setting-a-new-standard-for-quality-and-cost/))

**Quality.** Comparable to GraphRAG global search at 4% query cost; outperforms vector RAG and competing graph approaches at budget=500.

**Relevance to ODD.** **HIGH**. The lazy / deferred design is the right cost-shape. ODD's MVP should be **lazy-first**: NLP / tree-sitter preindex → agent walks at query-time, summarizing only on demand. Eager full-ontology preindexing is the GraphRAG mistake.

### CodexGraph (academic)

Property graph (V, E) with NODE types {MODULE, CLASS, FUNCTION, METHOD, FIELD, GLOBAL_VARIABLE} and EDGE types {CONTAINS, HAS_METHOD, HAS_FIELD, INHERITS, USES, CALLS}. Two-stage extraction: shallow (per-AST) + cross-file (imports, inheritance, re-exports). **Neo4j storage, Cypher queries**. Two-agent workflow: primary agent decomposes tasks; translation agent generates Cypher. ([CodexGraph](https://www.emergentmind.com/topics/codexgraph))

**Cost.** 1.5×–4× token overhead vs baseline. Python-only. "Indexing and graph construction incur substantial computational cost for large or highly volatile repositories."

**Refresh.** **Not solved.** Acknowledged as future work.

**Relevance to ODD.** MEDIUM. The **node/edge taxonomy** is directly applicable — ODD's substrate already proposes file/class/method nodes; CodexGraph validates the granularity choice. Cypher / Neo4j is **wrong for ODD** — too heavy for a single maintainer, OSS, no-budget context. ODD should keep flat-file storage (markdown + JSONL) and accept reduced query expressiveness.

### CGM — Code Graph Model (May 2025)

Graph integrated into LLM attention via specialized adapter. **43.00% on SWE-bench Lite** with Qwen2.5-72B (open weights). Multi-typed graph: files / classes / functions / variables; edges: calls / inheritance / imports / data dependencies. Hierarchical retrieval: entry-point search → graph traversal → ranking → context window management. ([CGM paper](https://arxiv.org/pdf/2505.16901))

**Failure modes.** Dynamic code (runtime calls) not captured. External libraries incomplete. Quality degrades on large codebases.

**Relevance to ODD.** LOW. CGM modifies LLM attention — not a viable approach in the "use Anthropic's hosted Claude" workspace. Useful only as a benchmark target.

### KG-Based Repository-Level Code Generation (May 2025)

Neo4j + AST + LLM-generated descriptions. Node types: File / Class / Method / Function / Attribute / **Generated Description**. Relations: defines_class / has_method / used_in / has_attribute / **has_description**. **`Generated Description` and `has_description` are the parts that matter for ODD's pivot** — they are the LLM-enrichment layer over a deterministic AST graph. ([KG-based code-gen paper](https://arxiv.org/html/2505.14394v1))

**Cost.** "Sub-graph retrieval and filtering is computationally intensive, especially for large repositories." Pass@1 36.36% on EvoCodeBench.

**Relevance to ODD.** **HIGH for the schema pattern.** This paper's mixed-node-type approach (deterministic structural nodes + LLM-generated semantic nodes) is structurally the ADR's pivot — agent semantic enrichment ON TOP of tree-sitter / AST extraction. **ODD's substrate should adopt this layered shape: AST nodes first, then `has_semantic` / `has_purpose` / `has_doc_link` / `has_implicit_adr` / `has_test_coverage` edges to LLM-emitted nodes.** This paper is the closest published precedent for the ADR's exact design.

### Agentic-RAG survey (Singh et al., Jan 2025)

Taxonomy: agent cardinality (single vs. multi), control structure, autonomy, knowledge representation. Identifies "graph-based RAG" as one category, with multi-hop reasoning via specialized agents. Open challenges: evaluation, coordination, memory management, efficiency, governance. ([Agentic RAG survey](https://arxiv.org/abs/2501.09136))

**Relevance to ODD.** MEDIUM as a positioning reference. ODD's substrate is "single-agent (the orchestrator) + multi-subagent (per-file analysts) + graph knowledge representation + persistent memory across runs." The taxonomy gives the design vocabulary for the ADR section.

### RepoFusion / RepoCoder / Code2Prompt (2023-2024 retrieval baselines)

[RepoFusion](https://arxiv.org/abs/2306.10998) (training framework), [RepoCoder](https://github.com/allanj/repo-level-codegen-papers) (iterative-refinement RAG), [Code2Prompt](https://github.com/mufeedvh/code2prompt) (CLI to dump entire codebases as prompts). Useful only as baselines: they prove that *retrieval* over repositories is well-studied; *semantic ontology* is not.

**Relevance to ODD.** LOW — these are pre-pivot retrieval primitives.

---

## 11. Knowledge-graph-from-LLM general approach

GraphRAG (Microsoft) is the published reference. Beyond it: neo4j-llm patterns (Cypher generation from natural language), LangChain GraphCypherQAChain (LLM ↔ Neo4j round-trips), FalkorDB GraphRAG SDK ([FalkorDB blog](https://www.falkordb.com/blog/graphrag-sdk-knowledge-graph/)).

**Common shape across the ecosystem:**
1. LLM extracts entities + relationships from text into a typed graph.
2. Graph stored in a property-graph DB (Neo4j, FalkorDB).
3. Query-time: LLM generates Cypher → DB → results back to LLM for synthesis.

**Universal failure modes:**
- **Hallucinated entities / relationships** — no published industry-standard validation.
- **Refresh cost** — most reference implementations are eager/full-rebuild.
- **Schema drift** — without an ontology lock, repeat extractions produce inconsistent types.

**Relevance to ODD.** MEDIUM. ODD's substrate borrows the *primitive* (LLM entity extraction) but rejects the storage shape (Neo4j / Cypher) for the workspace's velocity / single-maintainer constraints. ODD's "schema-locked" extraction (subagents emit typed JSONL conforming to a published schema) addresses the schema-drift failure mode head-on.

---

## 12. Codeium / Tabnine / Replit Agent (brief)

**Codeium / Tabnine.** Both are completion-first products. Repo understanding is server-side embedding indexing, not published in detail. Treat as Cursor-class RAG, no public KG architecture.

**Replit Agent (v2 → v3 → v4 in 2025).** Multi-agent architecture with parallel forks; orchestrating agent coordinates threads. Self-testing / debugging loop (generate code → run → fix → re-run). 200-min autonomy ceiling on Agent 3. **No public KG architecture.** Repo understanding inferred to be tools-at-query-time + embedding retrieval, not a persistent ontology. ([Replit 2025 review](https://blog.replit.com/2025-replit-in-review))

**Augment Code (worth flagging).** "Context Engine" is the most KG-adjacent claim from any commercial product: "semantically indexes and maps your code, understanding relationships between hundreds of thousands of files." Custom AI models (not generic embeddings), real-time indexing (seconds, not 10-minute polls), per-developer indices, Google Cloud (PubSub + BigTable + AI Hypercomputer) backbone. **Context Lineage** (2025) indexes recent commits + diffs. ([Augment Context Engine](https://www.augmentcode.com/context-engine), [Context Lineage](https://www.augmentcode.com/blog/announcing-context-lineage)) — **Augment is the closest commercial product to ODD's pivot ambition**, but it is closed-source and runs on a hyperscaler. ODD's substrate is the OSS / single-maintainer counterpart.

**Relevance to ODD.** Codeium/Tabnine: LOW. Replit: LOW. Augment: HIGH as a commercial-target reference; ODD does the same shape with no infrastructure.

---

## Consensus design (2024-2025)

There is **not yet a consensus** on agent-built code KGs. There IS a consensus on adjacent primitives:

| Primitive | Consensus | Source |
|---|---|---|
| AST extraction | tree-sitter | Aider, Cursor, Bloop, CodexGraph, CGM, KG-CodeGen paper. SCIP only where compiler-accuracy is needed (Sourcegraph). |
| File-level chunking | AST-aware (depth-first into sub-trees, sibling-merge) | Cursor, Continue.dev. Plain-text chunking deprecated. |
| Embedding-only RAG | **Deprecated for new builds** at enterprise scale | Sourcegraph explicitly retired, Continue deprecated `@Codebase` for MCP. |
| LLM-built KG construction | Eager (GraphRAG) **rejected on cost**; lazy (LazyGraphRAG) the new reference | LazyGraphRAG paper — 0.1% indexing cost for comparable quality. |
| Storage | Property graph + Cypher (academic / Neo4j ecosystem); flat files (Aider, ODD); MCP-served wiki (DeepWiki) | Three families, no winner. |
| Refresh | mtime-keyed cache (Aider) or Merkle tree (Cursor) | Both proven. Continuous re-embedding is rejected. |
| Surface | MCP server with 3-5 tools | DeepWiki, Continue.dev, Anthropic recommendation. |

**The "we tried X, it failed, we now do Y" stories that ODD must internalize:**

1. **Sourcegraph: embeddings → BM25 + Code Graph** because of third-party data egress, complexity, and 100K-repo-scale issues. ODD has the same constraints (publishing, no budget, growing repo set).
2. **Microsoft: eager GraphRAG → LazyGraphRAG** because of 1000× indexing cost. ODD's MVP must be lazy.
3. **Continue.dev: in-house `@Codebase` → MCP delegation** because rebuilding context-providers in-house is wasted work. ODD's substrate must surface via MCP eventually.
4. **GitHub stack-graphs: archived (Sept 2025)** in favour of tree-sitter for retrieval/AI use cases. (Already cited in `code-lineage-substrate/STACK.md`.)
5. **Sweep/Aider: pure-LLM walks → hybrid (deterministic seed + LLM enrichment)** because pure-LLM is too expensive and too hallucination-prone. ODD's pivot retains this insight: deterministic AST is the *seed*, LLM enrichment is the *pivot's value-add*.

The 2024-2025 industry direction is **"deterministic structural seed + lazy LLM enrichment + MCP-served output"**, NOT "agent walks repo from scratch and emits KG." ODD should align with this direction.

---

## What ODD should adopt

Firm recommendations, in priority order:

1. **Adopt Aider's physical-design pattern wholesale.** Tree-sitter extraction → per-file mtime cache → in-memory render → markdown output, token-budgeted. For ODD this is the *substrate seed layer* — exactly what `code-lineage-substrate/STACK.md` already specifies. **Confidence: HIGH.** ([Aider repomap source](https://github.com/Aider-AI/aider/blob/main/aider/repomap.py))

2. **Adopt LazyGraphRAG's lazy-by-default principle.** ODD's MVP must defer LLM enrichment to query-time-or-on-demand, not run an eager full-repo LLM pass. The deterministic AST seed is built eagerly (cheap); LLM enrichment is per-node, on-demand, cached. **Confidence: HIGH.** ([LazyGraphRAG blog](https://www.microsoft.com/en-us/research/blog/lazygraphrag-setting-a-new-standard-for-quality-and-cost/))

3. **Adopt the KG-CodeGen layered schema: deterministic structural nodes + `has_*` edges to LLM-emitted semantic nodes.** Concretely, ODD's substrate has:
   - Structural nodes: `File`, `Class`, `Method`, `Function`, `ConfigKey`, `BeanFactory`, `SDKBuilder`, `RouteHandler` (extracted by tree-sitter)
   - Semantic nodes: `Purpose`, `ImplicitADR`, `Caveat`, `MissingTest`, `DocLink`, `BugClass` (emitted by subagents per file)
   - Edges: `has_purpose`, `has_implicit_adr`, `has_caveat`, `has_missing_test`, `has_doc_link`, `has_bug_class`
   
   The deterministic layer is rebuildable cheaply; the semantic layer is incrementally refreshable. **Confidence: HIGH.** ([KG-CodeGen paper](https://arxiv.org/html/2505.14394v1))

4. **Adopt DeepWiki's output shape: markdown wiki + 3-tool MCP surface (`ask_question`, `read_wiki_contents`, `read_wiki_structure`).** ODD ships an MCP server that exposes the substrate. This is the only deployment surface that lets future tools consume the substrate (Claude Code, IDE assistants, third-party agents). **Confidence: HIGH.** ([DeepWiki MCP](https://cognition.ai/blog/deepwiki-mcp-server))

5. **Adopt Anthropic's subagent + persistent-memory-directory pattern as the construction primitive.** Per-file subagents emit typed JSONL into `pillars/code-ontology/{repo}/{path-hash}.jsonl` (or equivalent). Subagent context is independent; memory survives across runs. This is exactly the ADR's pivot. **Confidence: HIGH** (the pattern is documented; the at-scale code-KG application is novel ground). ([Anthropic skills](https://github.com/anthropics/skills), [Sub-agents](https://code.claude.com/docs/en/sub-agents))

6. **Adopt mtime-keyed cache + content-hash dedup.** Every node gets a cache key (`{file_path}:{mtime}:{schema_version}`). Subagent re-runs are skipped if cache hits. Content-hash dedup prevents duplicate LLM calls for unchanged content. **Confidence: HIGH.** ([Aider cache pattern](https://github.com/Aider-AI/aider/blob/main/aider/repomap.py))

7. **Adopt the relevance-test-budget concept from LazyGraphRAG as the cost knob.** ODD's substrate has a single tunable parameter: how deep does the agent walk per file (token budget for semantic enrichment). Default low (cheap MVP); raise on demand for specific files (where deep semantics matter). **Confidence: MEDIUM.** Borrows the principle but the specific tuning needs MVP data.

8. **Adopt schema-locked extraction (typed JSONL, published schema) to avoid GraphRAG's schema-drift failure mode.** Subagents are given a strict typed schema; emissions that don't conform get rejected. **Confidence: HIGH.** Standard practice for production LLM systems.

9. **Adopt Cursor's privacy posture for any future hosted form.** If ODD's substrate ever runs server-side, follow the obfuscated-path + Merkle-tree + content-proof pattern. **Confidence: MEDIUM.** Out-of-scope for MVP, in-scope for any team-wide deployment.

---

## What ODD should reject

1. **Reject embedding-only RAG.** Sourcegraph and Continue.dev both deprecated their pure-embedding stacks. ODD has the same scaling and privacy concerns. Embeddings are appropriate as *one signal* (chunk-similarity for fast lookup) but not as the primary representation. **Confidence: HIGH.** ([Cody architecture](https://sourcegraph.com/blog/how-cody-understands-your-codebase))

2. **Reject Neo4j / Cypher / property-graph DB storage.** CodexGraph and KG-CodeGen academic papers both use Neo4j; commercial Augment Code uses Google Cloud BigTable. **Both are too heavy for the workspace's single-maintainer / OSS / no-budget constraints.** ODD's substrate stays as flat files (markdown + JSONL + YAML manifests) per `code-lineage-substrate/SCHEMA.md`. Future migration to Neo4j is a Phase-3 option if cardinality demands it; MVP rejects it. **Confidence: HIGH.** ([CodexGraph cost](https://www.emergentmind.com/topics/codexgraph), [Augment infrastructure](https://www.augmentcode.com/blog/a-real-time-index-for-your-codebase-secure-personal-scalable))

3. **Reject eager full-repo LLM pre-indexing (full GraphRAG).** 1000× indexing cost is the explicit reason LazyGraphRAG was built. ODD's pivot is *more* expensive than tree-sitter — it must be lazy or it's structurally infeasible. **Confidence: HIGH.** ([LazyGraphRAG announcement](https://www.microsoft.com/en-us/research/blog/lazygraphrag-setting-a-new-standard-for-quality-and-cost/))

4. **Reject "agent walks the entire repo, emits everything from scratch."** This was implicit in the 2026-05-08 paradigm critique. The right pivot is *layered*: deterministic structural seed + agent semantic enrichment ON TOP. The seed is cheap; the enrichment is on-demand. Pure-agent walks have no precedent at scale, and the closest precedent (DeepWiki) almost certainly does deterministic structural analysis underneath the LLM layer. **Confidence: HIGH** (inferred from absence of any "pure-agent" published precedent).

5. **Reject SCIP / stack-graphs as the primary index.** Already rejected in `code-lineage-substrate/STACK.md`; the 2025 industry shift away from SCIP for retrieval/AI confirms the call. **Confidence: HIGH.** ([Sourcegraph SCIP](https://sourcegraph.com/blog/announcing-scip), [stack-graphs archived](https://github.com/orgs/sheeptechnologies/discussions/4))

6. **Reject CGM-style "graph-into-LLM-attention" approaches.** Requires custom-trained or fine-tuned models. ODD uses hosted Claude; can't modify attention mechanisms. **Confidence: HIGH.** ([CGM paper](https://arxiv.org/pdf/2505.16901))

7. **Reject building an in-house `@codebase` / `@docs` style context provider.** Continue.dev's deprecation in favour of MCP-based providers is the precedent. ODD's substrate IS the content; Claude Code / IDE assistants consume it via MCP. Don't reimplement Cursor's context engine. **Confidence: HIGH.** ([Continue MCP migration](https://docs.continue.dev/guides/codebase-documentation-awareness))

8. **Reject DeepWiki-style "two-hour automatic refresh" as the *only* refresh mode.** DeepWiki's opacity around incremental updates is its single weakest published claim. ODD's substrate must support: (a) on-commit refresh per file (mtime-keyed), (b) on-demand "deep walk this specific file" via a `/code-walk` skill, (c) a rolling background refresh as a third-tier. Two-hour cron is the floor, not the ceiling. **Confidence: MEDIUM** (stronger refresh story than any current production analogue).

9. **Reject cardinality-as-a-success-metric.** Both DeepWiki ("50K+ repos") and Augment ("400K+ files") brag about cardinality. ODD's substrate is *one* repo per pillar; success is the **probe-driven test set** (per `code-lineage-substrate/PROBES.md` and the i18n miss case-law in LSN-006). Don't fall into the cardinality-vanity trap. **Confidence: HIGH.**

---

## Sources

- [Aider repository mapping (DeepWiki)](https://deepwiki.com/Aider-AI/aider/4.1-repository-mapping)
- [Aider repomap.py source](https://github.com/Aider-AI/aider/blob/main/aider/repomap.py)
- [Aider tree-sitter queries directory](https://github.com/Aider-AI/aider/tree/main/aider/queries)
- [Aider repo-map blog post (2023)](https://aider.chat/2023/10/22/repomap.html)
- [Aider repomap docs](https://aider.chat/docs/repomap.html)
- [Anthropic Agent Skills overview](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview)
- [Anthropic Agent Skills engineering blog](https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills)
- [Anthropic anthropic-cookbook GitHub](https://github.com/anthropics/anthropic-cookbook)
- [Anthropic skills repo](https://github.com/anthropics/skills)
- [Anthropic Sub-agents docs](https://code.claude.com/docs/en/sub-agents)
- [Augment Code Context Engine](https://www.augmentcode.com/context-engine)
- [Augment Code Context Lineage](https://www.augmentcode.com/blog/announcing-context-lineage)
- [Augment Code real-time index](https://www.augmentcode.com/blog/a-real-time-index-for-your-codebase-secure-personal-scalable)
- [Bloop deep dive](https://www.blog.brightcoding.dev/2025/09/29/ai-powered-code-search-and-chat-for-your-codebase/)
- [Bloop GitHub](https://github.com/BloopAI/bloop)
- [Bloop on Qdrant case study](https://qdrant.tech/blog/case-study-bloop/)
- [Code Graph Model (CGM) paper](https://arxiv.org/pdf/2505.16901)
- [CodexGraph](https://www.emergentmind.com/topics/codexgraph)
- [Code2Prompt CLI](https://github.com/mufeedvh/code2prompt)
- [Cognition Devin 2.0](https://cognition.ai/blog/devin-2)
- [Cognition DeepWiki announcement](https://cognition.ai/blog/deepwiki)
- [Cognition DeepWiki MCP Server](https://cognition.ai/blog/deepwiki-mcp-server)
- [Cognition Devin 2025 review](https://cognition.ai/blog/devin-annual-performance-review-2025)
- [Continue.dev codebase indexing docs](https://docs.continue.dev/customize/context/codebase)
- [Continue.dev codebase documentation awareness guide](https://docs.continue.dev/guides/codebase-documentation-awareness)
- [Continue.dev custom providers](https://docs.continue.dev/customize/custom-providers)
- [Cursor secure codebase indexing](https://cursor.com/blog/secure-codebase-indexing)
- [DeepWiki MCP discussion / dev community](https://dev.to/fallon_jimmy/deepwiki-an-ai-guide-to-github-codebase-mastery-3p5m)
- [Engineer's Codex on Cursor indexing](https://read.engineerscodex.com/p/how-cursor-indexes-codebases-fast)
- [FalkorDB GraphRAG SDK](https://www.falkordb.com/blog/graphrag-sdk-knowledge-graph/)
- [GitHub Copilot features docs](https://docs.github.com/en/copilot/get-started/features)
- [GitHub Copilot Workspace concept-to-code](https://github.com/orgs/community/discussions/142971)
- [GitHub Copilot evolves agent mode](https://devops.com/github-copilot-evolves-agent-mode-and-multi-model-support-transform-devops-workflows-2/)
- [Knowledge Graph based code generation paper (May 2025)](https://arxiv.org/html/2505.14394v1)
- [LazyGraphRAG announcement](https://www.microsoft.com/en-us/research/blog/lazygraphrag-setting-a-new-standard-for-quality-and-cost/)
- [Microsoft GraphRAG blog](https://www.microsoft.com/en-us/research/blog/graphrag-unlocking-llm-discovery-on-narrative-private-data/)
- [Microsoft GraphRAG GitHub](https://github.com/microsoft/graphrag)
- [Microsoft GraphRAG project page](https://www.microsoft.com/en-us/research/project/graphrag/)
- [Microsoft GraphRAG docs](https://microsoft.github.io/graphrag/)
- [Pragmatic Engineer on Cursor](https://newsletter.pragmaticengineer.com/p/cursor)
- [RepoFusion paper](https://arxiv.org/abs/2306.10998)
- [Replit 2025 review](https://blog.replit.com/2025-replit-in-review)
- [Singh et al. Agentic RAG survey](https://arxiv.org/abs/2501.09136)
- [Sourcegraph Cody understanding your codebase](https://sourcegraph.com/blog/how-cody-understands-your-codebase)
- [Sourcegraph Cody remote repository context](https://sourcegraph.com/blog/how-cody-provides-remote-repository-context)
- [Sourcegraph Cody docs](https://sourcegraph.com/docs/cody)
- [Sourcegraph SCIP announcement](https://sourcegraph.com/blog/announcing-scip)
- [stack-graphs RFC discussion (archive)](https://github.com/orgs/sheeptechnologies/discussions/4)
- [Sweep AI code planning blog](https://github.com/sweepai/sweep/blob/main/docs/pages/blogs/ai-code-planning.mdx)
- [Sweep AI GitHub](https://github.com/sweepai)
