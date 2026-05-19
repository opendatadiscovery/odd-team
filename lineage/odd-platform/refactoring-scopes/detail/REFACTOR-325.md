## REFACTOR-325 — Housekeeping has no dry-run / no preview / no archival-before-delete — three TTL-driven jobs issue jOOQ DELETE directly; a misconfigured `housekeeping.ttl.data_entity_delete_days=1` would cascade through ~25 tables on the next 15-minute cycle with no recovery path

**Severity**: MEDIUM
**Category**: missing-validation (no-dryrun)
**Pillars affected**: [P-08-management-administration]
**Batch**: K (2026-05-19)

**Surfaced by**:
- `odd-platform__java__service__service__HousekeepingJobManager.md:bugs_limitations_corner_cases.[5]` (MEDIUM) — "No dry-run / no preview / no archival-before-delete mechanism. The three TTL-driven jobs issue jOOQ DELETE directly (`AlertHousekeepingJob.java:40-43`, `SearchFacetsHousekeepingJob.java:23-27`, `DataEntityHousekeepingJob.java:99-126`). There is no `housekeeping.dry-run=true` config that logs what WOULD be deleted, no `housekeeping.ttl.archive-table` that copies rows before delete, no operator-overrideable gate. A misconfigured `housekeeping.ttl.data_entity_delete_days=1` would immediately cascade through ~25 tables on the next 15-minute cycle with no recovery path. The LSN-001 shape applies: silent default + immediate destructive action + no preview."

**Description**: The three TTL-driven housekeeping jobs each issue `jOOQ DELETE` against their target table without a preview step:
- `AlertHousekeepingJob` — DELETE FROM alert WHERE ... (the jOOQ-precedence bug at REFACTOR-142 + the immediate purge)
- `SearchFacetsHousekeepingJob` — DELETE FROM search_facets WHERE last_accessed_at <= ?
- `DataEntityHousekeepingJob` — DELETE FROM data_entity ... CASCADE through ~25 tables (per batch-D)

There is NO `housekeeping.dry-run` config that would log "I would have deleted N rows from table T" without actually deleting; NO `housekeeping.ttl.archive-table` that COPIES rows to an `*_archived` table before DELETE; NO operator-overrideable gate to confirm the deletion volume before the cycle executes; NO 24-hour deferral window for newly-configured TTLs (so an operator who just edits `housekeeping.ttl.*` has time to roll back before the destructive action runs).

**Failure mode**: An operator types `housekeeping.ttl.data_entity_delete_days: 1` into `application.yml` (intending `100` but typo'd). The change deploys. Within 15 minutes, the next housekeeping cycle hard-DELETEs every data entity that has been in `DELETED` status for 1+ days. The ~25-table CASCADE removes lineage edges, metadata values, ownerships, tags, terms, alerts, messages, metrics, attachments, task runs, group relations. Recovery is from DB backup, requiring downtime + replay of any data ingested since the backup.

**Primary source citations**:
- `HousekeepingJobManager.java:25-39` (no dry-run check before invoking `housekeepingJob.doHousekeeping(connection)`)
- `AlertHousekeepingJob.java:40-43` (the direct DELETE)
- `DataEntityHousekeepingJob.java:99-126` (the cascade)
- `SearchFacetsHousekeepingJob.java:23-27` (the direct DELETE)

**Existing-ADR-or-implied-prescription**: None. ADR-CANDIDATE-046 (housekeeping opt-out by shipped default) is the deployment-architecture decision; ADR-CANDIDATE-101 (per-job failure isolation) is the failure-handling stance. Neither defends the absence of a preview / dry-run mechanism. LSN-001 (attachment-storage default that silently wiped production data) is the canonical case-law for "silent default + immediate destructive action + no preview" — this finding is the same shape.

**Proposed remedy**: Three composable fixes. (a) **Dry-run config**: add `housekeeping.dry-run: false` (default) → `true` mode that logs `WARN: would have deleted N rows from {table}` without executing the DELETE. Operators can set dry-run on a freshly-deployed change for one cycle to verify the volume. (b) **Archive-before-delete**: add `housekeeping.ttl.archive-enabled: false` (default) → optional COPY to `{table}_archived` before DELETE; archived rows retained for an operator-configurable additional window. (c) **TTL-change deferral**: at boot, detect changes to `housekeeping.ttl.*` from the previous run; defer the new TTLs by 24 hours so operators have time to roll back typos. Boot-time validator pairs with REFACTOR-073.

**Severity rationale**: MEDIUM — LSN-001 shape (silent default × immediate destructive action × no preview). The opt-out stance (per ADR-CANDIDATE-046) makes this scope more load-bearing: housekeeping ships ON, so the absence of a safety net is on the default deployment path.

**Suggested backlog grouping**: `Housekeeping safety sprint` (the high-priority cluster: REFACTOR-141 + REFACTOR-142 + REFACTOR-145 + this + REFACTOR-326)

---
