## STRENGTHENS — HousekeepingTTLProperties sidecar in batch ZK confirms the jOOQ-precedence bug at the CONFIG-CONSUMER layer

DOC-GAP-062 originally cited two primary sources: HousekeepingTTLProperties (batch D) + HousekeepingJobManager (batch K). Batch ZK refreshes the HousekeepingTTLProperties sidecar at substrate commit `ede5d277` and adds the **stress_findings request_inputs Category-F drift confirmation** — the predicate's TRANSLATES_SILENTLY framing where `resolvedAlertsDays` is the named field promising 'all resolved alerts after N days' but the implementation filters only `RESOLVED_AUTOMATICALLY`.

### Added surfaced_by (new sidecar cited)

- `odd-platform__java__housekeeping_config__config-properties-class__HousekeepingTTLProperties.md:bugs_limitations_corner_cases.[AlertHousekeepingJob jOOQ operator-precedence bypass]` (HIGH per sidecar — verbatim: "**`AlertHousekeepingJob` jOOQ operator-precedence bypass — known + docs-acknowledged, un-tested, un-tracked**. AlertHousekeepingJob.java:28-34: `.where(STATUS.eq(RESOLVED)).or(STATUS.eq(RESOLVED_AUTOMATICALLY)).and(STATUS_UPDATED_AT.lessOrEqual(cutoff))`. SQL operator precedence: `AND` binds tighter than `OR`. Emitted SQL: `WHERE (STATUS = 'RESOLVED') OR ((STATUS = 'RESOLVED_AUTOMATICALLY') AND (STATUS_UPDATED_AT <= cutoff))`. The TTL gate is bypassed for manual `RESOLVED` rows; they are deleted on the next 15-minute cycle regardless of `resolvedAlertsDays`. Docs page acknowledges this (WebFetched 2026-05-26). Fix: parenthesise — `.where(STATUS.eq(RESOLVED).or(STATUS.eq(RESOLVED_AUTOMATICALLY))).and(STATUS_UPDATED_AT.lessOrEqual(cutoff))`.")
- `odd-platform__java__housekeeping_config__config-properties-class__HousekeepingTTLProperties.md:stress_findings.request_inputs[resolvedAlertsDays]` — **NEW CATEGORY F TRANSLATES_SILENTLY framing**: "TRANSLATES_SILENTLY. The name promises 'all resolved alerts after N days'. The implementation filters by TTL only the auto-resolved subset — manual `RESOLVED` rows are deleted on the next cycle regardless of N due to the precedence bug. The field name does NOT communicate this caveat; the live docs acknowledge it as a 'known platform bug'." routes_to_finding `bugs_limitations_corner_cases.[2]` + `docs_link_semantic.doc_drift_findings.[3]`.
- `odd-platform__java__housekeeping_config__config-properties-class__HousekeepingTTLProperties.md:docs_link_semantic.doc_drift_findings[AlertHousekeepingJob jOOQ-precedence bug acknowledged but un-tracked]` — verbatim doc-drift quote re-confirmed: "docs acknowledge 'manual RESOLVED alerts are hard-deleted on the next housekeeping run regardless of this value'. Code site is AlertHousekeepingJob.java:28-34. The acknowledgement carries no GitHub issue link, no `// FIXME` / `// TODO` in source, no workaround."

### New evidence (supplementary)

- **WebFetch re-verification 2026-05-26**: the live page `https://docs.opendatadiscovery.org/configuration-and-deployment/odd-platform` status **200** — verbatim docs acknowledgement re-confirmed (no edit since DOC-GAP-062 batch D + K). The acknowledgement is still present without tracking link.
- **Category F (TRANSLATES_SILENTLY) framing strengthens the case for the doc-rewrite + tracking issue**: the LSN-020 family naming-vs-implementation lens is the canonical case-law class for fields whose name promises a different scope than the implementation delivers. The fix shape remains: parenthesise the predicate (one-line jOOQ refactor) + file `/log-issue odd-platform` to create the tracking issue.

### Severity update

Severity remains **HIGH** — primary-source re-confirmation does not change the assessment. The Category F framing adds a structural-dimension to the existing analysis but no new severity vector.

---

**Batch ZK contribution**: 1 PRIMARY SOURCE re-confirmation at substrate commit `ede5d277` + Category F TRANSLATES_SILENTLY framing addition; coverage unchanged (2 sidecars: HousekeepingTTLProperties + HousekeepingJobManager); evidence chain reinforced; severity unchanged (HIGH).
