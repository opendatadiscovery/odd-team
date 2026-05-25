---
doc_gap_id: DOC-GAP-266
severity: MEDIUM
category: drift
batch: ZC
generated_at: "2026-05-25T00:00:00Z"
generated_at_commit: ede5d277
prompt_version: "doc-gap-finder/0.1.0"
maintainer_curated: false
related_pillar_features:
  - "P-04:F-002"
related_features:
  - F-022
related_doc_gaps:
  - DOC-GAP-265   # sibling — same dashboard, different ring
---

## DOC-GAP-266 — Quality Dashboard "Table Health" ring label vocabulary drift — live `/features/data-quality/dashboard` page describes the slices as "success / failed / broken"; the DTO + rendered slice labels are "Healthy / Warning / Error" (`TablesHealthDashboard.{healthyTables, warningTables, errorTables}`); an operator reading the docs looking for a "broken tables" count will not find that label on the screen — the doc's vocabulary is not the product's vocabulary

**Severity**: MEDIUM
**Category**: drift (vocabulary mismatch between live doc and rendered UI labels; concepts roughly correspond but the words don't match)

### Surfaced by

- `odd-platform__ts__react-component__component__DataQualityContent.md:docs_link_semantic.doc_drift_findings.[0]` — verbatim: *"DOC DRIFT — Table Health ring labels disagree between doc and code. The live `dashboard` page (2026-05-22 status 200) describes Table Health as 'success / failed / broken'. The component renders the slices labelled **`Healthy` / `Warning` / `Error`** from `tablesDashboard.tablesHealth.{healthyTables, warningTables, errorTables}` (`DataQualityContent.tsx:55-62`, `components.yaml:3772-3787`). The DTO field set has no `failed` or `broken` — it has `warning` and `error`. An operator reading the docs looking for a 'broken tables' count will not find that label on the screen."*
- `odd-platform__ts__react-component__component__DataQualityContent.md:concepts.entities[TablesHealthDashboard]` — *"`{ healthyTables, warningTables, errorTables }` int32 counts (`DataQualityContent.tsx:55`, `components.yaml:3772-3787`)"*

### Evidence

- WebFetch `https://docs.opendatadiscovery.org/features/data-quality/dashboard` 2026-05-25 status **200** (DIRECT FETCH this session) — verbatim Q2 answer: *"Table Health Ring Labels: 'success / failed / broken'"*
- The page lists "success / failed / broken" as the labels; none of these words match the DTO's `healthyTables` / `warningTables` / `errorTables` or the rendered slice labels `Healthy` / `Warning` / `Error`.
- `odd-platform-specification/components.yaml:3772-3787` — `TablesHealthDashboard` schema declares exactly three int32 fields: `healthyTables`, `warningTables`, `errorTables` (and a total `entitiesCount`)
- `odd-platform-ui/src/components/DataQuality/DataQualityContent/DataQualityContent.tsx:53-63` — `tableHealthData` builds three slices: `{ name: t('Healthy'), value: tablesDashboard.tablesHealth.healthyTables, color: palette.dataQualityDashboard.healthy.color }, { name: t('Warning'), value: ...warningTables, color: ...warning.color }, { name: t('Error'), value: ...errorTables, color: ...error.color }`
- `odd-platform-ui/src/theme/palette.ts` (the `dataQualityDashboard` palette) — keyed by `healthy`, `warning`, `error` colour tokens

### Drift narrative

The live dashboard sub-page documents the Table Health ring with three slice labels — *"success / failed / broken"* — none of which match what the operator sees on screen. The rendered slice labels are *"Healthy / Warning / Error"*. The DTO field names confirm the product-side vocabulary: `healthyTables`, `warningTables`, `errorTables`.

The doc's vocabulary appears to be a copy-paste from the Test Results Breakdown ring's status set (which itself documents three of six — DOC-GAP-265): *"passed / failed / skipped"*. The doc author seems to have confused the two rings — calling the Table Health slices by run-status vocabulary instead of the dashboard's own table-health-status vocabulary. The actual three-tier classification on the table-health side maps roughly to per-dataset SLA: Healthy (no failing tests of any severity) / Warning (failing MINOR or MAJOR tests) / Error (failing CRITICAL tests). The SLA colour scheme in the live `sla-statuses.md` aligns with this — GREEN/YELLOW/RED — making the dashboard doc's "success/failed/broken" the OUTLIER in the otherwise self-consistent doc tree.

An operator reading the dashboard doc for the first time, scanning the Table Health section for "how many tables are in the Warning state", will find no mention of "Warning" anywhere on the page — the doc tells them about "failed". They have to click into the screen and discover the vocabulary by hovering over slices. The product-page vocabulary (Healthy/Warning/Error) is the source of truth; the doc needs to align.

### Proposed doc action

**Two-part action — fix the dashboard doc's vocabulary + add a cross-link to SLA**.

1. **Doc-side PRIMARY — `documentation/docs/features/data-quality/dashboard.md`** — replace the current "success / failed / broken" sentence with:

   > **Table Health** — the count of tables broken down by their aggregate health status:
   >
   > - **Healthy** (green) — the table has no failing tests of any severity (or has no DQ tests at all but the parent flag `monitored` reports `false`).
   > - **Warning** (yellow) — the table has at least one failing test at `MINOR` or `MAJOR` severity, but no failing `CRITICAL` test.
   > - **Error** (red) — the table has at least one failing test at `CRITICAL` severity.
   >
   > These three statuses map directly to the dataset-level SLA colours documented on the [Dataset Quality Statuses (SLA)](/features/data-quality/sla-statuses) page.

2. **Doc-side CONSISTENCY — `documentation/docs/features/data-quality/sla-statuses.md`** — verify (in the same authoring session) that the SLA colour names used there (GREEN/YELLOW/RED) are introduced as the row-coloring rule that the Table Health ring aggregates over; cross-link the dashboard page from there.

If the maintainer prefers the doc's current "success / failed / broken" vocabulary, the alternative is a UI relabel — but the DTO field names (`healthyTables` etc.) and the palette token names (`healthy`, `warning`, `error`) all use the Healthy/Warning/Error vocabulary, so changing the UI would require a far larger refactor; the cheap fix is the doc edit.

### Cross-references

- **DOC-GAP-265** (Test Results Breakdown 3-vs-6 statuses) — sibling finding on the SAME dashboard page; both edits should land together so the dashboard page is consistent end-to-end.
- **DOC-GAP-198** (SLA endpoint PNG-vs-JSON drift) — adjacent P-04 doc-drift finding; the SLA colour vocabulary (GREEN/YELLOW/RED) referenced in this fix is the same one DOC-GAP-198 wants the SLA page to fix.
- **Rule 6 coherence** — cross-registry sweep ran: `feature-flows/F-022`'s `description_excerpt` and the `DataQualityController` sidecar both use the SLA colour vocabulary (GREEN/YELLOW/RED), consistent with the proposed dashboard.md fix. No CONTRADICTS, no SUPERSEDES.

### Severity rationale

MEDIUM. The doc is wrong rather than incomplete — an operator following the doc to find "failed tables" is searching for a label that isn't on the screen. But the operator-impact is low (the dashboard is visually self-evident — Healthy/Warning/Error slices have intuitive colours, and the operator will eventually find what they need by looking at the screen). The fix is one paragraph.

### Last verified

- 2026-05-25 — WebFetch dashboard page status 200; the "success / failed / broken" sentence is intact; DTO field names + rendered labels re-confirmed at substrate commit `ede5d277`.
