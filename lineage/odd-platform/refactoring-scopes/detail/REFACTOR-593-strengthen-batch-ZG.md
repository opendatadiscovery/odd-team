## STRENGTHENS — Batch ZG (DataQualityRunsController controller-class sidecar reconfirms the titleIds → OWNERSHIP.TITLE_ID drift at the controller layer)

**New surfaced_by entry**:

- `odd-platform__java__DataQualityRunsController__controller-class__DataQualityRunsController.md:bugs_limitations_corner_cases.[1]` (HIGH) — "**`titleIds`/`deTitleIds` filter binds to OWNERSHIP.TITLE_ID — ownership role, not dataset title — with no UI signal of the translation.** Trace: controller params (`DataQualityRunsController.java:22, 27`) → service (`DataQualityRunsServiceImpl.java:26, 31`) → mapper (`DataQualityTestFiltersMapper.java:18, 23`) → repository SQL bind `OWNERSHIP.TITLE_ID.in(titleIds)` (`ReactiveDataQualityRunsRepositoryImpl.java:301, 309`). `OWNERSHIP.TITLE_ID` references the `TITLE` table — the ownership role assigned alongside an owner (e.g. 'Data Steward')."

**Cross-batch refinement**:

REFACTOR-593 was originally surfaced via the UI-filters sidecar (`DataQualityFilters`). This batch adds the backend-layer's confirmation at the controller-class surface; the LSN-020 class is now anchored at BOTH sides of the drift:
- **UI side**: `TitleFilter.tsx:29` (the bare `t('Title')` label invites the misinterpretation)
- **Backend side**: `ReactiveDataQualityRunsRepositoryImpl.java:301, 309` (the SQL bind to `OWNERSHIP.TITLE_ID`, not to dataset title/name)

The drift is operator-visible on the dashboard's tests-side AND tables-side filter dimensions (10 filter params: 5 tests-side × 5 tables-side; titleIds + deTitleIds both drift). The operator selecting "Title: Data Steward" sees the dashboard narrow to entities where someone holds that ownership ROLE — a fundamentally different slice than "datasets named 'Data Steward'" (the operator's likely mental model).

The remedy options (per REFACTOR-593's original entry) are unchanged: (a) UI label clarification (`'Ownership Title'` / `'Ownership Role'`), (b) parameter rename in the OpenAPI spec, (c) live-doc clarification on the filter semantics. The dashboard's `bugs_limitations_corner_cases.[1]` cites P-156 (in addition to the controller-class sidecar's P-156 reference) for end-to-end verification.

Cross-link with **REFACTOR-657 NEW** — DataSetController has analogous Category F path-parameter drift (`dataEntityId` documentation-only vs SQL filter); the LSN-020 class (input-name-vs-implementation drift) is the broader systemic-fix question. A CI check walking input-name → SQL-bind would catch both REFACTOR-593 and REFACTOR-657 atomically.

**Coherence check** (LSN-018):
- STRENGTHENS: REFACTOR-624 (Title.name no constraint — the directory-side companion), REFACTOR-372 (extractOwnershipRelation throws on missing titleDict — the ownership-title axis).
- SUPERSEDES: none.
- CONFLICTS: none.

---
