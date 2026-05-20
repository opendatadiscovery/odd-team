## REFACTOR-327 — Housekeeping has no tamper-evident audit log of configuration changes or deletions — a malicious operator could set all TTLs to 0 and silently destroy data; compliance frameworks requiring "data deletions must be logged and reviewable" are not satisfied

**Severity**: MEDIUM
**Category**: missing-audit
**Pillars affected**: [P-08-management-administration, P-09-security-access-control]
**Batch**: K (2026-05-19)

**Surfaced by**:
- `odd-platform__java__service__service__HousekeepingJobManager.md:security.known_security_gaps.[0]` (MEDIUM) — "No tamper-evident audit log of housekeeping configuration changes or deletions — a malicious operator with `housekeeping.ttl.*` write access at deploy time (e.g. via Helm chart override, env var, or Spring Cloud Config) could set all three TTLs to `0` and the next housekeeping cycle would silently destroy all RESOLVED alert history, all search-facet history, and all soft-deleted entities (with the ~25-table cascade including OWNERSHIP relations). There is NO audit trail of the configuration change AND NO audit trail of the deletion. Compliance frameworks requiring 'changes to data retention policies must be logged and reviewable' (SOX / GDPR records-of-processing) are not satisfied."

**Description**: The housekeeping subsystem emits ONLY `log.debug("Running housekeeping jobs")` at HousekeepingJobManager.java:30 and `log.debug("... deleted N")` at the individual job level (AlertHousekeepingJob.java:45 + SearchFacetsHousekeepingJob.java:29 + DataEntityHousekeepingJob.java:128). Production logging configuration does NOT include DEBUG by default; successful cycles are SILENT in the operator log. There is NO Micrometer counter, NO Prometheus gauge, NO `@ActivityLog` event, NO tamper-evident audit-log entry recording (a) the resolved TTL values at boot time, (b) the per-cycle deletion volume, (c) the per-row deletion record. Compliance frameworks requiring data-retention-policy change audit (SOX, GDPR Article 30 records-of-processing) cannot satisfy their requirements from this code path.

**Failure mode**: A malicious operator with deploy access (or a misconfigured CI/CD pipeline) sets `housekeeping.ttl.resolved_alerts_days=0`. The next housekeeping cycle hard-deletes every RESOLVED alert. There is NO record of (a) the config change (it was a YAML edit, not a UI action) or (b) the deletion (only `log.debug` at DEBUG level which is off in production). The auditor asks "who deleted these alerts and when?" — the platform cannot answer.

**Primary source citations**:
- `HousekeepingJobManager.java` (no audit annotation, no Micrometer counter)
- `HousekeepingTTLProperties.java` (no audit annotation)
- `AlertHousekeepingJob.java + SearchFacetsHousekeepingJob.java + DataEntityHousekeepingJob.java` (none emit structured audit; all use log.debug only)

**Existing-ADR-or-implied-prescription**: None. ADR-CANDIDATE-046 (housekeeping opt-out) and ADR-CANDIDATE-101 (per-job failure isolation) defend the shipping + failure-handling stances; the audit gap is a feature absence. Cross-link with REFACTOR-188 (no audit logging on RBAC mutations — REFINED in batch F: RBAC-tier specifically) — the audit-log absence is broader than RBAC; housekeeping is the data-DELETION audit gap.

**Proposed remedy**: Three composable fixes. (a) **Boot-time config audit**: emit `INFO: HousekeepingTTLProperties resolved as {resolvedAlertsDays=30, searchFacetsDays=30, dataEntityDeleteDays=30}` at boot; log to a tamper-evident structured log channel (audit log, not application log). (b) **Per-cycle deletion audit**: emit `audit.housekeeping.cycle{table=alert, deleted_count=N, cutoff_timestamp=T, cycle_started_at=...}` Micrometer counter + structured log entry per cycle per table. (c) **Configuration-change audit**: when `housekeeping.ttl.*` changes between boots (compare current values against previous-boot snapshot stored in DB), emit `audit.housekeeping.config_changed{key, old, new, changed_at, changed_by_source}`.

**Severity rationale**: MEDIUM — compliance-relevant; affects operators in regulated industries; the absence is uniform across the housekeeping subsystem and is the data-deletion-audit gap that REFACTOR-188 did not cover.

**Suggested backlog grouping**: `Cross-cutting observability sprint` (with REFACTOR-097, REFACTOR-188, REFACTOR-313) + `Housekeeping safety sprint`

---
