---
doc_page: "docs/configuration-and-deployment/enable-security/audit-trail-scope.md"
page_title: "Audit trail scope"
live_url: "https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/audit-trail-scope"
live_url_verified_status: "200"
live_url_resolved_slug: "configuration-and-deployment/enable-security/audit-trail-scope"
live_verified_at: "2026-05-29"
analysed_at_commit: "30795b4"
prompt_version: "doc-analyser/0.1.0"
confidence_overall: HIGH
describes:
  concepts:
    - "Activity Feed"
    - "Read Activity Feed (windowed, filtered, type-dispatched)"
    - "No-audit-log on RBAC mutations (audit-log presence asymmetry — REFINED in batch F)"
    - "Collector Token"
    - "Regenerate Collector Token"
  features:
    - "F-021"
    - "F-006"
    - "F-196"
  code_nodes:
    - "odd-platform java CollectorController controller-method:regenerateCollectorToken"
audience: [operator]
doc_claim_vs_code:
  - "ZERO hard drift — every load-bearing claim on this page is confirmed by the ontology's audit-silence invariant cluster. Confirmations recorded as precision notes below, NOT drift."
  - "Page claim: 'activity table requires a data_entity_id FK on every row, declared NOT NULL, would require a coordinated schema migration to close.' CONFIRMED at the schema layer — evidence: invariant:f-006-audit-silence-schema-rooted-data-entity-id-not-null-fk cites V0_0_48__add_activity.sql:4 (data_entity_id bigint NOT NULL) + V0_0_48__add_activity.sql:12 (FK activity_data_entity_id_fk REFERENCES data_entity(id)) + ReactiveActivityRepositoryImpl.java:219 (every read path INNER JOINs DATA_ENTITY). The page's architectural framing is code-accurate."
  - "Page claim: 'owner_association_request_activity table (dedicated), 5-value typed enum (REQUEST_CREATED/APPROVED/DECLINED/MANUALLY_APPROVED/MANUALLY_DECLINED).' CONFIRMED — evidence: invariant:two-tier-audit-asymmetry-bifurcation-owner-association-request-has-dedicated-table-rbac-mutations-do-not cites OwnerAssociationRequestActivityType.java:3-8 (exactly those 5 values) + V0_0_51__add_owner_association_request.sql. The page's positive-half second stream is accurate."
  - "Page claim: '27-value ActivityEventTypeDto enum, every event type names a data-entity attribute.' CONFIRMED — evidence: invariant:activity-event-enum-20-named-plus-7-categorical-equals-27 (20 named + 7 categorical = 27, all data-entity-scoped)."
  - "Page claim: 'RBAC / Owner / Term / Namespace / Datasource / Collector lifecycle leave no recoverable trace; service impls emit no activity row and no @Slf4j log line.' CONFIRMED — evidence: invariant:no-audit-log-on-rbac-mutations-... (master, Policy/Role/Owner) + invariant:audit-log-presence-asymmetry-batch-w-management-tier-tabs-extension (DataSourceServiceImpl all-4-paths, CollectorServiceImpl all-5-paths, TagServiceImpl, NamespaceServiceImpl emit NO Activity events) + invariant:slf4j-annotation-unused-no-audit-trail-at-ingestion-service-impl (@Slf4j present-but-unused → consistent with the page's 'application-level logs are NOT a substitute')."
  - "PRECISION NOTE (page is correct, not drift): page says 'Term assignments on data entities ARE audited; the Term entity itself is not.' The same per-mutation-type (not per-controller) asymmetry is code-confirmed for Tags: @ActivityLog(TAG_ASSIGNMENT_UPDATED) exists at DataEntityServiceImpl.java:358 for per-entity tag ASSIGNMENT, but the directory-vocabulary TagServiceImpl CRUD path carries none (per invariant:audit-log-presence-asymmetry-batch-w-...). The page's framing generalises correctly."
  - "PRECISION NOTE (page is correct): page says token rotation 'leaves no audit record' and cross-links the COLLECTOR_TOKEN_REGENERATE permission caveat. CONFIRMED — CollectorServiceImpl regenerate-token path is in the batch-W unaudited enumeration; the controller surface is the confirmed code node odd-platform java CollectorController controller-method:regenerateCollectorToken."
maintainer_curated: false
---

# Audit trail scope — doc understanding

This page is the single operator-facing reference for what ODD Platform records, what it does not, and the compensating controls for SOX / HIPAA / GDPR / SOC2 reviews. It is — almost uniquely among the docs — a faithful operator-facing rendering of an ontology invariant cluster: every load-bearing claim maps 1:1 to a confirmed audit-silence invariant. The page's central thesis (audit is **architecturally bifurcated**: data-entity activity feed + owner-association request log are recorded; RBAC / Owner / Term / Namespace / Datasource / Collector lifecycle leave no trace) is the operator-facing statement of `invariant:two-tier-audit-asymmetry-bifurcation-...` (the three-tier model) and the `F-006` audit-silence master.

The page's strongest move — framing the gap as **schema-rooted, not a missing-annotation oversight** — is code-accurate: `invariant:f-006-audit-silence-schema-rooted-data-entity-id-not-null-fk` confirms the `activity.data_entity_id NOT NULL` FK at `V0_0_48__add_activity.sql:4,12` plus the read-path INNER JOIN at `ReactiveActivityRepositoryImpl.java:219`, which together make the activity table structurally a "data-entity audit log", not a "platform audit log". The positive half's second stream — the dedicated `owner_association_request_activity` table with its 5-value enum at `OwnerAssociationRequestActivityType.java:3-8` — and the 27-value `ActivityEventTypeDto` (`invariant:activity-event-enum-20-named-plus-7-categorical-equals-27`) are both confirmed verbatim.

The operator-facing surfaces are `F-021` (global Activity Feed) and `F-196` (per-entity Activity tab); the read pipeline is the `Read Activity Feed (windowed, filtered, type-dispatched)` operation and the emission pipeline is the `@ActivityLog` / `ActivityAspect` snapshot-diff-emit operation. The Collector-token caveat binds to the confirmed code node `CollectorController controller-method:regenerateCollectorToken`. No hard doc-claim-vs-code drift exists on this page; the entries above are confirmations and two per-mutation-type precision notes, all with code evidence.

One ontology-only observation the page does NOT carry (candidate for the maintainer, not a drift against any current claim): `invariant:two-tier-audit-asymmetry-bifurcation-...` flags a HIGH-severity companion finding that `GET /api/owner_association_request/activity` has NO SecurityRule entry — any authenticated user can read the full forensic who-approved-whose-mapping trail, while the sibling LIST endpoint requires `OWNER_ASSOCIATION_MANAGE`. The page describes the positive-half audit stream's existence but not the read-side over-exposure on that same stream.

## Maintainer notes
<!-- preserved across re-analysis; the only block a human hand-edits -->
