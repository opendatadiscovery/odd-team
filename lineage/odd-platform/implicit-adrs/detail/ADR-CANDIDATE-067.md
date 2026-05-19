## ADR-CANDIDATE-067 — `@ReactiveTransactional` boundary asymmetry — list-shaped reads stay OUTSIDE TX; per-resource writes ARE INSIDE TX (multi-step)

**Severity**: MEDIUM
**Classification**: promote
**Support count**: 4 sidecars (this batch — 3 writes + 1 read; cross-ref to multi-batch pattern)
**Axes present**: controllers, services
**Surfaced by**:
- `getPopular.md:implicit_adrs[3]` ("No transactional boundary on the read path — `listPopular` is a single SELECT, no side-effect, no view-count touch.")
- `addDataEntityTerm.md:implicit_adrs[0]` (service-level `@ReactiveTransactional` on writes, controller-level absence)
- `upsertDataEntityInternalDescription.md:implicit_adrs[6]` (nested `@ReactiveTransactional` on outer + inner service)
- `createDataEntityTagsRelations.md:implicit_adrs[2]` (duplicate `@ReactiveTransactional` annotation on outer + inner service — defensive intent)

**Decision statement**: The platform applies `@ReactiveTransactional` selectively: per-resource write paths (description, internal_name, terms, tags, ownership, status, attachment, metadata) carry `@ReactiveTransactional` at the SERVICE LAYER — never at the controller. Multi-step writes (write + FTS-vector refresh + filled-flag toggle + activity-log emission + cross-service side effects) span ONE transaction. Conversely, list-shaped reads (`listPopular`, `listAssociated`, `listByOwner`) carry NO `@ReactiveTransactional` — they are single SELECTs with no side effects. `getDataEntityDetails` (batch F) is the deliberate exception on the read side: it carries `@ReactiveTransactional` BECAUSE of the read-as-write view_count UPDATE. The asymmetry is structural: the TX boundary is a function of whether the operation mutates state, not a uniform pattern.

**Evidence**:
- `getPopular.md` says: "No transactional boundary on the read path... Contrast with `getDataEntityDetails` (batch F implicit_adrs[2]) which carries `@ReactiveTransactional` to wrap the read + the view-count UPDATE in one transaction. `listPopular` reads `view_count` but never writes — the producer/consumer asymmetry is the implicit decision: the consumer half does not amplify the loop."
- `upsertDataEntityInternalDescription.md` says: "nested transactional annotations on both layers reflect the intent that a partial-failure state (e.g. description written but term-relations not updated) is forbidden."
- `createDataEntityTagsRelations.md` says: "Reactive transactional boundary is duplicated — both `DataEntityServiceImpl.upsertTags` and `TagServiceImpl.updateRelationsWithDataEntity` carry `@ReactiveTransactional`. The outer-tx encloses the inner one (Spring's default `PROPAGATION_REQUIRED`)."

**Rationale (wisdom test 3-question)**:
1. *Intentional?* YES — uniform pattern: writes carry the annotation, reads do not, except where the read mutates (getDataEntityDetails). The pattern is consistent across 7+ writes and 3+ reads. Defensive duplicate-annotation on nested services (Tags, Description) is intentional.
2. *Structural impact?* YES — affects connection-pool usage, partial-failure semantics, isolation level inheritance, and the rule "controllers are TX-naive."
3. *Refactoring or structural?* STRUCTURAL — switching to "all paths transactional" or "all paths non-transactional" would be a redesign.
→ ADR-CANDIDATE.

**Existing ADR**: partial overlap with ADR-CANDIDATE-059 (which says "Multi-step per-data-entity write paths use service-layer @ReactiveTransactional"). This candidate EXTENDS-EXISTING by adding the read-side asymmetry and the nested-annotation defensive pattern.

**Proposed action**: EXTEND existing `adrs/drafts/{ADR-CANDIDATE-059's file when promoted}.md` to articulate the read-side asymmetry AND the nested-annotation pattern. Alternatively, create `adrs/drafts/reactive-transactional-boundary-asymmetry.md` as a fresh ADR if ADR-CANDIDATE-059 hasn't been promoted yet.

**Severity rationale**: MEDIUM — pattern-shaping decision on transaction-boundary placement, confirmed across 4 sidecars in this batch alone (and 7+ across the wider repo).

---
