---
id: IT-123
title: "Under LOGIN_FORM, the SESSION cookie is HttpOnly + NOT Secure + SameSite=Lax and never ages out (timeout=-1)"
gates:
  validates: [F-087]
  enforces: []
  regresses: [PLT-074]
test_class: integration
stack: odd-loginform
automation: "e2e:session-cookie-posture.spec.ts"
plan_ref: "I1 (auth-mode + authz) — session-posture slice"
status: ready
expected_result: "GREEN — the shipped posture: HttpOnly present, Secure absent, SameSite=Lax (not Strict), no Max-Age/Expires, a held cookie keeps resolving under timeout=-1. A RED means a Secure-by-default / finite-timeout / SameSite=Strict / HttpOnly-off change landed — re-scope the pin and close the PLT-074 facet."
---

# IT-123 — session cookie security posture & lifetime (F-087)

> **A feature with no screen.** There is no "Session settings" page — the product IS the
> default security posture of the credential every authenticated browser request carries,
> experienced by the platform-operator the moment ODD stands up behind a real network. The
> login form itself is Spring Security's framework-default HTML form (no React login
> component). So the operator-observable artefact is the **Set-Cookie header + the cookie's
> server-side lifetime**, asserted at the wire. SECURITY-class; responsible disclosure —
> we assert reachability + the attribute set, never dump a session value.

## 1. What this checks
Log in via Spring form-login (`POST /login`) under `auth.type=LOGIN_FORM` and assert the
`SESSION` cookie's posture + lifetime:
- **UC-008** — `HttpOnly` IS set (the one safe-by-default attribute; pinned against silent regression).
- **UC-001** — `Secure` is ABSENT (the headline insecure default: on non-HTTPS the cookie travels in clear).
- **UC-007** — `SameSite=Lax` (framework default), NOT the hardened `Strict`.
- **UC-002** — the cookie has no `Max-Age`/`Expires`, and a HELD cookie keeps resolving a
  protected endpoint — under `spring.session.timeout=-1` the session never ages out
  server-side (no inactivity expiry ever fires; a captured-and-held cookie is a permanent
  credential), and there is no operator-facing revocation endpoint for an individual session.

**Operator-facing consequence if the posture were assumed-hardened and is not:** an operator
who deploys ODD over HTTP (or terminates TLS at a proxy that does not re-stamp cookie flags)
ships a session cookie in clear (UC-001) that an attacker can capture and replay forever
(UC-002). The platform sets none of these flags itself — it has no `CookieWebSessionIdResolver`
bean (`SessionConfiguration.java` declares no Secure/SameSite/HttpOnly setter; grep
`CookieWebSession|SameSite|HttpOnly|Secure.*cookie|WebSessionIdResolver` across the repo = 0
matches) — so all of it is delegated to the deployment topology, undocumented until DOC-241.

**Ground-truth nuance (do NOT assert the ideal):** an explicit `POST /logout` carrying the
cookie DOES invalidate the server session (verified live: post-logout replay → 302; Spring's
`WebSessionServerLogoutHandler` calls `session.invalidate()`). So the F-087/H-002
contradiction is NOT "logout never works" — it is the absence of **expiry/aging** under
timeout=-1 plus the absence of **out-of-band revocation** for a leaked cookie. UC-002 pins
exactly that, not a false "logout is a no-op".

## 2. Preparation — build the test stand
- **Stack**: `odd-loginform` (`lineage/_extractor/probe-stacks/odd-loginform.docker-compose.yml`):
  postgres + the platform with `AUTH_TYPE=LOGIN_FORM` + `AUTH_LOGIN_FORM_CREDENTIALS=admin:admin`.
  Distinct ports (platform `:18082`, pg `:15434`) + project `oddlf`. The spec brings it up in
  `beforeAll` and tears it down in `afterAll`. Manually:
  `docker-compose -p oddlf -f .../odd-loginform.docker-compose.yml up -d`.
- **Shipped defaults under test** (verified inside the running image at `/app/resources/application.yml`):
  `spring.session.timeout: -1`, `session.provider: IN_MEMORY`. No cookie-attribute config anywhere.
