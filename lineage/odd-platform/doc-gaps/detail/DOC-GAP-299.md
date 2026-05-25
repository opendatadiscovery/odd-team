---
doc_gap_id: DOC-GAP-299
severity: HIGH
category: drift
batch: ZG
generated_at: "2026-05-26T00:00:00Z"
generated_at_commit: 4ec2b20
prompt_version: "doc-gap-finder/0.1.0"
maintainer_curated: false
related_pillar_features:
  - "P-04:F-001"   # Test Results Import — the ingestion path that populates status_reason verbatim from the test framework
  - "P-04:F-002"   # Quality Dashboard — sibling read surface; the dashboard does not expose status_reason but the runs-history endpoint does
  - "P-09"         # Security & Access Control — cross-owner-read posture
related_features:
  - F-022          # per-dataset Test Reports — sibling read surface that also renders status_reason
related_doc_gaps:
  - DOC-GAP-293    # missing test-results.md page — the doc home for this caveat
  - DOC-GAP-287    # cross-owner read posture cluster — this finding extends the cluster to per-test diagnostic text
  - DOC-GAP-294    # wire enum / RUNNING — sibling DataEntityRun finding
related_retrospectives:
  - LSN-001        # operator-impact-by-omission class — the doc surface should warn before deployment
  - LSN-002        # silent-misconfiguration class — the framework's verbose-diagnostic mode is configured upstream of ODD; the platform inherits the verbosity
---

## DOC-GAP-299 — `DataEntityRun.statusReason` is a free-form `type: string` field (per `components.yaml:974-976`) populated verbatim by the ingested test framework (Great Expectations, dbt, custom) and surfaced UNFILTERED + UNREDACTED to ANY authenticated user across the catalog via `GET /api/dataentities/{data_entity_id}/runs` — combined with the controller's read-collaborative posture (no `@PreAuthorize`, no `SecurityRule`, no owner predicate at `ReactiveDataEntityTaskRunRepositoryImpl.java:161-191`), the per-test runs-history endpoint is a CROSS-OWNER DIAGNOSTIC-TEXT BROADCAST CHANNEL — common test frameworks emit failed-row sample values (Great Expectations), column-and-table names + SQL stack traces (dbt), and arbitrary string content (custom frameworks) into `statusReason`; non-owners enumerating other teams' DQ tests get the verbatim diagnostic stream including any PII or operational-detail the framework chose to embed; the live `/features/data-quality` page (status 200), the dashboard page (status 200), and the test-results-import page (status 200) are ALL SILENT on the `statusReason` shape, the cross-owner-read posture, and the framework-vendor-controlled content; the would-be `test-results.md` page does not exist (DOC-GAP-293) — there is NO operator-facing doc that warns about the leak channel

