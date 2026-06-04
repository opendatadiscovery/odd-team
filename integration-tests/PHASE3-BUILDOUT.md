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
- `data_entity`(id, oddrn, external_name, internal_name, internal_description, data_source_id, type_id, **entity_class_ids int[]**, view_count, …) · `data_source`(id, oddrn, name, …). The header CLASS badges come from `entity_class_ids` (int[], NOT auto-derived from type_id on a raw insert — set it explicitly; DataEntityClassDto DATA_SET=1/DATA_TRANSFORMER=2/DATA_QUALITY_TEST=4/…); the TYPE badge from `type_id` (DataEntityTypeDto TABLE=1/JOB=5/MICROSERVICE=13/…).
- `owner`(id, name, created_at, updated_at, **deleted_at**) · `title`(id, name, …, deleted_at) · `role`(id, name, …, deleted_at)
- `ownership`(id, data_entity_id, owner_id, **title_id**)  ← the owner's role is a TITLE (title_id), NOT role_id
- `tag`(id, name, important?) · `tag_to_data_entity`(tag_id, data_entity_id, external)
- `term`(id, name, definition, namespace_id, …, deleted_at) · `namespace`(id, name, …, deleted_at) · `data_entity_to_term`(data_entity_id, term_id, is_description_link)
- `metadata_field`(id, type, name, origin, deleted_at) · `metadata_field_value`(data_entity_id, metadata_field_id, value, active)
- `alert`(id, data_entity_oddrn, last_created_at **NOT NULL**, status_updated_at **NOT NULL**, status smallint [OPEN=1/RESOLVED=2/RESOLVED_AUTOMATICALLY=3], type smallint [BACKWARDS_INCOMPATIBLE_SCHEMA=1/FAILED_DQ_TEST=2/FAILED_JOB=3/DISTRIBUTION_ANOMALY=4]) · `alert_chunk`(alert_id, created_at NOT NULL, description) — the alerts list **INNER-JOINs alert_chunk**, so seed BOTH or the alert is invisible
- `data_source`(id, oddrn, name, namespace_id) · `group_entity_relations`(group_oddrn, data_entity_oddrn, is_deleted) · `dataset_version`(id, version, version_hash, dataset_oddrn) · `dataset_field`(id, name, oddrn, type jsonb, stats jsonb [non-null!], field_order, is_*) · `dataset_structure`(dataset_version_id, dataset_field_id)
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

