## REFACTOR-576 — `PartitionServiceImpl.getEmptyPastPartitions` matches `LIKE 'activity_%'` — pattern matches non-partition tables; a manually-created `activity_archive_v1` named with 3 underscore-parts may either crash the parser OR be auto-dropped silently

**Severity**: LOW (requires manual operator intervention to trigger)
**Category**: fragile-parsing
**Surfaced by**:
- `ActivityEmptyPartitionsHousekeepingJob.md:bugs_limitations_corner_cases[3]` (CANARY HEADLINE — "**`LIKE 'activity_%'` matches more than partition tables** — the pattern matches ANY table name starting with `activity_`, including a hypothetical manually-created `activity_archive`, `activity_export`, etc. If such a table is empty AND its name has exactly 3 underscore-separated parts (e.g. `activity_archive_v1`), the `getLastPartitionDate` parser at PartitionServiceImpl.java:72-80 will attempt to parse `v1` as a date — raising `DateTimeParseException` wrapped to crash the cycle. If the name has the right shape AND happens to encode a past date (e.g. `activity_old_20200101`), the parser succeeds and the table is DROPPED. NO exclusion is set on this job — `exclusions()` is not overridden" — LOW)
- `ActivityEmptyPartitionsHousekeepingJob.java:9-17` (verified — no `exclusions()` override)
- `EmptyPartitionsHousekeepingJob.java:37-39` (default empty exclusions)
- `PartitionServiceImpl.java:73-80` (the brittle name parser)
- `MessageEmptyPartitionsHousekeepingJob.java:22-25` (the Message variant DID add an exclusion for `MESSAGE_PROVIDER_EVENT`)

**Description**: `PartitionServiceImpl.getEmptyPastPartitions(connection, targetTable, exclusions)` (`:82-118`) queries `information_schema.tables`:

```sql
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name LIKE 'activity_%'
```

The `LIKE 'activity_%'` pattern matches ANY table name starting with `activity_`. For the activity-partition variant of the job (`ActivityEmptyPartitionsHousekeepingJob`), the intended targets are partition tables named `activity_YYYYMMDD_YYYYMMDD` (e.g. `activity_20240101_20240301`). The pattern WILL ALSO match:

- `activity_archive` (a hypothetical operator-created archive table).
- `activity_export` (a hypothetical operator-created export staging table).
- `activity_legacy_2020` (a hypothetical operator-created backup).
- Any other operator-created table with the `activity_` prefix.

The downstream `getLastPartitionDate(name)` at PartitionServiceImpl.java:73-80 parses the table name:

```java
String[] parts = name.split("_");
if (parts.length == 3) {
  return LocalDate.parse(parts[2], DateTimeFormatter.BASIC_ISO_DATE);
}
return null;  // not a partition; skip
```

The parser expects exactly 3 underscore-separated parts. The behaviour on operator-created tables:

- `activity_archive` → 2 parts → returns null → skipped (job ignores; safe).
- `activity_archive_v1` → 3 parts → tries to parse "v1" as date → **DateTimeParseException** → crashes the cycle.
- `activity_old_20200101` → 3 parts → parses "20200101" as a valid past date → **the table IS classified as a past partition** → empty-check fires → if empty, **the table is DROPPED silently**.

**Operator-visible consequences**:

1. **Crash path**: an operator creates `activity_archive_v1` for legitimate reasons (e.g. data export staging); the next 15-minute housekeeping cycle fails with `DateTimeParseException` wrapped in a `RuntimeException`. The cycle's remaining jobs are SKIPPED. Operator sees no UI signal; only logs.

2. **Silent-drop path**: an operator creates `activity_legacy_20200101` thinking they're naming a backup table; the next 15-minute cycle dropped the table. Operator-data lost. The operator has NO warning that names matching the pattern are at risk.

3. **The Message variant DID set an exclusion** (`MessageEmptyPartitionsHousekeepingJob.java:22-25` — overrides `exclusions()` to return `["MESSAGE_PROVIDER_EVENT"]`). Verifies the architectural pattern that subclasses SHOULD set exclusions for known-conflicting names. The Activity variant DID NOT — implicit gap.

**Cross-cutting context**: This is the **pattern-match-over-name defect class**. Combined with `DROP TABLE` having no `IF EXISTS` (REFACTOR-???), this is a brittle path.

**Primary source citations**:
- `ActivityEmptyPartitionsHousekeepingJob.java:9-17` (verified — no `exclusions()` override)
- `EmptyPartitionsHousekeepingJob.java:37-39` (default empty exclusions)
- `PartitionServiceImpl.java:89-91` (the `LIKE 'activity_%'` pattern)
- `PartitionServiceImpl.java:73-80` (the brittle name parser)
- `MessageEmptyPartitionsHousekeepingJob.java:22-25` (the CONTRAST — Message variant DID override)

**Existing-ADR-or-implied-prescription**: NONE. The defect is structural — the LIKE-pattern matching is too broad and the exclusion mechanism is per-subclass-override-only.

**Proposed remedy**: Three options:

1. **LOWEST cost — override `exclusions()` on `ActivityEmptyPartitionsHousekeepingJob`** (if any known conflicting names exist) — match the Message variant. But: there are NO known conflicting names today, so the exclusion list would be empty by default.

2. **MEDIUM cost — tighten the LIKE pattern to match only partition names**:
   ```sql
   WHERE table_name ~ '^activity_[0-9]{8}_[0-9]{8}$'
   ```
   PCRE regex matches ONLY tables with the exact partition naming convention (`activity_YYYYMMDD_YYYYMMDD`). Tables with different shapes (`activity_archive_v1`, `activity_old_20200101`) are excluded by the regex itself, not by exclusion list.

   Trade-off: Postgres regex performance is comparable to LIKE; very low marginal cost. Compatibility: tighter pattern; safer.

3. **HIGHER cost — track partition names in a metadata table**: Add a `partition_metadata` table (created by partition-lifecycle code) that tracks which partitions THIS PLATFORM created. Housekeeping queries `partition_metadata` directly instead of `information_schema.tables`. Decoupled from operator-naming. Architecturally heavy.

**Recommended**: Option 2 (tighter regex) — minimal change, high safety improvement. Combined with REFACTOR-557 (race window) and REFACTOR-578 (DROP TABLE privilege docs), this completes the EmptyPartitions safety hardening.

**Severity rationale**: LOW — requires manual operator action to trigger (creating an `activity_*`-named table). Severity is bounded by:
- No production deployment is known to do this.
- The Message variant set the precedent for exclusion-list usage (operators following best practices would not create conflicting names).
- The fix is mechanical and low-risk.

**Suggested backlog grouping**: `SEC-NNN activity-partition lifecycle hardening sprint`. Pair with REFACTOR-557 (race silent-data-loss), REFACTOR-578 (DROP TABLE privilege docs), REFACTOR-577 (no metrics), REFACTOR-564 (count(*) efficiency).

---
