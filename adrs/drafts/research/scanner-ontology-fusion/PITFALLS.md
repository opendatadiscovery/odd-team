---
research: scanner-ontology-fusion
artifact: PITFALLS
date: 2026-05-27
mode: workspace LSN survey + web prior-art + first-principles
overall_confidence: HIGH
intent: Catalog failure modes the fusion design must defeat. Every rule in Part D maps to ≥1 pitfall it defeats.
---

# PITFALLS — failure modes the scanner ↔ ontology fusion must defeat

The fusion hands the ontology (sidecars, feature-flows, concepts, implicit-ADRs, refactoring-scopes, doc-gaps, test-map, probes) to scanners as a clue surface, and lets scanners write back signal (`scanner_review:` blocks, new findings against ontology-named entities). A fusion that produces *confidently wrong* signal is worse than two independent systems — each side defers to the other, and the operator defers to both.

---

## Part A — workspace-specific pitfalls (LSN case-law)

### A1 — LSN-016: heuristic substrate produced no semantic content
**File:** `retrospectives/LSN-016-heuristic-substrate-no-semantic-content.md`

Temptation: let scanners do cheap pattern-match work the ontology was built to obsolete — a "broken-cross-references" scanner greps `[text](URL)` without consulting the ontology's `docs_link_semantic` block, regressing to the 1990s scanner stack while agentic enrichment sits unused. **Design must:** scanners with an ontology-fed sibling consult ontology clues first; pure heuristic fallback is a defect, not an optimisation. Scanner contracts name `ontology-fed | ontology-aware | ontology-blind`.

### A2 — LSN-017: per-node scan cannot see cross-layer user effects
**File:** `retrospectives/LSN-017-per-node-scan-cannot-see-cross-layer-user-effects.md`

The view_count doubling lived in a *composition* no single node saw. A scanner reading the feature-flow at face value — only named `chain[].file_line` anchors — inherits the feature-flow's blind spots. **Design must:** findings distinguish `ontology-confirmed` (verified what feature-flow named) from `ontology-extended` (discovered new behaviour). Two different rows in `scanner_review:`.

### A3 — LSN-018: cross-batch reducer contradiction, no coherence check
**File:** `retrospectives/LSN-018-reducer-contradiction-no-coherence-check.md`

F-010 said `SearchFacetsHousekeepingJob` exists; TEST-GAP-523 said it does not. Both committed, opposite polarity. The fusion doubles the surface area — scanners can now assert presence/absence the feature-flow has already claimed. **Design must:** scanner write-backs run the pre-emit coherence check against the feature-flow AND the rest of the ontology; polarity contradictions with higher-confidence artefacts halt emission and surface `state/coherence-conflict-scan-N.md`.

### A4 — LSN-019: file-analyser describes, does not interrogate
**File:** `retrospectives/LSN-019-file-analyser-describes-not-interrogates.md`

`listMostPopular` drift sat at `confidence: HIGH` for weeks because no interrogation was forced. If scanners are graded by "coverage of ontology-named entities," a fast scan touches everything and confidently asserts `OK` — fusion looks mature, is hollow. **Design must:** verdicts tagged `STATIC-INFERRED` or `PROBE-VERIFIED`; never `HIGH` without distinction. A scanner emitting only `STATIC-INFERRED OK` rows gets `verification_class: descriptive-only` and does not count toward "ontology-validated" status.

### A5 — LSN-020: Activity Feed `userIds` binds to OWNER_ID
**File:** `retrospectives/LSN-020-activity-userids-filter-binds-to-owner-id-no-top-down-reflection.md`

Cross-file intent-vs-implementation drift: parameter `userIds`, SQL filtering by `OWNER_ID`. Ontology silent. Scanners that re-walk the same chain re-affirm the same drift — they inherit the ontology's question-set. **Design must:** scanners ingesting a feature-flow run their own forcing-question pass over named entities, not merely tick off ontology citations. The forcing-question list is part of the scanner's contract; an "ontology-fed" scanner with no independent forcing-questions is a category error.

### A6 — LSN-022 + LSN-024: implicit target + stale model
**Files:** `retrospectives/LSN-022-panel-judged-against-implicit-target.md`, `retrospectives/LSN-024-meta-review-panel-reviewed-a-stale-model.md`

