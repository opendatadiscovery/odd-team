---
id: IT-115
title: "AlertManager webhook is ungated — an anonymous caller forges an OPEN alert on any existing entity"
gates:
  validates: [F-007]
  enforces: []
  regresses: [PLT-014, PLT-003]
test_class: integration
stack: odd-minimal
automation: "e2e:alertmanager-webhook-ungated.spec.ts"
plan_ref: I1
status: ready
---

# IT-115 — F-007 AlertManager webhook ungated cross-tenant alert creation

> A protocol is the **source of truth** — a human can execute every step below WITHOUT any tooling.
> The `automation:` spec runs the same steps and writes the same result; it never replaces the protocol.

## 1. What this checks

`POST /ingestion/alert/alertmanager` (AlertManagerController.java:21-26) is a 4-line handler with **no
`@PreAuthorize`, no `@Secured`, no `@ConditionalOnProperty`, no header inspection, no `@Valid`**. It
delegates `req.getAlerts()` verbatim to `AlertServiceImpl.handleExternalAlerts`, which maps the
**untrusted** `labels.entity_oddrn` straight onto `AlertPojo.dataEntityOddrn` (AlertServiceImpl.java:178)
with no DataEntity ownership/permission check, then INSERTs an OPEN `DISTRIBUTION_ANOMALY` alert. The path
is whitelisted (`SecurityConstants.WHITELIST_PATHS[2] = /ingestion/**`) in every UI auth mode and fully
open under `auth.type=DISABLED`; `IngestionDataEntitiesFilter` binds `/ingestion/entities` POST only and
does NOT cover it.

This pins the **forge**: an anonymous caller creates a real OPEN alert ROW attributed to an entity it does
not own (DB read-back), and the untrusted Prometheus `generatorURL` is rendered verbatim into the stored
chunk description (AlertServiceImpl.java:185).

Distinct from **IT-062**, which pins the *empty-payload auth posture* of this endpoint (`{alerts:[]}` →
200, request reaches the handler with no credential). IT-115 pins the F-007-specific *cross-tenant side
effect* IT-062 defers to the per-feature protocol.

**Operator-facing consequence if it FAILS the way it does today:** on a network-reachable deployment any
caller (anonymous under DISABLED; any authenticated user otherwise) injects false-positive OPEN alerts
onto other teams' data entities; with the cross-owner global "All" alerts tab (PLT-121) they are visible
platform-wide and indistinguishable from real alerts. Source: F-007 (`cross_tenant_alert_creation`,
`unauthenticated_payload_trust`, `untrusted_input_to_rendered_text`); filed as PLT-014 + PLT-003.

## 2. Preparation — build the test stand

- **Stack:** `odd-minimal` (`auth.type=DISABLED`). `ODD_STACK_EXTERNAL=1` reuses a running stack.
- **Auth/config:** DISABLED → SECURITY_RULES bypassed; no credential needed; a supplied credential is ignored.
- **Seed data:** one real `data_source` (id 21150) + one real `data_entity` (id 21151, oddrn
  `//e2e-it115/target_entity`) — the FK target the forge attributes an alert to. The caller does NOT own
  it. (`alert_fk_data_entity FOREIGN KEY (data_entity_oddrn) REFERENCES data_entity(oddrn)` — verified —
  so the target MUST exist; this is why the seed is required and why a non-existent oddrn is a 400.)
  Idempotent (DELETE-then-act on the alert rows).

## 3. Readiness check — is the stand ready?

- Platform health: `curl -fsS http://localhost:18080/actuator/health` → `{"status":"UP"}`
- Seed present: `SELECT 1 FROM data_entity WHERE oddrn = '//e2e-it115/target_entity'` → one row.

## 4. Run protocol — what to run (each request carries NO Authorization header)

1. Clear any prior alerts on the target oddrn (idempotency).
2. `POST /ingestion/alert/alertmanager` with body
   `{"alerts":[{"labels":{"entity_oddrn":"//e2e-it115/target_entity"},"generatorURL":"http://prometheus.example/graph","startsAt":"2026-06-07T00:00:00"}]}`
   → **200**.
3. Read back: `SELECT count(*), max(status), max("type") FROM alert WHERE data_entity_oddrn = '//e2e-it115/target_entity'`
   → `1, 1 (OPEN), 4 (DISTRIBUTION_ANOMALY)`.
4. Read back the chunk: `SELECT ac.description FROM alert a JOIN alert_chunk ac ON ac.alert_id = a.id WHERE a.data_entity_oddrn = '//e2e-it115/target_entity'`
   → contains `Distribution Anomaly. URL: http://…` with the attacker-supplied host verbatim.
5. PRECISION: `POST …` with `entity_oddrn` = a non-existent oddrn → **400** (USR003 DB constraint
   violation); no alert row created.

**Automated rail:** `ODD_STACK_EXTERNAL=1 integration-tests/run-suite.sh IT-115`
(or `PATH=… ODD_STACK_EXTERNAL=1 npx playwright test specs/alertmanager-webhook-ungated.spec.ts`).

## 5. What it checks — assertions

- **PASS (current platform, DISABLED)** when: the anonymous POST returns 200; exactly one OPEN
  DISTRIBUTION_ANOMALY alert row appears on the unowned target entity; the chunk description embeds the
  attacker-supplied generatorURL host verbatim; a non-existent oddrn yields 400 with no row.
- **FLIPS (regression-closure signal)** when: the webhook starts rejecting the unauthenticated POST
  (401/403 — an S2S-token or signature gate was added) OR no alert row is created for an entity the caller
  has no permission on (a server-side `entity_oddrn` ownership check was added). Either flip means F-007 was
  hardened — re-scope this pin to the gated behaviour.

## 6. Result log

Every run appends a dated entry to `integration-tests/run-log/{YYYY-MM-DD}-IT-115.md`.
Log fields: `date · stack_commit · runner (AI/human + name) · outcome (PASS|FAIL) · evidence (captured values) · notes`.

## Cross-references
- Source: F-007 facets `unauthenticated_payload_trust` · `cross_tenant_alert_creation` ·
  `untrusted_input_to_rendered_text`; AlertManagerController.java:21-26 · AlertServiceImpl.java:177-185.
- Plan: `lineage/odd-platform/test-plan.md` batch I1 (auth/authz posture).
- Related: IT-062 (the empty-payload auth-posture cell of the same endpoint) · IT-046 (the
  `/ingestion/entities` anon-write cell) · PLT-014 (webhook hardening) · PLT-003 (ingestion filter does not
  cover the path) · PLT-121 (cross-owner "All" alerts tab — the display half of the forge-and-display compound).
- Responsible disclosure: asserts reachability + a non-sensitive synthetic marker; no signature forgery,
  no secrets, no exploit recipe.
