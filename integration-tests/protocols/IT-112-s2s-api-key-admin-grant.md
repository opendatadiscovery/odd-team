---
id: IT-112
title: "S2S API key under DISABLED — observable posture + the PLT-001 fix (any-header pass-through)"
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
configured) and guards the PLT-001 fix against regression.

- **Baseline:** under DISABLED, requests WITHOUT `X-API-Key` are served normally (whoami 200 synthetic
  admin; `/api/dataentities/classes` 200) — the S2S filter is a clean pass-through (isValidToken(null) → false).
- **UC-7 / PLT-001 (FIXED 2026-06-19, CTRIB-022 / #1765):** with s2s unconfigured, ANY `X-API-Key` header is now
  **IGNORED** — the request returns its normal response (whoami 200 synthetic admin; classes 200), NOT the pre-fix
  500. `S2sTokenProvider.isValidToken` null-guards the unconfigured (`s2sToken == null`) token, so it returns
  `false` for any incoming key and the global `S2sAuthenticationFilter` passes the request through.
- **Blast radius (closed):** the unauthenticated DoS is gone platform-wide — a plain reference endpoint
  (`/api/dataentities/classes`) that is 200 without a key is now ALSO 200 with one. Before the fix it 500'd.

**PLT-001 history (the bug this guards):** `S2sAuthenticationFilter` is a `@Component implements WebFilter` with
NO `@ConditionalOnProperty`, so Spring WebFlux auto-registers it as a GLOBAL filter regardless of auth mode. On a
present header it called `S2sTokenProvider.isValidToken`, whose `s2sToken.equals(token)` dereferenced the null
(unconfigured) `s2sToken` → NullPointerException → 500. Any unauthenticated caller could turn any endpoint into a
500 by adding one header → a trivial unauthenticated denial-of-service on the shipped default. The fix
(CTRIB-022) is the defensive null-guard; the optional filter-registration gating is tracked separately as PLT-228.

Regression guard (LSN-029): re-grounded from a characterization pin (which asserted the buggy 500) to assert the
CORRECT post-fix pass-through (200). It goes RED the instant the NPE/DoS returns. SECURITY-class, responsible
disclosure: only junk header values are sent; only status + the non-sensitive identity marker are asserted; no
secret is transmitted or read.

## 2. Preparation

- **Stack:** `odd-minimal` (AUTH_TYPE=DISABLED; `auth.s2s.enabled`/`auth.s2s.token` UNSET — confirmed in
  `lineage/_extractor/probe-stacks/odd-minimal.docker-compose.yml:54`). `ODD_STACK_EXTERNAL=1` to reuse.
- **Seed:** none.

## 3. Readiness check

- Health: `curl -fsS http://localhost:18080/actuator/health` → UP
- Baseline: `curl -s -o /dev/null -w "%{http_code}" http://localhost:18080/api/dataentities/classes` → 200

## 4. Run protocol

1. `GET /api/identity/whoami` no header → 200 (synthetic admin); `GET /api/dataentities/classes` no header → 200.
2. `GET /api/identity/whoami -H "X-API-Key: <junk>"` → **200** (key ignored; identity still synthetic "admin").
3. `GET /api/dataentities/classes -H "X-API-Key: <junk>"` → **200** (key ignored; platform-wide, not endpoint-local).

**Automated rail:** `ODD_STACK_EXTERNAL=1 integration-tests/run-suite.sh IT-112`.
**RED proof (pre-fix):** `ODD_SUT=published:0.28.0 integration-tests/run-suite.sh IT-112` → the X-API-Key requests 500.

## 5. Assertions

- **PASS (post-fix, current contract)** when: no-header requests are 200; any-header requests are ALSO 200 (the key
  is ignored — clean pass-through) on both whoami (identity `admin`) and a plain reference endpoint.
- **RED (regression)** when: an any-header request returns 500 — the `s2sToken` NPE / unauthenticated DoS has
  returned. Expected RED on a pre-fix SUT (`published:0.28.0` / `ref:main`) — that is the PLT-001 RED proof.

## 6. Result log

Appends to `integration-tests/run-log/{YYYY-MM-DD}-IT-112.md`.

## Cross-references
- Source: F-088 UC-7 (DISABLED+S2S no-op posture); S2sAuthenticationFilter.java:26-29; S2sTokenProvider.java:15-21 (post-fix null-guard);
  odd-minimal.docker-compose.yml:54.
- Fix: `contributor/CTRIB-022.md` (issue #1765 / PLT-001) — null-guard `isValidToken`; unit `S2sTokenProviderTest`.
- Bug: `issues/odd-platform/PLT-001.md` (NPE — reachable on the default; fixed by CTRIB-022).
- Follow-up: PLT-228 (optional gating of the filter's registration on `auth.s2s.enabled`).
- Plan: `lineage/odd-platform/test-plan.md` batch I1 (auth-mode posture)
- Related: IT-111 (the no-header whoami 200 baseline), F-008/IT-046 (DISABLED open ingestion posture).
