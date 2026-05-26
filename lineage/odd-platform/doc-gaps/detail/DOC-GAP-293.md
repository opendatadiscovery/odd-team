---
doc_gap_id: DOC-GAP-293
severity: HIGH
category: missing-page
batch: ZG
generated_at: "2026-05-25T00:00:00Z"
generated_at_commit: 4ec2b20
prompt_version: "doc-gap-finder/0.1.0"
maintainer_curated: false
related_pillar_features:
  - "P-04:F-001"   # Test Results Import — produces the data this controller reads
  - "P-04:F-002"   # Quality Dashboard — sibling read surface (aggregate); /runs is per-test detail
related_features:
  - F-022          # per-dataset Test Reports tab — companion read surface; the test-report-details first-10-runs preview MOUNTS this endpoint
related_doc_gaps:
  - DOC-GAP-022    # size-unbounded class — this endpoint is a NEW instance
  - DOC-GAP-287    # cross-owner read posture cluster — this endpoint extends the cluster to runs-history
related_retrospectives: []
---

## DOC-GAP-293 — `GET /api/dataentities/{data_entity_id}/runs` (the per-test runs-history surface mounted at the `/dataentities/{id}/history` UI route AND embedded in the test-report-details preview) is COMPLETELY UNDOCUMENTED — no doc page exists on `docs.opendatadiscovery.org` for the runs-history surface; the natural canonical URL `/features/data-quality/test-results` returns HTTP 404; the adjacent `/features/data-quality/test-results-import` page (status 200) documents the INGESTION side only; the `/features/data-quality` pillar landing page (status 200) makes no statement about the per-test runs-history read endpoint; operators clicking the `/history` tab on a DQ-test details page have ZERO documentation to consult for the page-size=100 + end_time-DESC ordering + status-filter + RUNNING-state behaviour + cross-owner-read posture + status_reason free-form-text surface — and the six-value `DataEntityRunStatus` wire enum (`SUCCESS / FAILED / SKIPPED / BROKEN / ABORTED / UNKNOWN`) is itself unlisted; the dashboard page (per DOC-GAP-265) mentions three statuses; operators have no source for the remaining three

**Severity**: HIGH
**Category**: missing-page (the entire per-test runs-history surface has no doc home; operators discover the page through the UI but cannot retrieve its semantics from the documentation site)

### Surfaced by

- `odd-platform__java__DataEntityRunController__controller-class__DataEntityRunController.md:docs_link_semantic.doc_drift_findings.[0]` — verbatim: *"DOC GAP: the per-data-entity runs-history endpoint `GET /api/dataentities/{id}/runs` is NOT documented anywhere on `docs.opendatadiscovery.org`. WebFetch of `/features/data-quality` (2026-05-25 status 200) returned no content covering the runs UI / endpoint / pagination / status filter; WebFetch of `/features/data-quality/test-results` returned 404; WebFetch of `/features/data-quality/test-results-import` (status 200) documents the INGESTION side but not the runs-history READ side. Operator opening the `/history` tab on a DQ-test details page has no documentation to refer to: the size=100 page-size, the end_time-DESC ordering, the RUNNING-state behaviour, and the cross-owner-read posture are all undocumented."*
- `odd-platform__java__DataEntityRunController__controller-class__DataEntityRunController.md:docs_link_semantic.doc_drift_findings.[1]` — verbatim: *"DOC GAP: the six-value wire enum `DataEntityRunStatus` (components.yaml:1407-1415) is not listed on the data-quality doc page; the dashboard.md doc mentions 'passed / failed / skipped' (three values per the data-entity-run-status concept-index entry at concepts/index.yaml:664) — operator has no source for the full BROKEN / ABORTED / UNKNOWN set."*
- `odd-platform__java__DataEntityRunController__controller-class__DataEntityRunController.md:docs_link_semantic.doc_drift_findings.[2]` — verbatim: *"DOC GAP: status_reason is a free-form diagnostic field surfaced verbatim to the UI (TestRunStatusReasonModal); not documented as such. Operators integrating ODD with frameworks that put rich diagnostic detail in status_reason (Great Expectations, dbt) have no warning that the text is rendered with no redaction and visible to any authenticated user across the catalog."*
- `odd-platform__java__DataEntityRunController__controller-class__DataEntityRunController.md:upstream_callers` — two UI mount sites: `ui_route:/dataentities/{id}/history` (TestRunsHistory.tsx, page-size 100, infinite scroll) + `ui_route:/dataentities/{id}/test-report` (TestReportDetailsHistory.tsx, page-size 10 preview)
- `concepts.yaml:entities[DataEntityRunStatus]` (the six-value enum) + `entities[DataEntityRun]` (the row shape with status_reason free-form text)

### Evidence

