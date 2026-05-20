## REFACTOR-275 — `replaceLineagePaths` empty-input causes two wasted DB round-trips (`DELETE WHERE establisher IN ()` + `INSERT empty list`)

**Severity**: LOW
**Category**: performance-redundant-work
**Surfaced by**:
- `LineageServiceImpl.md:bugs_limitations_corner_cases[8]`

**Description**: `LineageServiceImpl.replaceLineagePaths` (lines 124-133) is `@ReactiveTransactional` and implements the establisher-keyed atomic-rewrite (per ADR-CANDIDATE-072). When `pojos` is an empty list:
- Line 127-129: `establishers = pojos.stream().map(LineagePojo::getEstablisherOddrn).collect(Collectors.toSet())` → empty Set.
- `batchDeleteByEstablisherOddrn(emptySet)` issues a `DELETE FROM lineage WHERE establisher_oddrn IN ()` — Postgres handles `IN ()` as `WHERE FALSE`; the query is a no-op but costs one round-trip + transaction overhead.
- `batchInsertLineages(emptyList)` is also a no-op (typically translated to an empty `INSERT INTO ... VALUES ()` no-op or short-circuited by the repository — but still costs one round-trip).

The cost: TWO wasted DB round-trips per empty-input invocation. Compounded by `@ReactiveTransactional`'s BEGIN + COMMIT overhead.

Today, ingestion-side callers (`LineageIngestionRequestProcessor.process`) have a `shouldProcess` predicate that returns false on empty input — the empty-input path is unreachable from the standard ingestion flow. But the service method is PUBLIC; future callers (direct HTTP, test code, scheduled jobs) may invoke it with an empty list. Without a defensive early-return, those callers pay the wasted round-trip cost.

The fix is a 2-line early-return:
```java
@ReactiveTransactional
public Flux<LineagePojo> replaceLineagePaths(final List<LineagePojo> pojos) {
  if (pojos.isEmpty()) {
    return Flux.empty();  // early-return on no-op
  }
  final Set<String> establishers = pojos.stream().map(LineagePojo::getEstablisherOddrn).collect(Collectors.toSet());
  return lineageRepository.batchDeleteByEstablisherOddrn(establishers)
      .thenMany(lineageRepository.batchInsertLineages(pojos));
}
```

The change is purely defensive; no behaviour change for callers that pass non-empty input.

**Primary source citations**:
- `LineageServiceImpl.java:124-133` — no early-return guard
- `LineageIngestionRequestProcessor.java:21-23` — upstream short-circuit via `shouldProcess`
- Postgres `IN ()` semantic (treated as `FALSE`)

**Existing-ADR-or-implied-prescription**: none. The fix is refactoring within the existing structure.

**Proposed remedy**: Add the early-return guard at line 125. One-line change.

**Severity rationale**: LOW — wasted round-trips on a code path not currently exercised. The gap is the FUTURE-CALLER-FRAGILITY: if a new caller invokes the public service method without first checking emptiness, the cost manifests. The defensive guard is cheap.

**Suggested backlog grouping**: `Lineage service hygiene` — bundle with REFACTOR-272 (orElseThrow RuntimeException), REFACTOR-273 (stack recursion), REFACTOR-274 (inner-DEG test anchor), REFACTOR-276 (Spring proxy self-invocation). The lineage-service file has several minor defensive-discipline gaps.

---
