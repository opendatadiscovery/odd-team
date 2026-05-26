# SHB-044 — Data-quality test severity changes leave NO audit trail; compliance can't answer "who set this to Critical?"

**Category**: merged
**Severity**: MEDIUM

## Hypothesis

When an operator sets or changes a Data-Quality test's severity (`MINOR | MAJOR | CRITICAL`) via `PUT /api/datasets/{id}/dataqatests/{tid}/severity` — and recall that severity directly drives the dataset's SLA colour, since `SLACalculator` encodes "raising a single test from Major to Critical can flip a dataset from Yellow to Red without any test pass/fail status changing" (per `documentation/docs/data-quality/sla-statuses.md:44`) — there is no `ActivityEvent` row written, no `last_modified_by` field, no version increment on the severity record, no Slack / webhook notification of the change. The repository uses `onDuplicateKeyUpdate` on `(DATA_QUALITY_TEST_ID, DATASET_ID)` — idempotent, but write-only-no-trail. A compliance reviewer auditing "who changed this dataset's SLA to Red on May 14?" cannot answer the question from the platform. An operator triaging a sudden dashboard flip cannot tell whether (a) a test result changed or (b) someone reclassified a test's severity. Same audit-asymmetry shape as F-019 (six-sidecar mute-on-write pattern) instantiated on the DQ surface.

## Evidence

- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/repository/reactive/ReactiveDataQualityRepositoryImpl.java:87-102` — the upsert: `onDuplicateKeyUpdate` on `(DATA_QUALITY_TEST_ID, DATASET_ID)`; no `last_modified_by`, no `updated_at`, no version column. The PUT silently overwrites the prior severity.
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/service/DataQualityServiceImpl.java:62-81` — `setDataQualityTestSeverity` service method: `@ReactiveTransactional`, calls the upsert, returns the DTO. No `activityRepository` reference, no `ActivityEvent.builder()`, no notification dispatch.
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/controller/DataQualityController.java:51-61` — the controller endpoint; thin proxy; no interceptor / aspect / aspect-J advice that would emit audit downstream.
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/security/constants/SecurityConstants.java:243-246` — the lone SecurityRule on this controller (DATA_ENTITY-scoped permission `DATASET_TEST_RUN_SET_SEVERITY`). The permission gate exists; the audit emission does not.
- `documentation/docs/data-quality/sla-statuses.md:44` (per the DataQualityController sidecar `implicit_adrs[3]` quote): "changing a single test's severity from Major to Critical can flip the dataset from Yellow to Red without any test pass / fail status changing" — confirms severity-change is an operator-impactful action whose absence-of-audit matters.
- `lineage/odd-platform/concepts.yaml` (and per system-mission.md canonicalisation candidate 3) — the audit-log presence asymmetry across mutating surfaces is already a known canonicalisation candidate; this is a NEW invocation site.

## Notes

- This is a textbook LSN-007 instance (the audit-silence six-sidecar pattern) applied to DQ severity. The shape: a state mutation on an owned entity that traversed the permission gate but bypassed the activity-log emission step.
- The blast radius is bigger than F-019's owner-lifecycle audit-silence because DQ severity feeds the SLA colour, which is consumed by BI tools and dashboards (per F-022 + the SLA badge surface) — operators in the regulated-data audience (financial, healthcare, government) cannot satisfy "who reclassified this test" questions from compliance reviewers without DB inspection.
- The fix is mechanical: an `ActivityEvent.builder().eventType(DATA_QUALITY_TEST_SEVERITY_CHANGED).oldState(...).newState(...).principal(...)` emission inside the service. The ActivityEventType enum needs a new value; the activity-event-payload schema needs a new variant. F-021 (Activity Feed) is the canonical sink.
- Caveat: the upsert is idempotent in OUTCOME (the row converges) but loses HISTORY (the prior severity is overwritten). An audit-emission would capture old + new — but the prior severity is read at upsert-time anyway via the existing-row check. A two-step service (read old → emit event → upsert) is the canonical fix.
- This thread is `open` rather than `clustering` because no F-NNN owns the DQ severity-mutation lifecycle today; F-022 stops at "Test Reports tab shows results."
- Same shape: every mutating endpoint that does NOT emit an activity event becomes a compliance hole. A meta-scan that enumerates "mutating service methods" cross-referenced with "service methods that touch ActivityRepository" would surface every instance; the LSN canonicalises it but no per-surface SHB exists for most.

## Next

1. **Verify**: grep `find odd-platform-api -name '*ServiceImpl.java' -exec grep -L 'ActivityEvent\|activityRepository' {} \;` to enumerate all mutating services that DON'T emit. Cross-reference with `SecurityConstants.SECURITY_RULES` to identify the gated-mutations without audit. Compare with F-021's activity-event-type coverage to identify gaps.
2. **Promote**: this is its own F-NNN candidate ("DQ Severity Lifecycle — change history & audit"), tightly clustered with F-022 (read surface) and F-021 (audit channel). Pillar P-04 with a P-07 (audit) cross-cut.
3. **Test gap**: the absence of audit also means the repository upsert is untested for "repeated PUTs produce no extra activity rows" (currently true; the absence of the assertion is the gap).
4. **DOC-GAP**: `docs.opendatadiscovery.org/features/data-quality/sla-statuses` does not state "severity changes are not audited." Add a caveat admonition; cite the open issue for the eventual audit-emission fix.

## Links

- cluster_with: [F-022, F-021, F-019]
- merged_into: F-057
- supersedes: []

## evaluation

- **feature-flow-builder 2026-05-26**: graduated — thread explicitly notes "open rather than clustering because no F-NNN owns the DQ severity-mutation lifecycle today; F-022 stops at 'Test Reports tab shows results.'" F-022 owns the READ surface (Test Reports + SLA badge); SHB-044's hypothesis is about the WRITE-AND-AUDIT lifecycle of severity, which is operator-impactful for compliance audiences via the SLA-colour feeds-BI-tools surface (cross-pillar blast radius). 6 evidence refs spanning controller / service / repository / SecurityConstants / doc-side framing. Minted F-057 at lineage/odd-platform/feature-flows/detail/F-057.yaml (P-04:F-004 DQ Test Severity Lifecycle). Three drift facets attached: severity_mutation_no_activity_event, sla_blast_radius_amplification_via_bi_integration, severity_lifecycle_history_unrecoverable. Cross-pillar links to F-022 (read surface) + F-021 (audit channel) + F-019 (sibling six-sidecar mute-on-write pattern) + F-040 (DQ test run history).