LSN-022 — panel had no written target, each agent invented one. Same shape here: a scanner emitting "this feature-flow is documentation-aligned" against *what* standard? If implicit, every scanner author picks differently. LSN-024 — panel re-recommended a fix the methodology already shipped. A scanner against ontology commit N-14 re-flags fixes that landed at N-7. **Design must:** every scanner load and cite `target.md` before verdicts; AND stamp the ontology commit consulted, refusing to emit if materially stale.

### A7 — LSN-023 + LSN-025: feature ontology without UI / substrate-axis ceiling gap
**Files:** `retrospectives/LSN-023-feature-ontology-built-without-the-ui.md`, `retrospectives/LSN-025-substrate-axis-enumerated-only-entry-points.md`

The substrate's `ui_shell:13, ui_routes:12` looked like UI coverage; real surface was 550 components. A scanner taking `chain[]` as complete reachable surface inherits the blindspot — "100% coverage" of an axis at 4.5% of its conceptual ceiling. The scanner becomes a meta-vanity-metric. **Design must:** scanner coverage metrics denominated by *conceptual ceiling* (Type-3.5 substrate-coverage probe), not substrate node count. "100% of F-031's UI hops verified" when F-031's UI chain is 1-of-12 components MUST surface "substrate-coverage gap detected — verification incomplete."

### A8 — LSN-009 + LSN-011: duplication / coherence not self-detecting
**Files:** `retrospectives/LSN-009-backlog-internal-duplication.md`, `retrospectives/LSN-011-doc-product-coherence-not-self-detecting.md`

LSN-009 — DOC-062 duplicated DOC-042 because the triager never grep'd backlog. LSN-011 — rich machinery for execution-quality, thin for completeness. Scanners against ontology-named entities land both: duplicates (no grep) AND completeness gaps (enumerate what was pointed at, not what should exist). **Design must:** scanner emissions grep ontology registries before writing; duplicates extend via back-link, never create parallel entries.

### A9 — LSN-008: stale-branch false positives
**File:** `retrospectives/LSN-008-stale-branch-false-positives.md`

Originally about stale `documentation/` checkouts. The fusion adds a second stale-source surface: stale `lineage/`. A scan consulting sidecars from N-21 when HEAD is N-3 is *worse* than non-fused — the operator sees both "current" (ontology stamp) and "contradicted by code." **Design must:** scanner protocol fetches + checks out `origin/main` of every consulted repo (target code AND ontology workspace) before running. A scan against a stale ontology is a process-level finding, not an emission.

---

## Part B — fusion-specific pitfalls (first-principles)

### B1 — Ontology staleness across the read↔scan boundary
Scan runs at HEAD N; ontology last refreshed at N-14; intervening commits renamed `userIds`→`actorIds`. Scanner finds shifted line numbers and either flags "anchor invalid" (false positive — code is fine) or silently chases the symbol and emits "consistent" (false negative — laundered staleness). **Mitigation:** stamp `ontology_commit:` on every emission. If `ontology_commit < HEAD - 5 commits` or 48h, fall back to ontology-blind with `WARNING: stale-ontology-skip`. No silent degradation.

### B2 — Circular trust (verifier built from the verified)
Scanner verification logic for "does this endpoint return what its OpenAPI tag promises?" was authored by reading the ontology's `understanding/` sidecar for that endpoint. Any wrong claim is now structurally invisible — claim and test share the source. **Mitigation:** verification MUST be self-contained code reading target-repo source directly. The ontology names *where to look*; the expectation comes from the scanner's own forcing-question contract. Any `Read(lineage/.../*.md)` inside the assert step is broken by design.

### B3 — Write-back contention
`/scan docs/accuracy` and `/scan tests/coverage` run in parallel; both annotate `F-021.yaml`'s `scanner_review:`; one overwrites the other. **Mitigation:** `scanner_review:` is APPEND-ONLY (list, not dict). Idempotency key `(scanner_id, scan_run_date, scanner_version)`. Same-key re-scan upserts (prior marked `superseded_at`); different keys never collide. Orchestrator serialises writes via file-lock per feature-flow.

