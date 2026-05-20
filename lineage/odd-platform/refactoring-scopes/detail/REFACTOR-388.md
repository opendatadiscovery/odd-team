## REFACTOR-388 — `getDataEntityTerms` / `getDatasetFieldTerms` re-queried 3 TIMES per single link/unlink (REFACTOR-228 cross-batch confirmation at the repository-layer leg)

**Severity**: LOW (severity bounded by REFACTOR-228 MEDIUM at the service-tier primary-source)
**Category**: performance-redundant-work (read amplification on activity-handler chain; repository-layer leg of REFACTOR-228)
**Surfaced by**: `ReactiveTermRepositoryImpl.md:performance.known_performance_gaps[0]` + `ReactiveTermRepositoryImpl.md:performance.hot_paths[3]`

**Description**: `ReactiveTermRepositoryImpl.getDataEntityTerms / getDatasetFieldTerms` (lines 378-406) are invoked 3 times per single link/unlink operation via the activity-handler triple-fire pattern:
- `TermAssignmentActivityHandler.getContextInfo` (BEFORE the mutation) — pre-state for the activity event.
- The service method body itself (DURING — for the `markEntityUnfilled` decision).
- `TermAssignmentActivityHandler.getUpdatedState` (AFTER the mutation) — post-state for the activity event.

For a data-entity with 100 linked terms, a single de-link issues 3 full-list re-queries plus 1 DELETE — 300% read-amplification for one write operation.

The repository-layer presence of the gap is RECORDED here per the substrate's bottom-up surfacing principle; the primary-source is `TermServiceImpl.java:184-196` + `TermAssignmentActivityHandler.java:30-46` documented at REFACTOR-228.

**Primary source citations**:
- `ReactiveTermRepositoryImpl.java:378-406` — the repository methods
- `TermAssignmentActivityHandler.java:30-46` — the triple-call shape
- `TermServiceImpl.java:184-196` — the service-tier orchestration
- Cross-batch: REFACTOR-228 (batch K — the original surfacing)

**Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-067 (the @ReactiveTransactional boundary) and ADR-CANDIDATE-060 (programmatic activity-event emission) PRESCRIBE the activity-handler design. The triple-fire is the activity-handler's contract; the gap is the missing in-handler memoization.

**Proposed remedy**: See REFACTOR-228 — the activity-handler can capture the BEFORE state, return it through the call, and reuse for the AFTER comparison. Eliminates two of the three reads.

**Severity rationale**: LOW (severity bounded by REFACTOR-228's MEDIUM at the service-tier primary-source).

**Suggested backlog grouping**: `Performance-baseline sprint` — same sprint as REFACTOR-228.

---
