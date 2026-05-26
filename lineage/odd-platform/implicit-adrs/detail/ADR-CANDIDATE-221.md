# ADR-CANDIDATE-221 — Data Quality Dashboard response is ALWAYS a 36-cell category×status matrix — closed enum + UNKNOWN catch-all + always-padded `count=0` for absent cells — the schema-shape is stable regardless of data

**Classification**: promote
**Severity**: MEDIUM
**Pillars affected**: [P-04 Data Quality, P-11 Platform API (response contract)]
**Batch**: ZG (2026-05-25)

**Surfaced by**:
- `odd-platform__java__DataQualityRunsController__controller-class__DataQualityRunsController.md:implicit_adrs.[3]` (HIGH) — "**Test categories are a closed enum padded with UNKNOWN as a catch-all; the response envelope is always 36 cells (6 categories × 6 statuses) regardless of data shape.** `DataQualityCategory` declares 5 named categories + `UNKNOWN` (`DataQualityCategory.java:11-17`); `resolveByName` returns UNKNOWN for any input that doesn't match a declared name (`DataQualityCategory.java:29-31`). The mapper then iterates every declared category AND every DataEntityRunStatus enum value, padding with `count=0` where absent (`DataQualityCategoryMapperImpl.java:25-30, 45-60`)."

**Decision statement**: The DQ dashboard's `test_results` envelope ALWAYS contains 6 categories × 6 statuses = 36 cells, with `count=0` filled where absent. The three-part contract:

1. **Closed enum** — `DataQualityCategory` (`DataQualityCategory.java:11-17`) declares the 6 categories: `ASSERTION | VOLUME_ANOMALY | FRESHNESS_ANOMALY | COLUMN_VALUES_ANOMALY | SCHEMA_CHANGE | UNKNOWN`. Adding a new category requires a code change (and matching enum value).

2. **UNKNOWN catch-all** — `DataQualityCategory.resolveByName` (`DataQualityCategory.java:29-31`) returns `UNKNOWN` for any input that doesn't match a declared name. Ingested test results with unrecognised `category` attribute strings are routed to UNKNOWN rather than rejected. The enum is closed at the wire surface but tolerant of expansion at the data side.

3. **Always-padded response** — `DataQualityCategoryMapperImpl.java:24-30` iterates every declared category to seed the result map; `addMissingStatuses` (lines 45-60) iterates every `DataEntityRunStatus` value and appends a `count=0` cell where absent. The response shape is therefore deterministic: 6 category objects × 6 status cells each = 36 leaves, regardless of what's in the database.

The intent is to externalise category-set evolution AND deliver a UI-stable schema. The UI's per-category result rows render run-status tiles in fixed enum-declaration order (ADR-CANDIDATE-208) — the UI relies on the always-padded shape to render rings + legend entries WITHOUT conditional logic for "is this status present?". Adding a new category enum value (e.g., `ML_DATA_QUALITY`) automatically extends the response once data carries the new attribute string; the UI does NOT need a deployment to display the new category.

**Wisdom test**: PASS. Three intent anchors:
1. **Algorithmic** — `addMissingStatuses` exists ONLY to pad; it has no other behaviour. The mapper deliberately pads rather than returning sparse data.
2. **Schema-design** — the enum is closed (not open) AND has an `UNKNOWN` catch-all; both choices are explicit (compare with an open-enum design where any string is accepted at the wire).
3. **Structural impact** — every UI consumer that renders the response (DataQualityContent rings, the per-category result rows, the BI tooling that reads the OpenAPI spec) depends on the stable 36-cell shape.

**Operator-visible consequence**:
- A test framework emitting an unrecognised category string (e.g., `data_freshness` instead of `FRESHNESS_ANOMALY`) sees its runs counted under UNKNOWN, not silently dropped.
- The dashboard ring ALWAYS shows every status legend entry even if its count is 0 — the operator sees that "ABORTED" is a possible status even if no test has ABORTED yet.
- Adding a new category (e.g., `ML_DATA_QUALITY`) requires only an enum addition; the response shape automatically expands.

**Existing ADR**: closely related to **ADR-CANDIDATE-208** (per-test-category result rows render in fixed enum-declaration order — the UI-side consequence). This ADR captures the BACKEND padding contract; ADR-208 captures the UI rendering convention. Together they form the closed-enum-with-stable-shape pattern across the DQ surface.

**Co-surfaced gaps** (link from `refactoring-scopes.md`):
- **REFACTOR-592** EXISTING — `palette.runStatus[status].color` throws TypeError if backend ever returns a status outside the closed enum. The padding contract assumes both layers agree on the enum; a future maintainer adding a status value on the backend (e.g., `PARTIAL`) without updating the UI palette would blank the dashboard.
- **REFACTOR-600** EXISTING — the live dashboard doc is incomplete on category status semantics. Operators reading the doc cannot predict which categories appear or which statuses are possible.

**Proposed action**: Promote to `adrs/drafts/dq-dashboard-closed-enum-padded-shape.md` (new ADR). Document:
1. The decision: 6 categories × 6 statuses = 36 cells, always padded with `count=0`.
2. The schema commitment: `DataQualityCategory` is a closed enum + UNKNOWN catch-all; ingested unrecognised categories route to UNKNOWN.
3. The UI commitment: the consumer relies on stable shape; any backend status addition needs a matching UI palette update (REFACTOR-592 is the canonical case-law).
4. The extension path: adding a new category requires an enum value addition; the response shape automatically expands.

**Severity rationale**: MEDIUM — pattern-shaping decision affecting the response contract for one feature (DQ dashboard); load-bearing for the UI consumer + BI tools reading the OpenAPI spec; not security-architecture, but a structural commitment that future maintainers must understand to evolve the schema safely.

**Coherence check** (LSN-018):
- STRENGTHENS: ADR-CANDIDATE-208 (per-test-category UI rendering order). Together they form the closed-enum-with-stable-shape pattern.
- SUPERSEDES: none.
- CONFLICTS: REFACTOR-592 (palette throws on unknown status) is the dual-layer-contract gap this ADR's padding contract implicitly relies on.

---
