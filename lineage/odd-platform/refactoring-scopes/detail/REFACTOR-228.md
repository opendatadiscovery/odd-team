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

---
