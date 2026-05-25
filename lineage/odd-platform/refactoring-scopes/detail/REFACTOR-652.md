## REFACTOR-652 — DataEntityRunController's runs-history endpoint cross-owner-broadcasts `status_reason` — a free-form diagnostic text field commonly carrying Great Expectations / dbt / custom framework failed-row sample values (PII-bearing) — any authenticated user reads any data entity's run history including this text

**Severity**: HIGH
**Category**: cross-owner-pii
**Batch**: ZG (2026-05-25)
**Pillars affected**: [P-04 Data Quality, P-09 Security & Access Control]

**Surfaced by**:
- `odd-platform__java__DataEntityRunController__controller-class__DataEntityRunController.md:security.known_security_gaps.[1]` (HIGH) — "status_reason payload is operator-supplied (ingested verbatim from the test framework) and not redacted at the API boundary; combined with cross-owner-read, this is a diagnostic-text broadcast channel — frameworks like Great Expectations emit failed-row sample values which may contain PII"
- `odd-platform__java__DataEntityRunController__controller-class__DataEntityRunController.md:bugs_limitations_corner_cases.[5]` (HIGH) — "Endpoint is NOT in SecurityConstants.SECURITY_RULES — no permission gate; the AuthorizationCustomizer catch-all `.pathMatchers(\"/**\").authenticated()` is the only filter. Any authenticated user can read any DQ test's or transformer's run history across the whole catalog. status_reason is a free-form text field set by the test framework (Great Expectations / dbt / custom) and commonly contains failed-row diagnostics — a non-owner gets a data-quality-diagnostic leak channel via this surface."

**Statement**: The runs-history payload includes `items[].statusReason` — a free-form text field set by the test framework (Great Expectations / dbt / custom Python). Frameworks commonly populate this field with diagnostic detail:
- **Great Expectations** — failed-row sample values (specific column values that violated the expectation), unexpected_count, partial_unexpected_list with actual data rows
- **dbt** — failed row counts, test compiled SQL, sample failing values
- **Custom** — arbitrary developer-supplied text including (potentially) SQL fragments, IDs, sample data

Combined with the cross-owner read posture (REFACTOR-024 family — confirmed at this surface in batch ZG), the field is a PII-broadcast channel: any authenticated user reading `/api/dataentities/{id}/runs` on any data entity (regardless of ownership) sees the diagnostic stream verbatim, including sample failing values that may contain customer PII, financial data, credentials in test fixtures, etc.

The blast surface is qualitatively WIDER than other cross-owner read surfaces in REFACTOR-024 family:
- Namespaces / owners / tags lists (REFACTOR-024 origin) — meta-information, no per-row data leakage
- Search results (REFACTOR-187) — entity names + ownership, no row-level data
- Lineage (REFACTOR-203) — graph structure, no row-level data
- **Per-entity runs-history with status_reason (THIS REFACTOR)** — ROW-LEVEL DATA potentially in the diagnostic text

The PII-exposure shape is the same one captured at REFACTOR-138 (PII surface in notification payloads — AlertNotificationMessage carries entity name + owner + namespace + lineage) but with a different exposure path: notifications go outbound to operator-configured channels; this REFACTOR is inbound-reachable by any authenticated platform user.

**Evidence**:
- Wire schema: `components.yaml:960-980` (`DataEntityRun.status_reason: string`, no maxLength, no `@Sensitive` annotation in the generator)
- SQL read path: `ReactiveDataEntityTaskRunRepositoryImpl.java:170-191` (status_reason column read verbatim, no redaction, no projection-filtering)
- UI render: `TestRunStatusReasonModal` (REFERENCE — the UI rendering the field as plain text)
- Cross-owner read posture: REFACTOR-024 family + this batch's strengthen
- Hypothesis: `lineage/odd-platform/probes/P-152.yaml`

**Existing-ADR-or-implied-prescription**: no governing ADR. **ADR-CANDIDATE-003** (read-collaborative GET) is the parent — the cross-owner read is intentional; but the operator may not realise that what's being read includes diagnostic free-form text that test frameworks routinely fill with sample data.

**Proposed remedy**: One or more of:
- **(a) Owner-scope the runs-history endpoint** — add a SECURITY_RULES entry with a per-entity `DATA_ENTITY_VIEW_DETAILS` or similar permission. Breaks the read-collaborative posture; an explicit decision required.
- **(b) Truncate / redact `status_reason` at the API boundary** for non-owners — keep status visible (SUCCESS/FAILED) but blank-out the diagnostic text. Preserves the read-collaborative posture for the AGGREGATE while protecting the diagnostic-text payload.
- **(c) Document the exposure on the live `/features/data-quality` page** — make operators aware that diagnostic text is cross-owner readable; let operators decide whether to sanitise at the ingestion source (GE / dbt config).
- **(d) Add a `@RedactInExportToNonOwners` annotation** on the wire schema's status_reason field; combined with a redaction filter at serialisation time. Generalisable to other cross-owner-readable free-form fields.

Option (c) is the smallest change; option (b) is the most defensive without breaking the architectural posture; option (a) is the architectural correction.

**Severity rationale**: HIGH — PII broadcast channel via a per-row free-form field; the test-framework integration story (the live `/features/data-quality/test-results-import` page) explicitly invites operators to push GE / dbt results, which routinely include sample failing values; operators following the docs have no warning that the resulting diagnostic stream is cross-owner-readable.

**Suggested backlog grouping**: `PII exposure audit batch` (paired with REFACTOR-138, REFACTOR-312, REFACTOR-514 — the notification-channel PII exposure family) + `Authorization audit batch` (the read-collaborative blast-radius family).

**Coherence check** (LSN-018):
- STRENGTHENS: REFACTOR-024 (parent family); REFACTOR-138 + REFACTOR-312 + REFACTOR-514 (notification-channel PII family — same PII shape on a different exposure path).
- SUPERSEDES: none.
- CONFLICTS: none. The cross-owner read posture is documented as intentional (ADR-CANDIDATE-003); the operational PII consequence on this specific surface is the documentation gap.

---
