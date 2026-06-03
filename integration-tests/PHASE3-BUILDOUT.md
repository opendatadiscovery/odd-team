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
namespace, any enum picker).

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

## Discovered findings (latent platform bugs surfaced while building ITs — for maintainer triage)
- **deserializeStats NPE → HTTP 500 on null dataset_field.stats** (found IT-023). `GET /api/datasets/{id}/structure`
  500s with `NullPointerException: Cannot invoke "org.jooq.JSONB.data()" because "stats" is null` at
  `DatasetFieldApiMapper.deserializeStats` (DatasetVersionMapperImpl.mapDatasetStructure). `dataset_field.stats`
  is nullable in the DDL (is_nullable=YES), so a field ingested without column stats makes the ENTIRE
  Structure tab unrenderable (500). Collectors normally send stats, so latent — but a single statless field
  takes down the whole dataset's schema view. Missing null-guard in the mapper. Candidate PLT-NNN / upstream
  issue + a future known-bug pin IT (seed a field with NULL stats → assert 500). Not pinned yet.

## Stack-blocked (needs a docker stack that doesn't exist yet — maintainer's call to build)
- (none logged yet — collector-integration features GE/Airflow/webhook will land here when reached)
