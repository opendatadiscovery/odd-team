## STRENGTHENS — Batch ZG (DataQualityRunsController controller-class sidecar adds further evidence for the multi-axis dashboard doc-incompleteness cluster)

**New surfaced_by entries**:

The DataQualityRunsController class-level sidecar surfaces SIX `doc_drift_findings` (`docs_link_semantic.doc_drift_findings.[0..5]`), each anchored at a specific axis where the live dashboard page is incomplete:

- `doc_drift_findings.[0]` (HIGH) — Test Results Breakdown definition: doc says "count of test runs"; code computes "count of tests keyed on latest run." Standalone tracker: REFACTOR-653 NEW.
- `doc_drift_findings.[1]` (HIGH) — `titleIds` LSN-020 drift. Standalone tracker: REFACTOR-593 (strengthened this batch).
- `doc_drift_findings.[2]` (MEDIUM) — `namespaceIds` OR widening. Standalone tracker: REFACTOR-594 (strengthened this batch).
- `doc_drift_findings.[3]` (MEDIUM) — Table Health classification rules entirely undocumented. Standalone tracker: REFACTOR-654 NEW.
- `doc_drift_findings.[4]` (LOW) — Monitored Tables TABLE-only restriction. ADR-CANDIDATE-222 NEW captures the architectural intent; this REFACTOR continues to track the operator-surprise dimension.
- `doc_drift_findings.[5]` (MEDIUM) — Read-endpoint authorization scoping silent. Standalone tracker: REFACTOR-024 family (strengthened this batch).

**Cross-batch refinement**:

REFACTOR-600 is the MULTI-AXIS UMBRELLA SCOPE for the Data Quality Dashboard doc incompleteness; the 6 individual axes have their own standalone REFACTOR entries (REFACTOR-653, -654, -593, -594; ADR-CANDIDATE-222 NEW; REFACTOR-024 family). The umbrella scope's value is in the consolidated remediation: a single dashboard doc update would close MULTIPLE individual entries.

The remediation prescription (the doc-side rewrite):
1. Define "test_results" semantic explicitly — "count of tests keyed on latest-run-status, NOT count of test runs."
2. Clarify `titleIds` filter — "Ownership Title / Role, NOT dataset name."
3. Disclose `namespaceIds` widening — "includes entities whose datasource is in the namespace, in addition to entities directly assigned."
4. Document Table Health classification rules verbatim — HEALTHY / WARNING / ERROR algebra.
5. Document Monitored Tables TABLE-only restriction explicitly (already in the doc; could be strengthened).
6. Disclose the cross-owner read posture for the dashboard endpoint.

Six axes; one consolidated PR. The dashboard surface is the catalog-wide quality posture; doc completeness is load-bearing for operator triage.

**Coherence check** (LSN-018):
- STRENGTHENS: REFACTOR-653 NEW, REFACTOR-654 NEW, REFACTOR-593 (strengthened), REFACTOR-594 (strengthened), REFACTOR-024 family (strengthened), ADR-CANDIDATE-220 NEW, ADR-CANDIDATE-221 NEW, ADR-CANDIDATE-222 NEW.
- SUPERSEDES: none.
- CONFLICTS: none.

---
