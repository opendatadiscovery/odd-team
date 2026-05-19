## REFACTOR-381 — Tag `empty-batch contract` differs between `ingestData` and inherited `bulkCreate` — `ingestData` short-circuits at lines 181-183; inherited `bulkCreate` short-circuits at ReactiveAbstractCRUDRepository.java:115-117; load-bearing-but-undocumented; a future change removing one guard would produce runtime SQL error

**Severity**: LOW
**Category**: load-bearing-but-undocumented (silent contract redundancy)
**Surfaced by**: `ReactiveTagRepositoryImpl.md:bugs_limitations_corner_cases[5]`

**Description**: `ReactiveTagRepositoryImpl.ingestData` short-circuits on empty input at lines 181-183: `if (entities.isEmpty()) return Flux.empty();`. The inherited `ReactiveAbstractCRUDRepository.bulkCreate` also short-circuits at lines 115-117. jOOQ does NOT accept zero-record INSERT statements (`INSERT INTO ... VALUES ()` is syntactically invalid), so the empty-batch guard is load-bearing.

**The contract is not documented at the interface; only the duplication across both implementations encodes the constraint**. A future maintainer reading just one method might believe the guard is defensive and remove it ("jOOQ would handle it") — produces a runtime SQL error on every empty bulk call.

**Primary source citations**:
- `ReactiveTagRepositoryImpl.java:181-183` — ingestData empty-batch guard
- `ReactiveAbstractCRUDRepository.java:115-117` — inherited bulkCreate empty-batch guard

**Proposed remedy**:
1. Add a Javadoc comment to BOTH methods explaining the guard is load-bearing.
2. Add a unit test asserting `ingestData(List.of())` returns `Flux.empty()` (does not throw).
3. Alternatively, push the guard into a shared helper method at the base class — single source of truth.

Option 3 is the cleanest.

**Severity rationale**: LOW — refactor-fragility; no impact today. Future maintainer pitfall.

**Suggested backlog grouping**: `Code hygiene`.

---
