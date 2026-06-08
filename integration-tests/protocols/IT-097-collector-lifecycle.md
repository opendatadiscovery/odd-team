---
id: IT-097
title: "Collector lifecycle — register (40-char token) / list-masked / rotate-in-place / soft-delete + UI render"
gates:
  validates: [F-020]
  enforces: []
  regresses: []
test_class: integration
stack: odd-minimal
automation: "e2e:collector-lifecycle.spec.ts"
plan_ref: I5
status: ready
---

# IT-097 — F-020 Collector Lifecycle Management

## 1. What this checks

Collector lifecycle is the operator-facing CRUD + token-issuance surface under **Management → Collectors**.
This protocol drives the full loop and verifies each step at the REAL boundary (HTTP response body AND a
Postgres read-back), under the shipped default `auth.type=DISABLED` (so the loop runs anonymously, the same
open posture IT-046 pins):

- **REGISTER** (`POST /api/collectors`): mints a `collector` row + a `token` row, returns the 40-char
  plaintext token ONCE. DB: collector exists, `deleted_at IS NULL`, `token_id` FK set, token value 40 chars.
- **LIST** (`GET /api/collectors`): the created collector appears, token MASKED to `******`+last6
  (`TokenMapper.mapValue`, `showToken=false` on reads); the mask tail is the genuine plaintext suffix.
- **ROTATE** (`PUT /api/collectors/{id}/token`): returns a NEW 40-char plaintext; the same token row is
  UPDATED in place (value changes, `created_at` preserved — `CollectorServiceImpl.regenerateToken`).
- **DELETE** (`DELETE /api/collectors/{id}`): 204; the collector is SOFT-deleted (`deleted_at` stamped, row
  retained — `ReactiveAbstractSoftDeleteCRUDRepository`) and disappears from the list.
- **UI** (`/management/collectors`): the `CollectorsList` page (GET `/api/collectors` on mount) renders the
  created collector's name in the rendered DOM.

**Operator consequence (pinned):** under DISABLED every step is reachable by any anonymous network caller —
collectors + usable S2S tokens are minted with no credential. DISABLED is for trusted networks only.
(The plaintext-at-rest + orphan-token defects are pinned separately by IT-060.)

## 2. Preparation

- **Stack:** `odd-minimal` (`auth.type=DISABLED` — the default). `ODD_STACK_EXTERNAL=1` reuses a running stack.
- **Auth/config:** DISABLED → anonymous register/list/rotate/delete permitted (no credential). Admin identity
  under DISABLED carries all four `COLLECTOR_*` permissions, so the UI affordances render.
- **Seed:** none. Each test creates its own `it097_`-prefixed collector (namespace `it097-ns`) and
  soft-deletes it at the end (idempotent, re-runnable against the shared stack).

## 3. Readiness check

- Health: `curl -fsS http://localhost:18080/actuator/health` → `{"status":"UP"}`
- List endpoint is the OpenAPI GET path `/api/collectors` (NOT `/api/collectors/list` — that path is not a
  route and 500s): `curl -s -o /dev/null -w '%{http_code}' 'http://localhost:18080/api/collectors?page=1&size=1'` → `200`.

## 4. Run protocol

1. `POST /api/collectors {name: it097_..., namespace_name: it097-ns}` (no auth) → 200 + `token.value` = 40-char plaintext.
   DB: `SELECT c.deleted_at, length(t.value) FROM collector c JOIN token t ON t.id=c.token_id WHERE c.id=<id>` → `(NULL, 40)`.
2. `GET /api/collectors?query=<name>` → the collector's `token.value` is MASKED `******`+last6; tail == plaintext tail.
3. `PUT /api/collectors/<id>/token` → 200 + a NEW 40-char plaintext (≠ original).
   DB: still one token row; `value` == rotated plaintext; `created_at` unchanged.
4. `DELETE /api/collectors/<id>` → 204. `SELECT deleted_at FROM collector WHERE id=<id>` → stamped (row kept);
   `GET /api/collectors?query=<name>` no longer returns it.
5. UI: `page.goto('/management/collectors')`, wait for GET `/api/collectors`, assert the created name is visible.

**Automated rail:** `ODD_STACK_EXTERNAL=1 integration-tests/run-suite.sh IT-097`
(or `PATH=… ODD_STACK_EXTERNAL=1 npx playwright test specs/collector-lifecycle.spec.ts`).

## 5. Assertions

- **PASS** when: register reveals a 40-char plaintext + creates the live collector/token rows; the list read
  masks the token as `******`+last6; rotation returns a new plaintext and UPDATES the token row in place
  (created_at preserved); delete returns 204 + soft-deletes the row + hides it from the list; the management
  UI renders the created collector name.
- **FAIL** when: any verb's HTTP contract regresses (e.g. register stops returning a 40-char token, the list
  read returns plaintext instead of masked, rotation inserts a new row / loses created_at, delete hard-deletes
  or leaves the collector listed), or the UI list fails to render the created collector.

## 6. Result log

Appends to `integration-tests/run-log/{YYYY-MM-DD}-IT-097.md`.

## Cross-references
- Source: F-020 (register / list-masked / rotate / delete lifecycle); UC trace corrected — the list read
  is GET `/api/collectors`, not `/api/collectors/list` (the feature-flow hop-1f path was wrong).
- Plan: `lineage/odd-platform/test-plan.md` batch I5.
- Related: IT-046 (anon collector/token MINT under DISABLED — F-008 UC-10) · IT-060 (F-125 credential
  at-rest/orphan pins) · IT-100 (F-163 the one-shot token-reveal UI pattern this lifecycle feeds).
