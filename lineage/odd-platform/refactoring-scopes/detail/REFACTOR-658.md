## REFACTOR-658 — DataSetController's diff endpoint returns HTTP 500 for non-existent `version_ids` (`size != 2` falls through to bare `RuntimeException`) — operator cannot distinguish "wrong id" from "platform broken" from the status code

**Severity**: MEDIUM
**Category**: error-mapping-500-not-404
**Batch**: ZG (2026-05-25)
**Pillars affected**: [P-01 Data Discovery (dataset structure surface), P-11 Platform API (status-code drift)]

**Surfaced by**:
- `odd-platform__java__DataSetController__controller-class__DataSetController.md:bugs_limitations_corner_cases.[2]` (MEDIUM) — "**Diff endpoint returns HTTP 500 for non-existent version_ids** (size != 2 path): `buildDataSetVersionDiffList` throws bare `RuntimeException('Query returned %s rows for diff request')` (DatasetVersionServiceImpl.java:69-71) when one or both ids are missing. ControllerAdvice maps this to 500. Callers cannot distinguish 'wrong id' from 'platform broken' from the status code alone. Identical-version_ids gets a clean 400 via `BadUserRequestException` (line 60); non-existent gets a 500. Asymmetric."

**Statement**: `GET /api/datasets/{id}/structure/diff?first=V1&second=V2` is supposed to compute the field-level diff between two dataset versions. When one or both version_ids do not exist (e.g., the user supplied a typo, a deleted version, or a non-existent id), the implementation throws a bare `RuntimeException`:

```java
// DatasetVersionServiceImpl.java:66-71
public Mono<DataSetVersionDiffList> getDatasetVersionDiff(...) {
  return reactiveDatasetVersionRepository.getDatasetVersionWithFields(List.of(firstVersionId, secondVersionId))
    .collectList()
    .map(rows -> {
      if (rows.size() != 2) {
        throw new RuntimeException("Query returned %s rows for diff request".formatted(rows.size()));
        // ↑ bare RuntimeException → ControllerAdvice catch-all → HTTP 500
      }
      return ...;
    });
}
```

The `ControllerAdvice` catch-all maps bare `RuntimeException` → HTTP 500. The operator cannot distinguish three cases from the status code alone:
- **(a) Wrong version_id** — caller error; should be HTTP 404 ("version not found") or HTTP 400 ("invalid id")
- **(b) Platform broken** — server-side bug; HTTP 500 is appropriate
- **(c) Concurrent deletion** — race; HTTP 410 Gone could be the precise framing

The asymmetry with the sibling case is striking: identical version_ids (e.g., `first=V&second=V`) gets a clean HTTP 400 via `BadUserRequestException` (`DatasetVersionServiceImpl.java:60`); non-existent gets HTTP 500. The two error paths should be symmetric.

**Evidence**:
- Diff service: `DatasetVersionServiceImpl.java:56-71` (the bare RuntimeException at line 69-71)
- Identical-ids branch: `DatasetVersionServiceImpl.java:59-61` (the clean BadUserRequestException — the sibling case)
- ControllerAdvice mapping: bare RuntimeException → HTTP 500
- Hypothesis: `lineage/odd-platform/probes/P-149.yaml`

**Existing-ADR-or-implied-prescription**: no governing ADR. The error-mapping drift is unanchored.

**Proposed remedy**: replace the bare `RuntimeException` with a typed exception:
```java
if (rows.size() < 2) {
  throw new NotFoundException("DatasetVersion", List.of(firstVersionId, secondVersionId));
}
```

This produces HTTP 404 with a descriptive payload listing which version_ids were not found. Symmetric with the identical-ids branch's HTTP 400.

**Severity rationale**: MEDIUM — error-mapping drift; operator-facing status-code confusion; no security or data-integrity impact. Small UX defect with a one-line fix.

**Suggested backlog grouping**: `DataSet API hygiene sprint` (paired with REFACTOR-657 — cross-dataset leak — and REFACTOR-659 — Latest=max(version)).

**Coherence check** (LSN-018):
- STRENGTHENS: REFACTOR-415 (NotFoundException surfaces as 5xx not 401 — analogous error-mapping drift on a different surface). The systemic question: should the platform have a unified error-translation policy?
- SUPERSEDES: none.
- CONFLICTS: none.

---
