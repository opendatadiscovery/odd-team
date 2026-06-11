---
id: CTRIB-006
github_issue_number: 1752
github_issue_url: https://github.com/opendatadiscovery/odd-platform/issues/1752
class: bug
milestone: "0.28.0"
status: planned
reproduced: "live 2026-06-11 on the shared odd-minimal stack (AUTH_TYPE=DISABLED), image odd-platform:odd-team-sut built from the PR-#1771 tip 5cbf60a3 = content of current main 39b54eef. Seeded ctrib006_* rows (healthy/DELETED/excluded ERD + GRAPH relationship entities, ids 20691-20696; cleaned after capture). API: list ?query=ctrib006 type=ALL -> total 4 INCLUDING status=5 + exclude_from_search=true rows (D2); catalog search 'ctrib006' (FTS vectors seeded for all 3) -> total 1, only the healthy row (the sibling-surface contrast); ?type=foo -> 400 USR001 'Type mismatch.' (D4 BE, post-#1771); erd detail 20691 -> 200 with erd_relationship_id=777001, GET /erd/777001 -> 404 USR002 (D5 trap; graph twin identical); ?query=ctrib006_src (source dataset name) -> total 0 vs ?query=ctrib006_rel -> 4 (D6). UI (Playwright vs the live stack, screenshots /tmp/ctrib006-U*.png): U1 source name x2 / target name x0 on the list (D1); U2 ?type=foo -> '0 relationships overall' + EmptyContentPlaceholder + NO error text (D4 UI); U3 graph overview Source-block='Source:ctrib006_tgt', Target-block='Target:ctrib006_src' (Finding A swap). IT-077 H-002 pin GREEN (bug present) in both 2026-06-11 feature-complete runs on this same SUT content (run-log)."
adr_required: false
plan_approved_by: ""
plan_approved_at: ""
docs_routing: ""
pr_url: ""
pr_draft: ""
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

## Comments (issue thread)

- Clarify comment: **none warranted** (G-C6) — recorded above.
- Root-cause + scope comment: ONE comment (drafted above), posts immediately after GATE 1
  approval, before any code (G-C5; github-write rate-limit honoured).

