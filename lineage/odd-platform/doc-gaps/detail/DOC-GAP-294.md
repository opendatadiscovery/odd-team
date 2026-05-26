---
doc_gap_id: DOC-GAP-294
severity: HIGH
category: drift
batch: ZG
generated_at: "2026-05-25T00:00:00Z"
generated_at_commit: 4ec2b20
prompt_version: "doc-gap-finder/0.1.0"
maintainer_curated: false
related_pillar_features:
  - "P-04:F-001"   # Test Results Import — the DB column populated by ingestion is the source of RUNNING values
  - "P-04:F-002"   # Quality Dashboard — sibling read surface (the dashboard's status-filter chip set is the wire enum)
related_features:
  - F-022          # per-dataset Test Reports tab — companion page that also relies on the wire enum
related_doc_gaps:
  - DOC-GAP-293    # the missing-page sibling — the new test-results.md page is the doc home for this caveat
related_retrospectives: []
---

## DOC-GAP-294 — `DataEntityRunStatus` wire enum (6 values: `SUCCESS / FAILED / SKIPPED / BROKEN / ABORTED / UNKNOWN`) is a strict subset of the DB column `data_entity_task_run.status` (7 values via `IngestionTaskRunStatus`: + `RUNNING`); MapStruct's `DataEntityRunMapper` flat-maps the String column into the wire enum target using `Enum.valueOf()` which throws `IllegalArgumentException` on unknown literals — the runs-history endpoint `GET /api/dataentities/{id}/runs` is therefore HYPOTHESISED to return HTTP 500 the moment any DQ-test enters the RUNNING state (the exact moment an operator most wants to consult the page); the asymmetry is undocumented in the OpenAPI spec, undocumented on every live doc page (`/features/data-quality`, `/features/data-quality/dashboard`, `/features/data-quality/test-results-import` — only the absence; the would-be `test-results.md` is missing per DOC-GAP-293); operator-impact: the `/history` tab fails silently with a 500 in the worst possible scenario (test running RIGHT NOW, operator opens the page to see what's happening)

