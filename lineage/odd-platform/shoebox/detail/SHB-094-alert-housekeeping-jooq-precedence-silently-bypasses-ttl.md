# SHB-094 — AlertHousekeepingJob jOOQ predicate bypasses TTL for manual RESOLVED alerts (docs-acknowledged, source-uncommented, un-tracked, untested)

**Category**: open
**Severity**: HIGH

## Hypothesis

Operators setting `housekeeping.ttl.resolved_alerts_days: 90` for compliance review expect ALL resolved alerts (manual + automatic) to remain in the database for 90 days. The actual behaviour: alerts a user manually marked `RESOLVED` are deleted on the very next 15-minute housekeeping cycle, regardless of TTL. Alerts auto-resolved by the platform (`RESOLVED_AUTOMATICALLY`) DO honour the TTL. The jOOQ predicate at `AlertHousekeepingJob.java:28-34` is `.where(STATUS.eq(RESOLVED)).or(STATUS.eq(RESOLVED_AUTOMATICALLY)).and(STATUS_UPDATED_AT.lessOrEqual(cutoff))` — SQL operator precedence binds `AND` tighter than `OR`, emitting `WHERE (STATUS='RESOLVED') OR ((STATUS='RESOLVED_AUTOMATICALLY') AND (STATUS_UPDATED_AT <= cutoff))`. The TTL gate is bypassed for the entire manual-resolved class. Live docs acknowledge this bug but the source has no `// TODO`, no GitHub-issue link, and no regression test.

## Evidence

- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/housekeeping/job/AlertHousekeepingJob.java:28-34` — the fluent-builder precedence bug; emitted SQL bypasses TTL for manual RESOLVED.
- Live `/configuration-and-deployment/odd-platform#housekeeping` (WebFetched 2026-05-19 and 2026-05-26 — verbatim): "a known platform bug currently exempts manual resolutions from the retention check — manual RESOLVED alerts are hard-deleted on the next housekeeping run regardless of this value."
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/housekeeping/job/AlertHousekeepingJob.java:1-50` — no `// TODO`, no `// BUG`, no `// FIXME`, no inline comment pointing to the docs acknowledgement or a tracking issue.
- Grep across `<odd-platform-api>/src/test` for `AlertHousekeepingJob` returns zero matches — no test pins the current buggy behaviour, no test would catch a regression of a future fix.
- Fix: parenthesise — `.where(STATUS.eq(RESOLVED).or(STATUS.eq(RESOLVED_AUTOMATICALLY))).and(STATUS_UPDATED_AT.lessOrEqual(cutoff))`. One-line.

## Notes

- This is a compliance disaster shaped finding: SOC2 / SOX / HIPAA workflows commonly require "audit-event records of resolved security alerts must be retained for N days" — ODD silently violates this for manually-resolved alerts. An operator marking an alert "I investigated this, RESOLVED" loses the trail within 15 minutes.
- Compounds with SHB-083 (Java-vs-YAML default mismatch): operator-customised application.yml that omits the TTL block produces zero-day purge of EVERYTHING; with the TTL set correctly, manual RESOLVED is still zero-day purged.
- Operator-recovery: only by querying the database directly to find rows where `STATUS = 'RESOLVED' AND STATUS_UPDATED_AT > now() - 15m`; once the cycle runs, the row is gone.
- The docs acknowledgement carries no GitHub-issue link, no fix-roadmap entry, no workaround — operators reading the docs learn the bug exists but cannot track or contribute to a fix.
- Cross-link to F-010 (housekeeping cycle) — F-010 anchors the cycle but does not surface this specific drift class as a feature facet.
- Confidence on the precedence semantics is HIGH (basic jOOQ + SQL); the docs acknowledgement is PRIMARY-SOURCE evidence that the maintainer is aware.

## Next

1. **REFACTOR-142** is already filed for this; this thread anchors the feature-side view. **ENRICH F-010** with this drift facet (`alert_housekeeping_jooq_precedence_bypasses_ttl_for_manual_resolved`).
2. **REFACTOR-NNN**: ship the one-line parenthesisation fix; add a regression test fixture seeding manual + automatic RESOLVED alerts at varying ages, asserting only the auto-resolved past-cutoff entries are deleted.
3. **DOC-NNN**: link the docs acknowledgement to a tracked upstream issue; add an inline `// TODO(bug-NNN): operator-precedence — manual RESOLVED bypasses TTL` in source until fixed.
4. **TEST-GAP-NNN**: pin the CURRENT buggy behaviour first (regression-pin BEFORE the fix); flip to pin the corrected behaviour after the fix ships.

## Links

- cluster_with: [F-010, SHB-083]
- merged_into: (open)
- supersedes: []
