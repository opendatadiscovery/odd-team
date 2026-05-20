## REFACTOR-322 — Activity-feed `@ActivityLog` AOP advice runs INSIDE the `@ReactiveTransactional` boundary — a transaction-rollback would also roll back the activity row; operators auditing "who tried to create this ownership" see no record of failed attempts

**Severity**: LOW
**Category**: observability (audit-rollback-coupling)
**Pillars affected**: [P-07-active-platform-features, P-09-security-access-control]
**Confidence**: LOW (the AOP-advice ordering semantics are inferred from the annotation source order; verification requires advice-layer inspection)
**Batch**: K (2026-05-19)

**Surfaced by**:
- `odd-platform__java__service__service__OwnershipServiceImpl.md:bugs_limitations_corner_cases.[6]` (LOW, confidence LOW) — "Activity-feed AOP advice runs INSIDE the `@ReactiveTransactional` boundary — a transaction-rollback would also roll back the activity row. The annotation order on each public method places `@ActivityLog` outside `@ReactiveTransactional` in source order (e.g. line 48 then 49). Whether the activity row is committed before or after the transaction boundary closes is determined by the AOP advice's implementation."

**Description**: `OwnershipServiceImpl.create` (lines 48-49), `delete` (lines 77-78), and `update` (lines 100-101) all carry `@ActivityLog` annotation AT LINE N and `@ReactiveTransactional` at line N+1. The relative AOP-advice order depends on Spring's `@Order` ordering between the two advice classes; the source order suggests `@ActivityLog` runs OUTSIDE `@ReactiveTransactional`, but the actual ordering depends on the advice's own configuration. If the activity emission runs INSIDE the transaction (because `@ReactiveTransactional`'s advice has a more specific `@Order`), a transaction failure (e.g. duplicate-key on `create` → `UniqueConstraintException` per REFACTOR-232) would roll back BOTH the ownership row INSERT AND the activity log row.

**Failure mode (depends on AOP-ordering verification)**: An operator's UI fires duplicate POST requests. The first INSERT succeeds and emits an `OWNERSHIP_CREATED` activity event; the activity row is committed. The second INSERT fails on UNIQUE constraint; if `@ActivityLog` advice runs INSIDE the `@ReactiveTransactional`, the second attempt's activity emission (which had captured the "before" state) is also rolled back. Operators auditing "who tried to create this ownership" see only the successful first attempt; the failed second attempt has no audit trail. This is the LOW-confidence scenario; verification requires inspecting the AOP advice impl.

**Primary source citations**:
- `OwnershipServiceImpl.java:47-49` (annotation order on `create`)
- `OwnershipServiceImpl.java:77-78` (annotation order on `delete`)
- `OwnershipServiceImpl.java:100-101` (annotation order on `update`)
- `ActivityLog.java:13-18` (annotation definition — no `@Order` or AOP semantics in the annotation itself; the ordering is in the advice impl)

**Existing-ADR-or-implied-prescription**: None. ADR-CANDIDATE-067 (service-layer `@ReactiveTransactional` boundary) and the implicit activity-feed pattern do not jointly define whether activity rows are inside or outside the transaction. The IMPLIED prescription is that audit events should survive transaction rollbacks (so failed attempts ARE auditable); the absence of an explicit decision is the gap.

**Proposed remedy**: Two steps. (a) **Verify**: inspect the `@ActivityLog` AOP advice implementation to determine the actual ordering — does the advice's `proceed()` happen before or after the `@ReactiveTransactional` advice's `commit()`? (b) **Codify**: if the activity row IS inside the transaction (rollback-bound), either (i) accept it as the pattern and document that failed attempts have no audit trail; OR (ii) move the activity emission OUTSIDE the transaction via a separate event-bus / sink that commits independently. The decision is operational — compliance frameworks may require audit-of-failed-attempts.

**Severity rationale**: LOW (confidence LOW) — latent observation; the actual impact depends on the AOP advice's implementation order; surfaced as a maintainer follow-up to verify and document.

**Suggested backlog grouping**: `Activity feed hardening` (cross-batch with REFACTOR-097 no-audit-codebase-wide)

---
