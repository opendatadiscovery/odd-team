- **REFACTOR-142** (NEW 2026-05-12D): `AlertHousekeepingJob` jOOQ operator-precedence bug — the predicate chain `.where(STATUS.eq(RESOLVED)).or(STATUS.eq(RESOLVED_AUTOMATICALLY)).and(STATUS_UPDATED_AT.lessOrEqual(cutoff))` produces `(STATUS=RESOLVED) OR (STATUS=RESOLVED_AUTOMATICALLY AND cutoff)`, NOT the intended `(STATUS=RESOLVED OR RESOLVED_AUTOMATICALLY) AND cutoff`. Manual RESOLVED rows are hard-deleted on the very next 15-minute cycle. The live doc acknowledges this as "a known platform bug" but the code has no `// TODO`, no GitHub-issue link, and no test
  - **Category**: jooq-precedence-bug
  - **Surfaced by**:
    - `odd-platform__java__org_opendatadiscovery_oddplatform_housekeeping_config__config-properties-class__HousekeepingTTLProperties.md:bugs_limitations_corner_cases.[3]` (HIGH — "silent data loss for manual alert resolutions — a user marking an alert RESOLVED loses it on the next housekeeping cycle, with 30-day retention promised in docs but bypassed in code")
  - **Statement**: `AlertHousekeepingJob.java:28-34` writes a fluent-builder predicate chain that exploits jOOQ's left-to-right binding: `.where(STATUS.eq(RESOLVED)).or(STATUS.eq(RESOLVED_AUTOMATICALLY)).and(STATUS_UPDATED_AT.lessOrEqual(cutoff))`. jOOQ's `.and(...)` binds to the most recent `.or(...)`, producing the SQL predicate `(STATUS=RESOLVED) OR (STATUS=RESOLVED_AUTOMATICALLY AND STATUS_UPDATED_AT <= cutoff)`. The TTL therefore applies ONLY to RESOLVED_AUTOMATICALLY rows; manual RESOLVED rows match the first disjunct and are hard-deleted IMMEDIATELY on the very next 15-minute cycle. The live `/configuration-and-deployment/odd-platform` docs page acknowledges the bug ("a known platform bug currently exempts manual resolutions from the retention check") — but there is no test asserting the predicate's behaviour, no `// TODO` in the source, and no GitHub issue linked.
  - **Evidence**: `AlertHousekeepingJob.java:28-34` (the predicate chain) + WebFetch `/configuration-and-deployment/odd-platform` 2026-05-12 (the docs acknowledgement) + grep for `// TODO` / `// FIXME` / GitHub-issue-URL in the file returning zero matches
  - **Existing-ADR-or-implied-prescription**: None — the bug contradicts the documented 30-day retention promise. There is no ADR defending "manual resolutions should not be retained".
  - **Proposed remedy**: Parenthesise the OR-group: `.where(STATUS.eq(RESOLVED).or(STATUS.eq(RESOLVED_AUTOMATICALLY))).and(STATUS_UPDATED_AT.lessOrEqual(cutoff))` — group the OR before AND-ing the cutoff. Add a jOOQ-tested predicate-verification test that asserts the generated SQL contains exactly `((status = 'RESOLVED') OR (status = 'RESOLVED_AUTOMATICALLY')) AND (status_updated_at <= ?)`. Add an `@SqlQueryTest` or equivalent.
  - **Severity rationale**: HIGH — silent data loss for every manually-resolved alert with the 30-day retention contract from docs broken in code. Operators consulting the docs assume retention; the code violates it.
  - **Suggested backlog grouping**: `Housekeeping safety sprint`

## STRENGTHENS — HousekeepingJobManager (batch K, PRIMARY-SOURCE at AlertHousekeepingJob.java:28-34)

**Direct file:line confirmation at PRIMARY SOURCE**. The batch-D HousekeepingTTLProperties sidecar surfaced this bug from the config-properties angle (the per-key retention contract); the batch-K HousekeepingJobManager sidecar surfaces it from the ORCHESTRATOR angle and adds the EXACT primary-source code reference:

**New batch-K evidence**:
- `HousekeepingJobManager.md:bugs_limitations_corner_cases.[1]` (HIGH): "`AlertHousekeepingJob` jOOQ operator-precedence bug — known and acknowledged on docs but unfixed, untested, and untracked at the source-line. The bug lives at AlertHousekeepingJob.java:28-34: `.where(ALERT.STATUS.eq(RESOLVED)).or(ALERT.STATUS.eq(RESOLVED_AUTOMATICALLY)).and(ALERT.STATUS_UPDATED_AT.lessOrEqual(cutoff))`. jOOQ's fluent-builder precedence: `.and(...)` binds to the most recent `.or(...)`. The emitted SQL is therefore `WHERE (STATUS = 'RESOLVED') OR (STATUS = 'RESOLVED_AUTOMATICALLY' AND STATUS_UPDATED_AT <= cutoff)`. The TTL applies ONLY to `RESOLVED_AUTOMATICALLY` rows; manual `RESOLVED` rows are hard-deleted on the very next 15-minute cycle regardless of `resolvedAlertsDays`. ... This is the PRIMARY-SOURCE confirmation of REFACTOR-142."
- The orchestrator-side context (HousekeepingJobManager) confirms the bug is invisible at the orchestrator layer: per-job exception isolation (ADR-CANDIDATE-101 NEW batch K) catches any exception and continues; there is no metric, no audit. The bug is FORENSICALLY SILENT.

**Cross-batch triangulation**:
- batch-D (HousekeepingTTLProperties): config-side framing — the retention contract is 30 days
- batch-K (HousekeepingJobManager): orchestrator-side framing — the orchestrator does not detect the bug
- batch-K (HousekeepingJobManager PRIMARY SOURCE): code-side framing — the jOOQ predicate at AlertHousekeepingJob.java:28-34 is the exact bug

**Severity unchanged**: HIGH (silent data loss for manual resolutions; docs contract broken).

---
