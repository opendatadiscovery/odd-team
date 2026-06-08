---
id: IT-055
title: "My-Objects anchor-set reads under DISABLED — triplet returns empty (no cross-owner leak)"
gates:
  validates: [F-015]
  enforces: []
  regresses: []
test_class: integration
stack: odd-minimal
automation: "e2e:my-objects-anchor-reads.spec.ts"
plan_ref: I1
status: ready
---

# IT-055 — F-015 My-Objects anchor-set reads under DISABLED

## 1. What this checks

F-015 is the owner-anchored discovery triplet on `DataEntityController` (lines 284-305):
`GET /api/dataentities/my` (the owned set) + `/my/upstream` + `/my/downstream` (the
non-owned-but-reachable one-hop lineage neighbours). Each takes only `(page, size)` — no owner/user
param — and resolves the anchor through the F-011 chokepoint `fetchAssociatedOwner()`
(`DataEntityRelationsServiceImpl.java:26`, `DataEntityServiceImpl.java:213`).

Under `auth.type=DISABLED` there is no principal, so `fetchAssociatedOwner()` emits `Mono.empty()` at
the principal step — BEFORE `listByOwner` / the lineage CTE / `listByOddrns` run. The anchor set is
empty, the derived set is empty, and all three endpoints return **200 + `[]`** regardless of catalog
data. This is **F-015-UC-12** (anonymous caller under DISABLED → empty, NOT a cross-owner leak) — the
SAFE characterization.

**Why it matters (REFACTOR-225):** owner-scoping is enforced at EXACTLY ONE site with no JOIN-side
defence-in-depth. A regression at that single anchor (fallback owner-id, a mis-ordered WebFilter, a
"fix" that defaults the anchor) would leak a wrong owner's lineage neighbourhood. The pins assert the
DISABLED path is safely-empty today and stays empty even with owned entities + lineage edges present,
so such a regression goes RED.

## 2. Preparation

- **Stack:** `odd-minimal` (`auth.type=DISABLED`). `ODD_STACK_EXTERNAL=1` to reuse.
- **Seed:** the corner test seeds a small graph (owned entity + upstream parent + downstream child,
  ids 20550-20553, `it055_` namespace) + ownership + two live `lineage` edges via `dbQuery`, then
  cleans up. The success test needs no seed.

## 3. Readiness check

- Health: `curl -fsS http://localhost:18080/actuator/health` → UP
- `GET /api/dataentities/my` → 200 + `[]` (anonymously reachable under DISABLED).

## 4. Run protocol

1. `GET /api/dataentities/my`, `/my/upstream`, `/my/downstream` → each 200 + `[]`.
2. Seed an owned entity with live upstream + downstream lineage edges; re-hit the triplet → each
   STILL 200 + `[]` (the anchor short-circuit precedes the lineage CTE).

**Automated rail:** `ODD_STACK_EXTERNAL=1 npx playwright test specs/my-objects-anchor-reads.spec.ts`.

## 5. Assertions

- **PASS (DISABLED)** when: all three endpoints return `[]` with and without seeded owned/lineage data.
- **FLIPS** when: any of the three returns a non-empty set under DISABLED — the anchor resolved to
  some owner without an authenticated principal (the REFACTOR-225 cross-owner-leak regression).

## 6. Result log

Appends to `integration-tests/run-log/{YYYY-MM-DD}-IT-055.md`.

## Cross-references
- Source: `DataEntityController.java:284-305`, `DataEntityServiceImpl.java:212-225`,
  `DataEntityRelationsServiceImpl.java:25-39`, `AuthIdentityProviderImpl.java:50-53`.
- Feature: `lineage/odd-platform/feature-flows/detail/F-015.yaml` (UC-12; REFACTOR-225; DOC-GAP-099).
- Related: IT-054 (the F-011 chokepoint this anchors on); LSN-017.
- Plan: `lineage/odd-platform/test-plan.md` batch I1 (auth-mode posture).
