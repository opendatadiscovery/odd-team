---
id: IT-052
title: "Management directory LIST endpoints are universally ungated reads (anon reads the full directory under DISABLED)"
gates:
  validates: [F-074]
  enforces: []
  regresses: []
test_class: integration
stack: odd-minimal
automation: "e2e:mgmt-directory-ungated-reads.spec.ts"
plan_ref: I1
status: ready
---

# IT-052 — F-074 Management directory ungated reads

## 1. What this checks

The read-collaborative posture (implicit ADR-CANDIDATE-003): every Management directory LIST endpoint is an
UNGATED read — no `*_READ` permission, no GET `SecurityRule` (the only GET rule is `OWNER_ASSOCIATION_MANAGE`
on the OAR *pending* list). All other list GETs fall through to the `.authenticated()` catch-all. Under the
shipped default `auth.type=DISABLED` (`.anyExchange().permitAll()`), an ANONYMOUS caller reads the full
directory. A characterization pin of the documented open-read posture.

- **H-003:** anon GET returns **200 + JSON** on `/api/owners`, `/api/namespaces`, `/api/tags`,
  `/api/datasources`, `/api/collectors`, `/api/titles`, `/api/policies`, `/api/roles`, `/api/owners/providers`.
  For owners/namespaces/tags/datasources the seeded row appears in the body (a REAL directory read, not the
  SPA `index.html` fallback — asserted via `content-type: application/json` + the seeded name present).
- **H-006:** the OAR forensic **activity** log (`/api/owner_association_request/activity?...&status=`) is
  anonymously reachable (200 JSON) — it has NO `SecurityRule` at all and is a richer dataset than the
  pending list.

**Operator caveat (why pin, not "fix"):** a DISABLED deployment is FULLY OPEN — any network caller reads the
entire Management catalog (owner roster incl. PII-bearing names, datasource ODDRNs, collector identities,
policy/role topology, the OAR audit log). DISABLED is for trusted networks only.

## 2. Preparation

- **Stack:** `odd-minimal` (auth.type=DISABLED). `ODD_STACK_EXTERNAL=1` to reuse a running stack.
- **Seed (names prefixed `it052_`):** one owner, one namespace, one tag, one data source (id 20520) so each
  directory read has a known row to find.

## 3. Readiness check

- Health: `curl -fsS http://localhost:18080/actuator/health` → UP
- Seed present, e.g. `SELECT 1 FROM owner WHERE name = 'it052_owner_dir'`.

## 4. Run protocol

1. `GET /api/owners?...&query=it052_owner_dir` (no auth) → 200 JSON, body contains the seeded owner.
2. `GET /api/namespaces`, `/api/tags`, `/api/datasources` (filtered) → 200, each contains its seeded row.
3. `GET /api/collectors`, `/api/titles`, `/api/policies`, `/api/roles` → 200 JSON; `/api/owners/providers`
   → 200 JSON with `default_providers`.
4. `GET /api/owner_association_request/activity?...&status=APPROVED` (no auth) → 200 JSON list.

**Automated rail:** `ODD_STACK_EXTERNAL=1 integration-tests/run-suite.sh IT-052`.

## 5. Assertions

- **PASS** when: every listed GET is anonymously reachable (200) AND returns JSON (not the SPA fallback) AND
  the seeded rows appear in the directory reads.
- **FLIPS** when: any returns 401/403 (a read gate was added / fail-closed default) — then the open-read
  posture changed; re-confirm the security model + the operator docs before treating as a regression.

## 6. Result log

Appends to `integration-tests/run-log/{YYYY-MM-DD}-IT-052.md`.

## Cross-references
- Source: F-074 H-003 (anon full-directory read under DISABLED), H-006 (OAR activity log ungated). Code:
  `SecurityConstants.java:98-355` (zero `*_READ`, only OAR-pending GET rule), `AuthorizationCustomizer.java:29-30`
  (catch-all `.authenticated()`), `DisabledAuthSecurityConfiguration.java:13-18` (permitAll under DISABLED).
- Latent defect surfaced: the OAR endpoints 500 (SYS001) on a MISSING required `status` query param
  (`MissingRequestValueException` swallowed by the catch-all `Exception` handler → 500 instead of 400).
- Plan: `lineage/odd-platform/test-plan.md` batch I1.