- WebFetch `https://docs.opendatadiscovery.org/features/data-quality/test-results` 2026-05-25 status **404** (verbatim from sidecar `docs_link_semantic.inferred_docs.[1].last_verified_status: 404`) — the natural canonical URL for a runs-history doc DOES NOT EXIST.
- WebFetch `https://docs.opendatadiscovery.org/features/data-quality` 2026-05-25 status **200** — the pillar landing page; per sidecar `docs_link_semantic.inferred_docs.[0]`: "exposes Data Quality test run history; this is the pillar's landing page" — confidence LOW because the page does not actually cover the runs-history surface.
- WebFetch `https://docs.opendatadiscovery.org/features/data-quality/test-results-import` 2026-05-25 status **200** — the ADJACENT page covering the ingestion side; per sidecar: "does not document the read-side runs-history endpoint" — confidence LOW for the same reason (adjacent, not covering).
- `odd-platform/odd-platform-api/src/main/java/.../controller/DataEntityRunController.java:13-28` — the 16-line controller class with one method `getRuns(dataEntityId, page, size, status, exchange)` and zero authorization annotations.
- `odd-platform/odd-platform-api/src/main/java/.../service/DataEntityRunServiceImpl.java:32-44` — the entity-class gate at the service tier; rejects everything that is not DATA_TRANSFORMER (class id 2) or DATA_QUALITY_TEST (class id 4).
- `odd-platform/odd-platform-api/src/main/java/.../repository/reactive/ReactiveDataEntityTaskRunRepositoryImpl.java:176-182` — `paginate(..., DATA_ENTITY_TASK_RUN.END_TIME, SortOrder.DESC, ...)` — the load-bearing ORDER BY end_time DESC with no tie-breaker; the page-size 100 default flows verbatim into `LIMIT`.
- `odd-platform/odd-platform-specification/openapi.yaml:1363-1386` — the `getRuns` OpenAPI operation (operationId `getRuns`, summary "Get runs for DataTransformer or DataQualityTest"); the only authoritative-but-machine-readable surface for the endpoint's contract.
- `odd-platform/odd-platform-specification/components.yaml:1407-1415` — `DataEntityRunStatus` enum: `SUCCESS, FAILED, SKIPPED, BROKEN, ABORTED, UNKNOWN` (6 values). The dashboard doc per DOC-GAP-265 mentions only 3 ("passed / failed / skipped"); the runs-history surface has NO doc home for any of the 6.
- `odd-platform/odd-platform-specification/components.yaml:974-976` — `DataEntityRun.statusReason` declared as free-form `type: string` with no `maxLength`, no `pattern`, no `description`. Operator-supplied verbatim from the test framework (Great Expectations / dbt / custom).
- `odd-platform/odd-platform-ui/src/components/.../TestRunsHistory.tsx:24-122` — the dedicated `/dataentities/{id}/history` UI surface with page-size 100, infinite scroll, status-filter dropdown. The UI is the operator's only discoverable affordance; the docs do not name it.
- `odd-platform/odd-platform-ui/src/components/.../TestReportDetailsHistory.tsx:30-32` — the test-report-details preview (first-10-runs strip) mounted on the test-report tab. The companion of the dedicated page.

### Drift narrative

The runs-history surface is a load-bearing affordance on EVERY DQ-test details page (the `/history` tab) and a glance affordance on the test-report tab (the first-10-runs preview). It has TWO distinct UI mount sites consuming the SAME backend endpoint, plus the OpenAPI spec for third-party integrators. None of these three surfaces has a corresponding doc page on `docs.opendatadiscovery.org`.

