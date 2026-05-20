## REFACTOR-233 — `ReactiveAlertRepositoryImpl.listByOwner` empty-result counter uses platform-wide count, not owner-scoped count — UX badge misreports total when caller's owner has zero alerts

**Severity**: MEDIUM
**Category**: ux-bug (label-asymmetry / wrong-count)
**Surfaced by**:
- `ReactiveAlertRepositoryImpl.md:bugs_limitations_corner_cases[5]`
- `ReactiveAlertRepositoryImpl.md:performance.known_performance_gaps[0]`

**Description**: `ReactiveAlertRepositoryImpl.listByOwner` (lines 160-179) passes `countAlertsWithStatusOpen()` (line 177) into `pageifyResult` as the `emptyRecordTotalCounter`. The expected method is `countAlertsWithStatusOpenByOwner(ownerId)`. `pageifyResult` (`JooqQueryHelper.java:119-127`) only consults the `emptyRecordTotalCounter` WHEN the records list is empty — meaning the bug manifests only on the empty-owner-result path.

When the caller's owner has zero open alerts (a new user, a recently-deleted alert set, or any user with no platform-wide alert ownership), the response's `Page.total` reports the **platform-wide open-alert count** instead of zero. The UI's pagination badge (e.g. "Showing 0 of 142 alerts") silently misreports — the user sees "142 alerts exist for me" when in fact the platform has 142 alerts total and the user owns 0.

The bug is latent for users who own at least one alert (the non-empty branch returns the per-page slice's `COUNT(*) OVER ()` correctly from the window-function pagination). It surfaces only when the owner-scope returns empty.

**Primary source citations**:
- `ReactiveAlertRepositoryImpl.java:160-179` — the full `listByOwner` body
- specifically line 177: `countAlertsWithStatusOpen()` instead of `countAlertsWithStatusOpenByOwner(ownerId)`
- `ReactiveAlertRepositoryImpl.java:269-279` — the correct `countAlertsWithStatusOpenByOwner` method that is NOT being called
- `JooqQueryHelper.java:119-127` — `pageifyResult(records, recordMapper, emptyRecordTotalCounter)` semantics

**Existing-ADR-or-implied-prescription**: implicit — the `listByOwner` family is designed to report owner-scoped counts (see the symmetric `countAlertsWithStatusOpenByOwner` method exists). The bug is a wiring oversight.

**Proposed remedy**: One-character fix:
```java
// before:
.pageifyResult(records, alertMapper, countAlertsWithStatusOpen());
// after:
.pageifyResult(records, alertMapper, countAlertsWithStatusOpenByOwner(ownerId));
```

Add a regression test in the (not-yet-existing — see REFACTOR-244) `ReactiveAlertRepositoryImpl` test class:
1. Create alerts attributed to owner-A.
2. Call `listByOwner(owner-B, page=1, size=10)` for a different owner-B with zero alerts.
3. Assert the returned `Page.total == 0`.

**Severity rationale**: MEDIUM — UX defect that produces user-visible incorrect counts. Operators see "142 alerts for me" + "0 results on this page" + "no way to navigate to them" — the inconsistency is confusing and may drive support tickets. Bonus performance impact: the empty-result path triggers an unnecessary platform-wide COUNT query (`countAlertsWithStatusOpen` — full ALERT table scan with WHERE STATUS=OPEN) instead of the cheaper owner-scoped COUNT (which uses the OWNERSHIP join's index).

**Suggested backlog grouping**: `Alert reliability cleanup` — pair with REFACTOR-037 (the reopen-guard race; same controller surface, same caller-experience domain).

---
