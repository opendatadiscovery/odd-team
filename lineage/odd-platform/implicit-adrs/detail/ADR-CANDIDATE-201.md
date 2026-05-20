## ADR-CANDIDATE-201 — Activity cursor pagination uses SYMMETRIC truncate-to-second comparator + FULL-PRECISION ORDER BY — the asymmetry between cursor-precision and sort-precision is intentional: tolerates JSON-serialization clock-precision loss in client cursor while preserving newest-first ordering at full DB precision

**Severity**: LOW
**Classification**: promote (new — implementation-detail decision worth codifying)
**Support count**: 2 sidecars (`ReactiveActivityRepositoryImpl` PRIMARY-SOURCE + `ActivityController` confirms via the cursor parameter exposure)
**Axes present**: pagination-design, cursor-precision-symmetry
**Pillars affected**: P-01 — activity-audit cursor pagination

**Surfaced by**:
- `ReactiveActivityRepositoryImpl.md:implicit_adrs[1]` (PRIMARY-SOURCE — "**Cursor pagination uses SYMMETRIC truncate-to-second comparator + full-precision ORDER BY**: the cursor predicate is `row(trunc(ACTIVITY.CREATED_AT, DatePart.SECOND), ACTIVITY.ID).lessThan(truncated, lastEventId)` (line 287-288) where BOTH sides are second-precision; the ORDER BY is full-precision `ACTIVITY.CREATED_AT.desc(), ACTIVITY.ID.desc()` (line 291). The asymmetry between comparator-precision and sort-precision is intentional — the client passes `lastEventDateTime` as an `OffsetDateTime` whose microsecond precision may have been altered by JSON serialisation (the ISO-8601 wire format only carries 3 decimal digits in some clients); truncating both sides of the comparator to second accommodates that loss while the ORDER BY preserves full-precision newest-first sort" — confidence: MEDIUM — "the WHY-anchor is the syntactic shape; no `// client-clock-skew tolerance` comment proves intent — but the symmetric-truncation-asymmetric-sort is too deliberate to be coincidence")
- `ActivityController.md:implicit_adrs[3]` (CONFIRMS — "Cursor pagination via `(lastEventId, lastEventDateTime)` as a deliberate alternative to offset/limit — the activity table is append-only and grows monotonically (F-010); offset pagination would degrade quadratically. The repository implements this via `row(trunc(ACTIVITY.CREATED_AT, SECOND), ACTIVITY.ID).lessThan(truncated, lastEventId)` — a composite cursor that uses second-truncation to avoid microsecond-precision issues at the boundary")
- `ReactiveActivityRepositoryImpl.java:285-288` (verified — the symmetric truncation on the cursor predicate)
- `ReactiveActivityRepositoryImpl.java:290-291` (verified — the full-precision ORDER BY)

**Decision statement**: The activity cursor pagination at `ReactiveActivityRepositoryImpl.java:285-291` makes an asymmetric precision choice:

- **Cursor comparator (line 287-288)**: BOTH sides truncated to second:
  ```java
  final OffsetDateTime truncated = lastEventDateTime.truncatedTo(ChronoUnit.SECONDS);
  conditions.add(
    DSL.row(trunc(ACTIVITY.CREATED_AT, DatePart.SECOND), ACTIVITY.ID)
      .lessThan(DSL.row(truncated, lastEventId))
  );
  ```

- **ORDER BY (line 290-291)**: full microsecond precision:
  ```java
  .orderBy(ACTIVITY.CREATED_AT.desc(), ACTIVITY.ID.desc())
  ```

The intent (inferred from syntactic deliberation): the client passes `lastEventDateTime` as an `OffsetDateTime` whose microsecond precision MAY have been altered by JSON serialization. The ISO-8601 wire format in JSON typically carries 3 decimal digits (milliseconds) but some clients (older browsers, certain HTTP libraries) round to seconds. Truncating BOTH sides of the comparator to second-precision accommodates this potential loss WITHOUT breaking cursor monotonicity. The ORDER BY at full precision preserves the newest-first sort within each second.

**Wisdom test (3-question)**:
1. *Intentional?* YES (with caveat) — multiple positive signals:
   - The `truncatedTo(ChronoUnit.SECONDS)` on `truncated` (line 286) AND `trunc(ACTIVITY.CREATED_AT, DatePart.SECOND)` on the column side (line 288) — BOTH sides explicitly truncate. Single-side truncation would be a bug; symmetric truncation is deliberate.
   - The ORDER BY at line 291 deliberately does NOT truncate — full-precision sort is preserved.
   - Three converging signals; no comment explicitly explains. Confidence: MEDIUM.
2. *Structural impact?* PARTIAL — affects cursor pagination correctness across client SDK implementations. Wide blast radius (every Activity feed paginated read).
3. *Refactoring or structural?* STRUCTURAL — changing the precision would require coordinated client-SDK + server-side changes.

→ ADR.

**Evidence**:
- `ReactiveActivityRepositoryImpl.md` says: "Cursor pagination uses SYMMETRIC truncate-to-second comparator + full-precision ORDER BY... the syntactic shape; no `// client-clock-skew tolerance` comment proves intent — but the symmetric-truncation-asymmetric-sort is too deliberate to be coincidence"
- `ReactiveActivityRepositoryImpl.java:285-288, 290-291` — verified the syntactic shape.
- intent_anchor: the deliberate symmetric truncation + the deliberate full-precision ORDER BY.

**Existing ADR**: STRENGTHENS / EXTENDS ADR-CANDIDATE-021 (existing — Activity streams use cursor pagination via `(lastEventId, lastEventDateTime)` — append-only audit data; no offset/limit support). ADR-CANDIDATE-021 is the BROADER cursor-pagination commitment; ADR-CANDIDATE-201 is the IMPLEMENTATION-DETAIL precision choice.

**Co-surfaced gaps**:
- REFACTOR-569 (NEW from this batch — cursor predicate function-on-column may bypass index) — the PERFORMANCE concern with the current implementation; the index does not support the truncated predicate. Adding a functional index closes the gap.

**Proposed action**: Promote to `adrs/drafts/activity-cursor-pagination-precision.md` OR extend ADR-CANDIDATE-021. Document:
- The symmetric truncation on the cursor predicate (tolerance for client clock-precision loss).
- The full-precision ORDER BY (preserves newest-first sort at DB level).
- The trade-off: index support requires functional index (REFACTOR-569 fix).
- The future-design hook: if client SDKs standardize on microsecond-precision JSON (e.g. RFC 3339 with 6 decimals), the truncation MAY be relaxed.

**Severity rationale**: LOW — implementation-detail decision. Severity is bounded by:
- No production correctness defect today (the symmetric truncation IS the safety mechanism).
- The fix to elevate to ADR is low-cost.
- The complementary REFACTOR-569 (performance) is the actionable consequence.

**Cross-pillar bump**: P-01 — activity-audit only. Severity stays LOW.

**Suggested backlog grouping**: ADR draft (extend ADR-021). Pair with REFACTOR-569 for the performance fix.

---