### B4 — Doc-product-as-requirements-registry drift
A docs-accuracy scanner takes `docs.opendatadiscovery.org/configuration` as truth and flags every code config-key absent from the doc as "undocumented" — but for a feature ADDED to code but not yet documented (legitimate WIP), that's a false positive. The scanner implicitly assumes doc = requirements; LSN-017 already named this wrong. **Mitigation:** every feature-flow carries `status: code-only | docs-only | both | drift`. Scanners route per matrix: `code-only` → doc-gap candidate; `docs-only` → ghost-doc candidate; `drift` → maintainer review with BOTH anchors; `both` → verify alignment. A scanner not consulting `status:` is broken by design.

### B5 — Consultation-cost explosion
A scanner thinks "before each emission, consult the SME subagent." A 200-finding scan spawns 200 consultations. The auto-memory rule `feedback_minimal_resources_maximum_value` is silently violated. **Mitigation:** per-scan-run budget — max 3 SME consultations + max 5 probe-runs. Excess findings emit `escalation: pending-sme-review` into the backlog. Hard cap.

### B6 — Scanner annotations become the new ontology-of-the-ontology
Once `scanner_review:` blocks accumulate on every feature-flow, they become a source of truth. Next scanner reads prior entries to decide what to verify (verifier drift); maintainers stop reading code (annotation trust drift). **Mitigation:** `scanner_review:` is READ by maintainers (surface display only); no scanner reads another scanner's emissions. Each scanner re-derives from substrate + ontology + code. A scanner depending on another scanner's output is a *workflow*, not a scanner — separate contract under `composite-checks/`.

### B7 — Wrong-anchor verification
F-018 declares `chain[2].file_line: TagService.java:142-160`; actual logic is at 92-110; 142-160 is unrelated helper containing a different `ORDER BY`. A scanner "verifying F-018" by reading the named anchors produces a wrong-but-confident verdict. **Mitigation:** scanner independently locates the named entity (`listMostPopular` in `TagService.java`) via its own static analyser, then verifies the *located* code. The ontology's `file:line` is a navigation hint, not a verification target. Scanner emits actual range alongside ontology's claim; mismatch produces `anchor-drift: ontology=X actual=Y` routed back to feature-flow-builder.

### B8 — Mixing modes silently
A scanner declares `ontology_fed: true` and runs against a surface the ontology has not enriched. Ontology returns empty arrays. Scanner silently falls back to standalone heuristic behaviour. Operators see `ontology_fed: true` and assume findings are ontology-enriched; they are not. **Mitigation:** scanner protocol includes explicit `ontology_coverage_check_at_start`: enumerate intended entities; query ontology coverage; if ratio < 50%, ABORT with `INSUFFICIENT-ONTOLOGY-COVERAGE` and emit `coverage_gap_for_scan:`. Silent degradation forbidden; explicit `ontology_blind: true` re-run is the only path to standalone behaviour.

---

## Part C — ecosystem prior art

