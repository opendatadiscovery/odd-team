## ADR-CANDIDATE-206 — Search-index consistency is part of the synchronous transaction for tag mutations — a tag rename refreshes the FTS vectors via an awaited `flatMap` inside `@ReactiveTransactional`, not a fire-and-forget `subscribe`

**Severity**: MEDIUM
**Classification**: promote
**Support count**: 1 sidecar (load-bearing — the `flatMap`-vs-`subscribe` placement inside a `@ReactiveTransactional` method is the intent anchor)
**Axes present**: services, repositories
**Batch**: X-TAGGING
**Related pillar features**: P-01:F-006 (Manual Object Tagging), P-01 (Data Discovery — full-text search surface), P-05 (Data Lineage / search-vector pipeline cross-cut)
**related_features**: [F-018]

**Surfaced by**:
- `odd-platform__java__TagController__controller-method__updateTag.md:implicit_adrs.[1]` ("Renaming a tag is a search-index-consistent operation — `TagServiceImpl.update` makes the three FTS-vector refreshes part of the synchronous transaction boundary via `flatMap(this::updateSearchVectors)`, not a fire-and-forget `subscribe`.")

**Decision statement**: When a tag is renamed via `PUT /api/tags/{tag_id}`, `TagServiceImpl.update` makes the full-text-search index refresh **part of the awaited `@ReactiveTransactional` chain**: the terminal step is `flatMap(this::updateSearchVectors)` (`TagServiceImpl.java:53`), and `updateSearchVectors` (`:161-167`) runs a concurrent `Mono.zip` of THREE FTS-vector refreshes — the data-entity `search_entrypoint.tag_vector`, the dataset-structure vector, and the term-side `term_search_entrypoint.tag_vector`. The `flatMap` (as opposed to a fire-and-forget `subscribe`) means the HTTP response is not returned until the search index is consistent with the renamed tag: a user who renames a tag and immediately full-text-searches the new name sees the carrying entities. The triple-zip is concurrent (parallel, not sequential `flatMap` chaining) — a deliberate latency optimisation. The decision codifies "a rename that changes a searchable token is not 'done' until the index reflects it; search-index consistency is a synchronous post-condition of the write, inside the same transaction."

**Evidence**:
- `updateTag.md` intent_anchor: "the `flatMap` (vs `subscribe`) placement, inside a `@ReactiveTransactional` method, shows the maintainer deliberately chose to make search-index consistency part of the awaited response... The triple-zip is concurrent (not sequential `flatMap` chaining) — intentional parallelism for latency."
- `updateTag.md` says: "`updateSearchVectors` runs `Mono.zip` of `reactiveSearchEntrypointRepository.updateChangedTagVectors`, `.updateChangedTagStructureVector`, `reactiveTermSearchEntrypointRepository.updateChangedTagVectors` (`TagServiceImpl.java:161-167`)."
- `updateTag.md` resource_boundaries says: "`updateSearchVectors` refreshes it synchronously within the same transaction, so there is no staleness window for the search index after a rename completes."

**Rationale (wisdom test 3-question)**:
1. *Intentional?* YES — the `flatMap` (await) vs `subscribe` (fire-and-forget) choice is a deliberate reactive-composition decision; placing it inside `@ReactiveTransactional` makes the index refresh atomic with the row UPDATE (rollback rolls back both). The concurrent `Mono.zip` (vs sequential chaining) is a second deliberate choice. The intent is inferred from the composition shape (confidence HIGH on the shape; no in-file comment, but the `flatMap`/`zip` placement IS the documentation).
2. *Structural impact?* YES — affects the search-index consistency model (the platform's full-text search is synchronously consistent with tag renames, not eventually consistent), the transaction boundary, and the latency profile of the rename endpoint (the rename blocks on a potentially large `search_entrypoint` upsert — see the performance gap below).
3. *Refactoring or structural?* STRUCTURAL — switching to an eventually-consistent / fire-and-forget index refresh, or to an async job, would change the consistency guarantee every search consumer relies on after a rename.
→ ADR-CANDIDATE.

**Note on the asymmetry**: this ADR describes the `update` path. The sibling `delete` path is NOT search-index-consistent in the same way — it refreshes only ONE vector and the refresh runs AFTER the `tag_to_term` rows are deleted (so the discovery CTE is empty and the refresh no-ops). That asymmetry is GAP-shaped — **REFACTOR-489** — and is explicitly NOT part of this ADR. The ADR captures the deliberate `update`-path design; REFACTOR-489 captures the `delete`-path's deviation from it.

**Existing ADR**: none. Composes with:
- **ADR-CANDIDATE-067** (`@ReactiveTransactional` boundary asymmetry — multi-step writes inside TX) — `TagServiceImpl.update` is the canonical multi-step write; this ADR adds the detail that the FTS refresh is one of the steps inside that boundary.
- **ADR-CANDIDATE-059** (service-layer `@ReactiveTransactional` boundary on per-data-entity write paths, with search-index refresh as one of the atomic steps) — the same "search-index refresh is an atomic step of the write transaction" pattern; the two together suggest the platform has a codebase-wide "writes that change searchable tokens refresh the FTS index synchronously inside the TX" convention worth consolidating.

**Co-surfaced gaps** (link from `refactoring-scopes.md`):
- **REFACTOR-489** — the `delete` path's asymmetric (1-of-3) + run-too-late FTS refresh; the deviation from this ADR's design.
- A performance gap (the rename's triple-upsert cost is unbounded in the tag's usage breadth, and fires even for a no-name-change `important`-flag toggle) — surfaced in `updateTag.md:performance.known_performance_gaps`; low severity; can be folded into a `PERF-NNN` follow-up rather than a standalone REFACTOR.

**Proposed action**: Promote to `adrs/drafts/synchronous-search-index-consistency.md` (or a section in the ADR-CANDIDATE-059 draft if the maintainer consolidates the FTS-in-TX pattern). Document: (a) the `flatMap`-inside-`@ReactiveTransactional` design and the synchronous-consistency guarantee it provides; (b) the concurrent `Mono.zip` latency optimisation; (c) the cross-reference to REFACTOR-489 (the `delete` path does NOT honour this design — a gap, not a counter-decision); (d) the performance trade-off (the rename blocks on a usage-breadth-proportional upsert).

**Severity rationale**: MEDIUM — pattern-shaping consistency-model decision. A future maintainer proposing "make tag rename async for latency" needs to know the synchronous-consistency guarantee is deliberate, and a maintainer fixing the `delete`-path FTS bug (REFACTOR-489) needs this ADR as the target design.

---
