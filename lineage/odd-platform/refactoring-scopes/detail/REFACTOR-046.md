- **REFACTOR-046** (NEW 2026-05-10A): Collector token rotation is not audit-logged — no `log.*` call on the regenerate path; the `TOKEN.updated_by` column is the only forensic trail and is overwritten on each rotation
  - **Category**: missing-audit
  - **Surfaced by**:
    - `odd-platform__java__CollectorController__controller-method__regenerateCollectorToken.md:bugs_limitations_corner_cases.[1]` (severity HIGH)
    - `odd-platform__java__CollectorController__controller-method__regenerateCollectorToken.md:security.known_security_gaps.[2]` (severity HIGH)
  - **Statement**: `grep` for `log.(info|warn|debug|error)` against CollectorController, CollectorServiceImpl, TokenGeneratorImpl, ReactiveTokenRepositoryImpl returned zero matches. The TOKEN row's `updated_by` column captures the actor username from `AuthIdentityProvider.getCurrentUser()` — the only forensic trail — but `updated_by` is overwritten on the next rotation, so the audit trail is single-state, not append-only. A security-incident review of "who rotated token X 30 days ago" cannot answer from production data.
  - **Evidence**: `TokenGeneratorImpl.java:28-52` (no log calls) + `CollectorServiceImpl.java:82-90` (no log calls) + `CollectorController.java:47-51` (no log calls)
  - **Existing-ADR-or-implied-prescription**: None defends the absence. ADR-CANDIDATE-017 (token rotation semantics) describes the structural decisions; audit logging is not part of those decisions and the absence is a gap.
  - **Proposed remedy**: Add INFO-level audit log at the regenerate boundary: `log.info("[token-rotation] collectorId={} actor={}", collectorId, currentUsername)`. Optionally append to a dedicated `audit_log` table for query-able forensic history (so rotation history beyond the most-recent state is recoverable). Document on the live `enable-security` page that rotation is logged.
  - **Severity rationale**: HIGH — investigation-readiness gap on a credential-rotation surface. An attacker who rotates collector tokens to disrupt ingestion (REFACTOR-049 + REFACTOR-064 amplifier path) leaves no application-side trail.
  - **Suggested backlog grouping**: `Token rotation hardening`

---

## STRENGTHENS — Batch ZB (2026-05-21) — the DataSource token-rotation path has the SAME audit silence; the gap is platform-wide across both credential families

**New surfaced_by**:
- `odd-platform__java__DataSourceController__controller-method__regenerateDataSourceToken.md:bugs_limitations_corner_cases.[3]` (HIGH) — "Token rotation emits NO Activity Event and writes NO audit log line. The `token` row's `updated_by` column ... is the ONLY forensic trail, and it is OVERWRITTEN on the next rotation — the audit record is single-state, not append-only. A security review of 'who rotated data-source token X, and who rotated it before that' cannot be answered from production data. No `log.info/warn` exists on the path (DataSourceController / DataSourceServiceImpl / TokenGeneratorImpl / ReactiveTokenRepositoryImpl carry no log call on the rotation path)."
- `odd-platform__java__DataSourceController__controller-method__regenerateDataSourceToken.md:security.known_security_gaps` (HIGH) — confirms the no-audit / single-state-`updated_by` gap for the data-source token rotation.

**Why a STRENGTHEN, not a new entry**: the same four classes (`*Controller`, `*ServiceImpl`, `TokenGeneratorImpl`, `ReactiveTokenRepositoryImpl`) carry zero `log.*` and emit zero Activity Event on BOTH the Collector and the DataSource rotation paths — `TokenGeneratorImpl` and `ReactiveTokenRepositoryImpl` are literally shared. The fix (an INFO-level audit log + optional append-only audit table) at the shared generator/repository tier remediates both. The scope's title should be re-scoped on triage to "ODD token rotation (every `token` row — Collector + DataSource)".

**Severity unchanged: HIGH** — the credential-rotation surface is now confirmed forensically-invisible across both credential families. Pairs with the REFACTOR-049 strengthen (DISABLED-mode rotation under DISABLED writes `updated_by` NULL — even the single-state trail is empty).

---
