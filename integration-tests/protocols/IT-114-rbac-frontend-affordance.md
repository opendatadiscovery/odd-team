---
id: IT-114
title: "RBAC frontend affordance — WithPermissions permit arm renders gated controls under the DISABLED synthetic admin"
gates:
  validates: [F-207]
  enforces: []
  regresses: []
test_class: integration
stack: odd-minimal
automation: "e2e:rbac-frontend-affordance.spec.ts"
plan_ref: I1
status: ready
---

# IT-114 — F-207 RBAC Frontend Affordance Pattern (WithPermissions / WithPermissionsProvider)

## 1. What this checks

`WithPermissions` is the platform's most-mounted UI primitive and ships ZERO tests. It HIDES (returns null),
not disables, a control when the signed-in user lacks the named permission (WithPermissions.tsx:28). Under
DISABLED the synthetic admin holds every Permission (whoami → getGlobalPermissions → PermissionProvider),
so `hasAccessTo(<any gated permission>)` is true and gated affordances RENDER.

- **UC-002:** the `DATA_ENTITY_TAGS_UPDATE`-gated "Add tags" button renders on an entity Overview
  (OverviewTags.tsx:38-50) — the permit arm of the HIDE-NOT-DISABLE contract.
- **UC-002 corner:** a SECOND independently-gated control — the `DATA_ENTITY_DESCRIPTION_UPDATE`-gated
  description button (`data-qa="add_description"`, InternalDescriptionHeader.tsx:40-50) — also renders,
  demonstrating the synthetic-admin-unlocks-everything posture (F-085 → F-207: the SPA trusts whoami).
- **UC-007 honesty:** under DISABLED the gated UI control is shown AND the write API is open — they AGREE
  only because BOTH are fully open. The UI is NOT the authorization boundary: an anonymous tag CREATE
  (POST /api/tags) succeeds (200), and the entity tag-relation write is not authz-rejected (not 401/403).

**Hide-arm honesty:** the deny arm (hasAccessTo false → null) is HARD to trigger under DISABLED (the admin
holds every Permission). Forcing it requires an enforcing auth mode + a non-admin user — that is IT-010's
(ldap-rbac-enforcement) territory + F-207-UC-003 (the backend gate holds on direct API call). This protocol
characterizes the permit arm honestly and defers the deny/hidden arm to IT-010 rather than fake it.

## 2. Preparation

- **Stack:** `odd-minimal` (auth.type=DISABLED — synthetic admin has all perms). `ODD_STACK_EXTERNAL=1` to reuse.
- **Seed:** one DATA_SET data_entity (id 21140, class `{1}`) to open its Overview. Idempotent; band
  21140-21149; name `it114_*`.

## 3. Readiness check

- Health: `curl -fsS http://localhost:18080/actuator/health` → UP
- Seed present: `GET /api/dataentities/21140` → 200.
- whoami carries DATA_ENTITY_TAGS_UPDATE + DATA_ENTITY_DESCRIPTION_UPDATE (the synthetic-admin grant).

## 4. Run protocol

1. Browse `/dataentities/21140/overview`; wait for the entity GET. Assert the "Add tags" button is visible.
2. On the same Overview, assert the `[data-qa="add_description"]` control is visible.
3. Assert an anonymous `POST /api/tags {name, important}` → 200 (write surface open); the entity
   tag-relation write is not 401/403 (authz open; a business 500 on the minimal seed is orthogonal).

**Automated rail:** `ODD_STACK_EXTERNAL=1 integration-tests/run-suite.sh IT-114`.

## 5. Assertions

- **PASS (DISABLED)** when: both gated affordances render; the anonymous tag create is 200; the entity
  tag-relation write is not authz-rejected.
- **FLIPS** when: a gated affordance does NOT render under the synthetic admin (the permit arm broke, or the
  whoami grant shrank — see IT-111), or the anonymous write is 401/403 (auth enabled — NOT DISABLED).

## 6. Result log

Appends to `integration-tests/run-log/{YYYY-MM-DD}-IT-114.md`.

## Cross-references
- Source: F-207 UC-002/UC-007; WithPermissions.tsx:11-34; PermissionProvider.tsx:27-32; OverviewTags.tsx:38-50;
  InternalDescriptionHeader.tsx:40-50.
- Plan: `lineage/odd-platform/test-plan.md` batch I1 (auth-mode posture)
- Related: IT-111 (the whoami all-perms grant that unlocks these gates), IT-010 (the backend gate / deny arm
  under LDAP — F-207-UC-003), LSN-023 (the UI-is-not-the-gate methodology lesson F-207 anchors).
