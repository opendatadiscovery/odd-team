<!--
batch-ZB append-file — refactoring-scopes index

Frontmatter count deltas (orchestrator applies to index.md frontmatter):
  sidecar_count: +5
  total_scopes: +11  (REFACTOR-581..591)
  scopes_by_severity: HIGH +1, MEDIUM +6, LOW +4   (was {CRITICAL:0, HIGH:66, MEDIUM:106, LOW:55} -> {CRITICAL:0, HIGH:67, MEDIUM:112, LOW:59})
  scopes_by_category (add): missing-fts-cleanup +2, missing-doc-prereq +0 (already 1; this batch adds 1 -> 2 if counted; the orchestrator may fold), permission-bypass +1, silent-data-loss +1, race-condition +1 (-> 5), contract-typo +1 (-> 2), error-mapping +1 (-> 5), status-code-narrow +1 (-> 2), missing-audit +1 (-> 9). NEW category keys this batch: missing-fts-cleanup (2), silent-data-loss (1). The HIGH REFACTOR-581 is missing-audit+plaintext-at-rest.
  Add to frontmatter:
    batch_2026_05_21ZB_summary: { added_scopes: 11, strengthened_scopes: 8, new_scopes_by_severity: { HIGH: 1, MEDIUM: 6, LOW: 4 }, new_scopes_by_category: { missing-fts-cleanup: 2, permission-bypass: 1, silent-data-loss: 1, race-condition: 1, contract-typo: 1, error-mapping: 1, status-code-narrow: 1, missing-audit: 1, missing-doc-prereq: 1 }, sidecars_consumed: 5, coherence_supersedes: 1 }

The 11 NEW "## REFACTOR-NNN — headline" blocks are below the marker line for the orchestrator's awk-merge.
-->

## Refresh note — batch ZB (2026-05-21 — DataSourceController endpoint-surface method-level deepening)

Five new method-level sidecars enriched the DataSourceController endpoint surface (`getDataSourceList`, `registerDataSource`, `updateDataSource`, `deleteDataSource`, `regenerateDataSourceToken`; batch W had enriched only the controller CLASS node). Per the Rule-0 wisdom test the batch is GAP-heavy as expected for an endpoint-deepening pass: **11 new refactoring scopes** (REFACTOR-581..591) + **8 existing scopes STRENGTHENED**, and **zero new ADR candidates** (the two ADR-shaped findings triangulate onto existing ADR-CANDIDATE-017 + ADR-CANDIDATE-068 — see `implicit-adrs/index-batch-ZB-append.md`).

**8 existing scopes STRENGTHENED** — the DataSource token-rotation path (`regenerateDataSourceToken`) shares the EXACT same `TokenGeneratorImpl` + `ReactiveTokenRepositoryImpl` code as the Collector token-rotation path, so it confirms the SAME gaps on a sibling endpoint (these are strengthens, not new entries — one gap site, two endpoints):
- **REFACTOR-045** (non-SecureRandom token RNG) — DataSource regenerate confirms `TokenGeneratorImpl.java:49`; re-scope to "every token row".
- **REFACTOR-046** (no rotation audit log) — DataSource regenerate confirms zero `log.*` + single-state `updated_by`.
- **REFACTOR-047** (no rotation grace period) — DataSource regenerate confirms the destructive in-place cutover; the data-source token IS the credential `IngestionDataEntitiesFilter` validates.
- **REFACTOR-048** (token plaintext-at-rest) — DataSource regenerate confirms the shared plaintext `token` table + plaintext `.equals` verify.
- **REFACTOR-049** (DISABLED-mode rotation bypass) — DataSource regenerate confirms the `DATA_SOURCE_TOKEN_REGENERATE` bypass under `auth.type=DISABLED` (member of the REFACTOR-185 cross-cutting cluster).
- **REFACTOR-062** (rotation response no `Cache-Control: no-store`) — DataSource regenerate confirms the bare `.map(ResponseEntity::ok)` shape.
- **REFACTOR-064** (rotation service method NOT `@ReactiveTransactional`) — DataSource regenerate confirms; **carries the batch-ZB CROSS-BATCH CORRECTION** — the method-level primary-source read confirms LOW code-smell, NOT atomicity bug, and records a Rule-6 SUPERSEDES of the test-map registry's stale CRITICAL `TEST-GAP-749` (see `state/coherence-conflicts-batch-ZB.md`).