**Severity**: HIGH
**Category**: drift (spec/code asymmetry where the wire contract excludes a documented DB state; mapper raises on the excluded literal; live docs say nothing about either the enum's 6-vs-7 truth nor the RUNNING-state failure mode)

### Surfaced by

- `odd-platform__java__DataEntityRunController__controller-class__DataEntityRunController.md:bugs_limitations_corner_cases.[1]` (HIGH per sidecar) — verbatim: *"Wire enum vs DB enum asymmetry — DB column `data_entity_task_run.status` accepts the seven-value `IngestionTaskRunStatus` enum (SUCCESS|FAILED|SKIPPED|BROKEN|ABORTED|RUNNING|UNKNOWN, IngestionTaskRun.java:28-36) but the wire enum `DataEntityRunStatus` declares only six values (RUNNING is missing, components.yaml:1407-1415). The DataEntityRunMapper flat-maps the String → wire enum target; MapStruct's String-to-enum conversion uses `Enum.valueOf()` which throws on unknown literals. Hypothesis: the runs-history endpoint returns HTTP 500 for any result set containing a RUNNING row — making the page UNAVAILABLE exactly while a test is in flight."*
- `odd-platform__java__DataEntityRunController__controller-class__DataEntityRunController.md:stress_findings.request_inputs[status].routes_to_finding` — verbatim: *"bugs_limitations_corner_cases (wire enum vs DB enum asymmetry) + docs_link_semantic.doc_drift_findings (six-value wire enum undocumented)"* — the input-name analysis pinpoints the operator's filter dropdown as the user-facing manifestation: an operator cannot filter by RUNNING (the wire enum has no such literal); the workaround (omit the filter to see all statuses) triggers the unmarshal failure if any returned row is RUNNING.
- `odd-platform__java__DataEntityRunController__controller-class__DataEntityRunController.md:tests_coverage_semantic.uncovered_behaviours[RUNNING status in result set]` (HIGH per sidecar) — verbatim: *"see P-151 (probe-skeleton emitted); this is the silent-availability-bug-during-in-flight-runs hypothesis"*
- `odd-platform__java__DataEntityRunController__controller-class__DataEntityRunController.md:concepts.entities.[2]` — verbatim: *"DataEntityRunStatus — six-value wire enum SUCCESS | FAILED | SKIPPED | BROKEN | ABORTED | UNKNOWN (`components.yaml:1407-1415`); DOES NOT contain RUNNING (asymmetry with the DB-side IngestionTaskRunStatus seven-value enum at `IngestionTaskRun.java:28-36`)"*
- `odd-platform/lineage/odd-platform/probes/P-151.yaml` (probe-skeleton emitted) — the dynamic verification probe.
- `concepts.yaml:entities[DataEntityRunStatus]` (6-value wire enum) + `entities[IngestionTaskRunStatus]` (7-value DB enum) — the schema-tier primary sources for the asymmetry.

### Evidence

- `odd-platform/odd-platform-specification/components.yaml:1407-1415` — verbatim:
  ```yaml
  DataEntityRunStatus:
    type: string
    enum:
      - SUCCESS
      - FAILED
      - SKIPPED
      - BROKEN
      - ABORTED
      - UNKNOWN
  ```
  6 values; RUNNING is absent.
- `odd-platform/odd-platform-api/src/main/java/.../model/tables/pojos/IngestionTaskRun.java:28-36` (the DB-tier source per sidecar) — `IngestionTaskRunStatus` enum declares 7 values: SUCCESS, FAILED, SKIPPED, BROKEN, ABORTED, **RUNNING**, UNKNOWN. RUNNING is the seventh.
- `odd-platform/odd-platform-api/src/main/java/.../mapper/DataEntityRunMapper.java:13-14` — verbatim from sidecar: the mapper flat-maps `DataEntityTaskRunPojo.status` (String column) → `DataEntityRun.status` (wire enum target). MapStruct's default String-to-enum strategy is `Enum.valueOf()`.
- `odd-platform/odd-platform-api/src/main/java/.../mapper/MapperConfig.java:7-13` (the MapStruct global config) — no `unmappedTargetPolicy = IGNORE` or `nullValueMappingStrategy` override that would catch unknown literals.
- `odd-platform/odd-platform-api/src/main/java/.../repository/reactive/ReactiveDataEntityTaskRunRepositoryImpl.java:170-191` — the read path emits the `status` column verbatim (no SQL-side filter excluding RUNNING).
- `odd-platform/odd-platform-api/src/main/java/.../controller/DataEntityRunController.java:18-27` — no `onErrorResume`; the controller propagates mapper exceptions verbatim to Spring's default error handler → HTTP 500 with a generic message.
- The status-filter query parameter accepts `DataEntityRunStatus` (wire enum, 6 values) — `openapi.yaml:1372-1376` per sidecar — so the operator's filter dropdown offers 6 chips; selecting any of them produces a `WHERE status = ?` predicate that excludes RUNNING rows; deselecting (i.e. all-statuses view) returns the full set including RUNNING → mapper failure.
- WebFetch evidence (DOC-GAP-293 sibling): the doc surface that should warn the operator (`/features/data-quality/test-results.md`) returns 404; the adjacent dashboard.md and pillar landing pages are silent on both the 6-value enum and the RUNNING-state behaviour.
- **The operator-impact narrative**: a data-quality engineer's monitoring slack channel pings: "DQ test `customers.row_count_check` is RUNNING for an unusually long time". The engineer clicks the test details page → `/history` tab to see the recent history. The page returns HTTP 500. The error is uninformative ("Internal Server Error" or whatever Spring's default surfaces). The engineer cannot consult the history precisely BECAUSE a test is running. The mitigation is to wait for the test to complete (so the table contains only non-RUNNING rows), then refresh — at which point the diagnostic value of the page (catching anomalies in the running window) is gone.
- **The structural-pattern observation**: the asymmetry is intentional at the schema layer (the wire enum excludes RUNNING because the read-side wire model assumes completed runs only — `endTime` is non-optional in the wire shape via the column projection), but the read path fetches RUNNING rows from the DB column and crashes the mapper. The fix is either (a) add RUNNING to the wire enum + handle the null `endTime` shape in the UI, or (b) filter `WHERE status != 'RUNNING'` at the SQL layer to match the wire contract, or (c) add a `@ValueMapping(source = MappingConstants.ANY_UNMAPPED, target = ...)` to map RUNNING to UNKNOWN (lossy but mapper-safe). Each option has UX trade-offs; the doc-side fix is to disclose the current behaviour pending the code-side decision.

### Drift narrative

The asymmetry between the wire enum (6) and the DB enum (7) is a load-bearing wire-contract decision that has no doc presence. The decision appears intentional: the wire model assumes completed runs (`endTime` is non-null in the column projection); RUNNING rows have null `endTime` and would not fit the wire shape. But the read path does not enforce this assumption — `getRuns` returns whatever rows match the data-entity-id-and-optional-status filter, including RUNNING rows when the operator omits the status filter (the default "all statuses" view).