The operator's discovery path is: navigate to a DQ test, click the `/history` tab, see the runs list, wonder about (a) what the columns mean, (b) what statuses are possible, (c) what `status_reason` shows, (d) how ordering works (start_time vs end_time), (e) what happens during an in-flight run, (f) whether they can see other teams' runs. The docs answer ZERO of these questions. The operator falls back to the OpenAPI spec (which is silent on semantics — DOC-GAP-271 establishes the spec's underdescription class on the adjacent dashboard endpoint), or to the UI's tooltips (there are none), or to reading the code.

The status_reason cross-owner visibility (per the sibling DOC-GAP-299 finding) is a genuine PII surface — frameworks like Great Expectations emit failed-row sample values directly into `statusReason`; dbt emits table/column names + SQL error excerpts. Any authenticated user can see the diagnostic stream of any DQ test in the catalog. The page that should warn the operator (e.g. `/features/data-quality/test-results.md`) does not exist.

The six-value `DataEntityRunStatus` enum is the second documentation gap layered on top: the dashboard page mentions 3 values ("passed / failed / skipped"); the runs-history surface displays up to 6 (the dropdown filter offers all 6). An operator filtering by `BROKEN` to find broken tests has no doc-side definition of what `BROKEN` means vs `FAILED`. The concept-index entry at `concepts/index.yaml:664` documents 3 values in the canonical concept; the wire enum has 6.

### Proposed doc action

**Four-part action — author the NEW page + extend the pillar landing page + extend the dashboard page + cross-link from the test-report page**.

1. **Doc-side PRIMARY (NEW page)** — author `documentation/docs/features/data-quality/test-results.md` (the URL `https://docs.opendatadiscovery.org/features/data-quality/test-results` that currently 404s):
   - Section "Where to find it" — name the `/history` tab on every DQ-test details page + the test-report-details preview.
   - Section "Runs list semantics" — name the columns (Status, Start time, Duration, Status reason), the page-size (100 dedicated, 10 preview), the infinite-scroll pagination, the ordering (end_time DESC, end_time-NULL-FIRST under Postgres default for RUNNING rows — see also DOC-GAP-294).
   - Section "Run statuses" — enumerate all 6 `DataEntityRunStatus` values with a one-sentence definition per value (Success / Failed / Skipped / Broken / Aborted / Unknown — co-located with DOC-GAP-265's dashboard.md edit so the vocabulary is consistent across pages).
   - Section "Status reason" — flag the free-form diagnostic-text surface: *"`Status reason` contains free-form text supplied by the ingested test framework (Great Expectations, dbt, custom). The platform renders it verbatim with no redaction; it may contain table/column names, sample failing row values, or stack traces depending on the test framework. The text is visible to any authenticated user across the catalog regardless of dataset ownership."*
   - Section "Authorization" — name the cross-owner read posture: *"Any authenticated user can read any DQ test's run history. The platform does not apply owner-scoping at this surface (consistent with the read-collaborative posture described on [the Data Discovery landing page]). Under `auth.type=DISABLED` the surface is anonymous."*
   - Section "API access" — link to the `developer-guides/api-reference/data-quality` sub-page (per DOC-GAP-198 — the sub-page that needs to exist) for direct REST-client integration.

2. **Doc-side COMPANION — `documentation/docs/features/data-quality.md`** (pillar landing page): add a "Surfaces" sub-section listing the four read surfaces in the pillar (Dashboard, per-dataset Test Reports, per-test Runs History, SLA badge) with a one-sentence summary and a link to each page. The pillar landing page currently does not enumerate its surfaces.

3. **Doc-side COMPANION — `documentation/docs/features/data-quality/dashboard.md`**: align the 6-status enumeration with the new test-results.md page (DOC-GAP-265 already names the 6-status edit; this finding co-locates the canonical vocabulary).

4. **Doc-side COMPANION — `documentation/docs/features/data-quality/test-reports.md`** (the per-dataset Test Reports page per F-022): add a cross-link to the new test-results.md page at the description of the first-10-runs preview strip.

### Cross-references

- **DOC-GAP-265** (Test Results Breakdown 3-vs-6 statuses) — sibling vocabulary finding; THIS finding adds the per-test runs-history surface to the locations that need the 6-value enumeration.
- **DOC-GAP-266** (Table Health label vocabulary drift) — sibling dashboard finding on the same authoring pass.
- **DOC-GAP-294** (RUNNING wire-enum mapper failure) — sibling code-side finding; the new test-results.md page is the doc home that needs the RUNNING-state behaviour caveat.
- **DOC-GAP-298** (Table Health classification rules undocumented) — sibling dashboard finding; the same authoring pass closes both.
- **DOC-GAP-299** (status_reason free-form leak) — sibling per-test cross-owner-read surface; the proposed Status reason section above is the operator-facing fix for both.
- **DOC-GAP-022** (size-unbounded class) — this endpoint is one more instance; the size=100 default and the no-server-side-cap behaviour should be named in the new page's pagination section.
- **DOC-GAP-271** (dashboard endpoint OpenAPI param description gap) — sibling spec-underdescription finding; the runs-history `getRuns` operation deserves a description backfill in the same spec-side pass.
- **DOC-GAP-287** (Relationships catalog-global cross-owner cluster) — extending the cluster to runs-history; the new page's Authorization section names the same posture.
- **DOC-GAP-198** (SLA endpoint + missing `developer-guides/api-reference/data-quality` sub-page) — the API-reference companion home this page links to.
- **Rule 6 coherence** — cross-registry sweep ran (`feature-flows/index.yaml` F-022, `concepts/index.yaml` entries for DataEntityRun / DataEntityRunStatus, `refactoring-scopes/index.md` REFACTOR-024): all SAME-POLARITY. No CONTRADICTS, no SUPERSEDES.

### Severity rationale

HIGH. The runs-history page is one of the most-visited surfaces in the platform for DQ operators (every time a test fails, the operator clicks `/history` to understand the cadence). The page is undocumented at every layer (no doc URL, no OpenAPI description, no UI tooltip). Combined with the status_reason cross-owner-readable surface (DOC-GAP-299) and the RUNNING-state mapper failure (DOC-GAP-294), this is an operator-trap class: the page works visually but its semantics are invisible. The fix is one new doc page + four cross-link edits — bounded and high-leverage.

### Last verified

- 2026-05-25 — sidecar's WebFetch results re-confirmed: `/features/data-quality/test-results` 404, `/features/data-quality` 200 without runs-history coverage, `/features/data-quality/test-results-import` 200 covering ingestion only. Substrate commit `4ec2b20`.
