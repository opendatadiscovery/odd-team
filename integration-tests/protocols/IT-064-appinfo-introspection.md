---
id: IT-064
title: "Deployment-Info Introspection Surface — anonymous /api/appInfo exact-shape + version/auth-mode fingerprint"
gates:
  validates: [F-119]
  enforces: []
  regresses: []
test_class: integration
stack: odd-minimal
automation: "e2e:appinfo-introspection.spec.ts"
plan_ref: I10
status: ready
---

# IT-064 — F-119 Deployment-Info Introspection Surface (`/api/appInfo`)

## 1. What this checks

`AppInfoController#getAppInfo` (AppInfoController.java:23-28) returns `{projectVersion, authType}` where
`authType` is the raw `@Value("${auth.type}")` (AppInfoController.java:17). The path is **not** in
`SecurityConstants.WHITELIST_PATHS`; under the shipped default `auth.type=DISABLED`,
`DisabledAuthSecurityConfiguration` wires `.anyExchange().permitAll()` (DisabledAuthSecurityConfiguration.java:18),
so the endpoint answers any unauthenticated caller.

- **H-003 (confirmed):** an anonymous GET `/api/appInfo` → **200** disclosing the precise platform version
  (`buildProperties.getVersion()`) + the active auth mode (`DISABLED` on this stack).
- **H-001 (exact-shape pin):** the response is **exactly** `{projectVersion, authType}` — no extra
  operator-sensitive field. A future field added to `AppInfo` (widening the unauthenticated fingerprint) trips
  this assertion.

**Operator caveat (why pin it):** under DISABLED a single unauthenticated GET yields the precise version
(CVE-scoping) + the auth mode — a passive recon fingerprint. The live security docs document this exact surface
(DOC-GAP-037 closed). The exact-shape pin guards against silently broadening that fingerprint.

## 2. Preparation

- **Stack:** `odd-minimal` (auth.type=DISABLED — the default). `ODD_STACK_EXTERNAL=1` to reuse a running stack.
- **Seed:** none — the endpoint reflects deployment metadata, not catalog state.

## 3. Readiness check

- Health: `curl -fsS http://localhost:18080/actuator/health` → UP
- `curl -s http://localhost:18080/api/appInfo` → `{"projectVersion":"…","authType":"DISABLED"}`.

## 4. Run protocol

1. `GET /api/appInfo` with NO Authorization header → 200, `content-type: application/json`.
2. Body has a non-empty `projectVersion` (string) and `authType == "DISABLED"`.
3. `Object.keys(body)` sorted === `["authType","projectVersion"]` (exactly two fields).

**Automated rail:** `ODD_STACK_EXTERNAL=1 integration-tests/run-suite.sh IT-064`.

## 5. Assertions

- **PASS (DISABLED)** when: 200 + non-empty `projectVersion` + `authType==DISABLED` + exactly the two keys.
- **FLIPS** when: a third key appears (widened anonymous fingerprint — review the new exposure); OR the GET returns
  401/403/302 (auth now gates `/api/appInfo` — re-scope H-003); OR `authType` ≠ DISABLED (the stack is no longer
  the shipped default).

## 6. Result log

Appends to `integration-tests/run-log/{YYYY-MM-DD}-IT-064.md`.

## Cross-references
- Source: F-119 H-001 (exact shape) + H-003 (anonymous-under-DISABLED fingerprint); reflection `feature-reflections/detail/F-119.yaml` (6 confirmed / 2 contradicted / 3 partial).
- Docs: `configuration-and-deployment/enable-security/authentication/disabled-authentication` (documents the /api/appInfo fingerprint — DOC-GAP-037 closed).
- Plan: `lineage/odd-platform/test-plan.md` batch I10 (public-API contract + operator-introspection exposure).
