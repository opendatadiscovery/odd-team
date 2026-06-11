---
id: IT-065
title: "Operator Management-Endpoint Exposure Surface — which Spring actuator endpoints are reachable anonymously"
gates:
  validates: [F-122]
  enforces: []
  regresses: [PLT-078, PLT-103]
test_class: integration
stack: odd-minimal
automation: "e2e:actuator-exposure.spec.ts"
plan_ref: I10
status: ready
---

# IT-065 — F-122 Operator Management-Endpoint Exposure Surface (actuator) [SECURITY]

## 1. What this checks

`SecurityConstants.WHITELIST_PATHS` includes `/actuator/**` (SecurityConstants.java:26) — actuator is reachable
**before** auth in EVERY mode (DISABLED + LOGIN_FORM + OAUTH2 + LDAP). The management block
(application.yml:226-242) sets `enabled-by-default: false`, exposes only `health, prometheus, env, info`, sets
**no** `management.server.port` (actuator shares the main HTTP port) and **no** `show-values` key (so env
value-masking is the Spring Boot framework default — NOT a platform contract; F-122 H-002).

- **UC-009 (which serve anon):** `/actuator/health` and `/actuator/info` return a real 200 body to an
  anonymous caller; `/actuator/info` discloses the build **version** (fingerprint, non-secret build coords).
- **UC-001 (SECURITY pin):** `/actuator/env` is reachable unauthenticated — a GET reaches application code and
  returns **500 SYS001**, NOT a 401/403 auth rejection. The security layer does not gate `/actuator/**`; this is
  invariant across all four auth modes because the **whitelist**, not the auth mode, is what opens it.
- **UC-005 (SECURITY pin):** `/actuator/prometheus` (operator metrics) is likewise reachable unauthenticated.

**Grounding subtlety (2026-06-07):** the platform's catch-all `ControllerAdvice`
(`@ExceptionHandler(Exception.class)` → SERVER_EXCEPTION, ControllerAdvice.java:62-66) **swallows** the actuator
dispatcher: every `/actuator/*` except `health`+`info` returns an indistinguishable **500 SYS001** over HTTP —
whether the endpoint is enabled (`env`), disabled (`beans`), or unknown (`foobar123`). So this protocol
**cannot and does not** assert a 200 credential dump from `/actuator/env` (it does not currently happen). The
verifiable, security-relevant fact is the **reachability** (auth does not protect `/actuator/**`).

**Operator impact (why pin it):** `/actuator/env` is whitelisted + enabled with masking resting on a framework
default, and actuator runs on the main port with no separate management port. A framework/config change that
restores a usable env body (or an operator who sets `show-values=ALWAYS` for debugging) instantly exposes the
configured-credential schema to any unauthenticated network caller. **Responsible-disclosure:** assert
reachability + a non-sensitive build marker only; never dump secret values. Root cause + operator impact are
already tracked in **PLT-078** (restrict the default exposure list) + **PLT-103** (env value leak) — this IT
adds the live regression guard, no new issue is minted (LSN-009 anti-duplication).

**Live refinement (2026-06-07):** PLT-078/PLT-103 describe `/actuator/env` returning the JDBC URL / credential
schema verbatim. On the current `:latest` image `/actuator/env` returns **500 SYS001** (the catch-all
`ControllerAdvice` masks the body), so the *value-dump* is not directly reproducible today — matching the
`refactoring-scopes.md` note that the actuator-leak angle is refuted on Spring Boot 3.4.x. What remains real and
is what this IT pins: the **reachability** posture (env/prometheus whitelisted, not auth-gated, in every mode).

## 2. Preparation

- **Stack:** `odd-minimal` (auth.type=DISABLED — the default). `ODD_STACK_EXTERNAL=1` to reuse a running stack.
- **Seed:** none — actuator reflects deployment/runtime, not catalog state.

## 3. Readiness check

- Health: `curl -fsS http://localhost:18080/actuator/health` → UP
- `curl -s http://localhost:18080/actuator/info` → 200 JSON with `build.version`.

## 4. Run protocol

(Send `Accept: application/vnd.spring-boot.actuator.v3+json`; `maxRedirects:0` to see a login redirect as a gate.)

1. `GET /actuator/health` → 200, body `status==UP`.
2. `GET /actuator/info` → 200, body has non-empty `build.version`.
3. `GET /actuator/env` → status is NOT 401/403 and NOT 302 (not auth-gated); current behaviour **404**
   (no route is mapped despite enabled+exposed config — the pre-2026-06-11 "500" was the advice
   catch-all swallowing this `NoResourceFoundException`; re-grounded by CTRIB-005/#1760, evidence on PLT-078).
4. `GET /actuator/prometheus` → status is NOT 401/403 and NOT 302; current behaviour **404** (same — the
   scrape surface is dead config; PLT-078/PLT-198).

Reachability assertions read NO response body and assert NO property value (responsible disclosure).

**Automated rail:** `ODD_STACK_EXTERNAL=1 integration-tests/run-suite.sh IT-065`.

## 5. Assertions

- **PASS** when: health+info serve 200 bodies anon (info discloses version); env+prometheus are not auth-rejected
  (no 401/403/302) and serve no route (404 — dead config, PLT-078).
- **FLIPS** when: `/actuator/env` or `/actuator/prometheus` returns 401/403/302 (placed behind auth / removed from
  the whitelist / moved to a separate management port — the surface narrowed, GOOD; re-scope the pin); OR either
  starts returning a 200 body (the endpoint came alive — for env, escalate: the config-key schema is now directly
  reachable; verify masking against PLT-078 and re-assess; for prometheus, PLT-198's gauge work unblocks).

## 6. Result log

Appends to `integration-tests/run-log/{YYYY-MM-DD}-IT-065.md`.

## Cross-references
- Source: F-122 UC-001 (whitelist reachability) + UC-005 (prometheus) + UC-009 (which endpoints serve); reflection `feature-reflections/detail/F-122.yaml` (7 confirmed / 2 contradicted / 2 partial; H-002 HIGH = show-values default not WHEN_AUTHORIZED).
- Tracked bugs (no new draft — LSN-009): `issues/odd-platform/PLT-078.md` (restrict default exposure list) + `issues/odd-platform/PLT-103.md` (env value leak); refactoring-scopes REFACTOR-029 / REFACTOR-117 / REFACTOR-181 (actuator-leak angle refuted on Spring Boot 3.4.x → residual is Lombok-toString).
- Plan: `lineage/odd-platform/test-plan.md` batch I10 (public-API contract + operator-introspection exposure).
