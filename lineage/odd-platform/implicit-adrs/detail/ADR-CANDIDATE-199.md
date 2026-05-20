## ADR-CANDIDATE-199 — `EmptyPartitionsHousekeepingJob` structurally enforces empty-only DROP via template-method pattern — the abstract base method `getTargetTable()` + `exclusions()` are the ONLY extension points; concrete subclasses CANNOT bypass the empty-check; the AND condition `isPartitionInPast && isPartitionEmpty` is mandatory

**Severity**: MEDIUM
**Classification**: promote (new — structural-pattern-enforcement decision)
**Support count**: 2 sidecars (`ActivityEmptyPartitionsHousekeepingJob` PRIMARY-SOURCE + the SIBLING `MessageEmptyPartitionsHousekeepingJob` as the parallel application)
**Axes present**: housekeeping-orchestrator, partition-lifecycle, template-method-pattern
**Pillars affected**: P-01, P-05 — audit-feed retention, data-collaboration retention

**Surfaced by**:
- `ActivityEmptyPartitionsHousekeepingJob.md:implicit_adrs[1]` (PRIMARY-SOURCE — "**Empty-only contract preserved by template method**: the abstract parent class does NOT expose a 'drop by date' or 'drop all past' API; the only exported behaviour is 'past AND empty'. Concrete subclasses cannot bypass the empty-check because they only inject the target-table name. The 'empty partitions' promise in the class name is structurally enforced — a subclass cannot legitimately drop a non-empty partition without rewriting the base" — confidence: HIGH)
- `ActivityEmptyPartitionsHousekeepingJob.md:implicit_adrs[0]` ("**Symmetric naming pattern**: every concrete `EmptyPartitionsHousekeepingJob` subclass is named `<Table>EmptyPartitionsHousekeepingJob` and overrides ONE method (`getTargetTable`) plus optionally `exclusions()`. This class and `MessageEmptyPartitionsHousekeepingJob` apply the convention consistently")
- `ActivityEmptyPartitionsHousekeepingJob.java:9-17` (the concrete subclass — verified 17 lines, only `getTargetTable` override)
- `MessageEmptyPartitionsHousekeepingJob.java:12-25` (the sibling subclass — `getTargetTable` + `exclusions()` override)
- `EmptyPartitionsHousekeepingJob.java:35-39` (the abstract base — `getTargetTable()` abstract + `exclusions()` default empty list)
- `EmptyPartitionsHousekeepingJob.java:21-22` (the template method — delegates to `partitionService.getEmptyPastPartitions`)
- `PartitionServiceImpl.java:109-112` (the AND condition — `isPartitionInPast && isPartitionEmpty`)
- `PartitionServiceImpl.java:133-142` (the empty-check SQL: `SELECT count(*) = 0 FROM <partition>`)

**Decision statement**: The platform's `EmptyPartitionsHousekeepingJob` (abstract base) uses the template-method pattern to STRUCTURALLY ENFORCE that only EMPTY past partitions are dropped:

1. **Template method (in the abstract base)**: `EmptyPartitionsHousekeepingJob.doHousekeeping` (`:16-33`) delegates to `partitionService.getEmptyPastPartitions(connection, getTargetTable(), exclusions())` which computes the drop-candidate list using:
   ```java
   if (isPartitionInPast(partitionName, baseline)        // partition's end-date < today
       && isPartitionEmpty(connection, partitionName)) {  // SELECT count(*) = 0 from partition
     add to result;
   }
   ```
   Both conditions MUST hold — Java's short-circuit `&&` ensures the empty-check fires after the past-check passes.

2. **Extension points (the only mutability surface for subclasses)**: 
   - `protected abstract String getTargetTable();` (`:35`) — names the table this subclass operates on. Mandatory override.
   - `protected List<String> exclusions() { return emptyList(); }` (`:37-39`) — optional override for known-conflicting names.

3. **Structural enforcement (the safety property)**: A concrete subclass CANNOT:
   - Drop a NON-empty partition (the AND condition forces empty-check).
   - Drop a FUTURE partition (the past-check forces date-relative-to-today).
   - Skip the check (the template method is the ONLY way for subclasses to invoke partition drops; bypassing requires rewriting the base).
   
   The subclass is REDUCED to: "name your table + optionally exclude specific names". The safety guarantee is held by the base.

**The CONSISTENT application across 2 subclasses**:
- `ActivityEmptyPartitionsHousekeepingJob` (`:9-17`) — 17 lines; overrides ONLY `getTargetTable` (returns `Tables.ACTIVITY`). Uses default empty exclusions.
- `MessageEmptyPartitionsHousekeepingJob` (`:12-25`) — overrides `getTargetTable` (returns `Tables.MESSAGE`) AND `exclusions()` (returns `["MESSAGE_PROVIDER_EVENT"]` — the known-conflicting name).

