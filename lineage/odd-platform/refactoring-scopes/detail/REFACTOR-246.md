## REFACTOR-246 — `AlertServiceImpl.updateStatus` under `auth.type=DISABLED` proceeds with `status_updated_by=null` — audit-attribution loss on the user-driven mutation path

**Severity**: MEDIUM
**Category**: missing-audit + auth-mode-gap
**Surfaced by**:
- `AlertServiceImpl.md:bugs_limitations_corner_cases[4]`
- `AlertServiceImpl.md:security.known_security_gaps[4]`

**Description**: `AlertServiceImpl.updateStatus` (lines 111-136) is the user-driven path for changing an alert's status. Line 117 calls `authIdentityProvider.getCurrentUser()` which returns `Mono.empty()` under `auth.type=DISABLED` (the shipped default per ADR-CANDIDATE-029). Line 119's `switchIfEmpty(alertRepository.updateAlertStatus(alertId, status, null))` fallback proceeds with `username=null`. The activity-feed row (emitted via the `@ActivityLog(ALERT_STATUS_UPDATED)` AOP) records the `dataEntityId` and the new status but cannot attribute the change to an actor.

Compounding factors:
- Under DISABLED (default deployment per REFACTOR-068 + REFACTOR-029), the entire `/api/alerts/{id}/status` endpoint is reachable by ANY network probe (SecurityConstants rule bypassed per REFACTOR-185).
- The controller carries no `@PreAuthorize` (per ADR-CANDIDATE-002 wiring at SECURITY_RULES; under DISABLED the SECURITY_RULES table is not consulted).
- Combined: under DISABLED, an anonymous remote caller can mutate any alert's status (open → resolved or vice versa) and leaves NO actor attribution in the activity feed.
- This compounds with REFACTOR-024 (cross-owner alert read): the attacker can list every open alert, pick a target, and silently close it without trace.

The behaviour is INTENTIONAL for system-context callers (background jobs, reconciliation processes) that legitimately have no associated user. The intent is captured in the `switchIfEmpty(... null)` pattern — the code is structurally explicit about the null-actor case. BUT the operator-facing UX is broken: under DISABLED (a legitimate deployment mode per ADR-CANDIDATE-029), the audit trail loses the actor signal entirely.

**Primary source citations**:
- `AlertServiceImpl.java:117-119` — the switchIfEmpty(... null) fallback
- `AlertController.java:1-58` — no security annotations (per neighbour sidecar `AlertController.changeAlertStatus`)
- `DisabledAuthSecurityConfiguration.java:14-17` — DISABLED-mode bypass (cross-reference)
- `AlertStatusUpdatedHandler.java:30, 40` — the activity-handler emission that records dataEntityId + status but not actor when null
- composes with REFACTOR-188 (no RBAC audit log — same forensic-silence pattern at the RBAC tier)

**Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-029 (DISABLED-as-shipped-default) is the architectural intent. The ADR's stance is "DISABLED is dev/demo only — operators MUST set auth.type for production." But the live security doc does NOT warn operators that under DISABLED the alert-mutation audit trail loses actor attribution. The mitigation is purely guidance-based; the code accepts the null-actor case.

**Proposed remedy**: Three options:
1. **DOC-ALIGN (cheapest)** — update the live `/configuration-and-deployment/enable-security` page to warn that under DISABLED, the alert-mutation audit trail loses actor attribution. Pair with the REFACTOR-185 doc tranche.
2. **System-actor attribution (defensive)** — replace the `null` in the switchIfEmpty fallback with a sentinel string like `"SYSTEM"` or `"ANONYMOUS_DISABLED_MODE"` so the activity row carries a deterministic non-null actor. Operators investigating the audit log can grep for the sentinel and know "this came from DISABLED mode." Trade-off: the row no longer indicates "no user" but instead indicates "DISABLED mode" — a different forensic signal.
3. **Reject under DISABLED (strictest)** — wrap `updateStatus` with a check: if `auth.type=DISABLED` AND no system-context, reject with 403. Trade-off: breaks legitimate system-context callers (background jobs) under DISABLED. Requires distinguishing user-driven from system-context calls, which is not currently structurally possible (the service is invoked from controllers AND from ingestion processors; today no flag distinguishes them).

Option (1) is the cheapest and aligns with ADR-CANDIDATE-029's "DISABLED is dev-only" framing. Option (2) is the strongest forensic improvement. Option (3) is the strictest but requires structural changes.

**Severity rationale**: MEDIUM — gated on the "DISABLED is dev/demo only" guidance being followed. Operators who mis-set the flag in production accept anonymous alert mutation with no audit. The defence is purely the operator's deployment discipline; the platform offers no boot-time validator (per REFACTOR-073).

**Suggested backlog grouping**: `Authorization audit batch` — pair with REFACTOR-073 (boot-time validator), REFACTOR-185 (DISABLED-mode bypass), REFACTOR-188 (RBAC audit silence). The set together describes the audit-trail gap under DISABLED.

---