**Coherence (Rule 6)**: cross-registry grep confirmed all new findings are SAME-polarity with the other registries — `feature-flows` F-010 already carries `orphan_token_row_no_housekeeping` (REFACTOR-581 back-links F-010); `concepts/index.yaml` already carries the "NAMESPACE_CREATE side-door confirmed at 4 sister services (... DataSource ...)" invariant (REFACTOR-584 is SAME-polarity, the endpoint-anchored instance); `test-map` already carries TEST-GAP-755 (Collector orphan-token — REFACTOR-581's sibling). ONE SUPERSEDES surfaced and logged: `test-map` TEST-GAP-749's CRITICAL atomicity-bug framing of `regenerateDataSourceToken`'s missing `@ReactiveTransactional` is refuted by the method-level primary-source read (single atomic UPDATE + in-memory regenerate → no partial-write window); logged to `state/coherence-conflicts-batch-ZB.md` for the test-mapper to drop TEST-GAP-749 CRITICAL→LOW. Zero CONTRADICTS.

**Batch-ZB leverage ranking** (new entries; `triangulation_count × severity_weight`, CRITICAL=8/HIGH=4/MEDIUM=2/LOW=1):
1. REFACTOR-581 — orphan token on data-source delete — HIGH×2 = 8
2. REFACTOR-584 — namespace-create permission bypass (register+update) — MEDIUM×3 = 6
3. REFACTOR-590 — no Activity Event on data-source mutations (register+update+delete) — MEDIUM×3 = 6
4. REFACTOR-583 — actively-ingested source undeletable (doc-prereq + race) — MEDIUM×2 = 4
5. REFACTOR-585 — partial-edit data loss (REPLACE-not-MERGE) — MEDIUM×1 = 2
6. REFACTOR-582 — FTS vector not cleared on delete — MEDIUM×1 = 2
7. REFACTOR-591 — 201-vs-200 status drift consolidation — LOW×2 = 2
8. REFACTOR-586 — no optimistic-lock lost-update — LOW×1 = 1
9. REFACTOR-587 — no FTS refresh on create — LOW×1 = 1
10. REFACTOR-588 — oddrn required-vs-optional contract typo — LOW×1 = 1
11. REFACTOR-589 — null-token opaque 500 — LOW×1 = 1

The orchestrator re-ranks the global `## Top 20 by leverage` head over the COMBINED set; REFACTOR-581 (leverage 8) is the only batch-ZB entry likely to enter the global Top 20 (HIGH severity + cross-registry triangulation with TEST-GAP-755 and F-010).

<!-- NEW-HEADLINES-BELOW -->

## REFACTOR-581 — `DELETE /api/datasources/{id}` orphans the `token` row — soft-delete UPDATEs only `data_source.deleted_at`; the FK-referenced `token` row is never cleaned and CANNOT be soft-deleted; every register-then-delete cycle leaks one plaintext-credential row

**Severity**: HIGH
**Category**: missing-audit + plaintext-at-rest (orphan-credential accumulation)

**Discriminating context**: `DataSourceServiceImpl.delete` (lines 85-96) calls the inherited `ReactiveAbstractSoftDeleteCRUDRepository.delete`, whose `getDeleteChangedFields` (lines 106-110) writes ONLY `deleted_at = NOW()` on `data_source`. The `data_source.token_id` FK still points at the `token` row; that row is never touched, and the `token` table (`V0_0_28__add_token.sql:1-9`) has no `deleted_at` column so it cannot be soft-deleted. No housekeeping job covers the `token` table. EXACT structural sibling of the Collector path (test-map TEST-GAP-755). `token.value varchar(40)` carries the 40-char plaintext credential. Pinned by probe P-046; back-links feature-flows F-010 (`orphan_token_row_no_housekeeping`).

**Full detail**: `detail/REFACTOR-581.md`

---

## REFACTOR-582 — `DELETE /api/datasources/{id}` does NOT clear the data source's FTS `search_entrypoint` vector — unlike the `update` path which calls `updateSearchVectors`; a soft-deleted data source may remain full-text-searchable

**Severity**: MEDIUM
**Category**: missing-fts-cleanup (stale search result)

**Discriminating context**: `DataSourceServiceImpl.delete` (lines 85-96) calls no `searchEntrypointRepository` method; `DataSourceServiceImpl.update` (lines 77,80,127-136) DOES. Whether the soft-deleted source still surfaces in catalog search depends on whether the search query JOINs `data_source` with a `deleted_at IS NULL` predicate (unknown — pinned by P-048). Second instance of the ADR-CANDIDATE-206 deviation (the Tag delete-path REFACTOR-489 is the first).

**Full detail**: `detail/REFACTOR-582.md`

---

## REFACTOR-583 — An actively-ingested data source is effectively undeletable — the cascade-guard 400s while any live `data_entity` child exists; collector re-ingest re-creates children between the delete-children and delete-source steps; the only reliable delete path (stop the collector first) is undocumented

**Severity**: MEDIUM
**Category**: missing-doc-prereq + race-condition (operational dead-end)

**Discriminating context**: `DataSourceServiceImpl.delete` (lines 88-95) throws `CascadeDeleteException` → HTTP 400 if `existsNonDeletedByDataSourceId` finds any live `data_entity` child. `data_entity` rows are collector-re-created every ingest tick, so the delete-children-then-delete-source sequence races the collector. The cascade-guard's check-then-act is also not serialised against ingestion (no `getIdByOddrnForUpdate` lock on the delete path). The live `features/management` page documents none of the delete preconditions. Pinned by P-047.

**Full detail**: `detail/REFACTOR-583.md`

---

## REFACTOR-584 — `POST /api/datasources` and `PUT /api/datasources/{id}` implicitly create a namespace via the `namespace_name` field — bypassing the `NAMESPACE_CREATE` permission gate; a caller holding only `DATA_SOURCE_CREATE` / `DATA_SOURCE_UPDATE` mints new namespace directory rows

**Severity**: MEDIUM
**Category**: permission-bypass (escalation-by-side-effect)

**Discriminating context**: `DataSourceServiceImpl.create` (lines 56-57) and `.update` (lines 74-76) call `namespaceService.getOrCreate(namespace_name)` → `NamespaceServiceImpl.getByName(name).switchIfEmpty(createByName(name))` — INSERTs a `namespace` row if absent. The register/update endpoints are gated only by `DATA_SOURCE_CREATE` / `DATA_SOURCE_UPDATE` (`SecurityConstants.java:116-120`); the explicit `POST /api/namespaces` is gated by `NAMESPACE_CREATE`. SAME shape as REFACTOR-199 (Owner) / REFACTOR-206 (Title); SAME-polarity with the `concepts/index.yaml` "NAMESPACE_CREATE side-door confirmed at 4 sister services (... DataSource ...)" invariant. Pinned by P-039.

**Full detail**: `detail/REFACTOR-584.md`

---

## REFACTOR-585 — `PUT /api/datasources/{id}` is a full-form REPLACE — a partial body silently nulls the omitted fields; an API consumer sending `{name}` to rename a source wipes its `description` and detaches its `namespace`; there is no MERGE option

**Severity**: MEDIUM
**Category**: silent-data-loss (REPLACE-not-MERGE via MapStruct default null-handling)

**Discriminating context**: `DataSourceServiceImpl.update` applies the form via MapStruct `DataSourceMapper.applyToPojo` (`DataSourceMapper.java:49`, `@MappingTarget`); `MapperConfig.java:7-11` sets no `nullValuePropertyMappingStrategy`, so MapStruct's default `SET_TO_NULL` governs — an omitted JSON field deserialises to null and is written as null. `DataSourceUpdateFormData` (`components.yaml:1317-1325`) has 3 optional fields, no `required` block. The behaviour rests on a framework default with no comment defending it. Pinned by P-043.

**Full detail**: `detail/REFACTOR-585.md`

---

## REFACTOR-586 — `data_source` has no optimistic-lock version column — two concurrent `PUT /api/datasources/{id}` edits are last-writer-wins with no conflict detection; operator A's edit silently vanishes under operator B's concurrent edit

**Severity**: LOW
**Category**: race-condition (lost update — no optimistic locking)

**Discriminating context**: `DataSourceServiceImpl.update` reads via `getDto(id)` with no `FOR UPDATE` (the `FOR UPDATE` variant is ingestion-only); the `data_source` table (`V0_0_1__init.sql:38-50`) has no version column used in the UPDATE WHERE clause. Two concurrent PUTs both read the same baseline, both REPLACE, the later commit silently overwrites — no HTTP 409, no `If-Match`. SAME shape as REFACTOR-210 (DataEntityPojo). ADR-CANDIDATE-073 justifies no pessimistic lock but does not cover the absence of any optimistic-concurrency control.

**Full detail**: `detail/REFACTOR-586.md`

---

## REFACTOR-587 — `POST /api/datasources` does not refresh the FTS `search_entrypoint` vector on create — `updateSearchVectors` runs only on the `update` path; a newly registered data source is invisible to full-text search until its first data_entity is ingested

**Severity**: LOW
**Category**: missing-fts-cleanup (deferred search-discoverability)

**Discriminating context**: `DataSourceServiceImpl.create` (lines 51-66) has no `updateSearchVectors` call on the return path; `.update` (lines 77,80,127-136) does. A manually-registered, not-yet-ingested data source is absent from catalog search until its first `data_entity` ingestion triggers the join-driven FTS rebuild. Deviation from ADR-CANDIDATE-206's synchronous-search-index-consistency design; self-healing on first ingestion.

**Full detail**: `detail/REFACTOR-587.md`

---

## REFACTOR-588 — `oddrn` is required-at-runtime but optional-in-the-OpenAPI-contract — `DataSourceFormData` marks only `name` as `required`, yet `POST /api/datasources` rejects an empty `oddrn` with HTTP 400; a spec-generated client omitting `oddrn` receives a surprising rejection

**Severity**: LOW
**Category**: contract-typo (OpenAPI contract understatement)

**Discriminating context**: `DataSourceServiceImpl.createDataSource` (lines 119-120) throws `BadUserRequestException("ODDRN must be filled for data source")` → HTTP 400 on an empty `oddrn`; `components.yaml:1314-1315` lists `required: [name]` only — `oddrn` declared optional. A spec-generated client treats `oddrn` as omittable and gets a 400 it could have prevented client-side. One-line `components.yaml` `required`-block fix.

**Full detail**: `detail/REFACTOR-588.md`

---

## REFACTOR-589 — `PUT /api/datasources/{id}/token` on a data source whose `token` is null surfaces as an opaque HTTP 500 — a `data_source` row whose `token_id` points at a missing/deleted token NPEs or throws `RuntimeException("Token is null")` with no actionable message

**Severity**: LOW
**Category**: error-mapping (opaque 500 on a data-integrity edge)

**Discriminating context**: `DataSourceServiceImpl.regenerateDataSourceToken` line 102 calls `dto.token().tokenPojo()` with no null guard on `dto.token()`; a missing token NPEs or `TokenGeneratorImpl.regenerate` (lines 45-47) throws `RuntimeException("Token is null")` → falls to `ControllerAdvice`'s catch-all generic handler (lines 61-66) → opaque HTTP 500. The exception is service/generator-tier so `JooqReactiveOperations.onErrorMap` (ADR-CANDIDATE-071) does not translate it. Foreseeable data-integrity edge with an unhelpful failure mode.

**Full detail**: `detail/REFACTOR-589.md`

---

## REFACTOR-590 — `data_source` mutations (register / update / delete) emit NO Activity Event — `DataSourceServiceImpl` imports no activity emitter; no audit trail of who registered / edited / deleted a data source or when; 3-sidecar triangulated

**Severity**: MEDIUM
**Category**: missing-audit

**Discriminating context**: `DataSourceServiceImpl` (`create` 51-66, `update` 68-83, `delete` 85-96) imports no `ActivityEvent` and makes no `activityEventEmitter` call on any mutation path. Distinct from REFACTOR-188 (RBAC-directory-mutation audit gap) — batch F's refinement noted DataEntity-tier mutations DO emit (`OWNERSHIP_CREATED`, `DATA_ENTITY_STATUS_UPDATED`); the `data_source` tier is a third, un-audited surface. The platform has the activity substrate (ADR-CANDIDATE-060) but the data-source-mutation paths do not use it.

**Full detail**: `detail/REFACTOR-590.md`

---

## REFACTOR-591 — OpenAPI declares HTTP `201` for `POST /api/datasources` and `PUT /api/datasources/{id}` but the controllers return `200` — a spec-generated client asserting `status == 201` treats a correct registration/update as a failure; consolidates the previously-unpromoted 201-vs-200 cross-cutting drift

**Severity**: LOW
**Category**: status-code-narrow (OpenAPI contract-vs-implementation drift)

**Discriminating context**: `DataSourceController.registerDataSource` line 35 (`.map(ResponseEntity::ok)` = 200) vs `openapi.yaml:453-455` (`'201'` declared); `.updateDataSource` line 44 (`ResponseEntity.ok()` = 200) vs `openapi.yaml:481-487` (`'201'` declared). Pinned by P-038. Consolidates the formerly-unpromoted "REFACTOR-193" cross-cutting observation (createOwner/createRole/updateRole/createPolicy batch E + postDataEntityList batch F) — the 201-vs-200 drift never had a standalone registry entry; REFACTOR-591 is that home. The OpenAPI-generator-as-source-of-truth pattern (ADR-CANDIDATE-001) fixes path/verb but not the controller body's hand-written status code.

**Full detail**: `detail/REFACTOR-591.md`

---
