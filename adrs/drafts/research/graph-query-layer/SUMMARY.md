---
research: graph-query-layer
artifact: SUMMARY
date: 2026-05-21
mode: ecosystem (synthesis of STACK, PRIOR-ART, SCHEMA, PITFALLS, PROBES)
overall_confidence: HIGH
---

# SUMMARY — firm recommendations for the derived graph query layer ADR

Synthesis of five research threads — STACK (toolchain), PRIOR-ART (GraphRAG + the Sourcegraph reconciliation), SCHEMA (the graph projection), PITFALLS (failure modes), PROBES (validation). Decision-grade; adopt as written unless the ADR states a reason not to.

## The verdict in one paragraph

**Build the derived graph query layer — the reconciliation with the anti-embedding decision holds, and the pre-registered adoption trigger has fired.** It is reconcilable (PRIOR-ART, HIGH): `APPROACH.md` §9 / `LSN-016`, read precisely, ban an *external-API runtime* and *RAG-as-construction-method* — they never adjudicated a *local, ephemeral, query-time* index. This is an **extension** of the prior decision, not a reversal. The toolchain is light and fully open. The remaining uncertainty is operational tuning (retrieval-quality fusion, thresholds), all re-fittable, all behind a graph-only fallback.

## Firm recommendations

1. **The trigger has fired — adopt now.** `feature-anchored-ontology.md` principle 7 pre-registered the adoption trigger (index >5 MB / >20 candidates per query / dedup quality drops). The literal "5 MB" is a **flawed proxy**: principle 7 assumed headline-only index entries (~300-500 B) and modelled the constraint as a subagent's context. Reality — `test-map/index.yaml` entries are ~1,460 B each; the index is 1.26 MB ≈ 315k tokens ≈ **157% of an agent's real context-load limit**, a measured CRITICAL hard-blocker the Adversarial Review Panel found independently. The ADR adopts the layer **and corrects principle 7's threshold** to the real constraint (the agent context window). The deferral was honoured — not bypassed.

2. **The reconciliation (PRIOR-ART, HIGH).** Sourcegraph deprecated embeddings of *raw code chunks* for three reasons; two (third-party data egress, 100k-repo scaling) are structurally inapplicable to a local single-repo deploy; the one real reason (index staleness) is *exactly* what an ephemeral rebuilt-from-files index eliminates. 2024-2026 evidence (RANGER, Sept 2025) endorses the exact proposed shape — vectors find entry points, deterministic graph traversal does the structural work, and the embedded text is *distilled NL sidecar prose*, not raw code. The substrate stays fully agentic; embeddings are a query accelerator, never the representation.

3. **The stack (STACK).** All Apache-2.0, in-process, zero-daemon, zero-infra: **rustworkx** (the graph — pure library; Kùzu is rejected — its upstream was archived Oct 2025; every server engine fails rule 12); **exact brute-force NumPy kNN** for the ~2,500 vectors (no ANN → fully deterministic); **EmbeddingGemma-300m** (Apache-2.0, Matryoshka-truncatable to 256-d — directly fights index bloat); **fastembed** (ONNX, in-process) as the runtime.

4. **The design (SCHEMA).** An ~11-label property graph projecting `nodes.jsonl` / `edges.jsonl` / sidecars / the 6 reducers, every element carrying `source_file:source_line` provenance. Embed at **section granularity** (parent-document pattern) → ~2,000-2,500 vectors. Idempotent `files → (graph, vectors)` rebuild; **content-hash parse cache + embedding cache keyed `(section-text-hash, model-id)`** (mirrors the existing enrichment-cache invariant). Query interface: a Python library + CLI; hybrid — vector top-k → bounded 2-hop traversal.

5. **Files stay canonical.** `nodes.jsonl` / `edges.jsonl` / sidecars / `detail/` files are unchanged and authoritative. The graph + vectors are **derived, ephemeral, git-ignored, rebuilt from the files, never hand-edited, never a source of truth.** The original graph-DB rejection (diff-friendly files mandatory) does not touch a throwaway index.

6. **The recorded dissent (PITFALLS).** The PITFALLS thread argues the literal 5 MB threshold is not crossed and recommends deferral. The ADR records this and overrides it — the proxy is demonstrably flawed (wrong per-entry-size assumption, wrong constraint model) and the panel's measured CRITICAL shows the index is *already* broken, not approaching a limit. Recording the override openly is how principle 7's "never silently slip it in" is honoured.

7. **Validation (PROBES).** A five-family gate — retrieval quality (recall@k / MRR / nDCG over a ~60-query maintainer gold set vs. the grep baseline), bounded per-query context (25k-token result ceiling + a sub-linear growth sweep), rebuild cost (cold ≤10 min / warm ≤30 s), determinism (graph traversal bit-identical; vector top-k stable). The new layer runs in **shadow mode** alongside the Python scripts until the gate passes.

## What the ADR must hedge (MEDIUM-confidence items)

- RRF / score-fusion tuning between the vector and graph signals — operational, re-fittable.
- The prose-embedding exact-token blind spot (an embedding of distilled prose can miss an exact identifier) — mitigated by keeping a keyword/structured filter in the hybrid, and by graph traversal being the backbone.
- Local embedding-model quality ceiling — mitigated by EmbeddingGemma being a strong 2025 open model and by the **graph-only fallback** (the layer is useful as a pure traversal index even if the embedding half underperforms).

## Net

Build it; build it light (in-process libraries, no daemon, no infra); keep files canonical and the graph disposable; gate the embedding half on the PROBES retrieval-quality result with a graph-only fallback; correct principle 7's threshold openly. **Overall confidence HIGH** on the architecture, the reconciliation, and the stack; MEDIUM on first-pass retrieval tuning — which is exactly what the shadow-mode validation gate exists to settle.