Both consistently apply the convention. Adding a new partitioned table to the platform's retention scheme requires only a 12-25 line subclass with no orchestrator change.

**Wisdom test (3-question)**:
1. *Intentional?* YES — multiple positive signals:
   - The template-method pattern is explicitly applied (abstract method + concrete method + default-empty-list optional override).
   - The AND condition in `PartitionServiceImpl.getEmptyPastPartitions` is a EXPLICIT predicate, NOT a discovery from a flat query — the maintainer wrote `isPartitionInPast(name, baseline) && isPartitionEmpty(connection, name)`.
   - The CONSISTENT application across 2 subclasses (Activity + Message) is the proof-of-pattern.
   - The exception-class for Postgres-DROP-of-empty-table is explicit (the empty check fires; the drop proceeds; if Postgres rejects via `DROP TABLE` privilege error, the parent catches and logs).
2. *Structural impact?* YES — defines the partition-lifecycle safety contract. Subclasses get a SAFE-BY-DEFAULT API. Future tables added to retention scheme inherit the same safety property.
3. *Refactoring or structural?* STRUCTURAL — adding a "drop past partitions regardless of empty" API would require rewriting the base method AND changing the safety contract. The current pattern is a deliberate constraint.

→ ADR.

**Evidence**:
- `ActivityEmptyPartitionsHousekeepingJob.md` says: "Empty-only contract preserved by template method: the abstract parent class does NOT expose a 'drop by date' or 'drop all past' API; the only exported behaviour is 'past AND empty'. Concrete subclasses cannot bypass the empty-check because they only inject the target-table name. The 'empty partitions' promise in the class name is structurally enforced"
- `MessageEmptyPartitionsHousekeepingJob` (`:12-25`) — verified the parallel application
- `PartitionServiceImpl.java:109-112` — verified the AND predicate
- intent_anchor: the AND condition is EXPLICIT (verified file:line), the abstract method is EXPLICIT (verified file:line), the default-empty-list optional override is EXPLICIT (verified file:line). Three positive signals of deliberate template-method design.

**Existing ADR**: NEW (codifies the template-method pattern as an architectural commitment). Composes with:
- ADR-CANDIDATE-198 (NEW from this batch — Activity table APPEND-ONLY) — composes: partition-level retention is the only retention strategy for APPEND-ONLY rows.
- ADR-CANDIDATE-044 (existing — Notifications lazy-create-no-drop pattern for Postgres replication slots) — CONTRASTS: notifications use lazy-create-no-drop; partitions use lazy-create + auto-drop-of-empty.
- ADR-CANDIDATE-068 (existing — soft-delete taxonomy) — Activity is the EXCEPTION; this ADR-199 is the COMPLEMENTARY retention pattern for the exception.

**Co-surfaced gaps** (link from `refactoring-scopes.md`):
- REFACTOR-557 (NEW from this batch — empty-check + drop race) — the STRUCTURAL safety enforcement is point-in-time at the SELECT; the operator's mental model is point-in-time at the DROP. The race is the operational consequence the maintainer should address by re-checking under DROP's ACCESS EXCLUSIVE lock.
- REFACTOR-085 (existing — monotonic activity growth) — composes: this ADR is the retention strategy that DOES exist (partition-only); REFACTOR-085 is the growth consequence on platforms with no empty partitions.
- REFACTOR-564 (NEW from this batch — `count(*) = 0` unindexed seq-scan) — the empty-check's PERFORMANCE concern; the structural enforcement uses an inefficient check.
- REFACTOR-576 (NEW from this batch — `LIKE 'activity_%'` pattern matches non-partition tables) — the pattern-matching brittleness; subclasses' `exclusions()` override is the safety mechanism.

**Proposed action**: Promote to `adrs/drafts/empty-partitions-housekeeping-template-method.md`. Document:
- The template-method pattern: abstract base + extension points (getTargetTable + exclusions).
- The structural enforcement of "past AND empty" via the AND predicate in the partition service.
- The CONSISTENT application across 2 subclasses (Activity + Message).
- The trade-offs: safety-by-default (subclasses cannot bypass) + retention-limitation (non-empty partitions never drop).
- The cross-link to REFACTOR-085 (growth consequence) and the future-design option for row-level TTL retention as a SEPARATE pattern (not via this template).
- The cross-link to REFACTOR-557 (race) — the safety enforcement is point-in-time; the race is the operational consequence to address via the proposed re-check-under-lock fix.

**Severity rationale**: MEDIUM — pattern-shaping decision for the housekeeping subsystem. The decision IS sound (safety-by-default template method) but operators should understand the implication (partition-only retention; non-empty partitions never drop). Promoting to ADR codifies the pattern for future tables added to retention scheme.

**Cross-pillar bump**: P-01 × P-05 — audit-feed retention + data-collaboration retention. Severity stays MEDIUM.

**Suggested backlog grouping**: ADR draft + REFACTOR-557 (operator-visible consequence to address).

---