### C1 — Sourcegraph + Cody embeddings deprecation
**Summary.** Cody shipped with vector-embeddings-over-code as retrieval backbone (2023-2024). In 2024-2025 Sourcegraph deprecated embeddings across Cody Free/Pro/Enterprise, replacing them with native Search API (semantic + lexical hybrid). Cited reasons: indexing freshness debt (refresh pipelines whose maintenance cost dominated), scale, security (code sent to third-party APIs). The pivot: from "pre-index code, query at runtime" to "treat repo as primary store, search live with semantic overlays." Sources: [Sourcegraph Cody FAQ](https://sourcegraph.com/docs/cody/faq), [Cody embeddings doc](https://docs.sourcegraph.com/cody/core-concepts/embeddings), [Sourcegraph blog: how Cody understands your codebase](https://sourcegraph.com/blog/how-cody-understands-your-codebase).

**Lesson for our fusion.** The ontology IS our "embeddings layer" — a pre-built, hand-enriched index of code semantics. Sourcegraph's experience: pre-built semantic indexes accrete maintenance debt that exceeds query-time value unless refresh is mechanically tied to code change. The fusion must NOT treat the ontology as a write-once index queried many times; it must be a *cache* whose entries expire on code-change detection. A scanner reporting "verified against ontology commit N-21" while target HEAD is N-3 replays the Cody-embeddings failure at a different layer (rule D1).

### C2 — Microsoft GraphRAG + LazyGraphRAG
**Summary.** [Microsoft Research's LazyGraphRAG announcement](https://www.microsoft.com/en-us/research/blog/lazygraphrag-setting-a-new-standard-for-quality-and-cost/) documents a tradeoff: graph-as-summary indexes built ahead of time are expensive to build and drift quickly (production graphs without automated refresh drift 15-20% per quarter per [GraphRAG-in-production analysis](https://tianpan.co/blog/2026-04-09-graphrag-production-when-vector-search-hits-ceiling)), and they produce hallucinations when LLMs over-rely on shortest paths in the linearised subgraph ([arxiv 2512.09148](https://arxiv.org/abs/2512.09148)). LazyGraphRAG defers summarisation to query time, paying 0.1% of GraphRAG's indexing cost at 2-8s query latency. The hallucination paper names the failure: "drift toward structurally plausible but unsupported evidence" — the model trusts the graph because it's structured, even when wrong.

**Lesson for our fusion.** The ontology is a *clue source*, not *ground truth*. LLMs *trust* the graph because it's structured, and that trust amplifies wrongness. The fusion must treat the ontology as a *navigation hint* (B7) and never a *verification target* (B2). Scanner verdicts must be derivable from target source even if the ontology vanishes (rule D8). "Graph as truth" recurs in B6 — scanner annotations becoming the new ontology-of-the-ontology, same shape one layer up.

### C3 — Glean (enterprise search with code+doc dual source)
**Summary.** [Glean's code-search documentation](https://docs.glean.com/security/how-code-search-works) and [their 2026 evaluation](https://www.glean.com/blog/enterprise-search-evaluation-2026) describe a system explicitly handling the dual-source problem: when documentation and code disagree, Glean cites *both* sources and lets the user adjudicate. Published example: a "tiered schedule for running corpus stats" query — Glean correctly identified the tiered schedule from code, where Claude with doc-only context incorrectly inferred a single weekly cadence. The system does NOT pick a winner — it surfaces both with provenance, joined by permission-respecting trace.

**Lesson for our fusion.** Glean validates LSN-017's rule ("code is truth; docs are the audit target") in production — with a refinement: the system does not silently elevate one source; it cites both and forces operator adjudication. The fusion must adopt the same posture for `status: drift` (B4): when a scanner finds code-doc disagreement, emit BOTH anchors with explicit provenance, route to maintainer review rather than auto-emitting "doc is wrong." Default is NOT "code wins, file a doc-gap" — it is "two sources disagree, here are both, you decide." This protects against the scanner becoming a doc-deletion engine when the doc is right and the code is the regression — a class neither LSN nor first-principles had named, surfaced only by Glean's operational experience.

---

## Part D — the consolidated hard rules

| # | Rule | Defeats |
|---|------|---------|
| **D1** | Every scanner MUST stamp `ontology_commit: <sha>` on every emission. If `ontology_commit < HEAD - 5 commits` or 48h, scanner emits `WARNING: stale-ontology-skip` for that feature-flow and falls back to ontology-blind mode. | B1, A6, A9, C1 |
| **D2** | Every scanner MUST load and cite a written `target.md` (explicit yardstick) before verdicts. An implicit target is forbidden; a scanner handed no target aborts. | A6 |
| **D3** | `scanner_review:` is APPEND-ONLY list. Idempotency key `(scanner_id, scan_run_date, scanner_version)`. Same-key re-scan = upsert (prior marked `superseded_at`). Writes serialised via file-lock per feature-flow file. | B3 |
| **D4** | Every feature-flow carries explicit `status: code-only | docs-only | both | drift`. Scanners consult `status:` and route per matrix (code-only → doc-gap; docs-only → ghost-doc; drift → maintainer review with BOTH anchors; both → verify alignment). | B4, C3 |
| **D5** | Scanner emissions MUST grep ontology registries (`refactoring-scopes/`, `doc-gaps.md`, `test-map.yaml`, `implicit-adrs.md`) before writing. Duplicates extend existing findings via back-link; never create parallel entries. | A8 |
| **D6** | Scanner emissions run the pre-emit coherence check (LSN-018 protocol) against the feature-flow they annotate AND against the rest of the ontology. Polarity contradictions halt emission and surface `state/coherence-conflict-scan-N.md`. Post-batch coherence sweep enumerates scanner emissions alongside reducer emissions. | A3, B3, B6 |
| **D7** | Scanner verdicts tagged `STATIC-INFERRED` or `PROBE-VERIFIED`. A scanner emitting only `STATIC-INFERRED OK` rows gets `verification_class: descriptive-only` and does not count toward "ontology-validated" status. | A4 |
| **D8** | Scanner verification logic MUST be self-contained code reading target-repo source directly. NO `Read(lineage/.../*.md)` inside the assert step. The ontology names *where to look* (file:line); the *expectation* comes from the scanner's own forcing-question contract. Scanner re-locates the named entity via its own static analyser; mismatch with the ontology's anchor produces `anchor-drift:` routed back to feature-flow-builder. | B2, B7, C2 |
| **D9** | Scanner emissions distinguish `ontology-confirmed` (verified what feature-flow named) from `ontology-extended` (discovered new behaviour). A scanner with no `ontology-extended` rows over a sustained window is a passive auditor — fine, but labelled, and the maintainer sees the distinction. | A2, A5 |
| **D10** | Every scanner runs `ontology_coverage_check_at_start`: enumerate intended entities; query ontology coverage; if ratio < 50%, ABORT with `INSUFFICIENT-ONTOLOGY-COVERAGE` and emit `coverage_gap_for_scan:` naming missing entities. Silent fallback to ontology-blind mode forbidden; explicit `ontology_blind: true` is the only path to standalone behaviour. | B8 |
| **D11** | Scanner coverage metrics denominated by the *conceptual ceiling* (LSN-025 Type-3.5 substrate-coverage probe), NOT substrate enumerated node count. "100% of F-031's UI hops verified" when F-031's UI chain is 1-of-12 components MUST surface "substrate-coverage gap detected — verification incomplete." | A7 |
| **D12** | Per-scan-run budget: max 3 SME consultations + max 5 probe-runs. Findings beyond budget emit `escalation: pending-sme-review` into the backlog. Hard cap, not soft target. Scanner contracts name the budget and escalation path. | B5 |

**Coverage check.** A1 → contract framework (each scanner declares ontology-mode); A2 → D9; A3 → D6; A4 → D7; A5 → D9 + D10; A6 → D1 + D2; A7 → D11; A8 → D5 + D6; A9 → D1; B1 → D1; B2 → D8; B3 → D3; B4 → D4; B5 → D12; B6 → D6 + D8; B7 → D8; B8 → D10; C1 → D1; C2 → D8; C3 → D4. Every pitfall maps; every rule lands.

---

## References

**LSN case-law (Part A):** `retrospectives/LSN-{008,009,011,016-020,022-025}.md` as cited above.

**Prior art (Part C):**
- [Sourcegraph Cody FAQ](https://sourcegraph.com/docs/cody/faq)
- [Sourcegraph Cody embeddings doc](https://docs.sourcegraph.com/cody/core-concepts/embeddings)
- [Sourcegraph blog: how Cody understands your codebase](https://sourcegraph.com/blog/how-cody-understands-your-codebase)
- [Microsoft Research: LazyGraphRAG sets a new standard](https://www.microsoft.com/en-us/research/blog/lazygraphrag-setting-a-new-standard-for-quality-and-cost/)
- [arxiv 2512.09148 — Detecting Hallucinations in Graph RAG](https://arxiv.org/abs/2512.09148)
- [GraphRAG in Production: When Vector Search Hits Its Ceiling](https://tianpan.co/blog/2026-04-09-graphrag-production-when-vector-search-hits-ceiling)
- [Glean: How Code Search Works](https://docs.glean.com/security/how-code-search-works)
- [Glean enterprise search evaluation 2026](https://www.glean.com/blog/enterprise-search-evaluation-2026)

**Sibling research threads:** `STACK.md`, `ARCHITECTURE.md`, `PROBES.md`, `SUMMARY.md` (synthesis target). Parent: `adrs/drafts/research/agentic-code-ontology/PITFALLS.md` (P1-P15 carry over to the fusion's enrichment-touching surface).
