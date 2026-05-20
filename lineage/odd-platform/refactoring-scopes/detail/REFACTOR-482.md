## REFACTOR-482 — TWO SecurityConstants.SECURITY_RULES wiring bugs at lines 295-299: (a) alert-status gated by DATASET_FIELD_ADD_TERM (copy-paste bug); (b) datasetfields/.../terms gated by DATA_ENTITY_ADD_TERM instead of DATASET_FIELD_ADD_TERM (wrong-permission wiring)

**Severity**: HIGH
**Category**: wiring-bug + path-mismatch + doc-code-drift
**Batch**: V (2026-05-20)
**Pillars affected**: [P-09-security-access-control, P-01-data-discovery (dataset-field metadata + alerts), P-11-platform-api (live docs cite the wrong permission)]

**Surfaced by**:
- `DatasetFieldController__controller-class__DatasetFieldController.md:bugs_limitations_corner_cases.[0]` (HIGH) — "**`SecurityConstants.java:299` wires `POST /api/datasetfields/{dataset_field_id}/terms` to `DATA_ENTITY_ADD_TERM` instead of `DATASET_FIELD_ADD_TERM`.** The live docs document `DATASET_FIELD_ADD_TERM` as the gate for this endpoint (verbatim: 'Allows linking a business glossary term to a specific field within a dataset.'). The code-doc divergence means: (a) a user granted `DATA_ENTITY_ADD_TERM` (intended for entity-level term-linking) effectively also gets dataset-field term-linking; (b) a user granted `DATASET_FIELD_ADD_TERM` cannot link terms to dataset fields. The permission catalog and the operative gate disagree."
- `DatasetFieldController__controller-class__DatasetFieldController.md:bugs_limitations_corner_cases.[1]` (HIGH) — "**`SecurityConstants.java:295-296` wires `PUT /api/alerts/{alert_id}/status` to `DATASET_FIELD_ADD_TERM`** — a clear copy-paste bug from the dataset-field block immediately preceding it. An alert-status update endpoint is gated by a dataset-field-scope term permission with no involvement of any dataset_field at the request path. Any user holding `DATASET_FIELD_ADD_TERM` can resolve alerts; any user holding an actual ALERT permission but NOT `DATASET_FIELD_ADD_TERM` CANNOT."
- live-doc anchor: `https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization/permissions` (verified 2026-05-20, status 200) documents `DATASET_FIELD_ADD_TERM` as "Allows linking a business glossary term to a specific field within a dataset."

**Statement**: SecurityConstants.SECURITY_RULES has TWO wiring bugs at adjacent lines 295-299, both of which produce permission-to-endpoint mappings that contradict the documented RBAC model.

**Bug 1 — Alert-status wired to DATASET_FIELD_ADD_TERM (copy-paste)**:

```java
// SecurityConstants.java lines 295-296 (BUG)
new SecurityRule(NO_CONTEXT,
    new PathPatternParserServerWebExchangeMatcher("/api/alerts/{alert_id}/status", PUT),
    DATASET_FIELD_ADD_TERM)  // <-- WRONG; should be an ALERT permission
```

The alert-status endpoint has NO involvement of any `dataset_field` at the request path; the permission family is clearly mis-applied. The endpoint immediately precedes the dataset-field block (lines 297-299 wire dataset-field paths to dataset-field permissions), suggesting the author copied lines 295-296 from the dataset-field template without changing the path OR the permission.

**Consequences**:
- Any user holding `DATASET_FIELD_ADD_TERM` (intended for "link a term to a dataset field") can RESOLVE ALERTS on any data entity.
- Any user holding an actual ALERT permission (e.g. `ALERT_RESOLVE` if such exists, or the documented ALERT permission family) but NOT `DATASET_FIELD_ADD_TERM` CANNOT resolve alerts.
- Cross-link with the AlertController class sidecar's documented authorization model: the AlertController claims service-layer authorization on alert-status; the SECURITY_RULES wiring contradicts this AND adds a wrong-permission gate.

**Bug 2 — datasetfields/.../terms wired to DATA_ENTITY_ADD_TERM**:

```java
// SecurityConstants.java lines 297-299 (BUG)
new SecurityRule(DATASET_FIELD,
    new PathPatternParserServerWebExchangeMatcher("/api/datasetfields/{dataset_field_id}/terms", POST),
    DATA_ENTITY_ADD_TERM)  // <-- WRONG; should be DATASET_FIELD_ADD_TERM
```