## ⚠ KEY LESSON 3 — FTS search surfaces need the ENTRYPOINT vector seeded + the right trigger
Catalog/term search does NOT query the base table — it matches a separate `*_search_entrypoint`
tsvector populated by the service on write. A raw `term`/`data_entity` INSERT is INVISIBLE to
search. To make seeded content findable: also insert `term_search_entrypoint(term_id, term_vector
= to_tsvector('english', name))` (verified: the platform's term search matches this; catalog
search uses `search_entrypoint` analogously). The term-search API is **POST `/api/terms/search`
with body `{query, filters:{}}`** (filters is REQUIRED — 400 without it) → returns `search_id` →
**GET `/api/terms/search/{search_id}/results?page&size`**. UI trigger: `TermSearchInput` fires the
search on **Enter ONLY** (`onChange` just tracks local text) — a Playwright `.fill()` alone never
searches, and because the Dictionary lists ALL terms on load, a fill-only assertion is a FALSE
PASS. Always `.press('Enter')` (or the surface's real submit) AND prove filtering with a second
seeded item that must be EXCLUDED, not just the presence of the match.

## ⚠ KEY LESSON 4 — getByText matches HIDDEN DOM; scope "not shown" negatives to visible only
Playwright `getByText`/`:text` match by `textContent`, which INCLUDES hidden elements (a closed
MUI Select / dropdown renders all its options in the DOM, hidden). So a `toHaveCount(0)` negative
on a value that ALSO appears as a hidden edit-dropdown option FALSE-FAILS (IT-021: status=STABLE
but `getByText('DEPRECATED')` resolved to 1 hidden option). `document.body.innerText` (used in the
ground-truth probes) EXCLUDES hidden text, so the probe and the locator disagree — trust the
locator. FIX: scope visible-only — `page.getByText(X,{exact:true}).filter({ visible: true })`
(Playwright ≥1.51). Use it for BOTH the present-badge assertion and the absent-badge negative
whenever the surface has an edit dropdown/select listing the same vocabulary (status, type, role,
namespace, any enum picker). ALSO applies to SVG `<title>` elements (react-flow lineage nodes put the
node name in a hidden `<title>` AND a visible label — IT-029) — always `.filter({visible:true})` for
graph/canvas labels.

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
  Count: **17 ITs total (5 new this session: IT-013..017)**. Next: F-177 type badge, F-024 term search.
- 2026-06-03 — RE-INGEST done at the 5-IT boundary (commit 96a8ab1): tests-ingest 143 test nodes (all
  gated, 0 orphan, 12 known-bug pins); graph-build w/ embeddings 6769 nodes / 8961 edges / 7720 vectors;
  alignment 🟡 PILOT-READY, ledger [D] still RED, ready-now lists F-024. **Next re-ingest at ~IT-022.**
  Next IT target: F-177 type/class badge or F-024 term search (dictionary route).

- 2026-06-03 — IT-018 (F-177 Class/Type badges on the detail header) — e2e:entity-class-type-badge.spec.ts.
  Success (TABLE entity with entity_class_ids={1} → header renders class badge "DS" + type badge "TABLE")
  + negative (entity_class_ids={} → no class badge, type badge remains — pins documented drift
  `class_array_empty_renders_no_badge`). **GREEN first-try (2 passed 9.2s)** — KEY LESSON 2 ground-truth
  FIRST paid off: pre-verified the transformed badge text (DS/TABLE) + the empty-class no-badge via a live
  header DOM dump BEFORE authoring assertions, so zero failed runs. Discovered data_entity.entity_class_ids
  (int[]) is the seedable class projection (NOT auto-derived from type_id on raw insert). Added helper
  seedEntityClassType(typeId, classIds) (verified schema; class ids DataEntityClassDto DATA_SET=1…, type
  ids DataEntityTypeDto TABLE=1/JOB=5…). feature-complete + ui-e2e. Count: **18 ITs total (6 new this
  session: IT-013..018)**. Next: F-024 term search (dictionary route), F-005/F-008/other ready-now surfaces.

- 2026-06-03 — IT-019 (F-024 Term search, Dictionary /termsearch) — e2e:term-search.spec.ts. First SEARCH
  (non-overview) surface. Success (seed 2 searchable terms; type a term + Enter → match shown, other term
  FILTERED OUT — proves search filters, not just the initial all-terms list) + negative (gibberish + Enter
  → neither term). **GREEN (2 passed 8.1s)** after ONE fix: the first run's negative failed because
  TermSearchInput searches on **Enter ONLY** (onChange just tracks local text) — my .fill() never searched,
  so the SUCCESS was a FALSE PASS off the initial all-terms list. Diagnosed by reading TermSearchInput.tsx
  + a live UI probe (term stayed visible after a gibberish .fill()). Added helper seedSearchableTerm + KEY
  LESSON 3 (FTS surfaces). feature-complete + ui-e2e. Count: **19 ITs total (7 new this session:
  IT-013..019)**. Next re-ingest at ~IT-022 (IT-017 was the last). Next: more ready-now surfaces.

- 2026-06-03 — IT-020 (F-018 entity Tags display) — e2e:entity-tags-display.spec.ts. Success (seeded
  tag chip renders verbatim on the Overview) + negative (no link → tag absent). **GREEN first-try (2
  passed 9.1s)** — ground-truth-first (API tags[] + overview DOM chip = verbatim 'IT020GoldTag').
  Distinct from IT-005 (F-018 catalog Top-Tags ordering bug) — this is the per-entity tag-chip display.
  Added helpers seedEntityTag/clearEntityTags (verified tag + tag_to_data_entity schema). feature-complete
  + ui-e2e. Count: **20 ITs total (8 new this session: IT-013..020)**. RE-INGEST due next (IT-021/022 —
  5-IT boundary since IT-017). The entity annotation-display family is now COMPLETE: desc/owners/terms/
  metadata/tags/badges. Next: status (F-044), metrics/data-quality/structure panels, or catalog search (F-017).

- 2026-06-03 — IT-021 (F-044 entity Status badge) — e2e:entity-status-display.spec.ts. Success
  (status=DEPRECATED → header badge "DEPRECATED") + negative (status=STABLE → "STABLE" shown,
  "DEPRECATED" NOT shown as a badge). **GREEN (2 passed 30.4s)** after ONE fix → KEY LESSON 4: the
  status edit-dropdown renders all status names as HIDDEN options, so getByText('DEPRECATED') matched a
  hidden option (false-fail on the negative); scoped to `.filter({visible:true})`. Verified schema:
  data_entity.status smallint (DataEntityStatusDto 1-5). Helper seedEntityStatus. feature-complete +
  ui-e2e. Count: **21 ITs total (9 new this session: IT-013..021)**. **RE-INGEST DUE at IT-022 (next).**
  Note: F-044's status_updated_at/30-day-TTL write-side drift is a SEPARATE pin candidate (not yet done).

- 2026-06-03 — RE-INGEST at IT-022 boundary (commit e27936a): tests-ingest 147 test nodes (all gated,
  0 orphan, 12 known-bug pins); graph-build 6773 nodes/8965 edges/7724 vectors; VALIDATES=116; alignment
  🟡 PILOT-READY, ledger [D] still RED. Next re-ingest ~IT-027.
- 2026-06-03 — IT-022 (F-017 Catalog search, /search — the platform's PRIMARY discovery surface) —
  e2e:catalog-search.spec.ts. Success (seed 2 searchable entities; search one + Enter → match shown,
  other FILTERED OUT) + negative (gibberish → neither). **GREEN first-try (2 passed 8.9s)** — reused the
  KEY-LESSON-3 FTS pattern + ground-truth-first: search matches search_entrypoint.data_entity_vector;
  main query box is placeholder "Search" exactly (sidebar facets are "Search by name") + searches on
  Enter; scoped exclusions to .filter({visible:true}) per KEY LESSON 4. Helper seedSearchableEntity
  (ids 2022/2023 to avoid clobbering shared entity 2001). feature-complete + ui-e2e. Count: **22 ITs
  total (10 new this session: IT-013..022)**. Search family now: catalog (F-017) + term (F-024). Next:
  structure/columns (dataset_field), linked URLs, data-quality/SLA, DEG (F-012), metrics, or ready-now.

- 2026-06-03 — IT-023 (F-045 Dataset structure/columns) — e2e:dataset-structure-display.spec.ts. Success
  (seed a dataset_version+dataset_field+structure link → Structure tab renders the column name verbatim)
  + negative (a never-seeded ghost column absent, visible-scoped). **GREEN (2 passed 9.2s)** after
  resolving the seed shape (most complex yet — versioned structure). Discovered a LATENT PLATFORM BUG
  (see Discovered findings below). Helper seedDatasetColumn (dataset_version/dataset_field/dataset_structure;
  stats MUST be non-null). feature-complete + ui-e2e. Count: **23 ITs total (11 new this session:
  IT-013..023)**. Surface variety now: overview annotations + header badges/status + 2 searches + dataset
  schema. Next: linked URLs, DEG (F-012), data-quality happy-path, metrics, namespaces. MILESTONE PING at IT-025.

- 2026-06-03 — IT-024 (F-012 Data Entity Group membership) — e2e:entity-groups-display.spec.ts. Success
  (entity 2001 made a member of a DEG → Overview "Data entity groups" renders the group name verbatim)
  + negative (no membership → group absent, visible-scoped). **GREEN first-try (2 passed 9.3s)** —
  ground-truth-first. Verified schema: group_entity_relations(group_oddrn, data_entity_oddrn, is_deleted)
  — membership by ODDRN; the DEG is itself a data_entity (class DATA_ENTITY_GROUP=8, type DAG=17). Helpers
  seedEntityGroupMembership/clearEntityGroupMembership. feature-complete + ui-e2e. Count: **24 ITs total
  (12 new this session: IT-013..024)**. Next: IT-025 (MILESTONE PING). Then linked URLs, data-quality, metrics.

- 2026-06-03 — IT-025 (F-028 Namespace display) — e2e:entity-namespace-display.spec.ts. Success (entity's
  data_source given a namespace → Overview "Namespace" field renders the name verbatim) + negative
  (data_source.namespace_id=NULL → namespace absent, visible-scoped). **GREEN (2 passed 17.8s)** —
  render confirmed in source (OverviewGeneral renders dataSource.namespace.name verbatim) + API
  ground-truth (browser ad-hoc probe was flaky this iter; the run-suite harness ran clean). Verified
  schema: data_source.namespace_id → namespace(id,name). Helpers seedEntityNamespace/clearEntityNamespace.
  feature-complete + ui-e2e. Count: **25 ITs total (13 new this session: IT-013..025)** 🎯 MILESTONE.
  Next re-ingest ~IT-027. Next surfaces: data-quality happy-path, metrics, alerts, linked-URLs (DQ-test),
  or ready-now features; collector-integration features remain stack-blocked.

### Target raised to ~50 ITs (maintainer, 2026-06-03 post-25-milestone). Continue authoring; re-ingest every ~5; milestone ping at IT-050.
- 2026-06-03 — IT-026 (F-031 Data Source management list) — e2e:datasource-management-list.spec.ts. First
  CONFIGURATION-AUDIENCE surface (/management/datasources, not entity detail). Success (seeded data source
  renders in the management list) + negative (a name belonging to no source absent, visible-scoped).
  **GREEN (2 passed 8.3s)** — ground-truth-first. Helper seedDataSource(id,name). feature-complete + ui-e2e.
  Count: **26 ITs total (14 new this session)**. NOTE: activity-feed surface DEFERRED (/api/activity param
  shape finicky) — revisit with dedicated ground-truth. RE-INGEST DUE at IT-027 (next). Next: more
  management lists (namespaces/owners/collectors/tags), data-quality, metrics, or ready-now.

- 2026-06-03 — RE-INGEST at IT-027 (commit abc49b4): 152 test nodes, VALIDATES=121, graph 6778n; PILOT-READY.
- 2026-06-03 — IT-027 (F-014 Per-Entity Alert View) — e2e:entity-alerts-display.spec.ts. Success (seed an
  OPEN alert + chunk → Alerts tab renders the type label "Backwards incompatible schema") + negative (no
  alert → type absent, visible-scoped). **GREEN (2 passed 8.5s)** — cracked the deferred alerts surface:
  the alerts list INNER-JOINs alert_chunk (a bare alert is invisible — seed a chunk too); alert needs
  status_updated_at NOT NULL + status/type smallint ids (OPEN=1; BACKWARDS_INCOMPATIBLE_SCHEMA=1). Verified
  schema banked below. Helpers seedEntityAlert/clearEntityAlerts. feature-complete + ui-e2e. Count: **27 ITs
  total (15 new this session)**. Observability surface now covered. Next: management lists, data-quality,
  metrics. Re-ingest ~IT-032.

- 2026-06-03 — IT-028 (F-019 Owner management list search) — e2e:owners-management-search.spec.ts. Success
  (seed 2 owners, "Search owner" → match shown, other FILTERED OUT) + negative (gibberish → neither).
  **GREEN (2 passed 32.2s)** after ONE fix: seedOwner SQL `SELECT $1 WHERE NOT EXISTS(... name=$1)` →
  Postgres "inconsistent types deduced for parameter $1" (untyped SELECT $1 vs text name=$1); fixed to
  two-query SELECT-then-INSERT (the robust idempotent pattern — note for future seeds: don't reuse one
  param in an untyped SELECT + a typed WHERE). Owners list filters server-side on type (debounced).
  Distinct surface from IT-015 (entity-owner display) under F-019. Helper seedOwner. feature-complete +
  ui-e2e. Count: **28 ITs total (16 new this session)**. Next: data-quality, lineage, metrics, global
  alerts (F-126), or more config lists. Re-ingest ~IT-032.

- 2026-06-03 — IT-029 (F-005 Lineage Graph Traversal) — e2e:entity-lineage-display.spec.ts. FLAGSHIP
  feature. Success (seed an upstream lineage relation → the Lineage tab react-flow graph renders the
  upstream node label) + negative (no lineage → related node absent, visible-scoped). **GREEN (2 passed
  32.4s)** after ONE fix → KEY LESSON 4 extension: react-flow puts the node name in a HIDDEN SVG <title>
  AND a visible label; getByText('X').first() matched the <title> (hidden) → toBeVisible failed; scoped
  to .filter({visible:true}). Verified schema: lineage(parent_oddrn, child_oddrn, establisher_oddrn,
  is_deleted) — parent→child by ODDRN; node labels queryable text. Helpers seedEntityLineage/
  clearEntityLineage. feature-complete + ui-e2e. Count: **29 ITs total (17 new this session)**. Next:
  data-quality, metrics, global alerts (F-126), facets, more config lists. RE-INGEST at IT-032 (next).

- 2026-06-03 — IT-030 (F-126 Global Alerts List Page) — e2e:global-alerts-list.spec.ts. Success (seed an
  OPEN alert → the global /alerts "All" tab lists it: entity it002_table + type "Backwards incompatible
  schema") + negative (no open alert → absent, visible-scoped). **GREEN (2 passed 8.4s)** — REUSED the
  IT-027 seedEntityAlert/clearEntityAlerts helpers (no new helper). Distinct from IT-027 (per-entity tab)
  — F-126 is the platform-wide page. feature-complete + ui-e2e. Count: **30 ITs total (18 new this
  session)**. DEFERRED this iter: data-quality (F-022) — GET /api/datasets/{id}/dataqatests 500s
  (mapDataQualityTest NPE on null dqDto.datasetList(); the QT entity needs rich specific_attributes DQ
  JSON, reverse-engineering needed; likely ingestion-only-reachable like deserializeStats — see Discovered
  findings). RE-INGEST at IT-032 (next). Next: metrics, facets, roles/policies/collectors config, activity.

- 2026-06-03 — IT-031 (F-178 business name / internal_name header display) — e2e:entity-business-name-display.spec.ts.
  Success (set internal_name → header heading shows it verbatim) + negative (clear → header falls back to
  external_name, business name absent). **GREEN (2 passed 9.2s)** after 3 dead-ends this iter (entity runs =
  no clean feature id [F-040 is DQ-only]; roles + policies management lists return [] for raw inserts — see
  Discovered findings). Helper seedEntityBusinessName. feature-complete + ui-e2e. Count: **31 ITs total (19
  new this session)**. ⚠ PLATEAU WATCH: clean raw-seedable surfaces thinning (RBAC lists, DQ, metrics,
  collectors need ingestion-shaped/create-API seeding or stacks). Remaining clean veins: search FACET
  filtering (F-017 behaviour), search suggestions, tags-management list, a few entity-detail nuances. If
  these run out before 50 → ping maintainer with built-vs-blocked (per loop). RE-INGEST at IT-032 (next).

- 2026-06-03 — RE-INGEST at IT-032 (commit 3fa8fe7): 157 test nodes, VALIDATES=126, PILOT-READY.
- 2026-06-03 — IT-032 (F-151 Term Detail Page Composition) — e2e:term-detail-page.spec.ts. Success (seed a
  term + definition → /terms/{id}/overview renders name + definition verbatim) + negative (a 2nd term's
  definition absent on the 1st term's page — term-specific). **GREEN (2 passed 8.4s)**. NEW clean surface
  (plateau NOT yet hit) — distinct from IT-019 term search + IT-016 term-to-entity. This iter ALSO surveyed
  search FACET filtering (F-017): facet UI interaction is complex (results+facet controls not cleanly
  findable via ad-hoc probe) — DEFERRED (needs careful facet-control ground-truth; not blocked, just fiddly).
  Helper seedTermWithDefinition (returns the term id for the dynamic route). feature-complete + ui-e2e.
  Count: **32 ITs total (20 new this session)**. Next clean veins: search suggestions, term linked-entities
  (F-153), external_description, more term/entity detail nuances. RE-INGEST ~IT-037.

- 2026-06-03 — IT-033 (F-002 term-side — term Linked-entities tab) — e2e:term-linked-entities.spec.ts.
  Success (term linked to entity 2001 → /terms/{id}/linked-entities lists it002_table) + negative (an
  unlinked term lists none). **GREEN (2 passed 8.9s)**. Reverse of IT-016 (entity→term) — distinct surface
  + code path (TermController.getLinkedEntities). Helper seedTermLinkedToEntity (returns term id). DEFERRED
  this iter: linked_columns (F-153) — GET /api/terms/{id}/linked_columns 500s (NPE: column's parent
  dataEntityPojo null; needs the full column→dataset_structure→data_entity chain — see Discovered findings).
  feature-complete + ui-e2e. Count: **33 ITs total (21 new this session)**. Next clean veins: search
  suggestions, external_description, linked-terms (F-?), query-examples. RE-INGEST ~IT-037.

- 2026-06-03 — IT-034 (F-155 Term Query-Example Linkage) — e2e:term-query-examples.spec.ts. Success (term
  + linked query_example → /terms/{id}/query-examples renders the definition + SQL) + negative (term with
  no example lists none). **GREEN (2 passed 32.3s)** after ONE fix → wait-pattern lesson: for TAB content
  that loads after navigation, do NOT strict-`waitForResponse` the tab's own API (it can fire before the
  listener or under a different URL → 60s timeout); instead wait (catch-safe) on the always-present detail
  GET (/api/terms/{id}) + a short settle, and let toBeVisible/toHaveCount poll. Verified schema:
  query_example(id, definition, query) · query_example_to_term(query_example_id, term_id). Helper
  seedTermWithQueryExample (returns term id). feature-complete + ui-e2e. Count: **34 ITs total (22 new this
  session)**. Remaining clean veins thinning: search suggestions, external_description, linked-terms.
  RE-INGEST ~IT-037. ⚠ If next iter's clean candidates exhaust → ping plateau (built-vs-blocked).

## ⚠ PLATEAU REACHED at 34 ITs (2026-06-03) — clean raw-seedable surfaces exhausted
After 22 new green ITs this session (IT-013..034), the supply of CLEAN, stack-available, raw-seedable,
non-dup feature surfaces is exhausted. IT-035 survey hit two non-viable candidates:
- **linked-terms (F-152)** — `GET /api/terms/{id}/term` returns 500/405; the linked-terms LIST API shape
  is non-trivial (the `/term` path is the link/unlink mutation, not the list — the list is likely embedded
  in the term detail response or a different GET). Needs investigation; the tab page also hangs on the 500.
- **external_description display** — API returns it, but it's F-004 (DUP of IT-014 internal_description;
  same OverviewDescription component, fallback field) → thin/dup, declined per no-test-theatre.
The remaining uncovered surfaces ALL need investment, not more of the same:
- **Fiddly UI** (multi-probe each): search facets (F-017), search suggestions autocomplete, linked-terms.
- **Ingestion-shaped / create-API seeding**: data-quality (F-022, specific_attributes DQ JSON), metrics,
  RBAC role/policy lists (F-006), linked_columns (F-153, column→dataset chain), activity feed (/api/activity).
- **Absent docker stack**: collector-integration features (GE/Airflow/webhook), collectors mgmt (token).
**Recommendation for the maintainer (fork):** (a) accept ~34 as the honest stopping point for the
raw-seed approach (a strong, comprehensive UI→backend→DB suite), OR (b) invest in an INGESTION-API seed
helper (POST through the real ingestion contract → unlocks DQ/metrics/structure/lineage-columns with
realistic data), OR (c) build collector docker stacks (unlocks the collector-integration family), OR
(d) have me grind the fiddly-UI surfaces (facets/suggestions/linked-terms) at ~1-2 iterations each.
Reaching ~50 needs (b)/(c)/(d); it is NOT reachable by raw-seed display ITs without padding.

## ✅ PLATEAU BROKEN (2026-06-04) — ingestion-API seed helper (unlock option b)
Built `e2e/helpers/ingest.ts`: `createDataSource` (POST /api/datasources) + `ingestEntities`
(POST /ingestion/entities) + `tableEntity` (minimal TABLE item per ingestion/samples/07_kinesis;
snake_case wire `data_source_oddrn`/`field_list`) + db helpers `seedIngestionDataSource`/`entityByOddrn`
(reads the `hollow` flag). This drives the REAL ingestion contract — the CRITICAL data family
(F-008 itself, F-030 metrics, F-022 DQ, realistic structure/lineage) is now reachable. Under
odd-minimal (DISABLED → permitAll, entities-filter OFF) the POSTs need no collector token.
- 2026-06-04 — IT-035 (F-008 Batch Ingestion — ingestion-write contract) — e2e:ingestion-reingest-contract.spec.ts.
  FIRST ingestion-API-driven IT. **UC-13** (re-ingest non-destruction): ingest {a,b} → re-ingest {a} →
  b STILL live + hollow=false → **GREEN**. EMPIRICAL CORRECTION — the reflector's entity-level "silent
  destruction" hypothesis is FALSE; top-level re-ingest is non-destructive upsert (the omitted lineage-EDGE
  half via LineageServiceImpl.replaceLineagePaths remains a follow-up — extend with a lineage-bearing payload).
  **UC-06** (atomicity): duplicate-ODDRN batch rejected whole (500 from Collectors.toMap) + NO partial row →
  **GREEN**. **2 passed (27.6s).** feature-complete + ui-e2e + I5. F-008 frontier 5/14 → 7/14. Count: **35 ITs
  total.** Next critical via the helper: F-030 metrics (ingestMetrics → GET /api/dataentities/{id}/metrics),
  F-022 DQ (specific_attributes via real ingest — retry the NPE-blocked surface), more F-008 (UC-12 audit,
  the UC-13 lineage-edge half). RE-INGEST due ~IT-037.
- 2026-06-04 — **PERSISTENT-STACK GRIND** (efficiency unlock): bring odd-minimal up ONCE
  (`docker-compose -p probe-stacks -f probe-stacks/odd-minimal.docker-compose.yml up -d`) + run each IT
  with `ODD_STACK_EXTERNAL=1 run-suite.sh IT-NNN` → **~1-2s per IT** (vs ~28s with churn). Probed
  feature-gating: metrics ENABLED (POST /ingestion/metrics→201), stats ENABLED (→201), lineage real
  (json). ⚠ KEY LESSON 5 (CORRECTED 2026-06-04 — I got this WRONG first; maintainer caught it): a GET to
  ANY unmatched path returns **200 text/html (the SPA index.html fallback)**, so a 200 on a GET proves
  nothing — ALWAYS check `content_type` (application/json = real API) AND read the CONFIG for the
  configured path. I probed the springdoc DEFAULT paths (/v3/api-docs, /swagger-ui), hit the SPA
  fallback, and FALSELY concluded "no swagger shipped / F-097 not runtime-testable". WRONG: odd-platform
  ships `springdoc-openapi`; application.yml configures it (paths SWAPPED) at UI=`/api/v3/api-docs`
  (302→webjars shell 200) + JSON spec=`/api/v3/swagger-ui.html`. The UI shell loads; the SPEC HANGS
  (springdoc 2.2.0 × Spring 6.2 `NoSuchMethodError` → PLT-141). F-097 IS testable → IT-042 (UI-shell
  lock + spec-hang pin). LESSON: never conclude a feature is ABSENT from a default-path probe — read the build+config.
- 2026-06-04 — IT-036 (F-030 Metrics Ingestion) — e2e:metrics-ingestion.spec.ts. Collector ingests a GAUGE
  family (POST /ingestion/metrics→201) → GET /api/dataentities/{id}/metrics serves it back; no-metrics
  entity → no family. **GREEN (2 passed 1.8s).** Helper ingest.ts +ingestMetrics/gaugeFamily/getEntityMetricsBody.
- 2026-06-04 — IT-037 (F-055 Lineage Depth Boundary) — e2e:lineage-depth-boundary.spec.ts. explicit
  lineage_depth=1 → 200 (green lock); UNSET depth → **500 NPE** (GREEN characterization pin of the broken
  "unset returns default" contract, DOC-GAP-089/TEST-GAP-279; flip when fixed). **GREEN (2 passed 973ms).**
- Count: **37 ITs total** (IT-035/036/037 ingestion-family via the helper). NOTE: use_case_coverage flips
  for F-030/F-055 are BATCHED (pending a reconciliation pass) — per-IT traceability is in the protocol
  `gates.validates`. Next tractable: F-095 stats, F-123 deletion-recreate, F-008 UC-13 lineage-edge half.
- 2026-06-04 — IT-038 (F-123 Deletion Semantics) — e2e:deletion-recreate-semantics.spec.ts. create
  datasource → DELETE (204) → re-create same name+oddrn → **200** (soft-delete is not a unique-constraint
  landmine — DATA-LOSS contract holds); + delete is effective (gone from the active list, JSON-parsed to
  dodge the SPA fallback). **GREEN (2 passed 893ms).** Distinct axis (resource lifecycle, not ingestion).
- **38 ITs total** (035-038 this grind: F-008/F-030/F-055/F-123). PENDING RECONCILIATION (wind-down or a
  fresh wakeup): (1) add IT-038 to feature-complete+ui-e2e+I5; (2) flip use_case_coverage for F-030/F-055/
  F-123 (read each feature's use_cases, set the verified promise `coverage: verified` + `test_ref` + bump
  the counter, like F-008 did); (3) re-ingest the ontology graph. Next tractable critical: F-095 stats
  (POST /ingestion/entities/datasets/stats→201, needs DataSetField + DatasetStatisticsList shapes),
  F-008 UC-13 lineage-edge half (transformer payload), F-047 column annotation, F-096 batch atomicity.

- 2026-06-04 (wakeup-loop iter 2) — IT-039 (F-047 Dataset Field structure via REAL ingest) +
  IT-040 (F-046 Custom Metadata Catalogue). IT-039: ingest TABLE w/ dataset.field_list → GET
  /api/datasets/{id}/structure shows the column; re-ingest w/ an added column surfaces it (schema
  evolution). Real ingest avoids the IT-023 raw-seed deserializeStats NPE. GREEN (2 passed 1.2s).
  IT-040: seed INTERNAL metadata field → GET /api/metadata/fields?query= returns it; non-match
  excluded. GREEN (2 passed 743ms). DataSetField ingest shape = {oddrn,name,type:{type:TYPE_STRING,
  logical_type,is_nullable}}. ⚠ list endpoints (/api/datasources, /api/tags, /api/namespaces,
  /api/owners) 500 WITHOUT page/size params (add ?page=1&size=N); /api/metadata/fields is paramless-OK.
- **40 ITs total. 6 critical features this run: F-008, F-030, F-055, F-123, F-047, F-046.** Couldn't
  quickly find clean ingest shapes for transformer-lineage (F-008 UC-13 edge-half) or stats (F-095) —
  no sample/contract field-names located; needs the DataTransformer + DatasetStatisticsList contract
  models read directly (next iter). RBAC/auth family (F-006/F-011/F-105) is auth-stack-blocked on
  odd-minimal (DISABLED=permitAll). PENDING RECONCILIATION still open (suites feature-complete/ui-e2e
  add for 038-040; use_case_coverage flips for F-030/F-055/F-123/F-047/F-046; graph re-ingest).
- 2026-06-04 (iter 2 cont.) — IT-041 (F-208 Data Entity Staleness) — e2e:entity-staleness.spec.ts.
  fresh entity → is_stale=false; UPDATE last_ingested_at = NOW()-30d → is_stale=true; re-ingest →
  is_stale=false. GREEN (2 passed 1.2s). The default stale-period is ACTIVE with no explicit env →
  DISPROVES F-208-UC-2 "unset silently disables" on this image. db helper +setEntityLastIngestedDaysAgo.
  **41 ITs total; 7 critical features this run: F-008/F-030/F-055/F-123/F-047/F-046/F-208.** Add IT-041
  to the suites + flip F-208 coverage at reconciliation.

- 2026-06-04 (iter 4, post-Swagger) — RE-PROBED the two features I'd WRONGLY dismissed (read-the-config
  discipline + live probes, not guesses). **IT-043 (F-005/F-008 lineage via ingestion):** the ingestion
  data_transformer uses `inputs`/`outputs` ODDRN arrays (NOT source_oddrn_list — my earlier grep guess);
  ingesting a JOB creates A→job→B edges; re-ingesting the job with outputs=[] REMOVES the omitted edge
  (UC-13 edge-half = replace, not merge). GREEN. **IT-044 (F-095 stats):** DataSetFieldStat wrapper is
  `number_stats` (a wrong key = silent hollow 201 → assert the READ-BACK); pushed unique_count reads back
  on the structure; an unstated field has null stats. GREEN. Helpers: ingest.ts +transformerEntity/
  numberField/ingestNumberFieldStats; db.ts +lineageEdgeExists. **44 ITs total.** HONESTY: neither bumped
  the promise-frontier (UC-13 already counted via IT-035; F-095-UC-1 via a prior probe) — they UPGRADE
  probe→durable-IT + complete UC-13's edge half. LESSON CONFIRMED: both WERE testable; the earlier "not
  tractable" was under-verification (same root cause as the Swagger miss). NEXT: prioritise UNVERIFIED
  promises (frontier-moving) — F-059/F-125/F-094/F-096/F-058 + F-095 edge/validation (UC-5/10/11).

