## REFACTOR-578 — `ActivityEmptyPartitionsHousekeepingJob` requires `DROP TABLE` privilege on the application's DB role; the canonical config docs page does NOT document this — least-privileged DB roles (e.g. RDS-managed Postgres) silently fail partition lifecycle without operator signal

**Severity**: MEDIUM (production-deployment surprise)
**Category**: missing-doc-prereq
**Surfaced by**:
- `ActivityEmptyPartitionsHousekeepingJob.md:security.known_security_gaps[0]` (CANARY HEADLINE — "**DDL privilege requirement is undocumented**: this job requires `DROP TABLE` privilege on `public.activity_*` partition tables — equivalently, ownership of the parent `activity` table or `superuser`. Combined with `ActivityTablePartitionManager`'s CREATE requirement (PartitionServiceImpl.java:55-66), the application's DB role must hold BOTH CREATE TABLE on `public` AND `DROP TABLE` on every partition it creates. The canonical config docs page does not enumerate this privilege requirement — operators running ODD against a managed Postgres (e.g. RDS) with a least-privileged role discover the gap only when partition lifecycle silently fails" — MEDIUM)
- `ActivityEmptyPartitionsHousekeepingJob.md:security.known_security_gaps[1]` ("**No audit log of partition DROP** — unlike data-mutation paths covered by `@ActivityLog`, this job's `DROP TABLE` against the audit-trail table itself emits ONLY `log.debug` at default-suppressed level. A compliance-aware deployment (SOX, GDPR records-of-processing) has no audit trail of WHICH partition was dropped WHEN" — MEDIUM)
- `PartitionServiceImpl.java:121-127` (the `DROP TABLE` DDL — verified raw JDBC)
- WebFetch `/configuration-and-deployment/odd-platform` (2026-05-20, status 200; verified no DB-privilege section)
- REFACTOR-090 (the related-but-different CREATE TABLE privilege gap on partition creation; the existing entry from batch 2026-05-10B)

**Description**: `PartitionServiceImpl.dropPartition(connection, partitionName)` (`:121-127`) issues:

```sql
DROP TABLE <partition_name>
```

PostgreSQL requires the issuing role to be the OWNER of the table OR a superuser. The platform's application DB role must hold one of:
- Ownership of the `public.activity` parent table (and all its child partitions, inherited via Postgres partition-table ownership).
- Membership in a role that owns the parent table.
- `superuser` (rarely granted in production).

**The undocumented requirement**: the live config docs at `https://docs.opendatadiscovery.org/configuration-and-deployment/odd-platform` (WebFetch 2026-05-20) covers:
- `odd.activity.partition-period` (the partition width).
- Various `housekeeping.ttl.*` properties.
- Datasource connection settings.
- Auth modes.

The docs do NOT enumerate the required DB privileges. Operators following the docs to deploy ODD against a managed Postgres (AWS RDS, Cloud SQL, Azure Database for PostgreSQL) typically:
- Provision a least-privileged role (e.g. `CONNECT`, `SELECT`, `INSERT`, `UPDATE`, `DELETE` on `public.*`).
- May grant `CREATE` on the schema.
- Are UNLIKELY to grant `DROP TABLE` or table-ownership.

**Operator-visible failure mode**: deployment succeeds, application boots, activity events INSERT correctly. After 30+ days (when the first past partition would be eligible for drop), the housekeeping cycle attempts `DROP TABLE` → Postgres rejects with `must be owner of table activity_YYYYMMDD_YYYYMMDD` → `PartitionServiceImpl` raises `RuntimeException` → `EmptyPartitionsHousekeepingJob.doHousekeeping` catches and logs ERROR → `HousekeepingJobManager` continues to the next job. Operator sees ZERO UI signal; only a log line buried in housekeeping output.

The activity table grows indefinitely (REFACTOR-085 compounds). The operator may not connect the dots between "ODD's activity table is huge" and "I need to grant DROP TABLE privilege" until manual investigation.

**Cross-cutting context**: This is the **undocumented-DB-prerequisite defect class**. Combined with:
- REFACTOR-090 (the related CREATE TABLE privilege requirement from batch B).
- REFACTOR-085 (activity table monotonic growth — compounded by this failure).
- REFACTOR-086 (silent-fail swallow on partition CREATE — same observability gap on the create side).

The collective fix is a documentation pass on "required DB privileges for ODD deployment".

**Primary source citations**:
- `PartitionServiceImpl.java:121-127` (verified `DROP TABLE` DDL — no `IF EXISTS`, no privilege-check)
- `EmptyPartitionsHousekeepingJob.java:30-32` (the RuntimeException catch — silent-fail)
- `HousekeepingJobManager.java:42-46` (the per-job error catch — logs ERROR, continues to next job)
- WebFetch `/configuration-and-deployment/odd-platform` (2026-05-20, status 200; verified absent DB-privilege section)
- Postgres documentation on `DROP TABLE` permissions
- REFACTOR-090 (the related CREATE side from batch B)

**Existing-ADR-or-implied-prescription**: NONE. The doc-gap is incidental.

**Proposed remedy**: Two options:

1. **LOWEST cost — Add a "Required DB privileges" section to the deployment docs**:
   Update `https://docs.opendatadiscovery.org/configuration-and-deployment/odd-platform` (or create a new "Database prerequisites" section) listing:
   ```
   The ODD application's DB role must hold the following privileges:
   - CONNECT on the target database.
   - USAGE + CREATE on the schema (default: public).
   - SELECT + INSERT + UPDATE + DELETE on all tables matching the platform's migration schema.
   - **For activity-feed partition lifecycle**: ownership of the `activity` parent table (or DROP TABLE privilege on `activity_*` partition tables) — required for the housekeeping subsystem's empty-partition cleanup.
   - **For replication-slot-based notifications**: REPLICATION privilege (only if `notifications.enabled=true`).
   ```
   Effort: small (one doc-section addition).

2. **MEDIUM cost — Add boot-time privilege check + WARN/FAIL**:
   On `@PostConstruct`, attempt a no-op `DROP TABLE IF EXISTS odd_privilege_check_xxx` (random name; pre-creating then dropping). If Postgres rejects → log a WARN at boot indicating "DROP TABLE privilege not granted; partition lifecycle will silently fail; see docs". Optional fail-fast posture: refuse to boot if `housekeeping.enabled=true` but DROP privilege is missing.
   Effort: medium (one boot-validator bean + integration test).

**Recommended**: Option 1 (doc fix) + Option 2 (boot-time WARN) — Option 1 closes the immediate doc-gap; Option 2 catches the production failure mode loud at boot.

**Severity rationale**: MEDIUM — production-deployment surprise. Severity is bounded by:
- The failure mode is silent — operators discover it via REFACTOR-085-shape growth investigation, not via direct error.
- The fix is incremental (doc + boot-check).
- The cost is borne by operators following the docs literally; teams familiar with Postgres lifecycle requirements may already know.

**Suggested backlog grouping**: `DOC-NNN deployment-docs hardening sprint`. Pair with REFACTOR-090 (CREATE TABLE privilege docs), REFACTOR-086 (silent-fail observability on create), REFACTOR-085 (activity growth — the compounded consequence).

---
