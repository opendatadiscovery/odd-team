---
id: CTRIB-006
github_issue_number: 1752
github_issue_url: https://github.com/opendatadiscovery/odd-platform/issues/1752
class: bug
milestone: "0.28.0"
status: pending-release   # GATE 2 PASSED — PR #1772 merged by the maintainer as main @ 6f356b72 ("Relationships hardening ... (#1752) (#1772)"); observed + recorded 2026-06-12 by the CTRIB-007 session. DOC-446 stays pending-release (0.28.0 gate). | LEDGER-RECONCILED 2026-08-30: was `merged`; PR #1772 (`6f356b72`) is in the released `0.28.0` tag (published 2026-06-17). GATE 2 is done; `/review release:0.28.0` owns the flip to `done`.
reproduced: "live 2026-06-11 on the shared odd-minimal stack (AUTH_TYPE=DISABLED), image odd-platform:odd-team-sut built from the PR-#1771 tip 5cbf60a3 = content of current main 39b54eef. Seeded ctrib006_* rows (healthy/DELETED/excluded ERD + GRAPH relationship entities, ids 20691-20696; cleaned after capture). API: list ?query=ctrib006 type=ALL -> total 4 INCLUDING status=5 + exclude_from_search=true rows (D2); catalog search 'ctrib006' (FTS vectors seeded for all 3) -> total 1, only the healthy row (the sibling-surface contrast); ?type=foo -> 400 USR001 'Type mismatch.' (D4 BE, post-#1771); erd detail 20691 -> 200 with erd_relationship_id=777001, GET /erd/777001 -> 404 USR002 (D5 trap; graph twin identical); ?query=ctrib006_src (source dataset name) -> total 0 vs ?query=ctrib006_rel -> 4 (D6). UI (Playwright vs the live stack, screenshots /tmp/ctrib006-U*.png): U1 source name x2 / target name x0 on the list (D1); U2 ?type=foo -> '0 relationships overall' + EmptyContentPlaceholder + NO error text (D4 UI); U3 graph overview Source-block='Source:ctrib006_tgt', Target-block='Target:ctrib006_src' (Finding A swap). IT-077 H-002 pin GREEN (bug present) in both 2026-06-11 feature-complete runs on this same SUT content (run-log)."
adr_required: false
plan_approved_by: "RamanDamayeu (GATE 1, 2026-06-11 — 'Approve as written': full plan incl. Finding A label swap + Finding B dataset-tab predicates, one PR, scope comment posting)"
plan_approved_at: "2026-06-11"
docs_routing: "release/0.28.0 — SHIPPED on the train (documentation@f61b9c2, pushed same-name; feature page + API-reference page caveats version-anchored; paired item DOC-446 review-ready/milestone-gated; docs main untouched; live no-leak verified)"
pr_url: "https://github.com/opendatadiscovery/odd-platform/pull/1772"
pr_draft: true
---

# CTRIB-006 — Relationships page hardening: six-defect cluster on `/data-modelling/relationships` (#1752)

