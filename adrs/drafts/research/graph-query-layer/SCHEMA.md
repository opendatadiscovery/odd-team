---
research: graph-query-layer
artifact: SCHEMA
date: 2026-05-21
mode: research (single-thread)
overall_confidence: MEDIUM
---

# SCHEMA — derived ephemeral graph-query layer

## Scope and the LSN-016 reconciliation

The proposal: keep the canonical files (`nodes.jsonl`, `edges.jsonl`, ~147 per-node
sidecars, 6 reducer outputs) as the **sole source of truth**, and build a **DERIVED,
EPHEMERAL property graph + vector index each run**, queried by hybrid retrieval.

This sits next to a hard constraint. `APPROACH.md` §line 473 and `retrospectives/LSN-016`
both say **"no vector store / RAG layer"** — and LSN-016 Rule 2 says **"no external LLM
usage."** The schema below is designed to honour both, and the distinction is load-bearing:

- **What LSN-016 rejected** — a *persistent* RAG system as the **substitute for** structural
  analysis: an external-API embedding service, a hosted vector DB, embeddings treated as
  the deliverable, "couldn't find similar text" framed as the failure to solve. That is
  still rejected. The structural blind-spots LSN-016 names are not similarity problems.
- **What this layer is** — a *throwaway query accelerator* over artefacts the methodology
  already produced. It is rebuilt from files on every invocation, never hand-edited, never
  committed, never canonical. It is the same category as Aider's in-memory repo-map or a
  database's query planner: an index, not a source. If it is deleted, `git checkout`
  restores nothing because nothing was lost — the files are untouched.

**Two non-negotiable carry-overs from LSN-016 Rule 2** the BUILD-phase ADR must hold:

1. **Embedding generation must be local and offline.** No `voyage-code`, no
   `text-embedding-3`, no hosted endpoint. Use a local sentence-transformer
   (`all-MiniLM-L6-v2`, 384-dim, ~80 MB, CPU-fast — or a code-tuned local model). The
   embedding cache key therefore pins the *local* model file hash, not an API version.
2. **The graph/index never calls an LLM.** It is pure Python over files. The agent that
   *queries* it is a Claude Code session; the layer it queries is inert data.

If the ADR cannot hold #1 — if a maintainer would have to pay an API per rebuild — then the
embedding half must be dropped and this becomes a **graph-only** query layer (still valuable;
see §Open questions). The graph half has **no** LSN-016 tension and ships regardless.

`overall_confidence: MEDIUM` — the property-graph schema and rebuild model are HIGH; the
embedding half is MEDIUM, gated entirely on the local-model constraint surviving ADR review.

## 1 — Property-graph schema

