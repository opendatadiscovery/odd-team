## REFACTOR-228 — `TermAssignmentActivityHandler` re-queries the data-entity's full term list TWICE per assignment for BEFORE/AFTER state capture — O(N) cost per O(1) operation

**Severity**: LOW
**Category**: performance-redundant-query
**Surfaced by**:
- `addDataEntityTerm.md:performance.known_performance_gaps[0]`
- `addDataEntityTerm.md:performance.resource_allocation`

**Description**: `@ActivityLog(event = TERM_ASSIGNMENT_UPDATED)` on `TermServiceImpl.linkTermWithDataEntity` triggers `TermAssignmentActivityHandler` (line 20-61), which captures BEFORE and AFTER terms-list state by re-querying `termRepository.getDataEntityTerms(dataEntityId)` TWICE per call (line 29-43 and 41-43). For data-entities with many terms (50+), this is two full-list queries per single-term-link write — an O(N) cost on a single-term-link write. The cost is acceptable for typical term counts but a hidden quadratic-shape cost on extreme cases where an entity has hundreds of terms and the operator team is bulk-linking via the UI's N parallel calls.

**Primary source citations**:
- `TermAssignmentActivityHandler.java:45-50` (the `getDataEntityTerms` calls)
- `TermAssignmentActivityHandler.java:29-43` (BEFORE/AFTER capture)
- `TermServiceImpl.java:169` (the `@ActivityLog` annotation triggering the handler)

**Existing-ADR-or-implied-prescription**: implicit — write-time activity capture should be O(1) where the data permits. The handler could compute the BEFORE state from the in-flight pojo plus the term-being-added, avoiding the re-query.

**Proposed remedy**: Refactor `TermAssignmentActivityHandler` to:
1. Capture BEFORE state once at the entry of `linkTermWithDataEntity` (before the INSERT).
2. Derive AFTER state by appending the new term to the BEFORE state (or by removing for the delete path).
3. Eliminate the re-query.

OR: emit the activity event with ONLY the diff (the added/removed term), and reconstruct full state at read time by replaying the activity feed.

**Severity rationale**: LOW — performance gap on a per-write operation; bounded by the per-entity term count. Worth fixing for a deployment with heavy taxonomy use, otherwise cosmetic.

**Suggested backlog grouping**: PERF-NNN write-path optimization sprint.

## STRENGTHENS — TermServiceImpl (batch K, TRIPLE-RE-QUERY refinement for removeTermFromDataEntity)

**Triple-re-query refinement at primary source**. The batch-I sidecar framed this as a double-re-query for `linkTermWithDataEntity`; the batch-K TermServiceImpl sidecar adds the TRIPLE-re-query case for `removeTermFromDataEntity` — the method itself ADDS a third `getDataEntityTerms` call inside the method body to drive the `markEntityUnfilled` decision, on top of the handler's two BEFORE/AFTER captures.

**New batch-K evidence**:
- `TermServiceImpl.md:bugs_limitations_corner_cases.[4]` (MEDIUM): "TermAssignmentActivityHandler triple-re-query (REFACTOR-228 primary source). `removeTermFromDataEntity` (`TermServiceImpl.java:184-196`) emits `TERM_ASSIGNMENT_UPDATED`; `TermAssignmentActivityHandler.getContextInfo` re-queries `getDataEntityTerms` (1st full-list query) BEFORE method execution; the method itself calls `getDataEntityTerms` at line 188 (2nd full-list query, drives `markEntityUnfilled` decision); the handler's `getUpdatedState` re-queries AGAIN (3rd full-list query) AFTER. For a data entity with 100 linked terms, a single de-link produces 3 full-list re-queries plus 1 DELETE. The same triple-re-query pattern applies to `removeTermFromDatasetField` (line 226-239)."
- `TermServiceImpl.md:performance.known_performance_gaps.[0]` (MEDIUM): same finding from the performance angle.

**Refined remedy** (batch K extension): The original REFACTOR-228 remedy proposed 2-query → 1-query for the link path; the triple-re-query case for the unlink path benefits even more. The `markEntityUnfilled` decision can be made via a `countRemainingTerms(dataEntityId)` query instead of a full-list (`SELECT COUNT(*) FROM data_entity_to_term WHERE data_entity_id = ? AND term_id != ?`) — O(1) instead of O(N). Combined with the handler refactor (compute AFTER state from BEFORE + diff), the per-delink cost reduces from 3 full-list + 1 DELETE to 1 COUNT + 1 DELETE.

**Cross-batch triangulation**:
- batch-I (addDataEntityTerm controller-method): double-re-query framing on the link path
- batch-K (TermServiceImpl PRIMARY SERVICE-LAYER): triple-re-query primary source on the unlink path

**Severity unchanged**: LOW (performance gap on per-write operation). The batch-K finding raises the worst-case multiplier from 2× to 3× for the unlink path.

---
