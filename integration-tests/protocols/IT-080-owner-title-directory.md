---
id: IT-080
title: "Owner-relationship Title directory has no Management curation tab; readable via DQ Title filter"
gates:
  validates: [F-036]
  enforces: []
  regresses: []
test_class: integration
stack: odd-minimal
automation: "e2e:owner-title-directory.spec.ts"
plan_ref: I9
status: ready
---

# IT-080 — Owner-Relationship Title Directory

> A protocol is the **source of truth** — a human can execute every step below
> WITHOUT any tooling. The `automation:` spec runs the same steps and writes the
> same result; it never replaces the protocol.

## 1. What this checks
The Title directory (owner-relationship labels consumed by Policy `:owner:title` conditions) has NO
Management curation surface — `ManagementTabs.tsx:19-50` enumerates 9 tabs and none is Titles, and
`managementRoutes.ts` declares no titles route. The only operator-visible read surface is the Data
Quality runs Title filter (`TitleFilter.tsx`, backed by `GET /api/titles`). Source: F-036 H-006/UC-006
(CONTRADICTED) + `ui_review_2026_05_26`. The assignment's hypothesis ("navigate the titles management
route, verify the title in the directory") is contradicted by the product, so per LSN-029 this is a
CONTRADICTION characterization pin. Operator consequence: an operator who reads the live Policies
case-variant caveat and goes looking for a "Titles" tab to clean up the directory finds nothing — the
directory grows monotonically and cannot be curated in-product. Tracked: DOC-GAP-146 / REFACTOR-206 /
REFACTOR-624.

## 2. Preparation — build the test stand
- **Stack**: shared odd-minimal (UI+API :18080, Postgres :15432), AUTH_TYPE=DISABLED;
  `ODD_STACK_EXTERNAL=1` to reuse (never bring up / tear down).
- **Seed data** (via `dbQuery`): a `title` row named `it080_ZZZ_Steward` (SELECT-then-INSERT;
  `title.id` is a sequence, so the row is keyed by name; `created_at`/`updated_at` default).

## 3. Readiness check — is the stand ready?
- Platform health: `curl -fsS http://localhost:18080/actuator/health` → `{"status":"UP"}`.
- Seed present: `SELECT id, name FROM title WHERE name = 'it080_ZZZ_Steward';` returns the row.

## 4. Run protocol — what to run
1. Navigate to `/management` (redirects to `/management/namespaces`); read the tab nav.
2. Navigate to `/data-quality`; open the "Filters for tables" Title filter autocomplete; wait for
   `GET /api/titles` (200); type `it080`; read the dropdown options.

**Automated rail**: `cd integration-tests/e2e && PATH="$HOME/.local/node/bin:$PATH" ODD_STACK_EXTERNAL=1 npx playwright test specs/owner-title-directory.spec.ts --reporter=line`

## 5. What it checks — assertions
- **PASS** when: the Management nav renders the 8 documented tabs (Namespaces, Datasources,
  Integrations, Collectors, Owners, Tags, Roles, Policies) AND has NO "Titles" tab; AND the seeded
  title renders as an option in the DQ-runs Title filter dropdown (with the row present in the DB).
- **FAIL** when: a "Titles" management tab appears (the contradiction would flip — re-evaluate F-036
  UC-006: a curation surface was added), or the seeded title cannot be reached via the DQ Title filter.

## 6. Result log
Append a dated entry to `integration-tests/run-log/{YYYY-MM-DD}-IT-080.md` per the standard fields.

## Cross-references
- Source: F-036 H-006/UC-006 (no curation surface — contradiction), H-001/UC-001 (the read surface)
- Feature flow: `lineage/odd-platform/feature-flows/detail/F-036.yaml`
- Reflection: `lineage/odd-platform/feature-reflections/detail/F-036.yaml`
- Tracked: DOC-GAP-146 (curation-surface absence), REFACTOR-206 / REFACTOR-624 (free-text / case-leak)
