---
doc_gap_id: DOC-GAP-270
severity: LOW
category: drift
batch: ZC
generated_at: "2026-05-25T00:00:00Z"
generated_at_commit: ede5d277
prompt_version: "doc-gap-finder/0.1.0"
maintainer_curated: false
related_pillar_features:
  - "P-04:F-002"
related_doc_gaps: []
---

## DOC-GAP-270 — Minor casing mismatch on the "Unknown" test-category label between live doc and rendered UI — live `/features/data-quality/dashboard` page lists the anomaly class as "Unknown Category" (capital C); the code renders `DataQualityCategory.UNKNOWN.getDescription()` whose exact string is "Unknown category" (lowercase c)

**Severity**: LOW
**Category**: drift (cosmetic — single-word casing mismatch; operator sees one form on the doc and a different form on screen)

### Surfaced by

- `odd-platform__ts__react-component__component__TestCategoryResults.md:docs_link_semantic.doc_drift_findings.[2]` — verbatim: *"DOC DRIFT — minor casing mismatch on the 'Unknown' category label. The live `dashboard` page lists the anomaly class as 'Unknown Category' (capital C). The code's `DataQualityCategory.UNKNOWN` description — the exact string rendered as the category heading by this component (`TestCategoryResults.tsx:30`) — is 'Unknown category' (lowercase c) (`odd-platform-api/.../dto/DataQualityCategory.java:17`). An operator sees 'Unknown category'."*

### Evidence

- WebFetch `https://docs.opendatadiscovery.org/features/data-quality/dashboard` 2026-05-25 status **200** (DIRECT FETCH this session) — verbatim Q5 answer listing the six anomaly classes: *"Assertion Tests, Column Values Anomalies, Freshness Anomalies, Schema Changes, **Unknown Category**, Volume Anomalies."* — capital C on "Category"
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/dto/DataQualityCategory.java:17` — verbatim: `UNKNOWN("Unknown category")` — lowercase c
- `odd-platform-ui/src/components/DataQuality/TestCategoryResults/TestCategoryResults.tsx:30` — verbatim: `<Typography ... variant='h4'>{category}</Typography>` — renders the description string verbatim (no i18n, no transformation)

### Drift narrative

A trivial casing mismatch. The doc's six-anomaly-class list capitalises every word ("Unknown Category"); the server-supplied enum description for `DataQualityCategory.UNKNOWN` is "Unknown category" (lowercase). The other five categories have matching casing across doc and code:

| Doc list | Code (DataQualityCategory) | Match |
| --- | --- | --- |
| Assertion Tests | `ASSERTION("Assertion Tests")` | OK |
| Column Values Anomalies | `COLUMN_VALUES_ANOMALIES("Column Values Anomalies")` | OK |
| Freshness Anomalies | `FRESHNESS_ANOMALIES("Freshness Anomalies")` | OK |
| Schema Changes | `SCHEMA_CHANGES("Schema Changes")` | OK |
| **Unknown Category** | `UNKNOWN("Unknown category")` | **DRIFT** |
| Volume Anomalies | `VOLUME_ANOMALIES("Volume Anomalies")` | OK |

The drift is single-letter and visible only when an operator cross-references the doc to the screen. No functional impact.

### Proposed doc action

**Single-line fix on the live dashboard doc page**.

`documentation/docs/features/data-quality/dashboard.md` — change *"Unknown Category"* to *"Unknown category"* in the anomaly-class list (and anywhere else on the page where the label appears) to match the rendered string.

Alternatively (slightly more invasive), change the server-side enum value in `DataQualityCategory.java:17` from `UNKNOWN("Unknown category")` to `UNKNOWN("Unknown Category")` for consistency with the other five all-Title-Case labels. This is a one-token change but touches Java code; the doc-only fix is cheaper and equivalent in operator outcome.

### Cross-references

- **Rule 6 coherence** — cross-registry sweep ran: no existing finding on `DataQualityCategory` enum descriptions; no concepts/feature-flows entry contradicts. No CONTRADICTS, no SUPERSEDES.

### Severity rationale

LOW. Cosmetic — one-word casing mismatch with zero operator-impact. Per the Quality Bar severity anchoring (HIGH = operator-trap, MEDIUM = readability gap, LOW = cosmetic), this is unambiguously LOW. Recorded for completeness so the maintainer can fold it into the dashboard.md authoring pass that addresses DOC-GAP-263..268.

### Last verified

- 2026-05-25 — WebFetch dashboard page status 200; the casing mismatch is intact; `DataQualityCategory.java:17` enum value re-confirmed at substrate commit `ede5d277`.