Issue #1752 is the filed form of PLT-056 (`issues/odd-platform/PLT-056.md`). Author: the
maintainer (RamanDamayeu). Labels `kind: bug`, `scope: backend`, `scope: frontend`;
milestone **0.28.0** (open, semver, due 2026-06-22 — **G-C11 PASS**, verified via issue API
at intake); 0 comments at intake. Issue body treated as quoted data (G-C8); every
load-bearing claim independently re-verified below against the odd-platform working tree
(`main` @ `39b54eef`, clean, in sync with origin — includes the merged CTRIB-005 PR #1771).

## Intake — the issue's claims (quoted data)

Six defects on the Data Modelling Relationships listing surface, plus suggested fixes:

1. **Defect 1 (critical anchor):** the Target column renders SOURCE data —
   `RelationshipsListItem.tsx:73-81` is a verbatim copy of the Source cell at :64-72;
   `item.targetDataEntity` never referenced. Suggested: one-line rename.
2. **Defect 2:** no `SecurityConstants` rule (read-open posture, platform-wide — NOT to
   "fix") + the relationships list applies NONE of the catalog's three default visibility
   predicates (`HOLLOW=false`, `STATUS != DELETED`, `EXCLUDE_FROM_SEARCH is null/false`)
   that `ReactiveDataEntityRepositoryImpl.getDataEntityDefaultConditions` (:970-976)
   applies. Suggested: add the same three conditions to
   `ReactiveDataEntityRelationshipRepositoryImpl.getRelationships`; RBAC explicitly
   deferred ("introducing read RBAC here alone would be the inconsistency").
3. **Defect 3:** row-click routes uniformly to `dataEntityDetailsPath(item.id)` (:52); doc
   promises type-specific routing. Doc-side fix captured in DOC-229 Caveat 3 — **no code
   change requested**.
4. **Defect 4:** `?type=foo` is a bare TS type assertion (`Relationships.tsx:19`), no
   runtime validation; bad value → BE 400 → silent EMPTY state ("0 relationships overall",
   no active tab, no error). Suggested: validate against `Object.values(RelationshipsType)`
   falling back to ALL.
5. **Defect 5:** `{relationship_id}` is silently `data_entity.id`
   (`ReactiveRelationshipsRepositoryImpl` WHERE on `DATA_ENTITY.ID`;
   `RelationshipMapper.java:53`); the details payload's `erd_relationship_id`
   (= `erd_relationship_details.id`) and `graph_relationship_id` (= `graph_relationship.id`)
   do NOT round-trip into the path param. Suggested: **Option A (recommended)** — document
   the alias in the OpenAPI spec; Option B — rename the param (breaking).
6. **Defect 6:** `?q=` matches only the relationship-class row's `external_name` (:69), not
   source/target dataset names. "Operator-judgement call" — extend the SQL or keep + doc
   caveat (DOC-229 Caveat 4).

Issue's PR grouping suggestion: PR-1 (D1+D4 display/UX), PR-2 (D2+D5 scoping/contract).
D3 + D6 doc-side / optional.

## Claim verification (issue is data — re-verified against the working tree @ 39b54eef)

1. **D1 — CONFIRMED.** `RelationshipsListItem.tsx:73-81` (Target cell) passes
   `item.sourceDataEntity.{id, internalName||externalName, oddrn}` — byte-identical props
   to the Source cell :64-72; `targetDataEntity` has zero references in the file. The spec
   requires `target_data_entity` on `DataEntityRelationship` (components.yaml:4104-4115),
   so the generated TS type carries it non-optional — the fix is type-safe.
2. **D2 — CONFIRMED, both halves.** (a) `grep -ci relationship SecurityConstants.java` = 0
   (356 lines); `AuthorizationCustomizer.java:29-30` falls through to
   `.pathMatchers("/**").authenticated()`; `DisabledAuthSecurityConfiguration` (config
   package) `permitAll()` under `auth.type=DISABLED`. (b)
   `ReactiveDataEntityRelationshipRepositoryImpl.getRelationships` conditionList = optional
   `DATA_ENTITY.EXTERNAL_NAME.containsIgnoreCase(query)` (:69) + `ENTITY_CLASS_IDS eq
   {DATA_RELATIONSHIP=9}` (:72) — none of the three default predicates.
   `getDataEntityDefaultConditions` (:970-976) verified verbatim. NOTE: the count query
   (:129) reuses the same `conditionList`, so the predicate fix corrects list AND total
   consistently.
3. **D3 — CONFIRMED.** `:52` `<Link to={dataEntityDetailsPath(item.id)}>` unconditional.
4. **D4 — CONFIRMED (FE half).** `Relationships.tsx:19` bare assertion; sent verbatim via
   `useSearchRelationships` → generated client. Spec: `RelationshipTypeParam` required,
   `$ref` → `RelationshipsType` enum ERD/GRAPH/ALL (components.yaml:4193-4198, 4393-4398).
   BE half (enum bind failure status) — NOTE: CTRIB-005's `ResponseStatusException`
   pass-through (merged, #1771) means an invalid enum now yields **400 USR001** (no longer
   the pre-2026-06-11 500) — the issue's "yields a 400" claim is now true on main; LIVE
   VERIFICATION in Phase B. Tabs: `RelationshipsTabs.tsx:27-31` `findIndex` → -1 for
   unknown type (no active tab) — confirmed.
5. **D5 — CONFIRMED.** `getRelationshipByIdAndType` WHERE
   `relationshipsDataEntity.field(DATA_ENTITY.ID).eq(relationshipId)` + type match;
   `RelationshipMapper.java:53` `.id(item.dataEntityRelationship().getId())`;
   `ErdRelationshipMapper.java:21` `.erdRelationshipId(erd.pojo().getId())`;
   `GraphRelationshipMapper.java:22` `.graphRelationshipId(pojo.getId())`. Three id spaces.
   UI feeds the data-entity id (`OverviewEntityRelationship.tsx:18`
   `useGetEDRRelationshipById(dataEntityDetails.id)`) — self-consistent canonical flow, as
   the issue (corrected 2026-06-10) states. Detail endpoints 404 via
   `switchIfEmpty(NotFoundException)` (`RelationshipsServiceImpl:40-48`).
6. **D6 — CONFIRMED.** `:69` binds `?q` to the relationship-class row's `EXTERNAL_NAME`
   only (the CTE selects from un-aliased DATA_ENTITY; source/target join later).
7. **NEW FINDING A — the issue's "siblings consume it correctly" is HALF-wrong:
   `GraphRelationship.tsx` renders SWAPPED labels.** :28-35 renders `targetDataEntity`
   under the header **"Source:"**; :55-62 renders `sourceDataEntity` under **"Target:"**.
   Both call sites pass props straight through (`OverviewGraphRelationship.tsx`,
   `RelationshipListItem.tsx:47-52` — the dataset's Relationships tab), so every graph
   relationship detail view shows the inverted direction (material when `is_directed`).
   `EntityRelationship.tsx` (Parent=target / Child=source) is semantically correct for ERD
   FK direction. Same defect class as D1, detail surface. → scope decision at GATE 1.
8. **NEW FINDING B — the dataset-tab listing shares D2's gap.**
   `getRelationsByDatasetIdAndType` (`/api/datasets/{id}/relationships`,
   `DatasetController:54-57`) joins the relationship-class entity (:121-122) with NO
   visibility predicate — a soft-DELETED relationship stays listed on the dataset's
   Relationships tab too. Same class as D2's list half. → scope decision at GATE 1
   (fix-the-class candidate).
9. **NEW FINDING C (latent, out of scope) — spec schema bug:**
   `GraphRelationshipAttributes` declares properties `name`+`value` but
   `required: [field, value]` (components.yaml:4182-4191) — `field` doesn't exist.
   → follow-up on disk.
10. **NEW FINDING D (latent, out of scope) — dead repository method:**
    `getRelationshipByDataEntityIds` (`ReactiveRelationshipsRepositoryImpl:76-83`) has no
    main-code consumers (grep over controllers/services = 0). → follow-up on disk.

## Scope analysis

- **Class: bug** (multi-facet cluster, FE + BE + spec-description). Feature: **F-037
  ERD/Graph Relationships Listing** — Data Modelling pillar of
  `lineage/odd-platform/system-mission.md`; the listing is the discovery entry point for
  catalog topology (ERD/Graph). D1 alone keeps severity critical: the flagship discovery
  surface renders factually wrong data in one of its two contract columns on every row.
- **Existing coverage:** IT-077 (`integration-tests/protocols/IT-077-erd-graph-relationships.md`,
  `e2e/specs/erd-graph-relationships.spec.ts`) — H-001 surface green-lock + H-002 GREEN
  characterization pin of D1 (LSN-029: flips RED on fix → re-ground, never delete).
  DOC-229 (`done`) shipped six operator caveats to the live relationships doc page —
  fixed caveats must be updated on the `release/0.28.0` train (G-C11).
- **Architectural significance (G-C7): NO ADR.** No migration; no auth-posture change (RBAC
  explicitly NOT introduced — the issue itself defers it as the platform-wide read-open
  posture); no breaking wire-contract change (D5 ships as Option A: spec *descriptions*
  only — Option B's param rename is excluded as breaking). The D2 predicate fix aligns the
  relationships listing surfaces with the platform's established default-visibility
  contract — bug-fix-shaped, milestone-gated 0.28.0. `adr_required: false`.
- **Clarify (G-C6): no question warranted.** The issue is the maintainer's own filed
  PLT-056 with a full verification trail and suggested fixes. The open judgement calls
  (D6 include/exclude, new findings A/B scope) are GATE 1 plan decisions with a drafted
  scope comment — not implementation-changing unknowns a comment must resolve first.

## Reproduction (G-C1) — captured live 2026-06-11

Stack: the shared odd-minimal stack (`probe-odd-platform` healthy; image
`odd-platform:odd-team-sut` built 2026-06-11 21:06Z from the working tree @ `5cbf60a3` =
the #1771 PR tip, whose content equals current `main` @ `39b54eef`). Seeds: `ctrib006_*`
(data_source 20690; relationship-class entities 20691 ok / 20694 DELETED status=5 / 20695
exclude_from_search=true / 20696 GRAPH type 26; datasets 20692 src / 20693 tgt;
`relationships` rows 776001-776004; `erd_relationship_details` 777001;
`graph_relationship` 778001; FTS `search_entrypoint` vectors for 20691/20694/20695).
Cleaned after capture (shared-stack hygiene, the IT-068/f1392de lesson).

### API probes (curl, verbatim)

```
GET /api/relationships?page=1&size=30&type=ALL&query=ctrib006
  -> 200, total 4: ctrib006_rel_ok, ctrib006_rel_deleted, ctrib006_rel_excluded,
     ctrib006_rel_graph — soft-DELETED + excluded LISTED                          D2 BUG
     (payload source/target are DISTINCT and correct for every row — D1 is UI-only)
POST /api/search {"query":"ctrib006"} -> GET /api/search/{id}/results
  -> total 1: ctrib006_rel_ok ONLY — the search tier HIDES deleted+excluded      CONTRAST
GET /api/relationships?page=1&size=30&type=foo
  -> 400 {"code":"USR001","message":"Type mismatch."}                            D4 BE
     (post-#1771 behaviour; the issue's pre-merge text predicted this 400)
GET /api/relationships/erd/20691         (the list id — canonical flow)
  -> 200 {id: 20691, erd_relationship.erd_relationship_id: 777001}               OK
GET /api/relationships/erd/777001        (the payload's own erd_relationship_id)
  -> 404 {"code":"USR002","message":"Relationship with id 777001 is not found"}  D5 TRAP
GET /api/relationships/graph/20696 -> 200 {graph_relationship_id: 778001}
GET /api/relationships/graph/778001 -> 404 USR002                                D5 TRAP
GET /api/relationships/graph/20691 -> 404 (ERD id on graph route — type isolated) OK
GET /api/relationships?...&query=ctrib006_src   (a SOURCE dataset's name)
  -> 200, total 0                                                                D6 BUG
GET /api/relationships?...&query=ctrib006_rel   (relationship-name prefix)
  -> 200, total 4                                                                control
```

### UI probes (Playwright vs the live stack; screenshots /tmp/ctrib006-U{1,2,3}.png)

- **U1 (D1):** `/data-modelling/relationships?q=ctrib006_rel_ok` — `ctrib006_src` visible
  **2×** (Source AND Target cells); `ctrib006_tgt` visible **0×**. The API returned the
  correct distinct target (above) — purely the row renderer.
- **U2 (D4):** `/data-modelling/relationships?type=foo` — API 400; H1 reads **"0
  relationships overall"**; `EmptyContentPlaceholder` ("No information to display")
  visible; **no error text anywhere**; no active tab. Indistinguishable from an empty
  catalog.
- **U3 (Finding A):** `/dataentities/20696/overview` (GRAPH relationship entity) —
  Source-block text = `Source:ctrib006_tgt`, Target-block text = `Target:ctrib006_src` —
  the labels are inverted on the running system.
- **Pinned:** IT-077 H-002 (the D1 characterization pin) ran GREEN (bug present) in both
  2026-06-11 `feature-complete` runs on this same SUT content
  (`integration-tests/run-log/2026-06-11-feature-complete.md`).

## Root cause (verified on the running system + source)

1. **D1 [FE]** — copy-paste: the Target cell (`RelationshipsListItem.tsx:73-81`) is a
   verbatim duplicate of the Source cell (:64-72); `item.targetDataEntity` is never read.
   The DTO is correct (live-verified) — display-layer only.
2. **D2 [BE]** — `getRelationships` builds its WHERE from scratch (entity-class + optional
   name match only) instead of starting from the platform's default visibility trio
   (`getDataEntityDefaultConditions`: HOLLOW=false, STATUS != DELETED(5),
   EXCLUDE_FROM_SEARCH null/false). Live: deleted + excluded listed here, hidden by the
   search tier. Same gap on the dataset-tab query `getRelationsByDatasetIdAndType`
   (:121-136 — Finding B). RBAC: no rule entry anywhere = the platform-wide read-open
   posture (per the issue's corrected framing) — not a defect to fix here.
3. **D4 [FE]** — `Relationships.tsx:19` casts the raw `?type=` string; the request 400s
   (post-#1771: clean USR001) but react-query just leaves `data` undefined → `relationships
   = []` → `isEmpty` → empty placeholder + "0 relationships overall"; `RelationshipsTabs`
   independently reads the raw param → `findIndex` -1 → no active tab. No error state on
   this surface at all.
4. **D5 [contract]** — `{relationship_id}` is the relationship-class entity's
   `data_entity.id` by construction (repository WHERE + mapper `.id(...)`); the details
   payload exposes two OTHER tables' PKs (`erd_relationship_details.id`,
   `graph_relationship.id`) under `*_relationship_id` names with no spec text saying they
   are not path-param inputs. Live: feeding them back 404s (or, on numeric collision with
   another relationship's data_entity.id, would return an unrelated payload).
5. **D6 [BE]** — the `?q` condition is applied inside the relationship-row CTE
   (un-aliased `DATA_ENTITY.EXTERNAL_NAME`), so it can only ever match the
   relationship-class row's own name; source/target tables join after pagination.
6. **Finding A [FE]** — `GraphRelationship.tsx` puts `targetDataEntity` under the
   "Source:" header and `sourceDataEntity` under "Target:" (:28-35 vs :55-62); both call
   sites pass props straight through. ERD's `EntityRelationship` (Parent=target,
   Child=source) is semantically correct for FK direction — the issue's "siblings consume
   it correctly" was right for ERD, wrong for GRAPH.

## Plan

**Branch:** `contrib/CTRIB-006-relationships-hardening` on `opendatadiscovery/odd-platform`.
**One draft PR** (deviation from the issue's two-PR suggestion — same surface, same
milestone, one review pass for a solo maintainer; per-defect commits keep the trail),
`Closes #1752`, `Milestone: 0.28.0`.

### Change A — FE display + UX (D1, D4, Finding A)

1. **D1** — `RelationshipsListItem.tsx:73-81` Target cell: the three props flip to
   `item.targetDataEntity.{id, internalName||externalName, oddrn}` (the issue's suggested
   one-line rename; type-safe — `target_data_entity` is spec-required).
2. **D4** — validate `?type=` against `Object.values(RelationshipsType)` with fallback
   `ALL`, in BOTH consumers of the raw param: `Relationships.tsx:19` (the fetch) and
   `RelationshipsTabs.tsx:27-31` (the active-tab index) — otherwise the list would load
   with no tab highlighted. Mechanism: one tiny shared helper or two inline guards,
   whichever reads cleaner at implement — no new abstractions beyond that. Post-fix
   behaviour: a mistyped/stale `?type=` deep-link degrades to the full ALL list with the
   All tab active (matches the tab strip's own default), no dead screen.
3. **Finding A** — `GraphRelationship.tsx`: swap the two `RelationshipDatasetInfo` blocks
   so "Source:" renders `sourceDataEntity` and "Target:" renders `targetDataEntity`
   (two-line fix, same defect class as D1, live-verified U3).

### Change B — BE default visibility predicates (D2 + Finding B)

1. `ReactiveDataEntityRelationshipRepositoryImpl.getRelationships` — add the exact
   platform default trio to `conditionList` (mirrors
   `ReactiveDataEntityRepositoryImpl.getDataEntityDefaultConditions:970-976`):
   ```java
   conditionList.add(DATA_ENTITY.HOLLOW.isFalse());
   conditionList.add(DATA_ENTITY.STATUS.ne(DataEntityStatusDto.DELETED.getId()));
   conditionList.add(DATA_ENTITY.EXCLUDE_FROM_SEARCH.isNull()
       .or(DATA_ENTITY.EXCLUDE_FROM_SEARCH.isFalse()));
   ```
   The count query (:129) reuses `conditionList` → list + total stay consistent.
2. `ReactiveRelationshipsRepositoryImpl.getRelationsByDatasetIdAndType` (the dataset's
   Relationships tab — same class, Finding B) — add `HOLLOW=false` + `STATUS != DELETED`
   on the `relationshipsDataEntity` aliased table. **Deliberately NOT
   `EXCLUDE_FROM_SEARCH` there**: that flag is the operator's *discovery-noise* control;
   the global list (a discovery surface with its own search box) honours it, but hiding a
   dataset's actual relationship from the dataset's own contextual detail tab would create
   silent incompleteness — DELETED is a lifecycle state, exclusion is a search-scope flag.
3. **No RBAC / SecurityConstants change** — the issue's own corrected analysis: catalog
   reads are RBAC-free platform-wide; adding read RBAC here alone would be the
   inconsistency.
4. **No visibility filtering on the erd/graph detail-by-id endpoints** — platform-wide,
   detail views of DELETED entities stay reachable (that is how operators inspect them);
   only LISTING surfaces hide them.

### Change C — spec descriptions for the id contract (D5 Option A)

`odd-platform-specification/components.yaml` (descriptions only — non-breaking; the UI TS
client is NOT committed, regenerated at build → zero committed-file churn):

1. `RelationshipIdParam` — description: the param is the relationship's `id` from
   `DataEntityRelationship` (= the relationship-class data entity's id); the
   `erd_relationship_id` / `graph_relationship_id` fields from the details payload are
   internal detail-record ids and are NOT valid values here.
2. `ERDRelationshipDetails.erd_relationship_id` + `GraphRelationshipDetails.graph_relationship_id`
   — description: internal detail-record id; not usable as `{relationship_id}`.
3. Deviation from the issue's letter: plain `description` instead of an `x-semantic-note`
   extension — descriptions are the conventional, generator-visible carrier; `x-`
   extensions are tool-invisible. (Named in the scope comment.)

### Tests (G-C9, both buckets; failing-first)

- **Unit → odd-platform CI** (in-process Testcontainers = unit bucket; runs in
  `./gradlew build`):
  - NEW `ReactiveDataEntityRelationshipRepositoryImplTest` (BaseIntegrationTest idiom):
    seeds healthy + DELETED + excluded + hollow relationship-class entities with
    `relationships` rows; asserts `getRelationships(ALL)` returns ONLY the healthy one and
    the page total matches (RED on main: returns all 4 — the failing condition injected
    explicitly); guards: ERD/GRAPH/ALL type filter still works; `?q` name match still
    works.
  - NEW `ReactiveRelationshipsRepositoryImplTest`: `getRelationsByDatasetIdAndType` hides
    a DELETED relationship (RED on main), and — pinning the deliberate nuance — an
    `exclude_from_search` relationship REMAINS visible on the dataset tab (GREEN both
    sides, the asymmetry made explicit).
  - FE unit: N/A-with-reason — no vitest CI executor (CTRIB-002..005 precedent); FE is
    gated by tsc/eslint/webpack via the SUT build + the e2e bucket.
- **Integration → odd-team, IT-077 RE-GROUNDED** (LSN-029: the H-002 pin flips, never
  deleted) + extended:
  1. H-002 → the Target column renders `it077_target` (1×) and `it077_source` once only
     (the fix assert — RED pre-fix);
  2. visibility: seed DELETED + excluded `it077x_*` relationships → absent from the list
     + the H1 total reflects only visible rows (RED pre-fix);
  3. `?type=foo` deep-link → the full list renders with the All tab active and no dead
     empty state (RED pre-fix);
  4. graph-detail labels: a GRAPH relationship's overview shows "Source:" = the source
     name, "Target:" = the target name (RED pre-fix);
  5. D5 green-locks (current behaviour, documents the id contract the spec now states):
     list id → erd detail 200; `erd_relationship_id` fed back → 404 USR002.
  - **RED proof:** the re-grounded spec vs `ODD_SUT=ref:main` → asserts 1-4 FAIL,
    5 passes; then GREEN 5/5 on the working-tree SUT. Recorded in the test ledger.
  - **Full regression (the gate, 2026-06-11 directive):** `run-suite.sh feature-complete`
    green + `multi-stack` green + `known-bugs` still-RED on the working-tree SUT, one
    suite at a time, actual counts read. Expected flip handled in-band: IT-077's old
    H-002 pin is re-grounded as part of this change (flip pre-authored here).
- **Docs (G-C10 + G-C11) — routing: `release/0.28.0` train.** READ
  `docs.opendatadiscovery.org/features/data-modelling/relationships` (live) +
  `documentation/docs/data-modelling/relationships.md` (DOC-229 shipped six caveats
  there, status done). Expected train edit: version-anchor/retire the caveats fixed at
  0.28.0 (D1 target column; D2 visibility — replaced by the new default-visibility
  statement incl. the dataset-tab exclude nuance; D4 ?type= dead-end; graph label swap if
  the page mentions detail labels), keep the still-true caveats (D3 routing, D6 search
  scope), point the D5 caveat at the now-documented id contract. Paired backlog DOC item
  (milestone 0.28.0, `pending-release`) with post-merge URLs. If the live page still
  carries DOC-229's ORIGINAL "cross-tenant enumeration oracle" framing (superseded by the
  issue's 2026-06-10 correction), that is a released-truth correction → separate
  immediate fix on docs `main` (read first; decide on evidence).
- **Ontology (G-C10):** `/enrich --touched` + re-embed + COMMIT: the four changed code
  nodes' sidecars (RelationshipsListItem / Relationships+Tabs / GraphRelationship /
  the two repository impls), the spec node if present, F-037 feature flow (H-002 →
  confirmed-fixed; use_cases coverage), IT-077 protocol re-ground, suites lane comments.

### Scope EXCLUSIONS (G-C5 — deliberately NOT touched)

- **No RBAC** for relationship endpoints (platform-wide read-open posture — the issue's
  own corrected scope).
- **No D6 search-scope SQL change** — the current name-only scope is the documented
  caveat (DOC-229 Caveat 4, live); widening to source/target names is a search-semantics
  feature decision and a pagination-sensitive query restructure. The issue itself marks
  it operator-judgement / optional; resolves doc-side.
- **No D3 routing change** — uniform row-click stands; doc-side caveat already shipped
  (DOC-229 Caveat 3); type-specific URLs would mean new routes (a feature, not a fix).
- **No Option B rename** of `relationship_id` (breaking for existing SDK consumers).
- **No detail-endpoint visibility filtering** (platform consistency: detail views of
  DELETED entities stay reachable).
- **`GraphRelationshipAttributes` spec `required: [field, value]` vs properties
  `name`+`value`** (Finding C) — latent generated-model blast radius → follow-up issue
  draft, not this PR.
- **Dead `getRelationshipByDataEntityIds`** (Finding D) — follow-up draft, not this PR.

### Scope/root-cause comment (posts to #1752 immediately after GATE 1 approval — ASCII)

> Re-verified all six defects live on a local stack built from current main (post-#1771);
> scope note for the upcoming fix PR.
>
> Everything reproduces as reported, with one update and two additions:
>
> 1. Defect 4's backend half now returns a clean 400 USR001 "Type mismatch." -- #1771's
>    ResponseStatusException pass-through (merged today) fixed the status code; the UI
>    half is unchanged (a mistyped ?type= deep-link still renders "0 relationships
>    overall" + an empty list with no error signal, indistinguishable from an empty
>    catalog).
> 2. NEW, same class as Defect 1: GraphRelationship.tsx renders the relationship detail
>    blocks with SWAPPED labels -- "Source:" shows the TARGET dataset and "Target:" shows
>    the SOURCE (verified live on a graph-relationship overview; both call sites pass
>    props straight through). The ERD sibling (Parent/Child) is correct.
> 3. NEW, same class as Defect 2: the dataset detail page's Relationships tab
>    (GET /api/datasets/{id}/relationships) also applies no visibility predicate -- a
>    soft-DELETED relationship keeps showing there too.
>
> The PR will contain:
> (a) Defect 1 -- the Target-column rename (the one-liner, as suggested);
> (b) Defect 4 -- runtime validation of ?type= with fallback to ALL, applied to BOTH
>     consumers of the raw param (the fetch AND the tab strip, so the page degrades to a
>     working ALL view instead of a dead screen);
> (c) Defect 2 -- the three default visibility predicates (HOLLOW / STATUS != DELETED /
>     EXCLUDE_FROM_SEARCH) on the global relationships list, exactly mirroring the
>     data-entity tier's defaults; plus STATUS+HOLLOW (deliberately NOT exclude_from_search
>     -- it is a search-noise flag, and hiding a dataset's real relationship from its own
>     detail tab would be silent incompleteness) on the dataset Relationships tab;
> (d) Defect 5, Option A -- OpenAPI descriptions stating {relationship_id} is the
>     relationship's data-entity id and that erd_relationship_id / graph_relationship_id
>     are internal ids that do NOT round-trip (plain descriptions rather than an
>     x-semantic-note extension -- descriptions are what generators and readers actually
>     surface);
> (e) the GraphRelationship label swap (2 above);
> (f) repository tests pinning the new visibility behaviour failing-first, an e2e
>     regression update, and the doc-page caveat updates riding the 0.28.0 release train.
>
> Per the issue's own framing, NOT in this PR: read-RBAC for relationship endpoints (the
> platform-wide read-open posture -- introducing it here alone would be the
> inconsistency); Defect 3 (row-click routing) and Defect 6 (search scope) stay doc-side
> -- both are documented caveats on the live Relationships page today; widening search to
> source/target names is a separate product decision. No breaking rename of
> relationship_id (Option B rejected).

### Follow-ups to log on disk (Phase D, `playbooks/follow-up-on-disk.md`)

- PLT-NNN draft: `GraphRelationshipAttributes` required-vs-properties spec bug (Finding C).
- PLT-NNN draft or REFACTOR item: dead `getRelationshipByDataEntityIds` (Finding D).

## Branch / commits (odd-platform)

Branch `contrib/CTRIB-006-relationships-hardening` (from `main` @ `39b54eef`), author +
committer `odd-contributor[bot]`:

- `122a0823` fix(relationships): catalog default visibility predicates on both listings
  (BE + the 2 failing-first Testcontainers test classes).
- `46a37f59` fix(ui): Target column renders the target; `?type=` validated with ALL
  fallback in BOTH consumers (new `parseRelationshipsType.ts`); GraphRelationship
  Source/Target labels un-swapped.
- `abe51417` docs(spec): `relationship_id` contract descriptions on the param + both
  `*_relationship_id` payload fields.

## Test ledger (implement run, 2026-06-11/12)

- **Unit — failing-first (RED on unfixed main):** `scripts/run-platform-tests.sh --tests`
  both new classes on pre-fix code → **3 tests completed, 3 failed**, each for exactly the
  injected condition (gradle report verbatim: the global list returned
  ok+deleted+excluded+hollow+graph against expected ok+graph; the ERD filter returned 4
  incl. hidden; the dataset tab returned 4 against expected ok+excluded).
- **Unit — GREEN on the fix:** same targeted run → **BUILD SUCCESSFUL in 1m 29s** (3/3).
- **Unit — full CI replica:** `scripts/run-platform-tests.sh` (no-arg
  `:odd-platform-api:build` = test + checkstyle + assemble) on the fixed tree →
  **BUILD SUCCESSFUL in 6m 4s**.
- **FE compile gates:** `tsc --noEmit` clean; `eslint` on all 5 touched TS files clean.
- **Integration — impacted IT (inner loop):** IT-077 re-grounded (LSN-029 — the H-002 pin
  flips to the fixed contract; flip pre-authored in the 2026-06-07 protocol entry) +
  extended (visibility, ?type=foo fallback, graph labels, D5 id-contract green-locks).
  **GREEN on the working-tree SUT @ abe51417: 6/6 (8.9s).** **RED proof vs
  `ODD_SUT=ref:main` (39b54eef): 4 failed / 2 passed — exactly as pre-authored** (✘ H-002
  source×2; ✘ visibility — hidden rows listed; ✘ ?type=foo dead state; ✘ graph labels
  swapped; ✓ H-001 surface; ✓ D5 green-locks). One honest interlude: the first ref:main
  attempt died building the throwaway SUT (gradle daemon GC-thrash, 512 MiB heap — the
  CTRIB-005 transient class); retried clean. Run-log:
  `integration-tests/run-log/2026-06-12-IT-077.md` (3 attributed entries).
- **Integration — FULL regression (the gate, 2026-06-11 directive), all on the
  working-tree SUT, one suite at a time, actual counts read:**
  - `feature-complete`: **277 passed / 0 failed (4.0m)** — +4 vs the 2026-06-11 273
    baseline = exactly IT-077's four new asserts. Zero regressions.
  - `multi-stack`: **9 passed / 0 failed (3.5m)** — MinIO, auth-boundary, LDAP RBAC,
    WAL ×2, LOGIN_FORM ×2 unaffected.
  - `known-bugs`: **6 failed / 0 passed — EXPECTED all-RED**, every failure its
    documented pin (IT-007 LSN-001/PLT-086; IT-006 TEST-GAP-1013; IT-004 PLT-052;
    IT-003 ×2 PLT-090/PLT-127; IT-005 PLT-026). **Zero unexpected GREENs** — no fix
    landed un-flipped. Run-logs: `2026-06-12-{feature-complete,multi-stack,known-bugs}.md`
    (attributed, narrative fields filled).

## Docs (G-C10 + G-C11) — READ + CHANGED + ROUTED

- **READ:** `documentation/docs/data-modelling/relationships.md` end-to-end (113 lines;
  train @ HEAD = origin/main for this file — no pre-existing train delta) +
  `documentation/docs/developer-guides/api-reference/relationships.md` end-to-end. The
  live page additionally curl-verified serving the PRE-fix caveats ("is being patched
  upstream") — the shipped page already carries DOC-229's corrected "read-collaborative"
  framing, so NO released-truth correction for docs main was needed.
- **CHANGED + ROUTED to the `release/0.28.0` train** (G-C11): commit `f61b9c2` pushed
  same-name (`1d43d6e..f61b9c2`). Feature page: D1 + D4 caveats → fixed-in-0.28.0 notes;
  RBAC caveat now access-only (severity danger→warning, editorial decision recorded in
  DOC-446) with the visibility half stated positively in the walkthrough incl. the
  dataset-tab exclude nuance; D5 caveat gains the payload-field trap + the
  now-in-spec note; intro re-counted (4 contracts + 2 fixed). API-reference page: the
  list-endpoint hint reworded version-anchored. D3 + D6 caveats kept verbatim (still
  true). Frontmatter PyYAML-parses; descriptions 118/114 chars.
- **Live no-leak verified post-push:** the published page still serves the 0.27.x
  caveats; zero "Fixed in 0.28.0" phrases live — release-gating intact.
- **Paired item:** `backlog/docs/DOC-446.md` (milestone 0.28.0, review-ready →
  pending-release at review; post-merge URLs + expected phrases recorded).

## Ontology refresh (G-C10)

- **Sidecars re-enriched at `abe51417`** (file-analyser/0.5.0, both validated `1 ok`,
  enrichment.log appended): `RelationshipController` controller-class (visibility trio +
  spec-documented id contract; `relationship_id` drift reclassified TRANSLATES_SILENTLY →
  TRANSLATES_LEGITIMATELY; NEW finding recorded: detail-by-id still serves
  DELETED/excluded/hollow — deliberate, mirrors the data-entity detail posture) +
  `relationships` route (all four FE/BE fixes verified first-hand; read-open posture
  unchanged-and-documented; P-167 Block D marked superseded).
- **NEW pre-existing finding surfaced by the route re-enrichment** (verified against the
  query shape read this session): the `?type=` filter applies in the JOIN **after** the
  CTE pagination window, and the count/total ignores type entirely → ERD/GRAPH tabs
  under-fill pages + over-count. Probe `lineage/odd-platform/probes/P-248.yaml` (agent-
  pinned) + **PLT-220** filed (excluded from this PR per G-C5 — needs its own
  pagination-correctness design).
- **F-037 feature flow:** facets bracket-stamped (D1 FIXED; D2 PART-FIXED — access half
  stands; D5 DOCUMENTED), node entry `unresolved: false`, use_cases H-001/2/3/4/6/9
  flipped verified/confirmed + **UC-13 added** (the visibility-defaults promise),
  `use_case_coverage` 0/12 → **7/13**, `test_matrix` unit+integration → covered
  (control_summary 2/4). PyYAML-validated.
- **Flip-on-fix sweep** (the TST-044 class, swept BEFORE review this time): suites.yaml
  I6 lane comment + wave-2 GREEN-pins comment flipped; IT-077 protocol re-grounded
  (result-log carries the flip provenance); PLT-056.md in-flight status note added;
  `promise-test-worklist.md` left untouched (explicit do-not-hand-edit snapshot,
  ADR-0077); DOC-229 left untouched (`done` historical record);
  `feature-reflections/detail/F-037.yaml` left untouched (dated hypothesis artefact —
  the projection carries the flips, F-017/CTRIB-005 convention).
- **Graph re-embed:** queued after the suite runs (CPU contention); recorded below.

## Branch / PR

- Branch `contrib/CTRIB-006-relationships-hardening` pushed to
  `opendatadiscovery/odd-platform` (3 commits `122a0823` / `46a37f59` / `abe51417`,
  authored + committed `odd-contributor[bot]`; 10 files — exactly the approved plan).
- **Draft PR #1772** — https://github.com/opendatadiscovery/odd-platform/pull/1772
  (`draft: true`, `Closes #1752`, `Milestone: 0.28.0` line — the issue's milestone
  re-verified open/unchanged via API at PR time (G-C11); docs note
  `documentation@release/0.28.0 (f61b9c2) — publishes with the 0.28.0 release`; review
  requested from `RamanDamayeu`, HTTP 201; the bot cannot merge — GATE 2 is the human's).
- Scope/root-cause comment on #1752 (GATE-1-approved, posted pre-code):
  https://github.com/opendatadiscovery/odd-platform/issues/1752#issuecomment-4685460651
- Docs train: documentation@`release/0.28.0` commit `f61b9c2` (pushed same-name); paired
  item `backlog/docs/DOC-446.md`.

## Definition of Done (LSN-032 four gates)

1. **Unit (full build, working tree = branch content):** ✅ BUILD SUCCESSFUL 6m04s
   (test + checkstyle + assemble) + failing-first RED (3/3, verbatim reasons) → GREEN.
2. **Integration (FULL regression on the working-tree SUT):** ✅ feature-complete 277/0 +
   multi-stack 9/9 + known-bugs 6/6-still-RED; impacted IT-077 6/6 GREEN with the
   ref:main 4-fail RED proof (LSN-033 honoured — SUT a run parameter, built from the
   tree each run).
3. **Docs:** ✅ READ (both pages end-to-end + live curl) + CHANGED + ROUTED to the
   `release/0.28.0` train (`f61b9c2`, same-name push; main untouched; live no-leak
   verified); paired DOC-446 (milestone 0.28.0, post-merge URLs recorded).
4. **Ontology:** ✅ two sidecars re-enriched at `abe51417` (validated), F-037 flow
   flipped (facets + use_cases 7/13 + matrix 2/4), enrichment.log, suites.yaml lane
   comments, IT-077 protocol re-grounded, PLT-056 in-flight note; graph re-embedded
   (build-info recorded below); ALL COMMITTED (workspace commit hash in the log).

## Follow-ups filed on disk (G-C5 / follow-up-on-disk)

- `issues/odd-platform/PLT-218.md` — spec `GraphRelationshipAttributes` requires `field`
  which doesn't exist (Finding C).
- `issues/odd-platform/PLT-219.md` — dead `getRelationshipByDataEntityIds` (Finding D).
- `issues/odd-platform/PLT-220.md` — type filter after pagination + type-blind total
  (the re-enrichment finding; probe P-248).
- `backlog/docs/DOC-446.md` — the paired release-train doc item (milestone 0.28.0).

## Comments (issue thread)

- Clarify comment: **none warranted** (G-C6) — recorded above.
- Root-cause + scope comment: ONE comment (drafted above), posts immediately after GATE 1
  approval, before any code (G-C5; github-write rate-limit honoured).
- **POSTED 2026-06-11 (post-GATE-1, pre-code):**
  https://github.com/opendatadiscovery/odd-platform/issues/1752#issuecomment-4685460651
  (author `odd-contributor[bot]`, HTTP 201; ASCII-verified before post).


## Review (2026-06-12, session: separate from the implementing session — post-46e938d)

- **Result**: ACCEPTED — `pr-draft` → `review-ready`. GATE 2 (human review + merge of
  draft PR #1772) is the remaining step. Paired DOC-446 flipped `review-ready` →
  `pending-release` (Gate 8 PENDING-RELEASE 0.28.0). CTRIB-005 recorded `merged` en route
  (PR #1771 merged by RamanDamayeu 2026-06-11T21:25:30Z as `39b54eef` = this branch's base).
- **Re-verification protocol**: every load-bearing claim re-derived from branch source /
  live GitHub API / the train ref (ls-remote) / the reviewer's own fresh full-regression
  runs — not from this record.

### Definition of Done (LSN-032 four gates) — re-verified

1. **Unit (full build, on the branch)** — PASS. Reviewer's own `scripts/run-platform-tests.sh`
   (no-arg = `:odd-platform-api:build`: test + checkstyle + jacoco + assemble) on the clean
   working tree at the PR tip `abe51417` → **BUILD SUCCESSFUL in 5m 12s**. Independently:
   PR #1772 CI ran 6/6 checks green on the exact head (Test Results: **417 tests / 0
   failures** = CTRIB-005's 414 baseline + exactly the 3 new repository tests; run_tests +
   Playwright test/lint/format-check + update_release_draft) — VERIFIED via check-runs API
   on `abe51417`.
2. **Integration (FULL regression, reviewer's own runs on the PR-tip SUT)** — PASS.
   One suite at a time, SUT image rebuilt from the clean tree @ `abe51417` (LSN-033):
   `feature-complete` **277 passed / 0 failed (4.0m)** — IT-077's six tests GREEN in-suite
   (line-reporter tests 99–104); `multi-stack` **9 passed / 0 failed (4.1m)**;
   `known-bugs` **6 failed / 0 passed — EXPECTED all-RED**, every failure its documented
   pin (IT-007 LSN-001/PLT-086; IT-006 TEST-GAP-1013; IT-004 PLT-052; IT-003 ×2
   PLT-090/PLT-127; IT-005 PLT-026), ZERO unexpected GREENs. All three identical to the
   implement run's counts. Run-log entries appended, reviewer-attributed, narrative fields
   filled. RED half re-verified from the run-log chain (`2026-06-12-IT-077.md`): GREEN 6/6
   on the fix SUT → honest SUT-BUILD-FAILED interlude (gradle GC thrash, retried) →
   `ODD_SUT=ref:main` (39b54eef) **4 failed / 2 passed exactly as pre-authored** (✘ H-002
   source×2, ✘ visibility, ✘ ?type=foo dead state, ✘ graph labels; ✓ H-001 surface,
   ✓ D5 green-locks). Shared-stack hygiene claim VERIFIED live: `psql` on probe-database →
   **0 rows** matching `ctrib006%` (the reproduction seeds were cleaned as recorded).
3. **Docs** — PASS, PENDING-RELEASE (0.28.0). Remote train tip = exactly `f61b9c2`
   (**`git ls-remote` — authoritative**; the local `origin/release/0.28.0` tracking ref
   lags because the documentation clone is single-branch → DOC-448 codifies ls-remote);
   parent `1d43d6e` (DOC-444); NOT reachable from `origin/main` (`5d92250`) — main
   untouched. Diff read end-to-end at the train ref: caveat intro re-count EXACT (4
   contract caveats + 2 fixed-in-0.28.0 notes = the 6 hint blocks); every behavioural
   claim matches the code read this review (`parseRelationshipsType` case-sensitive ALL
   fallback incl. the "other spellings load the unfiltered list" nuance; visibility trio;
   dataset-tab STATUS+HOLLOW-not-EXCLUDE asymmetry; spec id-contract text); D3 + D6
   caveats kept verbatim (still true — verified nothing in the diff touches routing or
   search scope); RBAC caveat correctly narrowed to access-only (danger→warning, decision
   recorded in DOC-446). Sub-checks green: PyYAML parses both pages; descriptions 118/114
   ≤200; all links tree-relative with every target present at `f61b9c2`; outbound
   `odd-collectors#relationships` resolves with the anchor. **Live no-leak verified**
   (curl, raw body ×2 pages): pre-fix phrases still served ("is being patched upstream";
   "full enumeration of the relationship class"); ZERO "Fixed in 0.28.0" / "as of 0.28.0"
   live. DOC-446's post-merge URLs + phrases recorded for the release gate.
4. **Ontology** — PASS. Both sidecars stamped `enriched_at_commit: abe51417` +
   enrichment.log 2026-06-12T00:55Z entries; controller sidecar carries the
   TRANSLATES_SILENTLY → TRANSLATES_LEGITIMATELY reclassification WITH citation
   (`components.yaml:4391-4402`) + the NEW deliberate detail-by-id-serves-DELETED finding;
   route sidecar documents `parseRelationshipsType` consumed by BOTH read paths + the
   read-open posture unchanged-and-deliberate. F-037: PyYAML OK; `use_case_coverage`
   7/13 with EXACTLY 7 `verified` entries; facets bracket-stamped with commit refs
   (FIXED 46a37f59 ×2 / PART-FIXED / DOCUMENTED abe51417), historical text preserved;
   `test_matrix` unit+integration covered, control_summary 2/4. suites.yaml: IT-077 in
   `feature-complete` + `I6-lineage-safety` lanes with re-grounded comments. IT-077
   protocol carries the flip provenance (the 2026-06-07 entry pre-authored the flip —
   LSN-029, pin re-grounded never deleted). PLT-056 in-flight note present. P-248 emitted
   at abe51417. Graph rebuilt `built_at: 2026-06-12`, nodes=7082, vectors=8014
   (BAAI/bge-small-en-v1.5) — exactly as the commit body claims. All committed (46e938d;
   workspace clean at review start).

### Contributor gates

- **G-C1 reproduce-first** — PASS. `reproduced:` field carries the full live evidence
  (API probes verbatim incl. the D2 catalog-search CONTRAST, UI Playwright probes U1-U3,
  the H-002 pin GREEN-on-bug in both 2026-06-11 runs); the pre-fix code shape re-read
  this review via the diff pre-image confirms each defect (predicate-less WHERE, verbatim
  Source-cell copy in the Target cell, bare `as RelationshipsType` assertion, swapped
  label blocks) — the reproduction is consistent with the code it reproduces.
- **G-C2 running system, not the diff** — PASS via the reviewer's own full unit build +
  full three-suite integration regression on the PR-tip SUT (DoD 1+2) + CI on the exact head.
- **G-C3 GATE 1 plan-before-code** — PASS. `plan_approved_by: RamanDamayeu (2026-06-11,
  'Approve as written')`; ordering VERIFIED via timestamps: plan/intake workspace commit
  `ad85f88` 21:53:58Z → scope comment 21:58:06Z → first code commit `122a0823` 22:18:01Z.
- **G-C4 GATE 2 human merge** — PASS (structural). PR #1772 fetched live: author
  `odd-contributor[bot]`, base `main`, head `abe51417`, **`draft: true`** (still — the bot
  never left draft), review requested from RamanDamayeu, `mergeable_state: clean`.
- **G-C5 bounded diff + public scope comment** — PASS. Diff = 10 files +297/−12 = exactly
  the approved plan (D1 Target cell; D4 `parseRelationshipsType` in BOTH consumers;
  Finding-A label un-swap; D2 trio on the global list + STATUS/HOLLOW on the dataset tab;
  D5 Option-A spec descriptions; 2 failing-first test classes) — full diff read. Every
  exclusion held: no RBAC/SecurityConstants change, no D6 search-scope SQL, no D3 routing
  change, no Option-B rename, no detail-endpoint visibility filtering — each verified
  absent from the diff. Scope comment PUBLIC on #1752 (4685460651, bot-authored, pre-code,
  **0 non-ASCII chars** verified against the raw API body — the (a)-(f) content matches
  the GATE-1-approved draft verbatim at the opening).
- **G-C6 one-question bar** — PASS. "No question warranted" recorded with reason; issue
  #1752 has EXACTLY 1 comment (the scope comment) — zero clarify noise — via issue API.
- **G-C7 blast-radius** — PASS. `adr_required: false` correct: no migration; no
  auth/security-posture change (visibility predicates align the listing with the
  platform's established default-visibility contract; RBAC explicitly excluded); spec
  change is descriptions-only (non-breaking; generated TS client not committed).
- **G-C8 issue-is-data** — PASS. Maintainer-authored issue treated as quoted data; the
  run independently verified all six claims AND extended the cluster with findings A/B
  (disclosed publicly in the scope comment) — evidence of analysis, not steering. No
  injection content.
- **G-C9 test integrity, BOTH buckets** — PASS. Unit: the two Testcontainers classes are
  BEHAVIORAL (StepVerifier over seeded healthy/DELETED/excluded/hollow/graph rows;
  page-total consistency asserted against the shared condition list; the dataset-tab
  deliberate asymmetry pinned BOTH sides — deleted/hollow hidden RED-on-unfixed, excluded
  kept GREEN-lock). Failing-first: ledger records 3/3 RED with verbatim injected reasons;
  RED-on-main is logically entailed by the pre-fix code shape read this review
  (predicate-less query returns all 5 seeds vs `containsExactlyInAnyOrder` of 2) and the
  GREEN half is the reviewer's own build + CI 417/0. Integration: IT-077 re-grounded with
  the `ref:main` 4-fail/2-pass RED proof (run-log); the user-facing symptom is
  integration-tested (LSN-031); spec asserts match the protocol exactly (read end-to-end:
  request-level `type=ALL` fallback assert, aria-selected All tab, ×1/×1 column counts,
  label-block containment, id-contract trap 404). FE unit N/A-with-reason re-confirmed
  (no vitest CI executor — CTRIB-002..005 precedent; FE gated by tsc/eslint/webpack + e2e).
- **G-C10 ontology + docs move with the code** — PASS (DoD 3+4). Reviewer's converge grep
  for IT-077 over the workspace: every hit is a flipped/current surface (2 sidecars,
  F-037, suites.yaml, protocol+spec, P-248, PLT-056, the record). ONE adjacent stale
  pointer found OUTSIDE the checklist's 8 surfaces: `navigation/domains/relationships.md:22`
  still carries the pre-fix drift note incl. the "enumeration oracle" framing PLT-056
  retracted 2026-06-10 — a CHECKLIST GAP (navigation/domains is not an enumerated
  surface), filed **TST-045** (instance + class fix). Does not gate GATE 2 (workspace
  pointer bookkeeping; the PR, docs train, and primary ontology are correct).
- **G-C11 milestone gate** — PASS. Issue #1752 milestone `0.28.0` OPEN (due 2026-06-22)
  re-verified via issue API at review time; PR body carries verbatim `Closes #1752` +
  `Milestone: 0.28.0` + the docs-train note (`documentation@release/0.28.0 (f61b9c2)`);
  docs routed to the train; paired DOC-446 milestone-gated. (No GitHub milestone OBJECT on
  the PR itself — consistent with CTRIB-004/005 precedent; the issue carries the object.)

### Universal Quality Bar gates

- **Gate 1 (no duplicates)** — PASS. IT-077 extended in place (not re-authored); the two
  unit classes cover distinct repositories (global list vs dataset tab), cross-referenced
  via javadoc; `parseRelationshipsType` duplicates no existing helper (grep over
  odd-platform-ui src: no prior enum-validation util); TST-045/DOC-447/DOC-448 deduped
  against TST-044 (CTRIB-005-scoped) + DOC-446 + the backlog — via grep + read.
- **Gate 2 (aliases)** — N/A. No new doc concept/alias: the visibility vocabulary
  (soft-deleted / hollow / excluded-from-search) pre-exists on the api-reference page
  (verified at the pre-change ref `5d92250`).
- **Gate 3 (caveats)** — PASS. Every operator-risk caveat is an admonition block (RBAC
  access, id-trap, D3 routing, D6 search scope, 2 fixed-in notes); the dataset-tab
  exclude nuance is a positive design statement in the walkthrough (not a buried risk) —
  via train-ref read.
- **Gate 4 (consumer-read)** — PASS. Workspace commit `46e938d` carries the 31-file
  `Consumer-read:` footer spanning both repos + documentation; key consumers re-walked
  this review: both repository impls (the count query REUSES `conditionList` —
  list+total consistency verified in source; the dataset-tab predicates land in
  `getRelationsByDatasetIdAndType` on the `relationshipsDataEntity` alias, detail-by-id
  untouched), `parseRelationshipsType` consumed by BOTH raw-param readers,
  `GraphRelationship` props pass-through from both call sites.
- **Gate 5 (unset-parameter)** — N/A (no SDK builder in scope).
- **Gate 6 (bidirectional code↔doc)** — PASS with finding FILED. Code→doc: all four fixes
  + the deliberate nuance + the id contract documented on the train; doc→code: every train
  claim matched to source read this review. Claim-class sweep over the whole train tree
  found ONE residual surface: `Features.md:212` "lists every relationship" → **DOC-447**
  (low, 0.28.0 train) — filed, not narrated.
- **Gate 7 (layout/completeness)** — PASS. No SUMMARY change needed (no page
  added/moved); `#known-operator-caveats` anchor intact (both cross-links resolve);
  suites-lane registration verified (IT-077 in feature-complete + I6, NOT in known-bugs).
- **Gate 8 (publishing/live)** — PASS for the pillar's public surfaces (PR #1772, issue
  #1752, comment, check-runs, PR #1771 merge state — all fetched live this review). Docs
  half: **PENDING-RELEASE (0.28.0)** by design — branch sub-checks green now (DoD 3);
  post-merge URLs + phrases recorded in DOC-446.
- **Gate 9 (claim provenance)** — PASS. Every load-bearing record claim re-derived (diff
  vs plan; GitHub state via 5 API fetches; train via ls-remote + show + grep; live pages
  via curl raw-body; ontology via disk reads + PyYAML; regression via the reviewer's own
  three-suite + full-build runs; seeds-cleaned via live psql). Outbound URL sweep: 8
  fetches, 0 broken; 1 stale-LOCAL-ref trap caught (single-branch clone's
  `origin/release/0.28.0` lagged the remote — ls-remote authoritative → DOC-448).
  Banned-phrase check over this review: none used.
- **Gate 10 (content-type homing)** — PASS. Work record in `contributor/`, run evidence
  in `run-log/`, probe in `probes/`, spec text in components.yaml, behaviour caveats on
  the feature page, endpoint semantics on the api-reference page, follow-ups in
  `backlog/` + `issues/` — per canonical-homes.
- **Gate 11 (audience isolation)** — PASS. Banned-term grep over both touched train
  pages: zero hits. PR body + issue comment are contributor/operator language
  (`contributor/CTRIB-006.md` reference is repo-public traceability, CTRIB-004/005 precedent).

### Verdict bookkeeping

- **Regressions**: none — measured, not inferred: full unit build GREEN (5m12s) + CI 6/6
  (417/0) on the exact head + feature-complete 277/0 + multi-stack 9/0 + known-bugs
  6/6-RED-as-designed, all reviewer-run on the PR-tip SUT.
- **Navigation**: ONE stale pointer → TST-045 (above); all other relationships pointers
  current.
- **Upstream issues logged**: none new this review (PLT-218/219/220 verified well-formed,
  ASCII-clean ×3, ID=max+1 sequence; PLT-220's pagination claim independently confirmed
  in source this review — the type filter joins after the CTE window, the count never
  sees it).
- **Doc-product editorial findings** (audit per `playbooks/doc-product-editorial-read.md`):
  - **Coverage this run**: focused pass per CTRIB-004/005 precedent (full-tree sweep was
    2026-06-08): both touched pages end-to-end at the train ref; cross-page coherence
    greps over the train tree (data-modelling hub, main-concepts, Features.md, search.md,
    api-reference hub, de-deprecation, data-objects); claim-class sweep ("every
    relationship" / "full enumeration") across all train docs.
  - **Findings**:
    - DOC-447 (low, parallel-surfaces-with-drift) — `Features.md:212` "lists every
      relationship across all data sources" needs the 0.28.0 "visible" anchor; the one
      surface DOC-446's claim-fix missed. Source: train ref `docs/Features.md:212`.
- **Follow-ups filed this review**: `backlog/tests/TST-045.md` (medium — navigation flip
  residue + flip-on-fix checklist surface 9: navigation/domains); `backlog/docs/DOC-447.md`
  (low, 0.28.0); `backlog/docs/DOC-448.md` (low — ls-remote as the authoritative train-ref
  check; single-branch clone trap).
- **Banned-phrase check**: none used in record or review.
- **Reviewer-committed artefacts**: three 2026-06-12 suite-run entries
  reviewer-attributed with narrative fields filled; harness re-stamps from the suite runs
  (P-001 probe-run, feature-flows verification stamps, 2 DataEntityController sidecar
  stamps) committed with this review; CTRIB-005 `merged` recorded; DOC-446 flip.
