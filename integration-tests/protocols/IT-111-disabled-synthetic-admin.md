---
id: IT-111
title: "DISABLED-mode synthetic-admin identity probe — whoami returns admin + full Permission set + owner null"
gates:
  validates: [F-085]
  enforces: []
  regresses: []
test_class: integration
stack: odd-minimal
automation: "e2e:disabled-synthetic-admin.spec.ts"
plan_ref: I1
status: ready
---

# IT-111 — F-085 Identity Probe & DISABLED-Mode Synthetic Admin Fallback

## 1. What this checks

Under the shipped default `auth.type=DISABLED`, an anonymous `GET /api/identity/whoami` returns the
synthetic admin identity contract — the single source the SPA drives all permission gating from.

- **UC-002:** anonymous whoami → **200** + `identity.username="admin"` + `identity.permissions` == the FULL
  `Permission` enum (Arrays.asList(Permission.values()), 73 values per components.yaml:161-235) + `owner=null`
  + `association_request=null`.
- **UC-001:** the SPA boots against that response (no login wall) — the rendered UI is the admin UI.

**Operator caveat (why pin it):** under DISABLED, ANY anonymous network caller is the admin with every
current AND future Permission — `Permission.values()` expands dynamically, so a new sensitive capability
enters the DISABLED grant with no controller change. DISABLED is for trusted networks only.

This is a characterization pin (LSN-029): GREEN under the shipped DISABLED default; it goes RED the instant
a hardening (PLT-072) makes DISABLED return a non-admin identity, or the Permission enum changes (the
pinned `EXPECTED_PERMISSIONS` list forces a deliberate re-grounding).

## 2. Preparation

- **Stack:** `odd-minimal` (auth.type=DISABLED — the default). `ODD_STACK_EXTERNAL=1` to reuse a running stack.
- **Seed:** none — whoami is a stateless identity probe.

## 3. Readiness check

- Health: `curl -fsS http://localhost:18080/actuator/health` → `{"status":"UP"}`
- `curl -s http://localhost:18080/api/identity/whoami` returns 200 with an `identity` object.

## 4. Run protocol

1. `GET /api/identity/whoami` anonymously (no Authorization, no cookie) → assert 200 + username "admin" +
   owner null + permissions == the pinned 73-value Permission enum.
2. Browse `/` → the SPA fires whoami and the catalog shell (main search) renders.

**Automated rail:** `ODD_STACK_EXTERNAL=1 integration-tests/run-suite.sh IT-111`.

## 5. Assertions

- **PASS (DISABLED)** when: whoami is 200, username "admin", owner null, the permission set equals the full
  Permission enum (set-equality + count); the SPA shell renders without a login redirect.
- **FLIPS** when: whoami returns 302/401 (mode is not DISABLED), or 500 (the s2s NPE — see IT-112), or the
  permission set is no longer the full enum (hardening, or an enum change).

## 6. Result log

Appends to `integration-tests/run-log/{YYYY-MM-DD}-IT-111.md`.

## Cross-references
- Source: F-085 UC-002 (synthetic-admin grant) + UC-001 (SPA single permission source); IdentityController.java:23-33;
  DisabledAuthSecurityConfiguration.java:13-17; components.yaml:158-235 (Permission enum); PermissionProvider.tsx:17-32.
- Plan: `lineage/odd-platform/test-plan.md` batch I1 (auth-mode posture)
- Related: IT-112 (the s2s X-API-Key 500 on whoami), IT-054 (whoami provider field for F-011).
