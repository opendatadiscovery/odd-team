---
id: IT-040
title: "Custom metadata catalogue — an INTERNAL field is discoverable via the autocomplete query; non-matches excluded"
gates:
  validates: [F-046]
  enforces: []
  regresses: []
test_class: integration
stack: odd-minimal
automation: "e2e:metadata-catalogue.spec.ts"
plan_ref: I5
status: ready
---

# IT-040 — F-046 Custom Metadata Field Catalogue (autocomplete discovery)

## 1. What this checks

The INTERNAL (operator-curated) metadata-field catalogue at `GET /api/metadata/fields` backs the
"add custom metadata" autocomplete: a field defined once must be discoverable (so it is reused, not
re-typed) and a query must filter. **Operator consequence if it FAILS:** duplicate metadata fields
proliferate because the catalogue never surfaces the existing one.

## 2. Preparation

- **Stack:** `odd-minimal` (DISABLED). `ODD_STACK_EXTERNAL=1` to reuse a running stack.
- **Seed:** one INTERNAL metadata field (`seedEntityMetadata('it040_cost_center', …)` — helpers/db.ts).

## 3. Readiness check

- Health: `curl -fsS http://localhost:18080/actuator/health` → UP
- Catalogue real: `GET /api/metadata/fields` → `{"items":[…],"page_info":…}` (200 application/json)

## 4. Run protocol

1. Seed an INTERNAL metadata field `it040_cost_center`.
2. `GET /api/metadata/fields?query=it040` → `items[].name` contains it.
3. `GET /api/metadata/fields?query=zzznotamatch` → `items[].name` does NOT contain it.

**Automated rail:** `ODD_STACK_EXTERNAL=1 integration-tests/run-suite.sh IT-040`.

## 5. Assertions

- **PASS** when: the seeded field is returned for a matching query and excluded for a non-matching one.
- **FAIL** when: the field is missing on match (catalogue doesn't surface it) or returned on a non-match (query ignored).

## 6. Result log

Appends to `integration-tests/run-log/{YYYY-MM-DD}-IT-040.md`.

## Cross-references
- Source: F-046 UC-2 (catalogue autocomplete); reuses the IT-017 metadata seed helper.
- Plan: `lineage/odd-platform/test-plan.md` batch I5