- 2026-06-04 (iter 5) — IT-045 (F-095 stats INPUT-VALIDATION gaps) — first FRONTIER-MOVING batch:
  targeted UNVERIFIED promises, probed read-back-first. The stats endpoint has NO input validation →
  3 LSN-029 characterization pins (GREEN now, flip when validation lands), F-095 frontier **2/12 → 5/12**:
  UC-11 empty/null body → 500 (not 4xx); UC-10 unknown field ODDRN → silent 201 (no signal); UC-5
  out-of-range (low>high, negative counts) → 201 + STORED VERBATIM (read-back). Drafted **PLT-142**
  (stats endpoint no input validation, 3 facets). **45 ITs total.** Lesson applied: assert read-back,
  not POST status (a wrong key / bad value still 201s). Next unverified: F-095 UC-6/7/12 (tag-auth,
  tag-preserve, DoS), F-125 token lifecycle, F-008 UC-12 audit-on-ingest, lookup features (F-059/F-058).

## ✅ RUN SUMMARY — 2026-06-04 autonomous integration grind (WOUND DOWN)
**13 new ITs (IT-035..047), 47 total. Stack torn down.** All GREEN + pushed to odd-team main.
- **F-008 Batch Ingestion (the #1 risk): 4/14 → 9/14** — UC-02 (ingestion-filter coverage gap / PLT-003, unit),
  UC-03/04/05/08 (datasource pins, prior), UC-06 (duplicate-ODDRN atomicity), UC-13 (entity non-destruction
  + lineage-edge replace), UC-01 (anon write), UC-10 (anon collector/token mint). [IT-035/043/046]
- **F-095 Statistics Ingestion: 2/12 → 7/12** — round-trip (IT-044); 3 input-validation gaps (PLT-142:
  500-on-empty-body, silent-accept-of-unknown-field, out-of-range-stored); tag handling (anon mint +
  re-push silent-drop). [IT-044/045/047]
- F-030 metrics (IT-036) · F-055 lineage-depth + unset-NPE pin (IT-037, 2/11) · F-123 deletion-recreate
  (IT-038, 1/11) · F-047 dataset structure via ingest (IT-039) · F-046 metadata catalogue (IT-040) ·
  F-208 staleness (IT-041, 1/12) · F-005 lineage via ingestion (IT-043) · F-097 Swagger discovery (IT-042, 1/11).
- **Swagger recovery:** corrected a false "no Swagger" claim; recovered the orphaned API-Reference doc page
  (live-verified 200) + documented the known-issue; PLT-141 (springdoc 2.2.0 × Spring 6.2 spec-hang).
- **Engine:** ingestion-API seed helper (broke the raw-seed plateau) + persistent-stack (~1-2s/IT).
- **2 upstream bug drafts:** PLT-141 (Swagger spec-hang, high) · PLT-142 (stats no-validation, medium).
- **Honesty:** ~+14 promise verifications across 6 features; IT-043/044 upgraded probe→durable-IT (no
  double-count). The read-the-config discipline turned 2 wrong "not tractable" dismissals into landed tests.

**LEFT (maintainer-scoped, not faked):** RBAC/owner-scoping/OAuth (F-006/011/105/084/086) — auth-stack-blocked
on odd-minimal (DISABLED=permitAll); needs odd-loginform/odd-ldap + an authenticated-admin-API seed helper.
Lookup tables (F-059/F-058) + F-008-UC-10 UI half (PLT-103) — need Playwright/browser flows. F-008-UC-11
(cluster session-bridge), F-095-UC-8/12 (concurrency/DoS) — probe/multi-node. DEFERRED: graph re-ingest +
worklist/scorecard regen → do post-merge of the unit-test branch (substrate scan is behind HEAD; odd-team
ITs aren't graph-ingested). Promise-frontier flips are committed in the SoT (feature-flows/detail).

## ⚠ WIND-DOWN POLICY (loop: read before grinding more) — 2026-06-04
The easy odd-minimal-tractable lane is largely exhausted after **7 critical features this run**
(F-008/030/055/123/047/046/208 = IT-035..041, all GREEN + pushed). Remaining critical features need
real investment: (a) ingestion contract-model shape-hunting — stats F-095 (DatasetStatisticsList +
per-field-type stat objects) and lineage-edge F-008-UC-13 (DataTransformer source/target oddrn lists)
— READ the generated ingestion contract models under `odd-platform-api/build/generated/.../ingestion/contract/model/`
before authoring; or (b) auth stacks — RBAC/owner-scoping F-006/F-011/F-105/F-084/F-086 are
BLOCKED on odd-minimal (DISABLED=permitAll → no authz to assert); they need odd-loginform/odd-ldap +
an authenticated-admin-API seed helper (a separate build).

**Loop policy for the next iteration(s):** attempt AT MOST 1-2 more features IF quickly tractable, THEN
**WIND DOWN** (do not reschedule indefinitely). Wind-down = the PENDING RECONCILIATION:
1. suites.yaml — add IT-035..041 to `feature-complete` + `ui-e2e` (035-037 already in; add 038-041).
2. use_case_coverage flips — for F-030/F-055/F-123/F-047/F-046/F-208, edit
   `lineage/odd-platform/feature-flows/detail/F-NNN.yaml`: set the verified promise(s)
   `coverage: verified` + add a `test_ref:` (IT-NNN) + bump `use_case_coverage.verified`, exactly like
   F-008.yaml. PyYAML-validate each. (F-008 already flipped.)
3. graph re-ingest — `cd lineage/_extractor && uv run lineage-extractor tests-ingest odd-platform && uv run lineage-extractor graph-build odd-platform && uv run lineage-extractor alignment odd-platform`.
4. commit + push; tear down the persistent stack (`docker-compose -p probe-stacks -f lineage/_extractor/probe-stacks/odd-minimal.docker-compose.yml down -v`); PushNotification the maintainer with the coverage summary (7+ features, total IT count, what remains: stats/lineage shape-work + the auth-stack RBAC family).

## Discovered findings (latent platform bugs surfaced while building ITs — for maintainer triage)
- **deserializeStats NPE → HTTP 500 on null dataset_field.stats** (found IT-023). `GET /api/datasets/{id}/structure`
  500s with `NullPointerException: Cannot invoke "org.jooq.JSONB.data()" because "stats" is null` at
  `DatasetFieldApiMapper.deserializeStats` (DatasetVersionMapperImpl.mapDatasetStructure). `dataset_field.stats`
  is nullable in the DDL (is_nullable=YES). **Reachability (checked IT-024): NOT operator-reachable via
  ingestion** — `DatasetFieldIngestionMapper.mapStat` does `serializeIntoJSONB(stat)`, so an omitted stat
  becomes JSONB `'null'` (a json-null value), NOT SQL NULL; `deserializeStats` only NPEs on SQL NULL, which
  requires a direct DB write. So this is a DEFENSIVE-HARDENING gap (the read mapper should null-guard
  `JSONB.data()`), NOT a live operator-facing bug → deliberately NOT pinned (a known-bug pin must
  reproduce an operator-reachable defect). Worth a low-priority upstream hardening note only. The IT-023
  seed sets stats='{}' to avoid it.
- **mapDataQualityTest NPE → HTTP 500 on null dqDto.datasetList()** (found IT-030). `GET /api/datasets/{id}/dataqatests`
  500s with NPE at `DataEntityMapperImpl.mapDataQualityTest:367/379` when a QUALITY_TEST entity lacks its
  DQ-detail attributes (datasetList/suiteName from specific_attributes). Same class as deserializeStats:
  ingestion always supplies these, so likely NOT operator-reachable via a real ingest — a defensive-hardening
  gap. NOT pinned. Blocks a raw-seed DQ e2e (F-022 per-dataset DQ test reports) — that IT needs the QT entity's
  specific_attributes DQ JSON reverse-engineered, OR an ingestion-API-driven seed. Deferred.
- **RBAC management lists (roles/policies) return [] for raw inserts** (found IT-031). `GET /api/roles` and
  `GET /api/policies` return `items:[] total:0` even with a raw-inserted row (deleted_at NULL). The list
  query filters/joins beyond a bare row (likely a default-data join or a name/system filter). F-006 RBAC
  management lists are NOT raw-seedable as-is → an RBAC-config IT needs the create-API or the missing join
  reverse-engineered. Deferred (not a bug — a seeding-shape gap). Also: generic entity "runs" tab has no
  clean dedicated feature id (F-040 is DQ-specific) → skip.
- **linked_columns NPE → HTTP 500 on a column's null parent dataEntityPojo** (found IT-033). `GET
  /api/terms/{id}/linked_columns` 500s (NPE getExternalName on a null DataEntityPojo) when the linked
  dataset_field isn't fully associated with its parent dataset (dataset_structure→dataset_version→
  data_entity chain). A raw dataset_field + dataset_field_to_term link is insufficient. F-153 (term linked
  columns) DEFERRED — needs the full column→dataset chain seeded, OR ingestion. Likely
  ingestion-only-reachable (a real ingest always has the parent) → defensive gap, NOT pinned.

## Stack-blocked (needs a docker stack that doesn't exist yet — maintainer's call to build)
- (none logged yet — collector-integration features GE/Airflow/webhook will land here when reached)
