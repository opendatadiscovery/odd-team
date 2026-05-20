## REFACTOR-358 — TOCTOU between `listByNames` and `bulkCreate` in `TagServiceImpl.getOrCreateTagsByName` — concurrent novel-name pressure produces UniqueConstraintException → 500 to the user; the service uses the unsafe path even though `ingestData` is the safe alternative

**Severity**: HIGH
**Category**: race-condition (TOCTOU; permission-tier UX regression on concurrent writes)
**Surfaced by**:
- `ReactiveTagRepositoryImpl.md:bugs_limitations_corner_cases[0]` (PRIMARY-SOURCE — explicit TOCTOU description)

**Description**: `TagServiceImpl.getOrCreateTagsByName` (lines 80-86, 144-159 + 105-110) implements the auto-create-on-miss flow as TWO reactor stages:

1. `repository.listByNames(tagNames)` (line 145) — fetches existing tag names case-sensitively.
2. `repository.bulkCreate(toCreate)` (line 82) — inserts the residual (not-yet-existing) tag names.

Between these stages, another concurrent caller can `bulkCreate` the same novel name. The service is wrapped in `@ReactiveTransactional` (line 97 of `updateRelationsWithDataEntity`), but in PostgreSQL's READ COMMITTED isolation (the default), the `listByNames` snapshot does NOT see uncommitted INSERTs from a concurrent transaction. The second caller's `bulkCreate` attempts to INSERT the now-conflicting name, hits `tag_name_unique` (the partial unique index per ADR-CANDIDATE-070 / -125 NEW), and receives `UniqueConstraintException("Tag with this name already exists")` from the centralised translation layer (ADR-CANDIDATE-071).

**The user sees a 500-level error on a normal-looking PUT request** — the operator updating tags on a data entity gets a generic-looking failure that is actually a "concurrent insert lost the race" surface. There is no caller-side retry of `listByNames` after the conflict.

**The architectural irony**: the same repository EXPOSES the safe path (`ingestData` per ADR-CANDIDATE-125 NEW — partial-unique-index + ON CONFLICT DO UPDATE-no-op). The `ingestData` path is upsert-shaped, idempotent, race-safe. `ExternalTagIngestionRequestProcessor` (the ingestion-side caller) uses `ingestData` correctly. But `TagServiceImpl.getOrCreateTagsByName` (the UI-side caller) uses `bulkCreate` (the operator-explicit fail-on-duplicate path per ADR-CANDIDATE-127 NEW). The maintainer chose the wrong contract for the in-between case.

**Primary source citations**:
- `TagServiceImpl.java:80-86, 144-159` — the listByNames + bulkCreate sequence
- `ReactiveTagRepositoryImpl.java:120-125` — listByNames implementation (case-sensitive IN)
- `ReactiveAbstractCRUDRepository.java:113-126` — bulkCreate inherited (no onConflict)
- `ExceptionUtils.java:30-36, 54-56` — translateDatabaseException → UniqueConstraintException → "Tag with this name already exists"
- Cross-batch: ADR-CANDIDATE-125 NEW (the safe path) + ADR-CANDIDATE-127 NEW (the dual-contract architecture explaining WHY both methods exist)

**Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-127 NEW (dual-contract write paths) documents the architectural distinction between `bulkCreate` (fail-on-duplicate, operator-explicit) and `ingestData` (upsert, ingestion-race-safe). The maintainer-extension contract under that ADR is "future callers MUST pick the contract that matches the upstream audience; in-between callers MUST pick `ingestData` if any concurrency exists". This scope is the architectural conformance gap — `TagServiceImpl.getOrCreateTagsByName` is the in-between caller and SHOULD use `ingestData`, but uses `bulkCreate`.

**Proposed remedy**: Switch the call site from `bulkCreate` to `ingestData`. The change is one-line additive:

```java
// Before (TagServiceImpl.java:82 paraphrased):
return repository.bulkCreate(toCreate);

// After:
return repository.ingestData(toCreate);
```

The semantic switch:
- Before: concurrent novel-name pressure surfaces as UniqueConstraintException → 500.
- After: concurrent novel-name pressure silently merges to the existing row; the caller gets the existing row's id; the operator's PUT succeeds idempotently.

The change is back-compat-safe because `ingestData` returns the SAME `Flux<TagPojo>` shape with the SAME id contract (existing rows return their existing ids; new rows return new ids). The caller (`TagServiceImpl.updateRelationsWithDataEntity`) consumes the ids to build TagToDataEntityPojo relations — no behaviour change.

Add a concurrent-INSERT regression test that pins the new behaviour. Cross-link with REFACTOR-223 (the Tag side-door — DATA_ENTITY_TAGS_UPDATE mints global Tag directory rows; this scope's fix tightens the side-door's correctness without changing the architecture).

**Severity rationale**: HIGH — operator-visible UX regression on concurrent edits. The case fires whenever two operators apply tags simultaneously OR an operator's UI submits two rapid PUTs OR a Collector's ingestion race with a UI tag edit. Today the platform's deployment is small enough that the race is rare; at any scale of multi-operator usage the rate becomes operationally-visible. The fix is small and architecturally aligned (use the contract the architecture INTENDS for this case).

**Suggested backlog grouping**: `SEC-NNN authorization-audit sprint` — pair with REFACTOR-223 (Tag side-door), REFACTOR-199 (Owner auto-create side-door), REFACTOR-206 (Title auto-create side-door). The four share the "directory growth via per-resource permission" pattern; this scope is the concurrency-correctness piece of the family.

---
