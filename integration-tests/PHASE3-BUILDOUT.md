# Phase 3 — Integration e2e build-out (ACTIVE, started 2026-06-03)

Cross-context brain for the integration-suite build-out. The /loop reads this first (with README.md + TEMPLATE.md + suites.yaml). Memory: `project_phase3_integration_e2e_buildout`.

## Mandate (maintainer, 2026-06-03)
Build the **integration (e2e) suite in THIS repo** (odd-team, `integration-tests/`) that verifies **real end-to-end feature behaviour (UI→backend→DB)** for the ontology's features. Grounded in the **feature-flows** (113 features) + the **documentation** (../documentation feature descriptions) + the **refined test-gaps** (1038 gaps; 253 `missing-integration` is the prime pool). **Success path + ≥1 negative path** per feature. Follow the **IT-NNN protocol**. Target **~200 tests** across 120+ features (north star; phased + prioritised by criticality). NEVER add integration tests to odd-platform; NEVER touch odd-platform src/main.

## Pipeline — VALIDATED 2026-06-03 ✅
`run-suite.sh smoke` ran end-to-end: stack-up → P-001 probe **PASS** → wrote probe-runs/ artefact + merged probe-verification into 2 sidecars + stamped feature-flows.yaml + logged run-log/2026-06-03-smoke.md; stack torn down clean. Docker 29.5.2 (client+server). e2e deps installed (e2e/node_modules + playwright). The agent CAN run the suite = the RED gate.
- **6 stacks** in `lineage/_extractor/probe-stacks/`: odd-minimal (core platform), odd-loginform, odd-ldap, odd-minio (REMOTE attachments), odd-notifications (+ -ha). Collector-integration features (GE/Airflow/webhook collectors) have NO stack yet → stack-blocked (build a stack = maintainer's call).
- **Two rails** (per protocol `automation:`): `e2e:specs/{slug}.spec.ts` (Playwright real browser — for user-facing features) · `P-NNN` (API probe via lineage/_extractor/probe-runtime — backend/DB sub-checks). A UI feature's integration test IS the e2e; the probe is a backend sub-check under it.
- **Pace reality:** each IT = stack-up (~2-3 min) + run + teardown; e2e (browser) longer. ~200 ITs is many hours of run time + authoring → long phased build-out; ping at milestones, not per-test.

## e2e spec pattern (from view-count-overview.spec.ts)
`import {test,expect} from '@playwright/test'` + helpers from `../helpers/db` (seedEntity, readViewCount, ENTITY_ID) and per-stack helpers (`../helpers/stack`, ldap-stack, minio-stack, …). Header javadoc: IT-NNN — F-NNN, the user scenario; protocol path; gates (validates F-NNN / regresses|pins); why-e2e-not-probe; EXPECTED RESULT. `test.describe('F-NNN feature — scenario', …) → test('assertion', async ({page}) => { arrange: seed via DB helper → act: page.goto(route)+waits → assert: read state (DB helper or UI) + expect })`. Gotchas (memory reference_odd_platform_e2e_route_interception): snake_case wire vs camelCase client; react-query initialData masks early assertions (waitForResponse first); response-interception needs an applied-guard. Seed via DB (helpers/db.ts), not API, for deterministic preconditions.

## Existing coverage (12 ITs — do NOT duplicate)
IT-001 F-001 view_count probe (smoke) · IT-002 F-001 view_count UI (pins PLT-104) · IT-003 search tsquery poison (PLT-090/127) · IT-004 DQ unknown-status (PLT-052) · IT-005 Top Tags ordering (PLT-026) · IT-006 SPA error boundary (TEST-GAP-1013) · IT-007 LOCAL attachment durability (LSN-001/PLT-086) · IT-008 REMOTE attachment round-trip (minio) · IT-009 auth-mode boundary · IT-010 LDAP RBAC · IT-011 notifications WAL lifecycle · IT-012 WAL failover. Suites in suites.yaml: smoke / feature-complete (green) / known-bugs (red pins) / ui-e2e.

## Per-IT pipeline (each loop iteration)
1. Pick next highest-criticality feature NOT yet IT-covered (cross-check this file + suites.yaml + protocols/). Core-platform → odd-minimal; defer stack-blocked.
2. Read feature-flow detail + its doc (../documentation) + its missing-integration test-gaps. REFINE the gaps (rescope/merge/drop).
3. Author protocols/IT-NNN-{slug}.md (copy TEMPLATE.md) + e2e spec (or probe). Success + ≥1 negative. Reuse helpers; add db.ts seed/read helpers as needed.
4. RUN via run-suite.sh (RED gate; run-to-resolve — a real failure is a found bug → pin in known-bugs, or a spec bug → fix). Never register a pass without a run.
5. Register in suites.yaml + run-log/; commit (heredoc, IT-NNN id); mark the test-gap covered.
6. Every ~5 ITs: re-ingest the ontology + record the count here.

## ⚠ KEY LESSON — the odd-minimal IMAGE schema lags the source migrations (verify, don't guess)
The stack runs a RELEASE odd-platform image whose Flyway schema differs from
`odd-platform/.../db/migration/*.sql`. Seeding against the source DDL cost IT-015 four failed
runs (no `owner.is_deleted`; `ownership.role_id` doesn't exist; missing UNIQUE constraints). RULE:
**inspect the running image's `information_schema.columns` before writing a relation seed**, and use
constraint-independent SELECT-then-INSERT / DELETE-then-INSERT (don't rely on ON CONFLICT unique
targets). Verified image schema (odd-minimal, 2026-06-03) for the common seed tables:
- `data_entity`(id, oddrn, external_name, internal_name, internal_description, data_source_id, type_id, view_count, …) · `data_source`(id, oddrn, name, …)
- `owner`(id, name, created_at, updated_at, **deleted_at**) · `title`(id, name, …, deleted_at) · `role`(id, name, …, deleted_at)
- `ownership`(id, data_entity_id, owner_id, **title_id**)  ← the owner's role is a TITLE (title_id), NOT role_id
- `tag`(id, name, important?) · `tag_to_data_entity`(tag_id, data_entity_id, external)
- `term`(id, name, definition, namespace_id, …, deleted_at) · `namespace`(id, name, …, deleted_at) · `data_entity_to_term`(data_entity_id, term_id, is_description_link)
- `metadata_field`(id, type, name, origin, deleted_at) · `metadata_field_value`(data_entity_id, metadata_field_id, value, active)
To re-inspect: `docker-compose -p probe-stacks -f lineage/_extractor/probe-stacks/odd-minimal.docker-compose.yml up -d`, wait for `/actuator/health`, `docker exec probe-database psql -U odd-platform -d odd-platform -c "\d <table>"`, then `down -v`.

## ⚠ KEY LESSON 2 — the UI transforms displayed text; assert on the VALUE, not the field name
The odd-platform UI does not render seeded identifiers verbatim. `MetadataItem` renders a custom
metadata field NAME through `TextFormatted` / `stringFormatted(name, '_', 'firstLetterOfString')`,
which lower-cases the name and turns `_` into a space: `IT017_cost_centre` → **`It017 cost centre`**.
Labels generally (field names, enum keys) are display-formatted; user DATA values (descriptions,
metadata values, owner names, term names) render verbatim. RULE for display ITs: assert on the
**verbatim data value** as the primary signal (it proves the datum reached the read surface), and if
you must assert a transformed label, use a **case-insensitive, whitespace-tolerant regex**
(`/it017\s+cost\s+centre/i`). When a display assertion fails, get ground truth before assuming a
product bug: `curl http://localhost:18080/api/dataentities/<id>` (the wire is **snake_case** —
`metadata_field_values`, not `metadataFieldValues`) + a quick live-browser `document.body.innerText`
dump (`@playwright/test chromium.launch()` from inside `e2e/`, with `PATH=$HOME/.local/node/bin:$PATH`).
Cost of NOT doing this: IT-017 first run looked like a missing-feature failure; it was a spec assertion
matching the wrong (untransformed) string.

## Progress log (one line per new IT)
- 2026-06-03 — PHASE 3 kickoff + pipeline VALIDATED (smoke green; harness operational; 6 stacks; Docker 29.5.2). Existing baseline: 12 ITs (IT-001..012). Next: author the first NEW IT for a high-criticality uncovered core-platform feature on odd-minimal (success + negative).
- 2026-06-03 — IT-013 (F-176 Data Entity Overview composition) — first AUTHORED Phase-3 IT, e2e:data-entity-overview.spec.ts. Success (seeded entity composes + renders its name, waits on the GET /api/dataentities/{id} detail fetch) + negative (absent id 999999 → entity name count 0). **GREEN (e2e:PASS, 2 passed in 52.6s)**. Added to feature-complete + ui-e2e suites; run-log/2026-06-03-IT-013.md. Reused seedEntity (no new helper). **Per-IT cost measured: ~52s** (stack-up ~15s + 2 tests ~26s + teardown) — ~200 ITs ≈ 3-4h run-time, feasible. Pattern established: seed→navigate→assert-rendered (generalises to term/owner/description/metadata display on the overview). Count: **13 ITs total (1 new), 13 features touched**. Next: more uncovered core-platform features (F-002 term display, F-004 description, F-019 owners, F-013 metadata, F-024 term search…), success + negative each.

- 2026-06-03 — IT-014 (F-004 Entity Description) — e2e:entity-description-display.spec.ts. Success (seeded
  internal_description renders on the Overview, waits on the detail GET) + negative (cleared description →
  marker absent, no stale/placeholder). GREEN (e2e:PASS, 2 passed 30.2s). Added db helper
  seedEntityDescription(text|null). feature-complete + ui-e2e; run-log/2026-06-03-IT-014.md. Count: **14 ITs
  total (2 new this session: IT-013/014)**. Next: F-002 term display / F-019 owners / F-013 metadata / F-024
  term search. RE-INGEST due after ~3 more new ITs.

- 2026-06-03 — IT-015 (F-019 Owners display) — e2e:entity-owners-display.spec.ts. Success (seeded owner
  renders on the Overview) + negative (no ownership → owner absent). **GREEN (2 passed 30.9s)** after 4 failed
  runs from IMAGE-vs-source schema drift → inspected the real schema (see KEY LESSON above) + added helpers
  seedEntityOwner/clearEntityOwners/getOrCreateNamed (ownership.title_id; SELECT/DELETE-then-INSERT).
  feature-complete + ui-e2e. Count: **15 ITs total (3 new this session: IT-013/014/015)**. The verified
  schema now makes term/metadata/tag relation seeds first-try. Next: F-002 term display, F-013 metadata,
  F-024 term search. RE-INGEST due at IT-018.

- 2026-06-03 — IT-016 (F-002 Term-to-Entity display) — e2e:entity-terms-display.spec.ts. Success (seeded
  linked term renders on the Overview) + negative (no link → term absent). **GREEN first-try (2 passed 30.5s)
  — the verified schema paid off** (no schema debugging). Added helpers seedEntityTerm/clearEntityTerms
  (term + namespace + data_entity_to_term) + widened getOrCreateNamed to namespace. feature-complete +
  ui-e2e. Count: **16 ITs total (4 new this session: IT-013/014/015/016)**. Next: F-013 metadata display,
  F-177 type badge, F-024 term search. RE-INGEST at IT-018 (next).

- 2026-06-03 — IT-017 (F-013 Custom Metadata display) — e2e:entity-metadata-display.spec.ts. Success
  (seeded INTERNAL metadata_field + metadata_field_value → the **value** renders verbatim + the field
  **label** renders) + negative (cleared value → value absent). GREEN (2 passed 9.2s on a warm stack)
  after ONE fix: the first run failed because the field NAME is rendered through TextFormatted (see KEY
  LESSON 2 below) — NOT a product bug. Diagnosed by API ground-truth (`curl /api/dataentities/2001` →
  the wire returns `metadata_field_values` snake_case correctly) + a live-browser DOM dump. Added helpers
  seedEntityMetadata/clearEntityMetadata (metadata_field INTERNAL origin + metadata_field_value, verified
  schema; getOrCreate field by (name,origin), DELETE-then-INSERT value). feature-complete + ui-e2e.
  Count: **17 ITs total (5 new this session: IT-013..017)**. RE-INGEST DUE NOW (next iter = IT-018).
  Next: F-177 type badge, F-024 term search.

## Stack-blocked (needs a docker stack that doesn't exist yet — maintainer's call to build)
- (none logged yet — collector-integration features GE/Airflow/webhook will land here when reached)
