## REFACTOR-544 — Three NEW IngestionServiceImpl F-008 drift facets surfaced from the service-tier vertex: (a) duplicate-ODDRN-in-payload crash via `Collectors.toMap` default-throw merger; (b) null `entityClassIds` NPE in the new-pojo delta-counter path; (c) `@Slf4j` unused — every destructive path (soft-delete restore, MICROSERVICE exclusion, duplicate-ODDRN crash, hollow promotion) executes WITHOUT any service-layer log line, breaking F-008 audit trail

**Severity**: MEDIUM
**Category**: missing-validation + missing-error-handling + missing-audit-log + asymmetric-defence
**Batch**: Z (2026-05-20)
**Pillars affected**: [P-10-integrations-ingestion (the F-008 service-tier vertex), P-07-active-platform-features (Activity Feed audit — the missing log is the audit-trail gap class), P-04-data-quality (BIS-alert derivation depends on the buggy MICROSERVICE-exclusion + the @Slf4j-silent restore)]

**Surfaced by**:
- `IngestionServiceImpl.md:bugs_limitations_corner_cases.[0]` (MEDIUM) — "Duplicate ODDRN within a single payload causes the entire ingestion to crash with `IllegalStateException: Duplicate key`. The two-arg `Collectors.toMap(DataEntityIngestionDto::getOddrn, identity())` at line 86 uses the default throwing merger — there is no `(a, b) -> a` or `(a, b) -> b` merge function, no comment defending the choice. The HTTP response shape is a 5xx with a stack trace logged on the platform side; the collector sees an unhelpful error. A collector with a glitched data-source iteration that emits the same ODDRN twice in one payload destroys the entire ingestion tick. No test asserts this; no comment defends the crash-vs-deduplicate decision."
- `IngestionServiceImpl.md:bugs_limitations_corner_cases.[2]` (LOW) — "`calculateTotalDeltaCount.calculateDeltaValues` (line 303-311) calls `Arrays.stream(entityClassIds).forEach(...)` (line 307) — if a new pojo has `entityClassIds == null` (theoretically possible if the IngestionMapper produced null for an entity with no class), this NPEs. The Java stdlib `Arrays.stream(null)` throws NullPointerException. The `classesAndTypeFilled` helper (line 313-315) protects the existing-entity decrement path but NOT the new-entity increment path at line 285. Asymmetric defence."
- `IngestionServiceImpl.md:bugs_limitations_corner_cases.[3]` (MEDIUM) — "`@Slf4j` (line 53) is unused. ZERO `log.*` calls in the file. The destructive paths — soft-delete restore (line 135-136), MICROSERVICE exclusion (line 103), duplicate-ODDRN crash (line 86), hollow-promotion (line 297), bulk-update with potentially stale `previousVersionPojo` data (line 134) — all execute silently. An operator investigating 'why did 3 entities I deleted reappear last night?' or 'why did my microservice's specific-attributes change not raise an alert?' has no service-layer log to consult. The application's only artefacts of these decisions are the DB state and (for restore) the bumped statistics counters."
- `IngestionServiceImpl.md:security.known_security_gaps.[0]` (MEDIUM) — "the `@Slf4j` annotation (line 53) is present but UNUSED. Destructive operations (restore-on-DELETED at line 135-136, MICROSERVICE exclusion at line 103, duplicate-ODDRN crash at line 86) execute with NO audit trail at this layer. Even if an operator enables DEBUG logging for the package, this Impl emits nothing because no `log.*` calls exist. A compromised collector exploiting the destructive surface (silent-delete-on-absence per MetadataIngestionRequestProcessor / LineageIngestionRequestProcessor — see interface sidecar) cannot be detected from logs originating in this Impl."

**Statement**: Three NEW Impl-specific drift facets surfaced from the IngestionServiceImpl service-tier vertex of the F-008 5-vertex picture:

**(a) Duplicate-ODDRN-in-payload crash**. `IngestionServiceImpl.java:83-86` uses the two-arg `Collectors.toMap(DataEntityIngestionDto::getOddrn, identity())` which applies the default throwing merger on duplicate keys:
```java
final Map<String, DataEntityIngestionDto> ingestionDtoMap = items.stream()
    .filter(d -> !d.getType().equals(JOB_RUN))
    .map(de -> ingestionMapper.createIngestionDto(de, dataSourceId))
    .collect(Collectors.toMap(DataEntityIngestionDto::getOddrn, identity()));
```
A collector emitting the same ODDRN twice in one payload (e.g. a glitched iteration over a data-source) crashes the entire ingestion with `IllegalStateException: Duplicate key`. The HTTP boundary surfaces this as a 5xx with stack trace; the collector receives an unhelpful error message. No test asserts the behaviour; no comment defends the crash-vs-deduplicate choice. The crash IS the destructive consequence — the ENTIRE batch (potentially thousands of entities) is rolled back inside the `@ReactiveTransactional` boundary (per ADR-CANDIDATE-190).

**(b) Null `entityClassIds` NPE in the new-pojo delta-counter path**. `IngestionServiceImpl.java:303-311` (`calculateDeltaValues`):
```java
private static void calculateDeltaValues(Integer typeId, Integer[] entityClassIds, ...) {
    Arrays.stream(entityClassIds).forEach(...);  // NPE if entityClassIds == null
}
```
The `classesAndTypeFilled` helper (lines 313-315) protects the EXISTING-entity decrement path at line 287-292 but NOT the NEW-entity increment path at line 281-285. Asymmetric defence: a new pojo with null `entityClassIds` (theoretically possible if the IngestionMapper produced null for an entity with no class) NPEs at line 307. The error escapes the reactive Mono, the @ReactiveTransactional boundary rolls back, the entire batch fails. No test, no comment, no defending logic.