A **labeled property graph** (LPG): typed nodes, typed directed relationships, key-value
properties on both ([Neo4j, *Describing a Property Graph Data Model*](https://neo4j.com/blog/developer/describing-property-graph-data-model/);
[AWS Neptune, *Property graph schema*](https://docs.aws.amazon.com/neptune-analytics/latest/userguide/custom-algorithms-property-graph-schema.html)).
LPG over RDF/OWL — same call the ARCHITECTURE made for `concepts` (structured prose, not
formal triples). The graph projects three canonical layers; **it adds no facts**.

**Universal provenance rule.** *Every* node and *every* relationship carries
`source_file` + `source_line` (line `0` when a whole-file artefact has no meaningful line,
e.g. a sidecar frontmatter). A graph element with no provenance is a build bug — the
projector raises, it does not silently emit. This mirrors Gate 9 and the sidecar `sources`
block; the graph is only as trustworthy as its citations.

### 1.1 Node labels

| Label | Projected from | Key | Core properties |
|---|---|---|---|
| `CodeNode` | `nodes.jsonl` (1 row → 1 node) | `node_id` | `axis`, `kind`, `repo`, `lang`, `package`, `descriptor`, `path`, `metadata` (JSON), `scaffold_hash`, `source_file`, `source_line` |
| `Sidecar` | each `understanding/*.md` (frontmatter) | `node_id` | `enrichment_status`, `confidence_overall`, `prompt_version`, `model`, `enriched_at_commit`, `slug`, `source_file`, `source_line=1` |
| `Concept` | `concepts.yaml` entity/operation/invariant/audience entries | `concept_id` (`{type}:{slug}`) | `concept_type` (entity\|operation\|invariant\|audience), `canonical_name`, `aliases[]`, `canonicalisation_candidate` (bool), `source_file`, `source_line` |
| `ImplicitADR` | `implicit-adrs.md` + `implicit-adrs/detail/` | `adr_candidate_id` | `category` (promote\|extend-existing\|drift\|unique-load-bearing), `severity`, `title`, `wisdom_test_pass` (bool), `source_file`, `source_line` |
| `RefactoringScope` | `refactoring-scopes.md` + detail | `scope_id` | `finding_class` (DOC\|TEST\|SEC\|PERF), `severity`, `title`, `source_file`, `source_line` |
| `DocGap` | `doc-gaps.md` + detail | `doc_gap_id` (`DOC-NNN`) | `gap_type` (broken-url\|missing-anchor\|code-doc-drift\|missing-page\|stale), `severity`, `target_url`, `source_file`, `source_line` |
| `TestGap` | `test-map.yaml` uncovered behaviours | `test_gap_id` (`TEST-GAP-NNN`) | `behaviour`, `criticality`, `double_jeopardy` (bool — also a `DocGap`), `source_file`, `source_line` |
| `Feature` | `feature-flows.yaml` + `feature-flows/detail/` | `feature_id` (`F-NNN`) | `pillar_id`, `feature_name`, `primary_drift_class`, `drift_class_summary[]`, `entry_point`, `source_file`, `source_line` |
| `FeatureReflection` | `feature-reflections/detail/` | `reflection_id` (`= F-NNN`) | `hypothesis_count`, `contradiction_count`, `source_file`, `source_line` |
| `Doc` | live-doc URLs cited in `docs_link_semantic` | `url` (+ `#anchor`) | `last_verified_status`, `last_verified_at`, `is_declared` (vs inferred), `source_file`, `source_line` |
| `Finding` | sidecar `bugs_limitations_corner_cases` / `security` / `performance` / `stress_findings` items | `finding_id` (`{node_id}#{section}#{idx}`) | `finding_kind` (bug\|security\|performance\|stress), `severity`, `summary`, `source_file`, `source_line` |

Eleven labels — `CodeNode` is the structural spine; `Sidecar`+`Finding` are per-node
enrichment; the remaining seven are reducer-derived (the "emergent axes" ARCHITECTURE names).
Schema-guided projection: a row that does not conform to a label's required-property set is
logged and skipped, never coerced — same isolation contract the reducers already hold.

`CodeNode` and `Sidecar` are kept as **two labels, not one merged node**: the scaffold
exists without enrichment (ARCHITECTURE's additive invariant), so a `CodeNode` with no
`Sidecar` is a legal, queryable state ("enumerated but un-enriched") — exactly the coverage
question `/coverage` answers.

### 1.2 Relationship types

| Type | From → To | Projected from | Properties |
|---|---|---|---|
| `DECLARED_IN` `IMPORTS` `CALLS` `EXPOSES` `WIRES` `CONFIGURES` `MOUNTS` `REFERENCES` `EMBODIED_BY` | `CodeNode` → `CodeNode` | `edges.jsonl` (type verbatim) | edge `metadata` (e.g. `http_method`, `path`, `operation_id`), `source_file`, `source_line` |
| `ENRICHED_BY` | `CodeNode` → `Sidecar` | slug join `nodes.jsonl` ↔ `understanding/*.md` | `enrichment_status`, `source_file`, `source_line` |
| `MENTIONS_CONCEPT` | `Sidecar` → `Concept` | sidecar `concepts` block ↔ `concepts.yaml` | `concept_role` (entity\|operation\|invariant\|audience), `source_file`, `source_line` |
| `SURFACES_FINDING` | `Sidecar` → `Finding` | sidecar `bugs_limitations`/`security`/`performance`/`stress` items | `section`, `source_file`, `source_line` |
| `IMPLIES_ADR` | `Sidecar` → `ImplicitADR` | reducer back-reference (`implicit-adrs/detail` cites `node_id`) | `source_file`, `source_line` |
| `HAS_DOC_GAP` | `Sidecar` → `DocGap` | `doc-gaps/detail` `node_id` cite | `source_file`, `source_line` |
| `HAS_TEST_GAP` | `Sidecar` → `TestGap` | `test-map.yaml` `node_id` cite | `source_file`, `source_line` |
| `HAS_REFACTOR_SCOPE` | `Sidecar` → `RefactoringScope` | `refactoring-scopes/detail` `node_id` cite | `source_file`, `source_line` |
| `LINKS_DOC` | `Sidecar` → `Doc` | sidecar `docs_link_semantic` (declared + inferred) | `is_declared`, `confidence`, `source_file`, `source_line` |
| `PART_OF_FEATURE` | `CodeNode` → `Feature` | `feature-flows/detail` `contributing_nodes[]` / `chain[].node` | `hop`, `multiplicity_per_trigger`, `source_file`, `source_line` |
| `REFLECTED_BY` | `Feature` → `FeatureReflection` | `feature-reflections/detail` `feature_id` | `source_file`, `source_line` |
| `CONTRADICTS` | `FeatureReflection` → {`Sidecar`\|`Doc`\|`ImplicitADR`} | reflection contradiction items | `verdict` (contradicted\|partial), `source_file`, `source_line` |
| `CANONICALISES` | `Concept` → `Concept` | `concepts.yaml` `canonicalisation_candidates` | `relation` (alias-of\|merge-into), `source_file`, `source_line` |

The 9 scaffold edge types from `edges.jsonl` are projected verbatim (uppercased) so a query
can mix structural hops with semantic hops in one traversal. The remaining types are the
**join fabric** that makes the reducer outputs traversable rather than 6 disconnected files.

Two integrity notes for the projector: (1) reducers cite `node_id`, but findings hang off
the *`Sidecar`* — the projector resolves `node_id` → `Sidecar` and attaches there, keeping
`CodeNode` purely structural; (2) a feature `chain[].node` descriptor like
`ts react-component:DataEntityDetails` may reference an **un-enriched / un-scaffolded**
node — the projector creates a stub `CodeNode {kind:'unresolved'}` so `PART_OF_FEATURE`
never dangles, and a query can surface "feature F-001 has an un-analysed hop."

## 2 — What to embed, and at what granularity

**Recommendation: embed at the per-SECTION granularity of each sidecar, plus one entry per
reducer-detail record. Do NOT embed whole sidecars; do NOT embed sub-section descriptors.**
Confidence **MEDIUM** (gated on the local-model constraint).

The sidecar is already a parent/child document by construction — frontmatter + ~13 named
Markdown sections (`understanding`, `concepts`, `bugs_limitations_corner_cases`,
`security`, `performance`, …). The retrieval literature converges on **parent-document
retrieval**: index small, semantically-coherent *child* units for precision; on a hit,
return the enclosing *parent* for context ([SurePrompts, *Chunking Strategies for RAG*](https://sureprompts.com/blog/chunking-strategies-for-rag);
[Snowch, *Text Chunking for Embeddings*](https://snowch.github.io/embeddings-at-scale-book/chapters/ch24_text_chunking.html)).

The named section **is** that natural child unit — no arbitrary character window needed:

- **Whole-sidecar embedding — rejected.** An `AlertController.changeAlertStatus` sidecar
  is ~200 lines spanning understanding, four security findings, five performance gaps,
  doc-drift. One vector averages all of it; a query for "alert authorization gap" competes
  with the performance prose in the same vector and washes out — the documented
  "details get washed out when one chunk covers multiple topics" failure
  ([Snowch](https://snowch.github.io/embeddings-at-scale-book/chapters/ch24_text_chunking.html)).
- **Per-descriptor embedding** (one vector per bullet — per implicit-ADR line, per concept
  entity) — **rejected.** Index size explodes (~147 sidecars × ~13 sections × ~4 bullets
  ≈ 7-8k vectors) and a single bullet loses the sibling context that makes it interpretable.
  Fixed-character splitting scores `Precision@1 ≈ 2-3%` in the chunking benchmark; section-
  coherent grouping scores `≈ 24%` ([arXiv 2603.06976, *A Systematic Investigation of
  Document Chunking Strategies*](https://arxiv.org/pdf/2603.06976)). Sub-section descriptors
  are *below* the coherence floor.
- **Per-section — accepted.** Each section is a single-topic, ~60-200-word coherent unit:
  precise enough that "alert reopen race condition" hits the `performance` section of the
  right sidecar, not the whole file. On a hit, the query layer returns the **whole parent
  sidecar** (or the requested section + frontmatter) — small-chunk precision, full-file
  context, exactly the parent-document pattern.

**Concrete embedding corpus per run:**

| Embedded unit | Vector text | Approx count (current substrate) |
|---|---|---|
| Sidecar section | section heading + section body, prefixed with `{node_id} · {kind}` | ~147 × ~10 non-empty sections ≈ **1,500** |
| Concept entry | `canonical_name` + aliases + the catalog gloss | ~105 |
| ImplicitADR candidate | `title` + the detail-file rationale | ~67 |
| RefactoringScope | `title` + finding body | ~120 (sampled count) |
| DocGap | `gap_type` + target URL + rationale | reducer count |
| Feature + FeatureReflection | `feature_name` + `description` + hypothesis text | ~5 features + reflections |

**Total ≈ 2,000-2,500 vectors.** At 384-dim float32 that is ~3-4 MB — trivially an
in-memory NumPy matrix; no vector *database* is warranted at this scale (reinforces "this is
an index, not a RAG product"). Each vector row stores `node_id` / artefact id + `section` +
`source_file` + `source_line` so a hit lands on a graph node with one dict lookup. The
`{node_id} · {kind}` prefix on section text is a cheap, well-established late-2025 trick
(contextual prefixing) to keep near-identical sections across sidecars distinguishable.

Empty sections (`covered_behaviours: []`) are **not** embedded — embedding "nothing" pollutes
the index. The projector skips any section whose body is empty or a bare `[]`.

## 3 — Deterministic, idempotent rebuild + cache model

**The graph + index are a pure function of the canonical files.** Same files → same graph,
bit-for-bit, on any machine — the functional-package-manager discipline (Nix/Guix: builds as
pure functions of declared inputs, content-addressed outputs;
[EmergentMind, *Reproducible Builds*](https://www.emergentmind.com/topics/reproducible-builds)).
The artefacts are **ephemeral**: `.gitignore`d, rebuilt per invocation, never hand-edited.
If they desync from the files, you delete and rebuild — there is no merge, no migration.

### 3.1 Rebuild pipeline

```
files → [parse]  per-file structured records  (cached on file content-hash)
      → [project] LPG nodes + relationships    (deterministic; sorted; in-memory)
      → [embed]   section/entry vectors         (cached on (content-hash, model-hash))
      → ready: in-memory graph handle + vector matrix
```

Determinism rules the projector MUST hold: (a) iterate input files in **sorted path order**;
(b) within a file, preserve source document order — never hash-map iteration; (c) node/edge
property dicts serialised with **sorted keys**; (d) no wall-clock, no RNG, no `uuid` in any
id — every id derives from canonical content (`node_id`, `F-NNN`, `{node_id}#{section}#{idx}`).
Given these, two rebuilds of the same commit are identical, and a rebuild diff is a faithful
mirror of a file diff.

### 3.2 Two caches (mirroring the ARCHITECTURE enrichment-cache invariant)

ARCHITECTURE's enrichment cache is keyed `(node_id, scaffold_hash, prompt_version, model)`.
The query layer mirrors the *shape* with two caches, both content-addressed, both
`.gitignore`d under `lineage/{repo}/.graph-cache/`:

**(a) Parse cache — key: `sha256(file_bytes)`.** For each canonical file, the parsed
structured record is stored at `.graph-cache/parse/{sha256}.json`. A file whose content-hash
is unchanged since the last run skips re-parsing. This is the per-run cheapness lever: on a
typical rebuild only the handful of files touched since last run are re-parsed; the other
~150 are cache hits. (Content-addressable storage via SHA-256 is the standard mechanism —
[Zig build cache](https://medium.com/@alex.rios/the-zigs-build-cache-eae263d1fad4).)

**(b) Embedding cache — key: `(sha256(section_text), embedding_model_id)`.** Stored at
`.graph-cache/embed/{model_id}/{sha256}.npy` (one small file per vector, or a single keyed
`.npz`). A section whose text is byte-identical to a previous run — and the same local model
— is a cache hit and is **not** re-embedded. This is the direct analogue of the enrichment
cache: text-hash replaces `(node_id, scaffold_hash)`, `embedding_model_id` replaces
`(prompt_version, model)`. `embedding_model_id` pins the **local model file hash** (per the
LSN-016 carry-over) — swapping the local model invalidates every embedding, correctly.

Cache *correctness* over cache *size*: any of the four key components changing → miss →
recompute. A stale cache can never be silently served — that would let the index drift from
the files, the exact failure the ephemeral design exists to prevent.

**Cost shape.** Cold build: parse + project (~seconds, $0) + embed ~2,000 sections on a
local CPU model (~tens of seconds, $0 — no API). Warm rebuild after a 3-sidecar edit:
~3 parse misses + ~30 embedding misses; everything else cached; **sub-second to a few
seconds**. The whole layer is free to run at the start of *every* query session — which is
what "ephemeral, rebuilt each run" requires to be practical.

**`manifest.yaml` `graph_cache` block** (for observability, mirroring the `enrichment` block):

```yaml
graph_cache:
  builder_version: 0.1.0
  embedding_model_id: "all-MiniLM-L6-v2@<sha256-of-local-model-file>"
  last_build_commit: ede5d277
  graph_node_count: 612
  graph_edge_count: 1340
  vector_count: 2180
  parse_cache_hit_rate: 0.94
  embedding_cache_hit_rate: 0.97
  cold_build_seconds: 41
```

### 3.3 Hand-edit prohibition

The graph/index files are **machine territory**, like a compiler's `target/`. The builder
writes a `# GENERATED — do not edit; rebuilt from lineage/{repo}/ files` header into any
on-disk dump. A maintainer who wants to change what the graph says edits the **sidecar or
reducer output** and rebuilds — the files are the only writable surface. This is the
same canonical-files-are-truth invariant ARCHITECTURE states for enrichment.

## 4 — Query interface

**Recommendation: a Python library + a thin `query` subcommand on the existing
`lineage/_extractor` CLI. NOT an MCP server for the MVP.** Confidence HIGH.

Rationale, and it is already settled in-workspace: `agentic-code-ontology.md` §line 274 —
*"Skills are the surface. A future MCP server (slice 10+) can expose the ontology to
non-Claude-Code consumers, but is not on the MVP path."* The query layer's only consumer is
a Claude Code subagent (`feature-advisor`, `/code-walk`, the reducers, `/navigate`). A
subagent already has `Bash` + `Read`; it invokes `python -m lineage_extractor query ...`
and reads the result. An MCP server adds a process to run, a transport to configure, and a
schema to version — for zero capability gain over a CLI a subagent can already call. MCP is
the right answer **when** a non-Claude-Code consumer appears (an IDE, a CI bot); until then
it is a maintenance burden a single-maintainer project should defer. The library functions
are written so an MCP server is a ~50-line wrapper if that day comes — no rework, just
exposure.

### 4.1 The hybrid query algorithm

Standard 2025 hybrid retrieval: **vector top-k for entry points, bounded graph traversal for
context**, fused ([Neo4j, *Enhancing Hybrid Retrieval with Graph Traversal*](https://neo4j.com/blog/developer/enhancing-hybrid-retrieval-graphrag-python-package/);
[arXiv 2507.03226, *Towards Practical GraphRAG*](https://arxiv.org/abs/2507.03226)).

```
query(text, k=8, hops=2, edge_filter=None, label_filter=None):
  1. embed `text` with the local model (cache-checked)
  2. cosine top-k over the in-memory vector matrix → k seed graph nodes
  3. from each seed, BFS traversal bounded by `hops` (default 2) and `edge_filter`
     — collect the bounded neighbourhood
  4. rank the union: vector similarity of seeds + structural proximity
     (hop-distance decay) — Reciprocal Rank Fusion of the two signals
  5. return ranked records: each carries node label, key properties,
     source_file:source_line, and the path back to its seed
```

`hops` default **2** — the 2025 finding is one-hop is high-recall and tractable, two-hop
captures most useful structural context, beyond that the neighbourhood explodes
([arXiv 2507.03226](https://arxiv.org/abs/2507.03226)). The bound is the safety rail against
the whole-graph-into-context failure. Pure-structural queries (no semantic need — "every
controller-method with a HIGH security finding") **skip step 1-2 entirely** and run a graph
predicate directly; the interface exposes both `query()` (hybrid) and `traverse()` (graph-only).

### 4.2 Concrete query shapes

**Shape A — semantic entry, structural expansion** (`feature-advisor` / `/code-walk`):
> *"I want to add per-alert authorization — what's affected?"*
Vector top-k → seeds land on the `security` sections of `AlertController.*` sidecars and the
`ImplicitADR` "authorization not enforced at controller layer." 2-hop traversal over
`SURFACES_FINDING` / `IMPLIES_ADR` / `EXPOSES` / `PART_OF_FEATURE` pulls the sibling alert
endpoints, the OpenAPI tag, the feature flow. Output: a cited blast-radius the agent reads
*before* writing code.

**Shape B — pure structural predicate** (`traverse()`, no embedding):
> *"Every `CodeNode` of kind `controller-method` with a `Finding` where
> `finding_kind='security'` and `severity='HIGH'`, and whether it has a `TestGap`."*
A graph match — feeds a security-coverage rollup deterministically. The double-jeopardy
(HIGH-severity security gap **and** untested) falls out of one traversal.

**Shape C — provenance / impact-of-a-file** (`/navigate`, refactor planning):
> *"If I touch `AlertServiceImpl.java`, what enrichment, findings, ADRs, doc gaps and
> features cite it?"*
Filter every graph element on `source_file` (the universal provenance property) →
the full set of artefacts whose claims rest on that file. Answers "what do I invalidate if
I change this" — directly the question a maintainer asks before a refactor.

**Shape D — cross-artefact contradiction surfacing** (reviewer / coherence sweep):
> *"Every `Feature` whose `FeatureReflection` `CONTRADICTS` either a `Doc` or an
> `ImplicitADR`."*
Traverse `REFLECTED_BY` → `CONTRADICTS`. Surfaces the intent-vs-implementation drifts the
rev-5 reflector produces, joined to the doc/ADR they contradict — a coherence-finding query
no single file answers, because the contradiction and its target live in different files.

### 4.3 Library surface (sketch)

```python
from lineage_extractor.graph_query import GraphQuery
gq = GraphQuery.build("lineage/odd-platform")   # cache-checked rebuild; ephemeral
gq.query("per-alert authorization", k=8, hops=2,
         edge_filter={"SURFACES_FINDING","IMPLIES_ADR","EXPOSES"})
gq.traverse(match={"label":"CodeNode","kind":"controller-method"},
            expand="SURFACES_FINDING", where={"finding_kind":"security","severity":"HIGH"})
gq.provenance(source_file="odd-platform-api/.../AlertServiceImpl.java")
```

Every returned record carries `source_file:source_line` so the calling agent can cite it in
its own output — the query layer never breaks the Gate 9 provenance chain.

### 4.4 Graph engine

Default: **NetworkX in-memory** + a NumPy vector matrix. The graph is ~600 nodes / ~1,300
edges today and at most low-thousands at full odd-platform coverage — far inside NetworkX's
comfort range, zero dependency weight, trivially ephemeral (built, queried, garbage-collected).
An embedded Cypher engine (Kùzu) was considered and is **not** recommended: it adds a binary
dependency for a dataset three orders of magnitude below where its columnar engine pays off,
and — concretely — the Kùzu project was **archived in October 2025**
([BigGo, *KuzuDB suddenly archived*](https://biggo.com/news/202510130126_KuzuDB-embedded-graph-database-archived)),
so betting the layer on it would import an unmaintained dependency. NetworkX + NumPy keeps
the layer genuinely throwaway. If the substrate ever grows past ~100k nodes (multi-repo,
cross-repo call edges), revisit with a maintained embedded engine — but that is not the
MVP and not this decade's odd-platform.

## Sources

- [Neo4j — *Describing a Property Graph Data Model*](https://neo4j.com/blog/developer/describing-property-graph-data-model/) — LPG node-label / relationship-type / property modelling.
- [AWS Neptune Analytics — *Property graph schema*](https://docs.aws.amazon.com/neptune-analytics/latest/userguide/custom-algorithms-property-graph-schema.html) — per-label property cataloguing; `(nodeLabel)-[edgeLabel]->(nodeLabel)` topology triples.
- [Hackolade — *Labeled Property Graph data modeling*](https://hackolade.com/labeled-property-graph.html) — schema-guided extraction; conform-or-skip discipline.
- [SurePrompts — *Chunking Strategies for RAG*](https://sureprompts.com/blog/chunking-strategies-for-rag) — parent-document retrieval (small child chunks for precision, return enclosing parent for context).
- [Snowch — *Text Chunking for Embeddings*](https://snowch.github.io/embeddings-at-scale-book/chapters/ch24_text_chunking.html) — detail-washout when one vector covers multiple topics; the granularity trade-off.
- [arXiv 2603.06976 — *A Systematic Investigation of Document Chunking Strategies and Embedding Sensitivity*](https://arxiv.org/pdf/2603.06976) — paragraph-group chunking ≈24% Precision@1 vs ≈2-3% for fixed-character splitting.
- [EmergentMind — *Reproducible Builds*](https://www.emergentmind.com/topics/reproducible-builds) — builds as pure functions of declared inputs; content-addressed outputs (Nix/Guix).
- [Alex Rios — *The Zig's Build Cache*](https://medium.com/@alex.rios/the-zigs-build-cache-eae263d1fad4) — SHA-256 content-addressable build cache mechanics.
- [arXiv 2507.03226 — *Towards Practical GraphRAG: Efficient KG Construction and Hybrid Retrieval at Scale*](https://arxiv.org/abs/2507.03226) — cascaded one-hop high-recall traversal; bounded multi-hop tractability.
- [Neo4j — *Enhancing Hybrid Retrieval with Graph Traversal (GraphRAG Python package)*](https://neo4j.com/blog/developer/enhancing-hybrid-retrieval-graphrag-python-package/) — vector-seed + graph-traversal + RRF fusion pattern.
- [BigGo — *KuzuDB embedded graph database suddenly archived*](https://biggo.com/news/202510130126_KuzuDB-embedded-graph-database-archived) — Kùzu archived Oct 2025; cautions against depending on it.
- Workspace: `adrs/drafts/research/agentic-code-ontology/ARCHITECTURE.md` — enrichment cache invariant `(node_id, scaffold_hash, prompt_version, model)`; per-node sidecar schema; additive scaffold↔enrichment contract.
- Workspace: `adrs/drafts/agentic-code-ontology.md` §15 / §line 274 — "Skills are the surface; MCP server is slice 10+, not MVP."
- Workspace: `retrospectives/LSN-016` + `APPROACH.md` §line 473 — "no vector store / RAG layer"; "no external LLM usage" — the constraints this schema reconciles.
- Workspace: `lineage/odd-platform/{nodes.jsonl,edges.jsonl,understanding/*.md,concepts.yaml,feature-flows.yaml,...}` — the canonical files projected; node-kind / edge-type histograms; sidecar section structure.

## Open questions

1. **Local-embedding constraint — the gating decision.** This schema's embedding half
   assumes a *local, offline* sentence-transformer (no API). If the BUILD-phase ADR confirms
   that, the layer ships whole. If a maintainer review decides even a local model is
   unwanted operational weight, **drop the embedding half** and ship a **graph-only** query
   layer — shapes B, C, D all work without vectors; only shape A's semantic entry degrades
   to keyword/label search. The graph half has no LSN-016 tension. The ADR must make this
   call explicitly and update `APPROACH.md` line 473's blanket "no vector store" to the
   precise "no *persistent external* RAG; a local ephemeral index is permitted" — or leave
   line 473 as-is and the embedding half does not ship.
2. **Reducer back-reference completeness.** The join fabric (`IMPLIES_ADR`, `HAS_DOC_GAP`,
   `HAS_TEST_GAP`, `HAS_REFACTOR_SCOPE`) assumes every reducer-detail record cites its
   originating `node_id`. Spot-checks show `concepts/index.yaml` lists `processed_node_ids`
   and `feature-flows/detail` lists `contributing_nodes`, but a pre-build audit must confirm
   *all six* reducers carry node-level back-references; any that don't need a small reducer-
   prompt patch before the projector can wire that edge type.
3. **Embedding model choice.** `all-MiniLM-L6-v2` is the safe general default (384-dim,
   ~80 MB, CPU-fast). A code-aware local model could lift shape-A precision on
   identifier-heavy queries — but adds size and a model-selection decision. Defer to a
   slice that measures shape-A recall on a fixed query set before committing.
4. **Stub-node policy for unresolved feature hops.** §1.2 creates `CodeNode {kind:'unresolved'}`
   stubs for feature `chain` nodes with no scaffold/enrichment. Confirm whether these should
   also surface as a coverage finding (un-analysed nodes a feature depends on) — likely yes,
   which makes the graph itself a coverage-gap detector, a useful free side effect.
5. **Rebuild trigger.** Ephemeral = rebuilt each run, but "each run" needs a definition:
   per query-session boot (simple, cache makes it cheap) vs lazy-on-first-query vs an
   explicit `query --rebuild`. Recommendation: build-on-first-query-of-session with the
   content-hash cache absorbing the cost; the ADR should confirm.
