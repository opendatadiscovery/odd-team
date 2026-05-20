## ADR-CANDIDATE-126 — Conflict-target on upserts is computed DYNAMICALLY from `Indexes.X.getFields()` rather than hardcoded `Field` literals — index-shape changes propagate to the application without code edits, while predicate-shape changes do NOT

**Severity**: MEDIUM
**Classification**: promote
**Pillars affected**: [P-01-data-discovery, P-08-management]
**Support count**: 1 sidecar (batch N ReactiveTagRepositoryImpl) — distinctive jOOQ idiom; may apply across other ingestion-side upserts (cross-batch verification needed)
**Axes present**: repositories
**Batch**: N (2026-05-19)

**Surfaced by**:
- `ReactiveTagRepositoryImpl.md:implicit_adrs.[1]` (HIGH) — "Conflict-target is computed from `Indexes.TAG_NAME_UNIQUE.getFields()` rather than hardcoded `TAG.NAME` — `ingestData` dynamically resolves the conflict fields (`:199-202`) from the jOOQ-generated index handle. A migration that changes the index to `(name, namespace_id)` (for example, to add namespace-scoped tags) would automatically propagate to the upsert. By contrast, the `WHERE TAG.DELETED_AT.isNull()` predicate is hardcoded (`:207`) — index-shape changes propagate, predicate-shape changes do NOT. This is a structural choice favouring shape-evolution-friendly conflict targets at the cost of predicate-evolution coupling." — intent_anchor: "`final List<Field<Object>> conflictFields = Indexes.TAG_NAME_UNIQUE.getFields().stream().map(of -> field(of.getName())).toList();` (`:199-202`) — explicit dynamic resolution rather than `TAG.NAME` literal"

**Decision statement**: When ODD's ingestion-side upsert needs an `onConflict(...)` target, the conflict fields are resolved DYNAMICALLY from the jOOQ-generated index handle (`Indexes.TAG_NAME_UNIQUE.getFields()`) rather than hardcoded as `TAG.NAME` literals. The application-side code reads:

```java
final List<Field<Object>> conflictFields = Indexes.TAG_NAME_UNIQUE.getFields()
    .stream()
    .map(of -> field(of.getName()))
    .toList();
```

(`ReactiveTagRepositoryImpl.java:199-202`). The conflict-target list is built at runtime from the index handle's field list, then passed to `.onConflict(conflictFields)` (line 203).

The architectural design accepts an ASYMMETRIC coupling between the application and the schema:
- **(a) Index-shape changes propagate** — a future migration that EXTENDS the conflict index to `tag_name_unique ON tag (name, namespace_id) WHERE tag.deleted_at IS NULL` automatically propagates to the upsert. The jOOQ codegen regenerates `Indexes.TAG_NAME_UNIQUE` with the two fields; the application's `getFields()` call picks up both; the upsert's conflict target becomes `(name, namespace_id)` without any code edit. The maintainer enabling namespace-scoped tags doesn't touch the repository.
- **(b) Predicate-shape changes do NOT propagate** — the `.where(TAG.DELETED_AT.isNull())` at line 207 is hardcoded; a future migration that broadens the index to `WHERE deleted_at IS NULL AND important IS NOT NULL` requires editing the application code (REFACTOR-379). The predicate is the asymmetric coupling point.
- **(c) Compositional with ADR-CANDIDATE-125** (partial-unique-index + onConflict-doUpdate-noop) — the dynamic conflict-target is the layer that makes -125's pattern future-extensible.

The idiom encodes the maintainer's preference: **schema-shape evolution is more frequent than schema-predicate evolution**. The index's field list grows when new dimensions are added (multi-tenant via namespace, multi-region via tenant); the index's predicate grows rarely (only when soft-delete semantics or status-machine semantics shift). Optimising for the more-frequent case is the trade-off.

**Wisdom test**: PASS on all three questions.
1. **Intentional?** YES — the explicit `Indexes.TAG_NAME_UNIQUE.getFields().stream().map(...).toList()` chain is a non-obvious idiom; the maintainer chose this over the trivial `Collections.singletonList(TAG.NAME)` literal. The intent_anchor is the code itself — a hardcoded literal would be 1 line; this is 4 lines.
2. **Structural impact?** YES — affects every ingestion-side upsert's evolution path; affects the schema-vs-application coupling discipline; affects the maintainer-extension contract for new partial-unique-index designs.
3. **Switching to hardcoded literals is REFACTORING or STRUCTURAL?** STRUCTURAL — the asymmetric coupling between index-shape (dynamic) and predicate-shape (hardcoded) is the architecture. Going to fully-dynamic conflict targets (where the predicate is also resolved from the index handle) would require jOOQ codegen extensions (not currently supported in stable releases). Going to fully-hardcoded would break the shape-evolution-friendliness this ADR codifies. Neither is a code-cleanup refactor.

**Evidence**:
- ReactiveTagRepositoryImpl.md says: "Conflict-target is computed from `Indexes.TAG_NAME_UNIQUE.getFields()` rather than hardcoded `TAG.NAME` — `ingestData` dynamically resolves the conflict fields (`:199-202`) from the jOOQ-generated index handle... index-shape changes propagate, predicate-shape changes do NOT. This is a structural choice favouring shape-evolution-friendly conflict targets at the cost of predicate-evolution coupling."
- ReactiveTagRepositoryImpl.java:199-202 — the dynamic-resolution code

**Existing ADR**: none. **Composes with ADR-CANDIDATE-125 NEW** (partial-unique-index + ON CONFLICT DO UPDATE-no-op — the dynamic conflict target makes -125's idiom future-extensible). **Composes with ADR-CANDIDATE-070** (partial unique index as soft-delete-aware name uniqueness — the schema-side enforcement that the dynamic conflict-target consumes).

**Co-surfaced gaps** (link from `refactoring-scopes.md`):
- REFACTOR-379 NEW — hardcoded `WHERE TAG.DELETED_AT.isNull()` predicate at line 207 is the asymmetric coupling point; documented as the price of this ADR (LOW; documented trade-off, not a defect).

**Proposed action**: Promote to `adrs/drafts/dynamic-conflict-target-from-jooq-index.md` (new ADR). Document:
- The idiom (`Indexes.X.getFields().stream().map(of -> field(of.getName())).toList()`).
- The schema-vs-application coupling asymmetry (shape dynamic; predicate hardcoded).
- The maintainer-extension contract: future upserts should use the dynamic-resolution pattern, NOT hardcoded Field literals.
- The trade-off acknowledged (REFACTOR-379 — predicate-shape changes need application-code edits).

Cross-link with ADR-CANDIDATE-125, -070, -065.

**Severity rationale**: MEDIUM — pattern-shaping idiom that affects every ingestion-side upsert. Affects future schema migrations adding dimensions to existing conflict indexes; the maintainer benefits from index-shape propagation without code edits. Less load-bearing than ADR-CANDIDATE-125 (the partial-index-as-race-protection) but the supporting idiom that makes the pattern future-extensible.

---
