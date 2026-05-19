## REFACTOR-231 — AlertManager webhook payload-driven alert creation with no caller-ID check — `entity_oddrn` from untrusted payload determines which data entity the alert attaches to

**Severity**: HIGH
**Category**: missing-auth + missing-validation
**Surfaced by**:
- `ReactiveAlertRepositoryImpl.md:security.known_security_gaps[1]`
- `ReactiveAlertRepositoryImpl.md:security.auth_mode_relevance` (the explicit cross-reference to `POST /ingestion/alert/alertmanager`)
- cross-batch: `REFACTOR-082` (the existing webhook-unauth finding)

**Description**: `AlertManagerController.alertManagerWebhook` is path-mounted at `POST /ingestion/alert/alertmanager` (`AlertManagerController.java:21-26`). The path does NOT match `IngestionDataEntitiesFilter`'s matcher (which is `/ingestion/entities` only — see REFACTOR-082). The controller carries no `@PreAuthorize`. The endpoint is in `SecurityConstants.WHITELIST_PATHS` (`/ingestion/**`) and the auth chain permits it across every mode.

The webhook delegates to `AlertServiceImpl.handleExternalAlerts` (lines 153-191), which:
- Reads `externalAlert.getLabels().get("entity_oddrn")` (`AlertServiceImpl.java:178`) directly from the request payload.
- Passes that oddrn into the new AlertPojo via `setDataEntityOddrn(...)`.
- Calls `alertRepository.createAlerts(...)` (`AlertServiceImpl.java:190`) which issues `INSERT INTO alert ... RETURNING` (`ReactiveAlertRepositoryImpl.java:332-342`) with no validation, no caller-ID check, no oddrn-ownership check.

The payload's `entity_oddrn` is UNTRUSTED yet DECIDES which data entity the alert attaches to. An anonymous caller (default DISABLED-mode deployment, the only realistic deployment per the operator docs which never warn against it) can:

1. POST an AlertManager-shaped JSON to `/ingestion/alert/alertmanager` with arbitrary `labels.entity_oddrn = "//postgresql/database/prod/schemas/public/tables/sensitive_table"`.
2. The platform creates an OPEN alert attached to that entity, with caller-controlled `description` text via `String.format("Distribution Anomaly. URL: %s", queryUrl)` (`AlertServiceImpl.java:185`) — the URL is also payload-controlled, allowing arbitrary content injection into the alert chunk text.
3. The alert surfaces in `GET /api/alerts` (REFACTOR-024 cross-owner read) — every authenticated user sees it.

Additional vectors compounding:
- **No idempotency**: `createAlerts` (`ReactiveAlertRepositoryImpl.java:332-342`) issues raw `INSERT … RETURNING` with NO `ON CONFLICT` clause. Prometheus retry on transient network error produces duplicate ALERT rows (see REFACTOR-234 separately for the de-duplication gap).
- **No payload validation**: the controller comment at line 20 reads `// TODO: define OpenAPI spec based on alert provider contract` — there is no schema. Any JSON shape that the deserialiser accepts produces an alert.
- **No source attribution**: the resulting AlertPojo carries `status_updated_by = NULL` on creation; there is no field for "this alert came from the AlertManager webhook" vs "this alert came from ingestion". An operator triaging an alert cannot distinguish authentic ingestion-driven alerts from webhook-driven attacker-planted alerts.

REFACTOR-082 named the auth surface ("AlertManager endpoint is not covered by ANY filter") in batch B. This finding (NEW 2026-05-19) confirms the consequence chain end-to-end at the SQL primary source: the repository `createAlerts` is the sink; the controller is the unauth front door; the service is the trust-the-payload glue. ADR-CANDIDATE-006 codifies the operator-delegated-auth posture — but the docs do not warn operators that an unprotected AlertManager webhook will accept arbitrary alert payloads attributed to arbitrary entities.

**Primary source citations**:
- `AlertManagerController.java:20-26` — the unauth controller + the TODO comment
- `AlertServiceImpl.java:178` — the untrusted `labels.entity_oddrn` consumption
- `AlertServiceImpl.java:185` — the user-controllable URL string interpolation into the chunk description
- `AlertServiceImpl.java:153-191` — the full handleExternalAlerts path (no auth, no validation, no idempotency check)
- `ReactiveAlertRepositoryImpl.java:332-342` — the sink `createAlerts` with no ON CONFLICT and no caller-ID check
- `SecurityConstants.WHITELIST_PATHS` — `/ingestion/**` blanket permit
- contrast with `IngestionDataEntitiesFilter.java:28` — the filter that DOES exist for `/ingestion/entities` but NOT for `/ingestion/alert/alertmanager`

**Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-006 (AlertManager network-delegated auth) codifies the absence of app-layer auth as the deliberate posture. The ADR's defence does NOT extend to:
- Validating that `entity_oddrn` exists in the platform.
- Validating that the alert payload conforms to a schema.
- De-duplicating retries.
- Attributing the alert source for forensic review.

These are gaps the ADR's stance does not justify — they're refactoring within the existing trust-the-network architecture.

**Proposed remedy**: Four composable fixes:
1. **Validate `entity_oddrn` exists**: add a service-layer check in `handleExternalAlerts` that calls `dataEntityRepository.existsByOddrn(entity_oddrn)` before creating the alert; reject with 400 if absent.
2. **Define the OpenAPI schema**: address the TODO comment at `AlertManagerController.java:20`; require `Content-Type: application/json` + a `@Valid` annotation on the deserialised request; reject payloads with missing or malformed `labels.entity_oddrn`.
3. **Add idempotency**: an `external_alert_id` column on ALERT (with a UNIQUE constraint) + an `ON CONFLICT DO NOTHING` clause in `createAlerts`. AlertManager provides `fingerprint` field for exactly this purpose.
4. **Add source attribution**: an `alert_source` enum column on ALERT (`INGESTION | ALERTMANAGER_WEBHOOK | MANUAL`) populated by the controller. Surface in the `GET /api/alerts` response so operators can filter / sort by source.

Documentation companion: update the live `/configuration-and-deployment/enable-security/authentication` page to explicitly enumerate the AlertManager webhook's trust requirements ("MUST be behind a reverse proxy with mutual TLS or network-level ACL"). The trust-the-network ADR is sound only if operators KNOW it.

**Severity rationale**: HIGH — anonymous unauthenticated remote alert injection under DISABLED-mode (default deployment), with arbitrary entity-attachment and arbitrary chunk-text content. Combined with REFACTOR-024 (cross-owner read), the planted alert is visible to every authenticated user. Combined with REFACTOR-244 (no observability), the injection is invisible to the operator unless they specifically look. Combined with the docs' silence (per the doc-completeness finding in the sidecar), no operator will know to look.

**Suggested backlog grouping**: `AlertManager hardening sprint` — pair with REFACTOR-082 (the original sibling-unprotected finding) and REFACTOR-073 (no boot-time security-posture validator). Doc companion in DOC-NNN for the operator-warning omission.

---
