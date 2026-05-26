## REFACTOR-608 — `IdentityController.whoami` emits zero application log lines — anonymous probes of the identity surface invisible in application logs

**Severity**: HIGH
**Category**: missing-audit / observability
**Batch**: ZD (2026-05-25)
**Pillars affected**: [P-09 Security & Access Control (the identity-exposure surface is the canonical reconnaissance vector under DISABLED)]

**Surfaced by**:
- `odd-platform__java__IdentityController__controller-class__IdentityController.md:bugs_limitations_corner_cases.[2]` (HIGH) — "No audit log on `/api/identity/whoami` invocation. The class carries `@Slf4j` (line 19) but emits NO log statement in the controller body or the IdentityServiceImpl body (IdentityServiceImpl.java:22-53). Under DISABLED + default deployment, every anonymous probe of the identity-exposure surface is INVISIBLE in application logs. An operator forensically reconstructing a security incident cannot determine that an attacker reconnoitered the platform's auth posture via whoami probing, nor that an attacker confirmed an 'admin' identity grant."

**Statement**: `IdentityController.java:19` declares `@Slf4j` but the controller body uses no `log.info` / `log.debug` calls; `IdentityServiceImpl.java:30-52` also emits no log statements. Every anonymous probe of `/api/identity/whoami` under DISABLED is invisible in application logs. An operator forensically reconstructing a security incident cannot determine that an attacker reconnoitered the platform's auth posture via whoami probing (REFACTOR-607), nor that an attacker confirmed an 'admin' identity grant from the response (REFACTOR-185 + REFACTOR-606).

**Evidence**:
- `IdentityController.java:19` (`@Slf4j` declared)
- `IdentityController.java:24-28` (no log calls)
- `IdentityServiceImpl.java:30-52` (no log calls)

**Existing-ADR-or-implied-prescription**: REFACTOR-097 (cross-cutting "no audit logging infrastructure exists" — `grep AuditLog | @Auditable | AuthLogger | accessLog` returns zero matches) is the codebase-wide root cause. REFACTOR-608 is the IDENTITY-SURFACE FACET of REFACTOR-097.

**Proposed remedy**: Emit a `log.info("whoami invoked: principal={}, remoteAddr={}, authMode={}", principal, exchange.getRequest().getRemoteAddress(), authMode)` from `IdentityServiceImpl.whoami` (the controller's `@Slf4j` is declared but the service-level log is more useful since it has the principal data). Under DISABLED + dummyOwner, log `principal=ANONYMOUS_DUMMY_FALLBACK` so the anomaly is detectable. Alternative remedy: defer to REFACTOR-097's cross-cutting audit infrastructure (a `platform_event` table + AOP advice on every authenticated endpoint).

**Severity rationale**: HIGH — combined with REFACTOR-185 (DISABLED bypasses all gates) + REFACTOR-606 (Permission.values() dynamic admin grant) + REFACTOR-607 (auth-mode probe surface), the under-DISABLED admin grant is COMPLETELY undetectable from logs. An operator cannot answer "did an attacker confirm DISABLED + claim admin identity?" from running-platform logs.

**Suggested backlog grouping**: "Authorization audit batch" / cross-cutting "Audit logging infrastructure" (REFACTOR-097's eventual fix).