The live docs at `https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization/permissions` document `DATASET_FIELD_ADD_TERM` verbatim as "Allows linking a business glossary term to a specific field within a dataset." The permission EXISTS at `PolicyPermissionDto.java:34`. The endpoint is RBAC-gated; the gate is the WRONG permission.

**Consequences**:
- A user granted `DATA_ENTITY_ADD_TERM` (intended for entity-level term-linking via `DataEntityController.addDataEntityTerm`) effectively ALSO gets dataset-field term-linking — over-grant.
- A user granted `DATASET_FIELD_ADD_TERM` per the live docs CANNOT link terms to dataset fields — under-grant.
- Operators reading the live RBAC docs and configuring Policies that grant `DATASET_FIELD_ADD_TERM` to a steward role discover the configuration "doesn't work" — but get NO error message, because the gate at the endpoint is a DIFFERENT permission.

**Evidence**:
- `SecurityConstants.java:295-299` (the wiring bugs)
- `PolicyPermissionDto.java:34` — `DATASET_FIELD_ADD_TERM` permission DOES exist; the maintainer authored both the permission AND a different gate
- `DatasetFieldController.java:88-95` — `addDatasetFieldTerm(datasetFieldId, formData)` (the endpoint name signals intent: it's the dataset-field-tier addition; the gate should match)
- live doc `https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization/permissions` — documents the correct permissions
- live doc `https://docs.opendatadiscovery.org/features/active-platform-features/activity-feed#event-types` — confirms the correct event-type emission (`DATASET_FIELD_TERM_ASSIGNMENT_UPDATED`) at TermServiceImpl.java:211, decoupled from the broken SECURITY_RULES wiring

**Existing-ADR-or-implied-prescription**:

- ADR-CANDIDATE-002 (centralized SECURITY_RULES) explicitly identifies the trade-off: "path-string coupling fragility + silent drift when a controller's URL pattern changes but its SECURITY_RULES row does not". These two bugs are the embodiment of that fragility — a single central table with no compile-time / boot-time validator.
- ADR-CANDIDATE-002-strengthen-batch-V incorporates the two bugs as the central-table-as-fragile evidence.
- REFACTOR-073 (boot-time security-posture validator) — these two bugs are EXACTLY the class of failure a boot-time validator would catch.

**Proposed remedy**:

1. **Path A — Fix the two wirings immediately**:
   - Line 295-296: change `DATASET_FIELD_ADD_TERM` to the appropriate ALERT permission (or remove the rule if alert-status was supposed to be ungated per AlertController service-layer authz).
   - Line 297-299: change `DATA_ENTITY_ADD_TERM` to `DATASET_FIELD_ADD_TERM`.
   - Add a single regression test (`SecurityConstantsWiringTest.permissionsMatchEndpointPrefixes`) that asserts each rule's permission family-prefix matches the rule's path-prefix (e.g. `/api/alerts/...` → ALERT_*; `/api/datasetfields/...` → DATASET_FIELD_*; `/api/dataentities/...` → DATA_ENTITY_*; `/api/queryexample/...` → QUERY_EXAMPLE_*). The test would catch the two bugs today and prevent regression.

2. **Path B — Implement the boot-time SECURITY_RULES validator (REFACTOR-073)**: a Spring `@PostConstruct` bean that walks the SECURITY_RULES list, cross-references each path with the OpenAPI spec to confirm the endpoint exists, cross-references each permission with the docs / `PolicyPermissionDto`, and FAILS BOOT on any wiring inconsistency. This is the long-term structural fix; REFACTOR-073 is now 12-sidecar triangulated, including this batch's two bugs.

3. **Path C — Migrate to `@PreAuthorize` annotations per ADR-CANDIDATE-002's trade-off**: not recommended; would break the centralized-matrix invariant. Documented as the structural alternative but NOT the recommendation.

Path A is the immediate fix; Path B is the architectural improvement.

**Severity rationale**: HIGH — TWO simultaneous wrong-permission gates in adjacent lines of code. Both are STATIC TODAY (the wrong permissions are in production). Both are operator-visible only via the symptom (configuration "doesn't work"); neither produces an error. Bug 2 is doc-vs-code drift — operators following the docs configure the system incorrectly. Bug 1 over-grants alert-resolve capability to dataset-field-term holders. Cross-link: REFACTOR-073 (now 12-sidecar triangulated — the strongest case for a boot-time validator in the catalog).

**Suggested backlog grouping**: `Authorization audit batch` — covers REFACTOR-482 (this), REFACTOR-073 (boot-time validator — strengthened), REFACTOR-008 (live `/term` vs `/terms` drift case — same fragility class, prior batch finding), REFACTOR-009 (no compile-time/test-time guard against this class of drift).

---
