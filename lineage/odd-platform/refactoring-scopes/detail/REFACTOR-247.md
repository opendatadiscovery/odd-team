## REFACTOR-247 — `AlertServiceImpl.getTotals.total` exposes platform-wide alert count via the badge counter — strengthens REFACTOR-024 with a NEW surface

**Severity**: LOW (UX consequence already part of REFACTOR-024 family; LOW for this specific surface)
**Category**: enumeration-vector
**Surfaced by**:
- `AlertServiceImpl.md:bugs_limitations_corner_cases[6]`
- `AlertServiceImpl.md:security.data_exposure[1]`
- `AlertServiceImpl.md:security.owner_scoping` (the "MIXED — total is platform-wide" finding)

**Description**: `AlertServiceImpl.getTotals` (lines 90-109) returns three counts in parallel: `total` (platform-wide), `myTotal` (caller's owner), `dependentTotal` (caller's downstream lineage). The `total` is computed via `alertRepository.countAlertsWithStatusOpen()` (line 91) which has NO owner argument — the count is across the entire platform.

The badge counter (the UI's top-bar alert indicator) renders this `total` value. Under LOGIN_FORM/OAUTH2/LDAP, any authenticated user sees the platform-wide open-alert count. Under DISABLED, any anonymous caller sees it via the unauth `/api/alerts/totals` endpoint.

This is the same shape as REFACTOR-024 (`getAllAlerts` cross-owner read) but with a smaller payload — a single integer count instead of the full alert list. The integer is less individually-identifying but enables ENUMERATION-style probing:
- An attacker monitors `total` over time to infer when new alerts are created (timing side-channel).
- A user with no associated owner sees `myTotal=0` and `dependentTotal=0` but the platform-wide `total` reveals the platform's alert volume.

The asymmetry is intentional in shape — the maintainer's choice to expose three counts in one call is for UI ergonomics — but the platform-wide nature of `total` is the same posture as REFACTOR-024.

**Primary source citations**:
- `AlertServiceImpl.java:90-109` — the getTotals body with three concurrent counts
- `AlertServiceImpl.java:91` — `alertRepository.countAlertsWithStatusOpen()` (no owner argument)
- `AlertServiceImpl.java:95-102` — countByOwner + countDependent (owner-scoped, with .defaultIfEmpty(0L) fallback)
- batch H sidecar `ReactiveAlertRepositoryImpl.md` — confirms the SQL primary source has no owner predicate
- cross-reference REFACTOR-024 (the original cross-owner reads finding)

**Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-003 (read-collaborative-GET-uniformly-authenticated, resolved → intentional). The architectural posture defends this — the badge counter is part of the read surface. The gap is the live-doc silence on the counter; operators reading the security doc don't know "a user with no associated owner still sees the platform's total open-alert count."

**Proposed remedy**: Same as REFACTOR-024 — either (a) make the badge counter owner-scoped (`countOpenAlertsForOwner(ownerId)`) and accept the UX trade-off (badge no longer shows platform-wide volume), OR (b) accept the architectural posture and document it on the live security page. Choice (b) aligns with ADR-CANDIDATE-003's resolved-to-intentional stance.

**Severity rationale**: LOW — same surface as REFACTOR-024 family with smaller payload. The UX trap is real (a user with no associated owner sees `myTotal=0` next to `total=N` — confusing) but the data exposure is just a count.

**Suggested backlog grouping**: `Authorization audit batch` — bundle with REFACTOR-024 family + ADR-CANDIDATE-003 triage. A single doc-update pass surfaces the badge-counter aspect.

---