- **Toolchain**: Node 18+ → `cd integration-tests/e2e && npm install`. No browser (REST + docker only).
- **Seed data**: none — the posture is config-shipped, not data-dependent.

## 3. Readiness check — is the stand ready?
- Platform health: `curl -fsS http://localhost:18082/actuator/health` → `{"status":"UP"}`.
- Enforcing boundary present: `curl -s -o /dev/null -w '%{http_code} %{redirect_url}' http://localhost:18082/api/owners?page=1\&size=10` → `302 .../login` (a non-whitelisted route requires auth).

## 4. Run protocol — what to run
- **Automated rail**: `cd integration-tests/e2e && PATH=... ODD_STACK_EXTERNAL=1 npx playwright test specs/session-cookie-posture.spec.ts --reporter=line` (self-contained; manages its own loginform stack, leaves odd-minimal untouched).
- **Manual (human-carryable)**:
  1. Capture the Set-Cookie attribute set:
     `curl -s -D - -o /dev/null -X POST http://localhost:18082/login --data-urlencode username=admin --data-urlencode password=admin --max-redirs 0 | grep -i set-cookie`
     → `set-cookie: SESSION=<uuid>; Path=/; HTTPOnly; SameSite=Lax` (HttpOnly present, Secure absent, SameSite=Lax, no Max-Age/Expires).
  2. Replay the held cookie against a protected endpoint:
     `curl -s -b cj.txt -o /dev/null -w '%{http_code}' -X GET http://localhost:18082/api/owners?page=1\&size=10` → **200** (the cookie is the credential carrier; never ages out under timeout=-1).

## 5. What it checks — assertions
- **PASS** when: login 302→`/`; the SESSION Set-Cookie has `HttpOnly` (UC-008) AND NOT `Secure` (UC-001) AND `SameSite=Lax` not `Strict` (UC-007) AND no `Max-Age`/`Expires`; the held cookie resolves `/api/owners` with 200 (UC-002).
- **FAIL (posture changed → re-scope the pin)** when: `Secure` present, or `SameSite=Strict`, or `Max-Age`/`Expires` present, or the held cookie is rejected (302) — a Secure-by-default / SameSite-Strict / finite-timeout fix (PLT-074) landed.
- **FAIL (regression)** when: `HttpOnly` is ABSENT — a `WebSessionIdResolver` override silently turned off the one safe-by-default attribute.
- **FAIL (setup)** when: login returns `/login?error` (credential store mismatch — check `AUTH_LOGIN_FORM_CREDENTIALS=admin:admin`).

## 6. Result log
`integration-tests/run-log/{YYYY-MM-DD}-{suite-or-IT}.md`. Log fields:
`date · stack_commit · runner · outcome · evidence (Set-Cookie attrs; replay status) · notes`.

## Cross-references
- Source: F-087 (`feature-flows/detail/F-087.yaml` UC-001/002/007/008) + `feature-reflections/detail/F-087.yaml` (H-001/002/007/008) · `SessionConfiguration.java:22-65` (no CookieWebSessionIdResolver bean) · `LoginFormSecurityConfiguration.java:53-59` (formLogin + enforcing boundary; CSRF disabled at :54) · `JooqSessionRepository.java:138-148` (expiry math) · application.yml `spring.session.timeout: -1`.
- Tracked code bugs: **PLT-074** (cookie-posture epic — Secure/SameSite/timeout) · PLT-064 (CSRF disabled under LOGIN_FORM) · PLT-083 (session housekeeping no @SchedulerLock). Docs: DOC-241 + DOC-250 (done).
- Sibling: **IT-009** owns the ADR-0074 authentication boundary (DISABLED open vs LOGIN_FORM closed); this spec assumes that boundary and pins the cookie the enforcing mode issues.
- Plan: `lineage/odd-platform/test-plan.md` batch I1.
- Automation: `integration-tests/e2e/specs/session-cookie-posture.spec.ts` (stack `helpers/loginform-stack.ts` + generic `helpers/stack.ts`).
