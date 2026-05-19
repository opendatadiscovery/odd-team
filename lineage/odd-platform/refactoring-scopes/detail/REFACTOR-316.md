## REFACTOR-316 — `linkTermWithDataEntity` vs `linkTermWithDatasetField` asymmetric duplicate-INSERT handling — the data-entity path emits 400 'Term already assigned to data entity'; the dataset-field path silently succeeds on duplicate, with a possible NullPointerException downstream

**Severity**: MEDIUM
**Category**: error-mapping (inconsistent-error-surface)
**Pillars affected**: [P-06-data-glossary]
**Batch**: K (2026-05-19)

**Surfaced by**:
- `odd-platform__java__service__service__TermServiceImpl.md:bugs_limitations_corner_cases.[5]` (MEDIUM) — "`linkTermWithDataEntity` and `linkTermWithDatasetField` are asymmetric on duplicate-INSERT handling. `linkTermWithDataEntity` (`TermServiceImpl.java:173-174`) translates the empty INSERT result to `BadUserRequestException 'Term already assigned to data entity'`. `linkTermWithDatasetField` (`TermServiceImpl.java:215`) has NO `.switchIfEmpty` — a duplicate INSERT silently succeeds, returning an empty Mono that flatMaps onwards into `termRepository.getTermRefDto(relation.getTermId())` with `relation == null` (NullPointerException risk — depends on the repository's null-handling)."

**Description**: `TermServiceImpl.linkTermWithDataEntity` (lines 170-179) inserts the link row; if the insert returns empty (the row already exists, blocked by the PK on `(data_entity_id, term_id, is_description_link)`), the chain at line 173-174 translates via `.switchIfEmpty(Mono.error(new BadUserRequestException("Term already assigned to data entity")))`. The user sees 400. By contrast, `linkTermWithDatasetField` (lines 212-221) lacks this `.switchIfEmpty` — a duplicate INSERT silently succeeds, returning an empty Mono. The downstream `flatMap` at line 219 attempts `termRepository.getTermRefDto(relation.getTermId())` with `relation == null` (the empty Mono propagates downward). Depending on whether the repository handles null-input gracefully, the operator sees either a NullPointerException (HTTP 500) or a confusing empty response.

**Failure mode**: A UI form on a dataset-field detail page allows users to add terms. A double-click triggers two parallel `POST /api/datasetfields/{id}/terms` requests for the same term. The first INSERT succeeds; the second hits the PK and emits empty. The second response either 500s (NPE downstream) or returns a confusing empty body — neither matches the user's mental model "the term was already added; let me know clearly."

**Primary source citations**:
- `TermServiceImpl.java:170-179` (data-entity path with `.switchIfEmpty(BadUserRequestException)`)
- `TermServiceImpl.java:212-221` (dataset-field path WITHOUT `.switchIfEmpty`)

**Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-071 (centralised DB-error translation via `ExceptionUtils.translateDatabaseException`) frames the canonical error-translation pattern. The data-entity path could ALSO use the centralised translation (the underlying PK violation should produce `UniqueConstraintException` via `JooqReactiveOperations`); the explicit `.switchIfEmpty` is a workaround. The dataset-field path neither uses the centralised translation NOR uses the workaround — it's a gap.

**Proposed remedy**: Add the matching `.switchIfEmpty(Mono.error(new BadUserRequestException("Term already assigned to dataset field")))` at `TermServiceImpl.java:215` symmetrically with the data-entity path. Better: align both paths with ADR-CANDIDATE-071's centralised pattern (use the `UniqueConstraintException` translation chain); but that requires verifying the repository's INSERT returns the expected error type.

**Severity rationale**: MEDIUM — UX-asymmetry; the 500 NPE on dataset-field path is the worst-case shape; the fix is a one-line symmetry restoration.

**Suggested backlog grouping**: `Data Glossary hardening sprint`

---
