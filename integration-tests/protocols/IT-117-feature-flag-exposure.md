---
id: IT-117
title: "Feature-flag exposure: stock-install empty set + anonymous reach + known-enum-only fingerprint under DISABLED"
gates:
  validates: [F-034]
  enforces: []
  regresses: []
test_class: integration
stack: odd-minimal
automation: "e2e:feature-flag-exposure.spec.ts"
plan_ref: I10
status: ready
---

# IT-117 — Feature-flag exposure surface (GET /api/features/active)

> A protocol is the **source of truth** — a human can execute every step below
> WITHOUT any tooling. The `automation:` spec is a convenience rail that runs the
> same steps and writes the same result; it never replaces the protocol.

## 1. What this checks

F-034 Platform Feature-Flag Exposure. The platform exposes which optional features
(Data Collaboration / Alert Notifications) are activated via `GET /api/features/active`,
resolved once at boot from `datacollaboration.enabled` + `notifications.enabled`
(FeatureResolverImpl.java:16-31). This pins three observable promises on the shipped
DISABLED stack:

- **UC-4** — stock install (both flags at their `false` defaults, application.yml:173,205)
  returns `200 {"items":[]}` (a real JSON empty array, never null, never 404).
- **UC-5** — under `auth.type=DISABLED` an anonymous (no-credential) caller reaches the
  endpoint and reads the feature set. The path is NOT whitelisted
  (SecurityConstants.java:95-96) — the anonymous reach is a property of DISABLED's
  `permitAll()`, which is exactly the operator-facing caveat.
- **UC-8 (corner)** — the items array carries ONLY known `Feature` enum names
  (DATA_COLLABORATION / ALERT_NOTIFICATIONS) and no duplicates; the set is constructor-global
  (FeatureResolverImpl.java:14), identical for every caller deployment-wide.

**Operator consequence if it FAILS:** a non-empty default set means a feature ships
enabled out of the box (unreviewed exposure); a new enum value anonymously exposed means
an external scanner can fingerprint a newly-added optional feature without authenticating
(F-034 facet `disabled_mode_anonymous_feature_fingerprinting`). Source: F-034 use_cases
UC-4/UC-5/UC-8; the contradicted UC-2/UC-3 (chrome-invariance + boot-immutability) are
tracked separately as PLT-068 and are not observable on this non-reconfigurable stack.

## 2. Preparation — build the test stand

- **Stack**: the shared `odd-minimal` stack, already running. Reuse it with
  `ODD_STACK_EXTERNAL=1` — never bring it up or tear it down.
- **Auth/config**: `auth.type=DISABLED` (odd-minimal default); both feature flags at their
  shipped `false` defaults (no override applied).
- **Seed data**: none. This characterizes the stock-install default state.

## 3. Readiness check — is the stand ready?

- Platform health: `curl -fsS http://localhost:18080/actuator/health` → `{"status":"UP"}`
- Endpoint live: `curl -s http://localhost:18080/api/features/active` → `{"items":[]}`

## 4. Run protocol — what to run

1. `curl -s -i http://localhost:18080/api/features/active` — confirm `200`,
   `content-type: application/json`, body `{"items":[]}`.
2. Repeat with no auth header (already anonymous under DISABLED) — confirm still `200` JSON.
3. Confirm every entry in `items` (empty here) is a known `Feature` enum name.

**Automated rail**: from `integration-tests/e2e`:
`PATH="$HOME/.local/node/bin:$PATH" ODD_STACK_EXTERNAL=1 npx playwright test specs/feature-flag-exposure.spec.ts --reporter=line`

## 5. What it checks — assertions

- **PASS** when: `GET /api/features/active` returns `200` `application/json` with
  `items: []` on the stock install; an anonymous caller gets the same `200` JSON; every
  exposed item is one of {DATA_COLLABORATION, ALERT_NOTIFICATIONS} with no duplicates.
- **FAIL** when: the endpoint 404s / returns null items / redirects an anonymous caller
  (302/401) under DISABLED; OR a default flips a flag on (non-empty default set); OR a new,
  unknown feature name appears in the anonymous response (widened fingerprint).

## 6. Result log

Every run appends a dated entry to `integration-tests/run-log/{YYYY-MM-DD}-IT-117.md`.
Log fields: `date · stack_commit · runner (AI/human + name) · outcome (PASS|FAIL) · evidence (captured values) · notes`.

## Cross-references
- Source: F-034 UC-4 / UC-5 / UC-8 (`lineage/odd-platform/feature-flows/detail/F-034.yaml`)
- Contradicted-but-out-of-scope-here: F-034 UC-2 (chrome-invariant) + UC-3 (boot-immutable) → `issues/odd-platform/PLT-068.md`; chrome pin lives at IT-101 (F-041)
- Plan: `lineage/odd-platform/test-plan.md` batch I10
- Automation spec: `integration-tests/e2e/specs/feature-flag-exposure.spec.ts`
- Sibling exposure pin: IT-064 (F-119 `/api/appInfo` — same DISABLED anonymous-reach surface)
