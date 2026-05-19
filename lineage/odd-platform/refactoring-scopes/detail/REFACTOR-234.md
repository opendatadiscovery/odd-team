## REFACTOR-234 — `ReactiveAlertRepositoryImpl.createAlerts` has no idempotency on AlertManager webhook retries — INSERT without ON CONFLICT; Prometheus retry produces duplicate ALERT rows

**Severity**: MEDIUM
**Category**: idempotency
**Surfaced by**:
- `ReactiveAlertRepositoryImpl.md:bugs_limitations_corner_cases[2]`

**Description**: `createAlerts` (`ReactiveAlertRepositoryImpl.java:332-342`) builds a sequence of `insertStep.set(alertRecord).newRecord()` calls followed by a final `.returning(ALERT.fields())`. There is no `.onConflict(...)` clause and no equivalent SELECT-then-INSERT idempotency check.

Two paths reach this method:
1. **Ingestion path** — `AlertServiceImpl.applyAlertActions` (lines 201-231) uses `AlertActionResolver` which de-duplicates at the application layer before calling the repository. The ingestion-path idempotency is provided by the resolver. This path is fine.
2. **AlertManager webhook path** — `AlertServiceImpl.handleExternalAlerts` (lines 153-191) does NOT use `AlertActionResolver`. It constructs new AlertPojo instances directly from each `ExternalAlert` in the payload and calls `createAlerts` with no de-duplication.

Prometheus AlertManager retries failed webhook deliveries (typical retry interval: 30-90 seconds for transient failures). Each retry POSTs the same payload (same `fingerprint`, same `entity_oddrn`, same `labels`). The platform creates a duplicate ALERT row on each retry. There is no `(data_entity_oddrn, external_alert_fingerprint, status='OPEN')` UNIQUE constraint to back-stop. There is no application-level "have I seen this fingerprint before?" check.

The consequence: a single Prometheus alert firing during a network blip produces 2-N duplicate OPEN alerts in the ODD platform. Operators triaging see N copies of the same alert, must close them individually, and the `lastReason` / `lastCreatedAt` timestamps drift across the duplicates.

Compounding: REFACTOR-231 (above) covers the broader auth/validation gap on the same webhook path. This finding is narrower: even WITH auth and validation in place, the de-duplication still wouldn't fire because the SQL has no idempotency contract.

**Primary source citations**:
- `ReactiveAlertRepositoryImpl.java:332-342` — the raw `INSERT … RETURNING` with no ON CONFLICT
- `AlertServiceImpl.java:153-191` — `handleExternalAlerts` (webhook path) with no resolver
- `AlertServiceImpl.java:201-231` — `applyAlertActions` (ingestion path, uses resolver)
- AlertManager retry contract: <https://prometheus.io/docs/alerting/latest/configuration/#http_config> (retries on 5xx; backoff is configurable)
- contrast: `ReactiveOwnershipRepositoryImpl.java:69-81` — uses `.onConflictOnConstraint(...).doUpdate()` for the UPSERT semantic; the codebase has precedent for ON CONFLICT but createAlerts doesn't use it

**Existing-ADR-or-implied-prescription**: implicit — the codebase has the ON CONFLICT precedent (Ownership UPSERT, lineage `onDuplicateKeyIgnore`). The webhook path is unique in lacking it. No comment defends the absence; this is a refactoring within the existing pattern, not a structural change.

**Proposed remedy**: Composite fix paired with REFACTOR-231:
1. **Add `external_alert_fingerprint` column** to ALERT (nullable for ingestion-driven alerts; required for webhook alerts). Schema migration: `ALTER TABLE alert ADD COLUMN external_alert_fingerprint VARCHAR(255)`.
2. **Add a partial UNIQUE index** that prevents duplicates only within the OPEN status (so resolved-then-reopened alerts can be tracked): `CREATE UNIQUE INDEX alert_external_fingerprint_unique ON alert (external_alert_fingerprint) WHERE status = 'OPEN' AND external_alert_fingerprint IS NOT NULL`.
3. **Change `createAlerts` to use `.onConflict(...).doUpdate()`** when invoked from the webhook path: keep the latest payload's `lastReason` / `lastCreatedAt` / chunk content, but don't insert a new row.
4. **Add a regression test** asserting that two POSTs with the same fingerprint produce a single ALERT row.

The fix re-uses the codebase's existing UPSERT pattern (Ownership repository) — no new architectural commitment.

**Severity rationale**: MEDIUM — operator UX degradation (duplicate alert noise) + data-integrity (the alert table grows non-monotonically with retries). Not a security issue per se, but compounds with REFACTOR-231 (anonymous remote alert injection — a malicious actor could amplify their inserted alerts by N retries against a flaky network).

**Suggested backlog grouping**: `AlertManager hardening sprint` — couple with REFACTOR-231 (auth + validation) and REFACTOR-082 (the broader unprotected-endpoint finding). All three together describe the webhook hardening surface.

---