**Severity**: HIGH
**Category**: drift (compound: undocumented diagnostic-PII leak channel + undocumented cross-owner read posture on the per-test runs-history surface; the field's free-form nature means the content is operator-tooling-controlled, not platform-controlled)

### Surfaced by

- `odd-platform__java__DataEntityRunController__controller-class__DataEntityRunController.md:security.known_security_gaps.[1]` (HIGH per sidecar) — verbatim: *"status_reason payload is operator-supplied (ingested verbatim from the test framework) and not redacted at the API boundary; combined with cross-owner-read, this is a diagnostic-text broadcast channel — frameworks like Great Expectations emit failed-row sample values which may contain PII"*
- `odd-platform__java__DataEntityRunController__controller-class__DataEntityRunController.md:security.data_exposure.[1]` — verbatim: *"status_reason free-form text (commonly contains test-framework diagnostics: column names, failed-row counts, sample failing values for Great Expectations; table/column names for dbt) → any authenticated user; non-owners get a data-quality-diagnostic leak channel"*
- `odd-platform__java__DataEntityRunController__controller-class__DataEntityRunController.md:security.owner_scoping` — verbatim: *"BYPASSES — no owner-context check at any layer (controller / service / repository). Verified: `ReactiveDataEntityTaskRunRepositoryImpl.getDataEntityRuns` (lines 161-191) filters only on `DATA_ENTITY.ID.eq(dataQualityTestId)` and optionally `STATUS.eq(...)`; there is no JOIN to `ownership` and no filter by the calling user's owners. This is a NEW invocation site of the cross-owner-read posture in the REFACTOR-024 family (extension to 5th site: the four DataQualityController GETs + this runs-history GET)."*
- `odd-platform__java__DataEntityRunController__controller-class__DataEntityRunController.md:docs_link_semantic.doc_drift_findings.[2]` — verbatim: *"DOC GAP: status_reason is a free-form diagnostic field surfaced verbatim to the UI (TestRunStatusReasonModal); not documented as such. Operators integrating ODD with frameworks that put rich diagnostic detail in status_reason (Great Expectations, dbt) have no warning that the text is rendered with no redaction and visible to any authenticated user across the catalog."*
- `odd-platform__java__DataEntityRunController__controller-class__DataEntityRunController.md:bugs_limitations_corner_cases.[5]` (HIGH per sidecar) — same finding from the corner-case lens with the SecurityConstants.SECURITY_RULES audit (zero hits on `/runs`).
- `odd-platform__java__DataEntityRunController__controller-class__DataEntityRunController.md:tests_coverage_semantic.uncovered_behaviours[Cross-owner-read posture]` (HIGH per sidecar) — probe **P-152** emitted (`lineage/odd-platform/probes/P-152.yaml`).
- `concepts.yaml:entities[DataEntityRun.statusReason]` — schema-tier free-form `type: string` declaration

### Evidence

- `odd-platform/odd-platform-specification/components.yaml:974-976` — `DataEntityRun.statusReason: { type: string }` — no `maxLength`, no `pattern`, no `description`. The schema explicitly permits arbitrary string content.
- `odd-platform/odd-platform-api/src/main/java/.../controller/DataEntityRunController.java:13-28` — the 16-line controller with no `@PreAuthorize`, no audit log line, no rate limit.
- `odd-platform/odd-platform-api/src/main/java/.../repository/reactive/ReactiveDataEntityTaskRunRepositoryImpl.java:161-191` — the SQL: `JOIN data_entity ON oddrn` + `WHERE data_entity.id = ? AND status = ?` + `ORDER BY end_time DESC LIMIT ? OFFSET ?`. No OWNERSHIP JOIN. No principal-derived predicate. No data-source-permission filter.
- `odd-platform/odd-platform-api/src/main/java/.../auth/SecurityConstants.java:98-355` — `SECURITY_RULES` table audit (verified per sidecar): zero matches for `/runs`; the endpoint falls through to `AuthorizationCustomizer.pathMatchers("/**").authenticated()` (line 29-30).
- `odd-platform/odd-platform-api/src/main/java/.../auth/AuthorizationCustomizer.java:29-30` — the catch-all `.authenticated()` — only auth gate on the path.
- `odd-platform/odd-platform-ui/src/components/.../TestRunStatusReasonModal.tsx` (per sidecar reference) — the modal renders `status_reason` verbatim to the UI; no escaping, no truncation, no per-frame container that would visually mark the content as third-party-supplied.
- **The ingestion provenance**: ODD ingests test-run rows via the `/ingestion/entities` path (sidecar references `TaskRunIngestionRequestProcessor`). The ingested payload's `status_reason` field is written verbatim to `data_entity_task_run.status_reason`. The ingest path has NO sanitisation, NO content filter, NO length cap. The content is whatever the test framework's adapter chose to emit.
- **Great Expectations content example**: a `expect_column_values_to_not_be_null` failed expectation emits `status_reason` along the lines of *"Expectation failed: 12 unexpected null values found in column 'ssn'. Sample failing rows (first 10): [{ssn: null, email: 'user1@example.com', user_id: 12345}, {ssn: null, email: 'user2@example.com', user_id: 12346}, ...]"* — depending on the test framework's `result_format` configuration, the sample values flow into the diagnostic text verbatim, including potentially PII columns like email addresses.
- **dbt content example**: a failed `dbt test` emits `status_reason` along the lines of *"Failure in test not_null_users_email (models/staging/users.sql): Got 47 results, configured to fail if != 0. Compiled SQL: SELECT email FROM analytics.users WHERE email IS NULL; ..."* — the compiled SQL appears verbatim, exposing the model schema + the table name + the analyst's query intent.
- **Custom framework content example**: a bespoke validator running shell commands and emitting their stdout into status_reason verbatim — fully operator-controlled content with no schema constraint.
- **The cross-owner enumeration narrative**: an attacker with valid platform credentials (or a curious operator with low-privilege access) writes a script: `for id in 1..N: GET /api/dataentities/{id}/runs?size=100` — for every entity id that resolves to a DQ test, they receive up to 100 most-recent runs WITH `statusReason`. The script enumerates the catalog's DQ diagnostic stream cross-owner. The platform emits no audit log of the access; the operator has no rate limit; the size param is unbounded (DOC-GAP-022 family). For an organization with 10K DQ tests, the script harvests ~1M run rows in O(test_count) HTTP calls.
- **The doc-side absence**: WebFetch `/features/data-quality` 2026-05-25 status 200: makes no statement about who can read DQ test diagnostics; WebFetch `/features/data-quality/dashboard` 2026-05-25 status 200: same; WebFetch `/features/data-quality/test-results-import` 2026-05-25 status 200: documents the ingestion side, makes no statement about how the ingested status_reason is read or by whom; WebFetch `/features/data-quality/test-results` 2026-05-25 status **404**: the would-be doc home does not exist. The `/configuration-and-deployment/enable-security/authorization/permissions` page enumerates DQ permissions (`DATA_ENTITY_ALERT_*` family) but no DQ-read permission; the absence of a permission is the cross-owner-read posture, but the page does not say so explicitly.

### Drift narrative

The status_reason field is the operator-facing diagnostic surface for DQ test failures — when a test fails, the operator clicks into the runs-history page to see `statusReason` and understand what failed. The field's free-form nature is by-design: test frameworks emit rich diagnostic information (sample failing rows, compiled SQL, stack traces) that operators need to triage. The design choice is correct; the operator-trust assumption is implicit.

The implicit assumption: "the test's owner has full control over what the framework emits, and we trust that they don't embed PII or operational secrets". The assumption breaks down for two reasons:
1. **The framework's default config is verbose**. Great Expectations defaults to `result_format: BASIC` which includes element counts but not sample values; `COMPLETE` includes sample values; many production deployments use `SUMMARY` or `COMPLETE` for triage purposes. The owner may have configured the framework before deploying ODD without thinking about cross-team visibility.
2. **The reader is not necessarily the owner**. The cross-owner read posture means ANY authenticated user reads the diagnostic stream. The owner's framework config affects what every authenticated user sees about their tests.

The combination — verbose framework defaults + cross-owner read — produces a diagnostic-text broadcast channel that operators cannot audit (no log line in `DataEntityRunServiceImpl.java`), cannot rate-limit (no Bucket4j / Resilience4j), and cannot turn off (the only way to suppress the content is to reconfigure the upstream test framework, which is per-test-suite and out-of-band of ODD).

The doc-side absence is the most actionable element: an operator deploying ODD for the first time has no warning about the verbose-default issue. By the time they realise their Great Expectations COMPLETE-formatted sample values are flowing into every authenticated user's runs-history view, the data has already been ingested and is queryable. The fix is doc-side preemption — warn before deployment.

Combined with the missing-page parent (DOC-GAP-293), this is a doc-product priority: the new `test-results.md` page is the obvious doc home for the warning, and the same authoring pass closes both findings.

### Proposed doc action

**Three-part action — doc-side warning in the new test-results.md (per DOC-GAP-293) + framework-vendor-specific guidance + code-side `/log-issue` for an optional content-filter**.

1. **Doc-side PRIMARY — co-locate with DOC-GAP-293's new `test-results.md` page**:

   Under the proposed "Status reason" section, expand the warning to:

   > **Status reason — diagnostic-text leak channel**. The `statusReason` field of each run carries free-form text emitted by the ingested test framework (Great Expectations, dbt, custom). The platform stores and renders this text verbatim with NO redaction, NO length cap, and NO content filter. The text is visible to ANY authenticated user across the catalog (regardless of dataset ownership) via the `/dataentities/{id}/history` UI tab AND via direct REST access at `GET /api/dataentities/{id}/runs`.
   >
   > **What the field can contain (per framework)**:
   > - **Great Expectations** (under `result_format: COMPLETE`): sample failing-row values, column names, expected vs actual values. If your DQ tests cover columns with PII (emails, names, SSNs, addresses), sample failing rows include those values verbatim.
   > - **dbt**: the compiled SQL, table/column names, error messages. Schema names and the data team's query intent are exposed.
   > - **Custom frameworks**: arbitrary string content under operator control.
   >
   > **What to do** (before ingesting test results):
   > 1. Configure your test framework's diagnostic-detail level to the minimum needed for triage. For Great Expectations, prefer `result_format: SUMMARY` or `BASIC` over `COMPLETE`. For dbt, consider `--quiet` mode in CI or post-process the failure messages to strip column-value samples.
   > 2. Treat the `statusReason` field as catalog-readable. Do not embed credentials, internal hostnames, or any value class your team does not want every authenticated platform user to see.
   > 3. If your deployment requires per-test cross-owner access controls, gate the `/api/dataentities/{id}/runs` endpoint at the reverse-proxy or API-gateway tier; ODD does not currently apply owner-scoping at this surface.

2. **Doc-side COMPANION — `documentation/docs/features/data-quality/test-results-import.md`** — add a one-section "Diagnostic detail configuration" note covering the same framework-vendor guidance, cross-linked to the test-results.md page. The ingestion-side page is where operators land BEFORE they ingest data; the warning belongs there as a pre-deployment checkpoint.

3. **Code-side `/log-issue odd-platform`** — author a backlog item for an OPTIONAL content-filter feature:
   - Option A (minimum-risk): add a `dq.status-reason.max-length: <int>` config key that truncates `statusReason` at read time (preserves ingested data, limits surface area).
   - Option B (full control): add a per-test `statusReason.public: bool` flag (default true for backwards-compat) that owners can flip to false to suppress diagnostic text for cross-owner readers; owners still see the full text.
   - Option C (deferred): owner-scoping the entire runs-history endpoint behind a `dq.runs-history.owner-scoped: false` feature flag (REFACTOR-024 family).
   The maintainer chooses; the doc-side warning above is the immediate operator recourse.

### Cross-references

- **DOC-GAP-293** (missing test-results.md page — parent finding; the doc home for this warning) — the same authoring pass closes both
- **DOC-GAP-287** (Relationships catalog-global cross-owner cluster) — this finding extends the cluster to per-test diagnostic-text; META candidate for a cross-cutting visibility-model doc page
- **DOC-GAP-294** (RUNNING wire-enum mapper failure) — sibling DataEntityRun finding; the same authoring pass closes all three (DOC-GAP-293, 294, 299)
- **DOC-GAP-022** (size-unbounded class) — enables the bulk-enumeration narrative above
- **REFACTOR-024** (cross-owner read posture family) — code-side scope for the optional owner-scoping fix
- **LSN-001 / LSN-002** — operator-impact-by-omission / silent-misconfiguration class — the framework's verbose default + the platform's no-redaction posture produces the canonical operator-trap pattern
- **Rule 6 coherence** — cross-registry sweep ran: `concepts/index.yaml` entries for `DataEntityRun.statusReason` (free-form string) consistent; `feature-flows/F-022` references the test-report-details preview that ALSO renders status_reason (same finding applies to that surface). No CONTRADICTS, no SUPERSEDES.

### Severity rationale

HIGH. The diagnostic-text leak channel affects every ODD deployment that runs test frameworks emitting verbose status_reason content (Great Expectations COMPLETE format, dbt error messages, custom verbose validators). The leak is structural (SQL has no owner predicate; the schema permits arbitrary string content) and uniformly silent at every doc layer. The operator-trap class (LSN-001 / LSN-002) is the same shape as canonical maintainer-pact violations: the framework's verbose default + the platform's no-redaction posture combine to surface PII / internal-detail to cross-owner readers, and no doc page warns about it. The fix is bounded (doc warning + cross-link + optional code-side feature for sensitive deployments). Severity is HIGH because: (i) the cross-owner readability is structural; (ii) the content includes potential PII depending on test framework configuration; (iii) the operator has no doc-side warning before deployment; (iv) the canonical doc home does not exist (DOC-GAP-293).

### Last verified

- 2026-05-26 — sidecar's static evidence (the SQL absence of owner predicate at `ReactiveDataEntityTaskRunRepositoryImpl.java:161-191`, the schema's free-form status_reason declaration at `components.yaml:974-976`, the SECURITY_RULES audit returning zero hits for `/runs`) re-confirmed at substrate commit `4ec2b20`. WebFetch results for the three live data-quality pages (status 200 each, verbatim absence of status_reason discussion) re-confirmed via sidecar `docs_link_semantic.inferred_docs`.
