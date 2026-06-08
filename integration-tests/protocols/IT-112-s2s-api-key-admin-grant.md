---
id: IT-112
title: "S2S API key under DISABLED — observable posture + the PLT-001 NPE-on-any-header pin"
gates:
  validates: [F-088]
  enforces: []
  regresses: [PLT-001]
test_class: integration
stack: odd-minimal
automation: "e2e:s2s-api-key-admin-grant.spec.ts"
plan_ref: I1
status: ready
---

# IT-112 — F-088 S2S API Key — Global Admin Grant Surface (auth.s2s.enabled)

## 1. What this checks

Characterizes the OBSERVABLE S2S posture on the shipped `odd-minimal` default (AUTH_TYPE=DISABLED; s2s NOT
configured) and pins a real, previously-mischaracterized bug.

- **Baseline:** under DISABLED, requests WITHOUT `X-API-Key` are served normally (whoami 200 synthetic
  admin; `/api/dataentities/classes` 200) — the S2S filter is a clean pass-through (isValidToken(null) → false).
- **UC-7 / PLT-001 (KNOWN BUG):** with s2s unconfigured, ANY `X-API-Key` header makes the request **500**.
  `S2sAuthenticationFilter` is a `@Component implements WebFilter` with NO `@ConditionalOnProperty`, so
  Spring WebFlux auto-registers it as a GLOBAL filter regardless of auth mode. On a present header it calls
  `S2sTokenProvider.isValidToken`, whose `s2sToken.equals(token)` dereferences the null (unconfigured)
  `s2sToken` → NullPointerException → 500.
- **Blast radius:** the 500 is NOT whoami-specific — a plain reference endpoint (`/api/dataentities/classes`)
  that is 200 without a key 500s with one. Any unauthenticated caller can turn any endpoint into a 500 by
  adding one header → a trivial unauthenticated denial-of-service on the shipped default.

**PLT-001 correction:** the existing PLT-001 draft calls this NPE "unreachable in production" / severity
low, assuming the filter is registered only when `auth.s2s.enabled=true`. That assumption is FALSE (the
filter is an unconditional global WebFilter). The NPE is reachable on the default config; severity should
be raised and the "unreachable" framing removed.

Characterization pin (LSN-029): the 500 is the CURRENT (buggy) behaviour. A correct fix (defensive null
guard) makes an unconfigured-s2s request pass through to 200; this pin then goes RED → re-ground IT-112.
SECURITY-class, responsible disclosure: only junk header values are sent; only status + the generic error
wrapper shape are asserted; no secret is transmitted or read.

## 2. Preparation

- **Stack:** `odd-minimal` (AUTH_TYPE=DISABLED; `auth.s2s.enabled`/`auth.s2s.token` UNSET — confirmed in
  `lineage/_extractor/probe-stacks/odd-minimal.docker-compose.yml:54`). `ODD_STACK_EXTERNAL=1` to reuse.
- **Seed:** none.

## 3. Readiness check

- Health: `curl -fsS http://localhost:18080/actuator/health` → UP
- Baseline: `curl -s -o /dev/null -w "%{http_code}" http://localhost:18080/api/dataentities/classes` → 200

## 4. Run protocol

1. `GET /api/identity/whoami` no header → 200 (synthetic admin); `GET /api/dataentities/classes` no header → 200.
2. `GET /api/identity/whoami -H "X-API-Key: <junk>"` → **500** + error wrapper (`status:500`, path echoed).
3. `GET /api/dataentities/classes -H "X-API-Key: <junk>"` → **500** (platform-wide, not endpoint-local).

**Automated rail:** `ODD_STACK_EXTERNAL=1 integration-tests/run-suite.sh IT-112`.

## 5. Assertions

- **PASS (current buggy state)** when: no-header requests are 200; any-header requests are 500 on both whoami
  and a plain reference endpoint.
- **FLIPS (fix landed)** when: an any-header request on an s2s-unconfigured stack returns 200 (pass-through)
  instead of 500 — the NPE was fixed; re-ground this protocol to the post-fix pass-through contract.

## 6. Result log

Appends to `integration-tests/run-log/{YYYY-MM-DD}-IT-112.md`.

## Cross-references
- Source: F-088 UC-7 (DISABLED+S2S no-op posture, partial); S2sAuthenticationFilter.java:17-29; S2sTokenProvider.java:10-21;
  odd-minimal.docker-compose.yml:54.
- Bug: `issues/odd-platform/PLT-001.md` (NPE — draft mischaracterizes reachability/severity; this run corrects it).
- Plan: `lineage/odd-platform/test-plan.md` batch I1 (auth-mode posture)
- Related: IT-111 (the no-header whoami 200 baseline), F-008/IT-046 (DISABLED open ingestion posture).