**(c) `@Slf4j` unused — silent destructive paths**. `IngestionServiceImpl.java:53` declares `@Slf4j`; verified by `Grep "log\\." IngestionServiceImpl.java` returns ZERO matches. Every behavioural decision in the file executes SILENTLY at the service tier:
- Soft-delete restore (lines 135-136) — un-archive of soft-deleted entities
- MICROSERVICE exclusion from specific-attributes deltas (line 103) — F-008's `undocumented_carve_out` facet
- Duplicate-ODDRN crash (line 86) — the (a) finding above
- Hollow-promotion counter increment (line 296-298, 300) — operator-visible counter math
- Bulk-update with potentially stale `previousVersionPojo` data (line 134)
- The 14-processor chain itself running inside `@ReactiveTransactional` (lines 71-72)

An operator investigating "why did 3 entities I deleted reappear last night?" or "why did my microservice's specific-attributes change not raise an alert?" has NO service-layer log to consult. The Activity Feed (P-07) captures DataEntity status mutations + OWNERSHIP_CREATED via @ActivityLog AOP on UI controllers; it does NOT capture the IngestionService's destructive paths. This is the audit-trail GAP specific to F-008's service-tier vertex; combined with REFACTOR-185 (default-OFF auth) and REFACTOR-188 (no audit on RBAC mutations), the F-008 chain's destructive surface is forensically silent under default deployment.

**Primary source citations**:
- `IngestionServiceImpl.java:83-86` (Collectors.toMap default-throw merger)
- `IngestionServiceImpl.java:284-285, 303-311` (null entityClassIds NPE path)
- `IngestionServiceImpl.java:287-294` (the existing-entity branch DOES guard via classesAndTypeFilled — the asymmetry)
- `IngestionServiceImpl.java:53` (`@Slf4j` declared)
- Grep on `IngestionServiceImpl.java` for `log\\.` — ZERO matches
- `IngestionServiceImpl.java:103` (MICROSERVICE exclusion — silent)
- `IngestionServiceImpl.java:135-136` (`DataEntityInternalStateService.restoreDeletedDataEntityRelations` — silent un-archive)
- `IngestionServiceImpl.java:296-300` (hollow-promotion counter — silent math)

**Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-190 NEW batch Z (single-transaction-per-batch atomicity — the duplicate-ODDRN crash IS the txn rollback; the architectural intent is "atomic batches" so the crash is consistent with atomicity, but the unhelpful error shape is the bug). ADR-CANDIDATE-191 NEW batch Z (establisher-keyed lineage replacement — the destructive verb depends on the @Slf4j-silent paths). F-008 detail YAML drift facet `batch_atomicity_without_signal` is enforced HERE; the audit-trail gap is the operational consequence.

**Proposed remedy** (multi-fix):

**Fix (a) — Duplicate-ODDRN handling**: Replace `Collectors.toMap(getOddrn, identity())` with `Collectors.toMap(getOddrn, identity(), (a, b) -> { log.warn("Duplicate ODDRN in payload: {}", a.getOddrn()); return a; })` — log the duplicate and keep the first occurrence (de-dup behaviour). Add a test `IngestionDuplicateOddrnTest` asserting that a payload with same-ODDRN-twice succeeds with the first-occurrence semantics. Trade-off: silently deduping may hide collector bugs; alternative is to fail with a structured 400 carrying the duplicate ODDRN. Either choice is better than the current 5xx-with-stack-trace.

**Fix (b) — Null entityClassIds defence**: Apply `classesAndTypeFilled` to the new-entity path symmetrically with the existing-entity path; OR add `Optional.ofNullable(entityClassIds).map(Arrays::stream).orElse(Stream.empty())` wrapping at line 307. Either fix closes the asymmetric defence.

**Fix (c) — Activity/log emission on destructive paths**:
- Add `log.info(...)` calls at each destructive site (lines 86, 103, 135-136, 296-300) — at minimum recording the ODDRN + the operation
- Consider adding `@ActivityLog` AOP annotations on the destructive private methods (the MICROSERVICE exclusion, the restore, the hollow-promotion) — surfaces them in the Activity Feed
- Recommend the log-line-only fix as immediate; the @ActivityLog extension is the medium-term scope for F-008's audit-trail family

**Severity rationale**: MEDIUM — three drift facets at the F-008 service-tier vertex; the @Slf4j-unused finding is the most operationally significant (silent destructive paths under default-off auth — REFACTOR-185 amplifies the consequence); the duplicate-ODDRN crash is collector-correctness MEDIUM; the null entityClassIds NPE is asymmetric-defence LOW. Together they sharpen the F-008 service-tier picture; collectively the trio is HIGH for forensic-recovery scenarios.

**Suggested backlog grouping**: `F-008 service-tier hardening sprint` co-batched with REFACTOR-185 (the auth-cluster fix at upstream filter), REFACTOR-217 (the path-mismatch authz-bypass — primary source confirmed in batch Z), and the F-008 detail YAML drift facets (the macro narrative for the audit-trail gap).

---