The MapStruct mapper's String-to-enum strategy is `Enum.valueOf()` — strict; unknown literals throw `IllegalArgumentException`. The exception propagates up through the reactive Mono chain, hits Spring's default error handler, and becomes an HTTP 500 with a generic message. The page goes blank exactly when the operator most needs it: when a test is RUNNING.

The status-filter dropdown amplifies the confusion: the operator sees 6 chips (no RUNNING option), selects SUCCESS / FAILED / etc., and the page works because the SQL `WHERE status = ?` excludes RUNNING rows. The operator unselects to see "all" and the page breaks. The state machine has no doc-side description.

The dashboard's status legend (per DOC-GAP-265) renders all 6 wire enum values; an operator seeing RUNNING on the dashboard's filter sidebar (if any) would naturally try to filter by RUNNING in the runs-history page — but RUNNING is not in the wire enum, so the filter chip is absent. The lack of doc-side narration of the 6-vs-7 truth leaves the operator with no model for what's going on.

### Proposed doc action

**Two-part action — doc-side primary + code-side cross-ref to /log-issue**.

1. **Doc-side PRIMARY — co-locate with DOC-GAP-293's new `test-results.md` page**:

   Under the proposed "Run statuses" section in `documentation/docs/features/data-quality/test-results.md`, add the in-flight caveat at the bottom of the 6-status list:

   > **In-flight runs.** While a test is executing, its row in `data_entity_task_run` carries the DB-side status `RUNNING` (a value that is not exposed in the wire API surface). The runs-history endpoint currently returns HTTP 500 when the result set contains a RUNNING row — meaning the `/history` tab is temporarily unavailable while a test is in flight. To consult the history during a test execution, filter by a specific completed status (Success / Failed / Skipped / Broken / Aborted / Unknown) — the filter excludes RUNNING rows at the SQL layer and the page renders correctly. Track the in-flight run via the test-report tab's status indicator instead.

   Also, in `documentation/docs/features/data-quality/test-results-import.md` (the ingestion-side page, status 200), add a one-line note: *"Ingested rows whose status is `RUNNING` (a test in flight) are stored in `data_entity_task_run` but are not surfaced in the wire API. Use the test-report tab's status indicator to track in-flight runs."*

2. **Code-side cross-ref via `/log-issue odd-platform`** — author a backlog item with the three options enumerated above:
   - Option A: extend `DataEntityRunStatus` to include RUNNING (wire-contract change; client/SDK regen required).
   - Option B: filter `WHERE status != 'RUNNING'` at the SQL layer (read-path semantic change; aligns the wire and DB contracts at the cost of hiding in-flight rows from the runs-history surface entirely — operators consult test-report tab instead).
   - Option C: add a MapStruct `@ValueMapping(source = "RUNNING", target = "UNKNOWN")` (lossy but mapper-safe; preserves the runs-history page during in-flight runs at the cost of misrepresenting RUNNING as UNKNOWN).
   The maintainer chooses; the doc-side caveat above remains valid until the code-side fix lands.

### Cross-references

- **DOC-GAP-293** (missing-page parent — the new `test-results.md` page is the doc home for this caveat)
- **DOC-GAP-265** (dashboard 3-vs-6 statuses) — sibling vocabulary finding; the dashboard names 3, the wire enum has 6, the DB enum has 7; the same authoring pass aligns all three layers
- **DOC-GAP-266** (Table Health label vocabulary drift) — sibling page-vocabulary finding
- **probe P-151** — the dynamic verification probe; pin the HTTP-500-on-RUNNING hypothesis end-to-end
- **F-022** (per-dataset Test Reports tab) — the sibling feature surface that also relies on the wire enum; the same caveat should appear on the test-reports.md page
- **Rule 6 coherence** — cross-registry sweep ran: `concepts/index.yaml` enumeration of `DataEntityRunStatus` (6-value) AND `IngestionTaskRunStatus` (7-value) — both present, consistent with the asymmetry framing. `feature-flows/F-022` references the wire enum only. No CONTRADICTS, no SUPERSEDES.

### Severity rationale

HIGH. The page goes BLANK exactly when the operator most wants to consult it (a test running RIGHT NOW). The operator-trap class (LSN-001 / LSN-002) is the same shape as canonical maintainer-pact violations: the surface works fine in the demo state (no in-flight tests) and breaks in production where in-flight tests are common. The doc-side fix is bounded (one paragraph in the new test-results.md page) and the code-side options are enumerated for the maintainer's triage; the severity reflects operator-impact, not fix complexity.

### Last verified

- 2026-05-25 — sidecar's static evidence (the 6-vs-7 enum, the MapStruct strict mode, the no-error-handler controller) re-confirmed at substrate commit `4ec2b20`. Dynamic verification deferred to probe P-151.
