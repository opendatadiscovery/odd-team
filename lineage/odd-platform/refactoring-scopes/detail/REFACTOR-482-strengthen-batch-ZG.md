## STRENGTHENS — Batch ZG (DatasetFieldController controller-class sidecar adds re-verified evidence for BOTH wiring bugs with deeper file-analyser/0.4.0 anchoring + 2026-05-25 live-doc re-check)

The TWO SecurityConstants.SECURITY_RULES wiring bugs at lines 295-299 are reconfirmed at the controller-class layer with deeper line-anchored evidence:

**New surfaced_by entries**:

- `odd-platform__java__DatasetFieldController__controller-class__DatasetFieldController.md:bugs_limitations_corner_cases.[0]` (HIGH) — "**`SecurityConstants.java:299` wires `POST /api/datasetfields/{dataset_field_id}/terms` to `DATA_ENTITY_ADD_TERM` instead of `DATASET_FIELD_ADD_TERM`.** The live docs document `DATASET_FIELD_ADD_TERM` as the gate for this endpoint (verbatim: 'Allows linking a business glossary term to a specific field within a dataset.'). The code-doc divergence means: (a) a user granted `DATA_ENTITY_ADD_TERM` (intended for entity-level term-linking) effectively also gets dataset-field term-linking; (b) a user granted `DATASET_FIELD_ADD_TERM` cannot link terms to dataset fields. The permission catalog and the operative gate disagree."

- `odd-platform__java__DatasetFieldController__controller-class__DatasetFieldController.md:bugs_limitations_corner_cases.[1]` (HIGH) — "**`SecurityConstants.java:295-296` wires `PUT /api/alerts/{alert_id}/status` to `DATASET_FIELD_ADD_TERM`** — a clear copy-paste bug from the dataset-field block immediately preceding it. An alert-status update endpoint is gated by a dataset-field-scope term permission with no involvement of any dataset_field at the request path. Any user holding `DATASET_FIELD_ADD_TERM` can resolve alerts; any user holding an actual ALERT permission but NOT `DATASET_FIELD_ADD_TERM` CANNOT."

**Live-doc anchor re-verified 2026-05-25**:
- `https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization/permissions` — WebFetched 2026-05-25 status 200. The permissions page documents:
  - `DATASET_FIELD_ADD_TERM: Allows linking a business glossary term to a specific field within a dataset.` — the documented gate for `POST /api/datasetfields/{id}/terms`
  - `DATA_ENTITY_ALERT_RESOLVE: Allows resolving alerts for a data entity.` — the natural alert-status-mutation gate
- The wiring at SecurityConstants.java:295-299 contradicts BOTH documented mappings.

**Cross-batch refinement** (batch ZG's contribution):

The DatasetFieldController class-level sidecar adds the OPERATOR-FACING confirmation: the 7 endpoints across 4 services rely on the 6 SecurityRule entries at SecurityConstants.java:282-303; TWO of those entries are wrong. The wiring-bug surface is now triangulated at:
- **Controller** (this batch — file-analyser/0.4.0)
- **Live docs** (re-verified 2026-05-25 — the permissions page describes both `DATASET_FIELD_ADD_TERM` and `DATA_ENTITY_ALERT_RESOLVE` correctly)
- **SecurityConstants** (the buggy wiring at lines 295-299)

The fix is unchanged (one-line correction at SecurityConstants.java:299 — `DATA_ENTITY_ADD_TERM` → `DATASET_FIELD_ADD_TERM`; replace `SecurityConstants.java:295-296`'s `DATASET_FIELD_ADD_TERM` with an actual ALERT permission). Integration tests asserting permission-to-endpoint binding would catch the regression; no such tests exist (cross-link REFACTOR-009 — systemic-fix question).

**Probe-coverage**: P-153 (cited in the sidecar) verifies both bugs end-to-end via REST + permission grants.

**Coherence check** (LSN-018):
- STRENGTHENS: REFACTOR-008 (the `/term` vs `/terms` path-mismatch — the analogous systemic root cause: controller-vs-SECURITY_RULES drift); ADR-CANDIDATE-002 (centralised SECURITY_RULES — the trade-off this scope's case-law surfaces); ADR-CANDIDATE-224 NEW (parent-scoped authz — the wiring bugs mean the wrong-grain permission is checked).
- SUPERSEDES: none.
- CONFLICTS: none.

---
