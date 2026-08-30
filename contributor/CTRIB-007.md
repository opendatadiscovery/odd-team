---
id: CTRIB-007
github_issue_number: 1773
github_issue_url: https://github.com/opendatadiscovery/odd-platform/issues/1773
class: bug
milestone: "0.28.0"
status: pending-release   # GATE 2 done: PR #1775 squash-merged by the maintainer as main @ 7f905a5a (verified via git log origin/main, 2026-06-12 — recorded by CTRIB-008 en route); /review had ACCEPTED on the PR HEAD 1a196254 same day | LEDGER-RECONCILED 2026-08-30: was `merged`; PR #1775 (`7f905a5a`) is in the released `0.28.0` tag (published 2026-06-17). GATE 2 is done; `/review release:0.28.0` owns the flip to `done`.
reproduced: "live 2026-06-12 on the shared odd-minimal stack (probe-odd-platform healthy; image odd-platform:odd-team-sut built 2026-06-12T11:32Z from the clean main tree @ 6f356b72). Seeded the IT-005 discriminating shape via psql (35 tags: 30 OLD usedCount=1, ids 7-36 + 5 young POP usedCount=5, ids 37-41; cleaned after capture — 0 residue verified). D1: GET /api/tags?page=1&size=30&query=it005- -> total 35, returned 30, POP present: [] — window = it005-old-001..030 (id order, max usedCount in window 1); control GET size=35 -> response top-5 = the 5 POP at usedCount 5 (the outer count-DESC sort works once un-truncated — the inner window IS the defect). D3-entity FALSIFICATION: PUT /api/dataentities/20054/tags (5 POP -> [POP-001, ctrib007-audit-probe]) then GET /api/dataentities/20054/activity -> TAG_ASSIGNMENT_UPDATED event id 21 with old_state.tags = ALL 5 prior names and new_state.tags = the 2 new names — the entity path captures the FULL before/after; the issue's 'entity = id-only, no payload diff' claim is falsified on the running system. Corroboration: IT-005 RED (PLT-026 pin) in BOTH 2026-06-12 known-bugs suite runs (implement + review sessions) on the same main content."
adr_required: false  # for THIS run's scope (Thread A — a bug fix restoring the spec'd contract). Threads B and C are deferred BECAUSE each needs an ADR (see Scope analysis).
plan_approved_by: "RamanDamayeu (GATE 1, 2026-06-12 — 'Approve as written': Thread A only + IT-005 flip + two-route docs + B/C deferred ADR-first; scope comment posting approved)"
plan_approved_at: "2026-06-12"
docs_routing: "SHIPPED both routes: release/0.28.0 train commit 6be1f90 (same-name push f61b9c2..6be1f90 — tagging.md LSN-019 caveat -> fixed-in-0.28.0 info note; paired item DOC-449, milestone-gated; live no-leak verified) + docs main commit 188eb8e (released-truth correction: tagging.md audit-asymmetry entity row + activity-feed.md event-type rows — the falsified 'id-only payload' implication corrected; immediate flow)"
pr_url: "https://github.com/opendatadiscovery/odd-platform/pull/1775"
pr_draft: true
---

# CTRIB-007 — Tagging: `listMostPopular` returns OLDEST-by-id (Thread A of #1773)

Issue #1773 is the filed form of PLT-026 (`issues/odd-platform/PLT-026.md`). Author: the
maintainer (RamanDamayeu). Labels `kind: bug`, `scope: backend`, **`to decompose`**;
milestone **0.28.0** (open, semver, due 2026-06-22 — **G-C11 PASS**, verified via issue API
at intake); 0 comments at intake. Issue body treated as quoted data (G-C8); every
load-bearing claim independently re-verified against the odd-platform working tree
(`main` @ `6f356b72`, clean, = origin/main — includes the merged CTRIB-006 PR #1772).

## Intake — the issue's claims (quoted data)

Three defects on the Manual Object Tagging surface, with three suggested fix threads:

1. **Defect 1 / Thread A:** `listMostPopular` paginates by `TAG.ID ASC` inside the CTE
   (`ReactiveTagRepositoryImpl.java:148`) BEFORE the usage-count aggregation; the outer
   `orderBy(count DESC)` (`:158`) re-ranks only the truncated window. With >size tags, the
   most-popular young tags never reach page 1. Operator surface: the catalog home "Top
   Tags" strip (`Overview.tsx:20-23`, size=30) + `getPopularTagList` ("sorted by
   popularity", `openapi.yaml:343-346`). Suggested: aggregate over the FULL directory,
   then ORDER BY count DESC, then truncate — preferably as a reusable
   `paginateAfterAggregation` variant in `JooqQueryHelper`.
2. **Defect 2 / Thread B:** five side-channel paths mint global Tag rows without
   `TAG_CREATE` (`getOrCreateTagsByName` auto-create primitive; REFACTOR-223). Suggested:
   permission check inside the primitive + ingestion carve-out.
3. **Defect 3 / Thread C:** "three-way" audit asymmetry — claimed: entity path = id-only
   payload, dataset-field path = full diff, term path = no event. Suggested: bring entity
   + term up to the DatasetField pattern, reusing `TAG_ASSIGNMENT_UPDATED`.

## Claim verification (issue is data — re-verified against main @ 6f356b72)

1. **D1 — CONFIRMED** in source and LIVE (reproduction above).
   `ReactiveTagRepositoryImpl.listMostPopular:137-167`: `paginate(homogeneousQuery,
   List.of(new OrderByField(TAG.ID, SortOrder.ASC)), (page-1)*size, size)` at :147-148;
   the paginated select becomes `tag_cte` (:150); usage counts joined AFTER (:151,
   `getDataEntityWithDatasetFields` — union of `tag_to_data_entity` +
   `tag_to_dataset_field` counts); outer `orderBy(field(COUNT_FIELD).desc())` at :158.
   `JooqQueryHelper.paginate:63-90` confirmed: row_number + LIMIT/OFFSET inside, so the
   window truncates before any caller-side aggregation. The page-metadata fields
   (`_total`/`_row`/`_next`) ride through the CTE — load-bearing for the fix shape.
   **Two issue-data corrections found:** (a) `TopTagsList.tsx:25-35` DOES client-sort by
   `usedCount` desc — over the wrong server window, so the bug stands unchanged (the IT-005
   spec text has this right; the issue's "no client re-sort" is a mis-cite);
   (b) the empirical-test citation `retrospectives/LSN-019-listMostPopular-...` is
   actually `lineage/odd-platform/probes/P-LSN019-listMostPopular-drift.md` (workspace
   LSN-019 is a different lesson).
2. **D2 — CONFIRMED** in source: `TagServiceImpl.getOrCreateTagsByName:80-86` bulk-creates
   novel names with zero permission consultation; reachable from
   `updateRelationsWithDataEntity:105` (entity tags, gate DATA_ENTITY_TAGS_UPDATE
   SecurityConstants:214), `TermServiceImpl.upsertTags:257` (gate TERM_TAGS_UPDATE :186),
   `DatasetFieldServiceImpl:202,266` (gate DATASET_FIELD_TAGS_UPDATE :288-290), and
   `ExternalTagIngestionRequestProcessor:104` (+ `getOrInjectTagByName` :71 — the
   ingestion processor uses BOTH primitives, so a permission check inside the primitive
   needs an ingestion-context bypass design). Incidentally LIVE-demonstrated during the
   D3 probe: the PUT minted `ctrib007-audit-probe` with no TAG_CREATE involved.
   REFACTOR-223 records the auto-create as **spec-acknowledged design**
   (ADR-CANDIDATE-065 auto-create-on-miss) with a scope asymmetry (TAG_CREATE is
   MANAGEMENT-scoped; the per-entity gates are resource-scoped).
3. **D3 — PARTIALLY FALSIFIED.** Term half CONFIRMED: `service/term/TermServiceImpl
   .upsertTags:253-264` has NO `@ActivityLog` (code-certain — the aspect only fires via
   the annotation; nothing emits). Entity half FALSIFIED live + in source:
   `TagActivityHandlerImpl:26-50` resolves the FULL tag list from the entity id BEFORE
   (`getContextInfo` -> oldState) and AFTER (`getUpdatedState`) the change — the
   annotation's `@ActivityParameter(DATA_ENTITY_ID)` is the lookup key, not the payload.
   Live: old_state.tags = 5 names, new_state.tags = 2 names (reproduction above). The
   real asymmetry is TWO-way: entity + dataset-field both full before/after; term NOTHING.
   The live tagging.md page (docs main @ 68098e8, lines 100-109) carries the falsified
   implication ("with the entity id in the payload" contrasted against the dataset-field
   row's "capturing the before-and-after tag list" + "three different decoders") — a
   released-truth doc correction is due on docs MAIN.
4. **D3-term structural finding (NEW):** `activity.data_entity_id` is `bigint NOT NULL`
   FK -> `data_entity(id)` (`V0_0_48__add_activity.sql:4,12`) — the activity model is
   strictly entity-keyed. Reusing `TAG_ASSIGNMENT_UPDATED` for term tag changes (the
   issue's suggestion) is structurally infeasible: there is no data-entity id to key the
   row (a term id would violate/mis-attribute the FK). Term-tag audit requires a design:
   schema change (nullable/polymorphic key) or a parallel term-activity surface + spec
   enum + UI renderer — G-C7 territory (migration + public-contract).

## Scope analysis

- **Class: bug** (D1 — the thread this run fixes). Feature **F-018 Manual Object Tagging**
  (P-01 Data Discovery pillar). Promise F-018-UC-001 ("the Top Tags strip returns the
  MOST-USED tags, not the oldest") is `contradicted/unverified` — this run flips it to
  `verified`. IT-005 (known-bugs lane) is the pre-authored RED pin; its protocol already
  names the fix that flips it GREEN ("move ORDER BY usage_count DESC outside the paginate
  primitive ... then move IT-005 to feature-complete").
- **Decomposition (the issue carries `to decompose`):** this run ships **Thread A only**.
  - **Thread B (side-channel mints) — DEFERRED, ADR-first (G-C7 auth/security-posture).**
    It changes the effective permission semantics of four shipped endpoints, alters a
    spec-acknowledged behaviour (ADR-CANDIDATE-065 auto-create-on-miss), and needs an
    ingestion carve-out design (the processor calls both primitives). Per G-C7 the ADR is
    approved before any code — its own run.
  - **Thread C (audit asymmetry) — DEFERRED + RE-SCOPED.** The entity half is falsified
    (already full payload — doc correction instead of code). The term half is real but
    structurally design-bound (entity-keyed NOT NULL activity schema — finding 4 above):
    needs the same ADR-shaped decision (G-C7: migration / public-contract). Folding into
    the Thread-B ADR or its own — maintainer's call at that run.
  - Both deferrals are tracked in `issues/odd-platform/PLT-026.md` (the canonical
    workspace tracker for the cluster — Thread status section added this run) and stated
    publicly in the scope comment below. The PR therefore says **"Part of #1773"** (NOT
    `Closes`) — the issue stays open for B + C.
- **Architectural significance of Thread A (G-C7): NO ADR.** No migration, no
  auth-posture change, no contract break — the fix RESTORES the published contract
  ("sorted by popularity": spec summary + method name + UI label). The `JooqQueryHelper`
  change is a guard-rail loosening for computed aliases (generalising the existing
  `RANK_FIELD_ALIAS` exemption), behaviour-preserving for every existing caller (the
  check only ever throws; all live callers pass it today).
- **Clarify (G-C6): no question warranted.** Maintainer-authored issue with full trail;
  the open calls (thread split, helper-variant shape) are GATE 1 plan decisions, not
  implementation-changing unknowns.
- **Consumers of the changed query (all verified):** `TagController.getPopularTagList`
  (the only API consumer) <- UI: Overview Top Tags (`useGetPopularTags`, size 30),
  Management > Tags list (`fetchTagsList` paginated), tag autocompletes (TagsEditForm,
  Activity MultipleFilter) — all benefit from true popularity order; pagination
  metadata (total/hasNext) preserved by the fix shape. Existing unit test
  `TagRepositoryImplTest.testListMostPopular` (:236-266) asserts name-query membership
  only (single page, order-insensitive) — stays GREEN, no re-grounding needed.

## Root cause (verified on the running system + source)

`paginate()` is applied to the RAW tag select (order: `TAG.ID ASC`, LIMIT size) and only
then is usage aggregated and sorted — so "page 1 of most-popular" is actually "the size
OLDEST tags, re-ranked among themselves". The seeded live run shows it exactly: 30/35
returned, all usedCount=1, the five usedCount=5 tags absent; un-truncated control returns
them at the top. The fix must invert the order of operations: aggregate usage over the
FULL filtered directory, THEN order by usage, THEN paginate.

## Plan

**Branch:** `contrib/CTRIB-007-tag-popularity-ordering` on `opendatadiscovery/odd-platform`
(from `main` @ `6f356b72`). **One draft PR**, body "Part of #1773" (Thread A; the issue
stays open for the deferred threads), `Milestone: 0.28.0` line. One cohesive commit
(helper exemption + query restructure + tests are one logical change).

### Change 1 — `JooqQueryHelper.homogeneityCheck`: exempt computed (unqualified) alias fields

`JooqQueryHelper.java:139-153`: skip any field whose `getQualifiedName().qualified()` is
false (a computed alias — `rank`, `count`, `external` — is not a table column; the check's
real invariant is "no fields from two TABLES"). This subsumes and replaces the existing
`RANK_FIELD_ALIAS` special case (same shape: `field("rank", ...)` is unqualified; jOOQ
3.18 `Name#qualified()` verified present via javap). Loosening-only: every existing caller
that passes today still passes; previously-throwing inputs were runtime crashes, none live.
This realises the issue's "paginateAfterAggregation variant" intent as a generalisation of
the EXISTING primitive instead of a parallel method — any aggregated select becomes
paginatable (deviation named in the scope comment).

### Change 2 — `ReactiveTagRepositoryImpl.listMostPopular`: aggregate, THEN paginate

`:137-167` restructure (the union-usages CTE + mapTag + fetchCount machinery all reused):

```java
final Select<TagRecord> homogeneousQuery = DSL.selectFrom(TAG).where(conditions);
final Table<? extends Record> tagCte = homogeneousQuery.asTable("tag_cte");      // FULL filtered set (no window)
final Table<Record> unionUsages = getDataEntityWithDatasetFields(tagCte, homogeneousQuery);

final var aggregated = DSL.select(unionUsages.fields(tagCte.fields()))
    .select(DSL.boolOr(unionUsages.field(EXTERNAL_FIELD, Boolean.class)).as(EXTERNAL_FIELD))
    .select(DSL.sum(unionUsages.field(COUNT_FIELD, Integer.class)).as(COUNT_FIELD))
    .from(unionUsages)
    .groupBy(unionUsages.fields(tagCte.fields()));

final Select<? extends Record> select = paginate(aggregated,
    List.of(new OrderByField(field(COUNT_FIELD), SortOrder.DESC),   // popularity first
            new OrderByField(TAG.ID, SortOrder.ASC)),               // deterministic tiebreak
    (page - 1) * size, size);

return jooqReactiveOperations.flux(select).collectList()
    .flatMap(records -> jooqQueryHelper.pageifyResult(records, this::mapTag, fetchCount(query, ids)));
```

Page metadata (`_total` = full filtered-directory count via `count() over()`, `_next`)
now comes from the OUTERMOST paginate — same fields `pageifyResult` reads today (they
currently ride inside the CTE; the existing total/hasNext semantics are preserved —
`testListMostPopular`'s `total=4 / hasNext=false` asserts stay green). Ordering contract
after the fix: `usage DESC, id ASC` — deterministic for ties (the 35-equal-tags LSN-019
scenario returns the 30 oldest BY DESIGN then — equal usage, id tiebreak — which is the
correct contract; the discriminating young-populars scenario is the real test).
Performance note for the PR body: the aggregation now scans the full filtered directory
(2 GROUP BYs over tag_id-indexed relation tables) — inherent to a correct global Top-N;
tag directories are O(10^2..10^4); measured fine at e2e scale.

### Tests (G-C9, both buckets; failing-first)

- **Unit -> odd-platform CI** (BaseIntegrationTest = unit bucket):
  - EXTEND `TagRepositoryImplTest`: new test `listMostPopular returns the globally
    most-used tags, not the oldest window re-ranked` — seeds the discriminating shape
    (N old tags each with 1 relation, created FIRST/lowest ids; M young tags each with
    K>1 relations, created LAST/highest ids; page size < N+M), asserts: page 1 contains
    ALL young-populars, ordered `count DESC, id ASC`; total = N+M; hasNext = true.
    **RED on main** (young-populars absent from the window — the injected failing
    condition), GREEN on the fix. Relation rows seeded via jooq ops against real
    Postgres (data_source + data_entity minimal rows, the IT-005 SQL shape).
  - NEW tiny `JooqQueryHelperTest`: `homogeneityCheck` accepts one-table fields + a
    computed alias (the exemption — RED on main: throws "heterogeneous"), still rejects
    two TABLES' fields (the guarded invariant — GREEN both sides).
  - Full CI replica: `scripts/run-platform-tests.sh` (no-arg `:odd-platform-api:build` —
    test + checkstyle + assemble) on the fixed tree.
- **Integration -> odd-team, IT-005 FLIPS (LSN-029 — pre-authored in the protocol):**
  - Inner loop: `run-suite.sh IT-005` on the working-tree SUT -> GREEN (the 5 POP names
    visible on the rendered Top Tags strip).
  - RED proof: `ODD_SUT=ref:main run-suite.sh IT-005` -> RED for exactly the pinned
    reason (POP absent).
  - Flip-on-fix sweep: IT-005 protocol re-grounded (expected_result -> green-on-fix
    history note; status stays ready; result-log entry); `suites.yaml` lanes — IT-005
    OUT of `known-bugs` (-> 5 pins remain), INTO `feature-complete` (+ the I7 lane
    comment updated); run-log entries attributed.
  - **FULL regression (the gate, 2026-06-11/12 directive)** on the working-tree SUT, one
    suite at a time, actual counts read: `feature-complete` (green-target; +1 = IT-005
    joining), `multi-stack` (green-target), `known-bugs` (expected all-RED of the
    REMAINING 5 pins — IT-003 x2, IT-004, IT-006, IT-007; zero unexpected GREENs),
    `ingestion-e2e` (green-target). Unit full build on the same tree.

### Docs (G-C10 + G-C11) — read + decided + ROUTED (two routes)

- **Train `release/0.28.0`** (unreleased behaviour — the fix ships at 0.28.0):
  `documentation/docs/data-discovery/tagging.md` — the LSN-019 caveat block (lines
  ~61-68: "sorted by tag id, not by popularity" + empirical example + workaround)
  migrates to a short "Fixed in 0.28.0" resolved-limitation note (per the DOC-190
  companion contract: "After Thread A lands, the LSN-019 admonition migrates"); the
  Tag-facet seed-list sentence updated consistently. Sync-first, same-name push only
  (LSN-034). **Paired backlog DOC item** (milestone 0.28.0, affected URL + expected
  post-release phrases) so the release gate can find it.
- **Docs MAIN** (released-truth correction — true today, independent of 0.28.0):
  the same page's audit-asymmetry table (lines 100-109) — the entity row's "(with the
  entity id in the payload)" implication corrected to "capturing the before-and-after
  tag list" (live-verified this run); the "three different decoders" framing reduced to
  the real two-way statement (entity + dataset-field full diff; term nothing). Check
  `activity-feed.md`'s sibling note for the same falsified claim and correct together.
  Normal immediate flow on docs main (CTRIB-006 precedent for en-route released-truth
  corrections), live-verified at /review.
- Spec: NO change — `getPopularTagList` "sorted by popularity" becomes true.

### Ontology refresh (G-C10)

`/enrich --touched` + re-embed + COMMIT: `ReactiveTagRepositoryImpl` sidecar (the
name-behaviour drift -> fixed at commit; new aggregate-then-paginate shape),
`JooqQueryHelper` sidecar (paginate contract: computed-alias exemption, aggregated
selects paginatable). F-018 feature flow: drift entry
`name_behavior_drift_list_most_popular_...` bracket-stamped FIXED; UC-001 coverage ->
verified (IT-005 + the unit test), `use_case_coverage` 2/15 -> 3/15; test_matrix cell.
IT-005 protocol + suites.yaml (above). `issues/odd-platform/PLT-026.md`: github fields
filled (1773 + URL), Thread-status section (A shipped via this PR; B ADR-first deferred;
C re-scoped: entity-half falsified -> doc-corrected, term-half design-bound on the
entity-keyed activity schema). `P-LSN019` probe file: drift-fixed status note.
CTRIB-006 bookkeeping (observed en route): PR #1772 MERGED as `6f356b72` -> CTRIB-006
status `review-ready` -> `merged`.

### Scope EXCLUSIONS (G-C5 — deliberately NOT touched)

- **No Thread B code** (permission check in `getOrCreateTagsByName` / ingestion
  carve-out) — ADR-first, its own run.
- **No Thread C code** (term-path `@ActivityLog` / any activity schema change) — the
  suggested reuse is structurally infeasible (NOT NULL entity FK); design-bound, deferred
  with B. The entity half needs NO code (already full payload) — doc correction only.
- **No other F-018 drifts** (case-sensitivity, name validation, open read, TOCTOU,
  delete-cascade asymmetry, ids-param description, 200-vs-201, directory-CRUD audit
  absence... — all already catalogued in F-018/REFACTOR scopes; none enter this diff).
- **No spec change** (the popularity description becomes accurate).
- **No UI change** (TopTagsList client re-sort stays — harmless over a correct window;
  Overview/Management consume the corrected order as-is).
- **No new `paginateAfterAggregation` method** — the generalised `homogeneityCheck`
  realises the same reuse with less surface (deviation from the issue's letter, named in
  the scope comment).

### Scope/root-cause comment (posts to #1773 immediately after GATE 1 approval — ASCII, one comment)

> Reproduced and root-caused on a local stack built from current main; scope note for
> the upcoming fix PR. Per the "to decompose" label, the PR covers Thread A; here is
> what we verified about all three.
>
> Thread A (listMostPopular) - reproduced exactly as reported: seeded 35 tags where the
> 5 youngest are the most used (5 usages each vs 1); GET /api/tags?page=1&size=30
> returned the 30 oldest (every usedCount=1) and none of the 5 most-used; the same call
> with size=35 returns the 5 most-used at the top, proving the outer count-DESC sort is
> fine and the inner pre-aggregation window is the defect. The fix restructures the
> query to aggregate usage over the full filtered directory, then order by usage_count
> DESC with tag id ASC as a deterministic tiebreak, then paginate - so page boundaries
> are stable and the spec's "sorted by popularity" holds past one page. Realisation
> detail: instead of adding a parallel paginateAfterAggregation helper, the existing
> paginate primitive's field-homogeneity guard now exempts computed alias fields
> (generalising the exemption it already had for the FTS rank alias) - same reuse, less
> surface; any aggregated select becomes paginatable.
>
> Thread B (side-channel mints) - confirmed in source (and incidentally live: our audit
> probe minted a tag through PUT /api/dataentities/{id}/tags with no TAG_CREATE
> involved). Deliberately NOT in this PR: it changes the effective permission semantics
> of four shipped endpoints and the spec-acknowledged auto-create-on-miss behaviour, and
> the ingestion processor reaches the same primitive (needs a carve-out design so
> collectors keep minting). That wants a short design decision (ADR) first - we will
> follow up with it as its own PR.
>
> Thread C (audit asymmetry) - one correction from driving the running system: the data
> entity path DOES capture the full before/after tag lists (we changed an entity's tags
> and the TAG_ASSIGNMENT_UPDATED event carried old_state.tags = all 5 prior names,
> new_state.tags = the 2 new names). The handler resolves the full state from the entity
> id; the id is the lookup key, not the whole payload. So the real asymmetry is two-way,
> not three-way: entity and dataset-field changes are both fully audited; TERM tag
> changes emit nothing (TermServiceImpl.upsertTags has no @ActivityLog). The suggested
> reuse of TAG_ASSIGNMENT_UPDATED for terms does not fit the storage model: the activity
> table keys every event to a data entity (data_entity_id bigint NOT NULL, FK) - term
> audit needs either a schema/key design change or a term-scoped activity surface, so it
> rides the same follow-up design as Thread B rather than this PR. The tagging docs page
> will be corrected accordingly (the entity row currently implies id-only payload).
>
> Net: this PR fixes Thread A (query restructure + a failing-first repository test + an
> e2e regression test on the rendered Top Tags strip + the docs caveat update riding the
> 0.28.0 release train). Threads B and C stay open on this issue with the design notes
> above.

### Follow-ups to log on disk (Phase D)

- `issues/odd-platform/PLT-026.md` — github fields + Thread-status section (the B/C
  deferral tracking; no new item minted — PLT-026 IS the cluster tracker).
- Paired DOC item for the train edit (next free DOC-NNN, milestone 0.28.0).
- CTRIB-006 `merged` bookkeeping.

## Branch / commits (odd-platform)

Branch `contrib/CTRIB-007-tag-popularity-ordering` (from `main` @ `6f356b72`), pushed to
upstream; author + committer `odd-contributor[bot]`:

- `82812cdf` fix(tags): listMostPopular aggregates usage BEFORE paginating — 4 files
  +139/−11: `ReactiveTagRepositoryImpl.listMostPopular` aggregate-then-paginate
  (usage DESC, id-ASC ties; page metadata from the outermost paginate);
  `JooqQueryHelper.homogeneityCheck` computed-alias exemption (subsumes
  RANK_FIELD_ALIAS; loosening-only); the 2 failing-first test files. Exactly the
  approved plan; every exclusion held (no Thread B/C code, no spec change, no UI change,
  no new helper method).

## Test ledger (implement run, 2026-06-12)

- **Unit — failing-first (RED on pre-fix content, captured verbatim):**
  - `TagRepositoryImplTest` 11 completed / 1 failed — ONLY the new test:
    `Expecting actual: [18L,19L,20L,21L,22L] to contain exactly: [23L,24L,25L,18L,19L]
    ... not found: [23L,24L,25L]` — the 3 most-used youngest tags absent from page 1
    (the exact injected condition).
  - `JooqQueryHelperTest` 2 completed / 1 failed — the alias case threw
    `IllegalArgumentException: The list of passed query's fields is heterogeneous`
    (JooqQueryHelper.java:150); the two-table rejection passed (the guarded invariant,
    GREEN both sides).
- **Unit — GREEN on the fix:** both targeted runs BUILD SUCCESSFUL (TagRepositoryImplTest
  11/11 in 1m12s; JooqQueryHelperTest in 56s).
- **Unit — full CI replica:** `scripts/run-platform-tests.sh` (no-arg
  `:odd-platform-api:build` = test + checkstyle + assemble) on the fixed tree →
  **BUILD SUCCESSFUL in 6m49s**.
- **Integration — the IT-005 flip (LSN-029, pre-authored in the protocol):**
  - First fix-SUT run FAILED — **the fix WAS rendered** (DOM snapshot: the strip led
    with `it005-POP-005 5` … usage 5); the spec's own `exact: true` locator could never
    match (TagItem renders name+count with a CSS-margin gap → textContent
    `it005-POP-0055`). The pin was born RED; its PASS side first ran on this fix and
    exposed the locator defect. Spec re-grounded: substring locator + asserts ALL 5
    most-used tags visible.
  - **GREEN on the working-tree SUT @ 82812cdf: 1 passed (3.8s).**
  - **RED proof vs `ODD_SUT=ref:main` (6f356b72): 1 failed for exactly the pinned
    reason** (strip = the oldest window, `getByText('it005-POP-005')` — the proven-sound
    locator — found nothing). One honest interlude: the first ref:main attempt died
    building the throwaway SUT (gradle GC-thrash — the CTRIB-005/006 transient class);
    retried clean. Run-log: `integration-tests/run-log/2026-06-12-IT-005.md` (5
    attributed entries).
- **Integration — FULL regression (the gate, 2026-06-11/12 directive), all on the
  working-tree SUT @ 82812cdf, one suite at a time, actual counts read:**
  - `feature-complete`: **278 passed / 0 failed (4.7m)** — the 277 baseline + exactly
    IT-005 joining the lane. Zero regressions.
  - `multi-stack`: **9 passed / 0 failed (4.8m)**.
  - `known-bugs`: first pass **4 failed / 1 passed — ONE unexpected GREEN**, triaged
    in-band: IT-003's catalog half passed in-suite; isolation re-run of IT-003 on the
    SAME SUT = **2/2 RED (both pins hold)** and the diff cannot touch tsquery — a
    lane-composition sequencing flake (IT-005 left the lane), logged as a **TST-042
    instance** (the inverse direction: an expected-RED pin flashing GREEN). Clean
    re-run: **5 failed / 0 passed — EXPECTED all-RED**, every failure its documented pin
    (IT-003×2 PLT-090/127; IT-004 PLT-052; IT-006 TEST-GAP-1013; IT-007
    LSN-001/PLT-086), zero unexpected GREENs.
  - `ingestion-e2e`: **6 passed / 0 failed (1.2m)**.

## Docs ledger (G-C10 + G-C11) — READ + CHANGED + ROUTED (two routes)

- **READ:** `documentation/docs/data-discovery/tagging.md` (the caveat blocks end-to-end
  on both refs — main and the train copies were identical pre-change) +
  `documentation/docs/active-platform-features/activity-feed.md` (the tag event-type
  rows + the asymmetry hint). Claim-sweep over the train tree for other ordering-claim
  surfaces: only tagging.md carries it (catalog-overview's "most-used tags" line becomes
  simply true).
- **Docs MAIN (released-truth correction, immediate flow):** commit `188eb8e`
  (`5d92250..188eb8e`) — tagging.md asymmetry-table entity row → "capturing the
  before-and-after tag list"; the "three different decoders" paragraph → the live-verified
  two-way truth; activity-feed.md `TAG_ASSIGNMENT_UPDATED` row gains "Carries
  before-and-after tag lists" + the hint reworded. Frontmatter PyYAML-parses;
  descriptions 112/182 chars.
- **Train `release/0.28.0`:** commit `6be1f90` (same-name push `f61b9c2..6be1f90`,
  LSN-034 honoured) — the LSN-019 warning admonition + workaround → a version-anchored
  fixed-in-0.28.0 info note. Paired item `backlog/docs/DOC-449.md` (milestone 0.28.0,
  post-merge phrases recorded).
- **Live no-leak verified post-push:** the published page still serves the 0.27.x
  ordering caveat ("sorted by tag id, not by popularity" ×2 hits); zero "Fixed in
  0.28.0" phrases live. **Main-route corrections LIVE-VERIFIED after GitBook sync**
  (2026-06-12, same session): tagging.md "scoped to the entity, capturing the
  before-and-after" ×2 hits; activity-feed.md "both carry the full before-and-after tag
  lists" ×2 hits.
- **Spec:** no change — `getPopularTagList` "sorted by popularity" becomes accurate.

## Ontology refresh (G-C10)

- Sidecars re-enriched at `82812cdf` (file-analyser/0.5.0):
  `odd-platform__java__TagController__controller-method__getPopularTagList.md` (the
  substrate node whose public contract changed) +
  `odd-platform__java__repository__reactive__repository__ReactiveTagRepositoryImpl.md`
  (the changed implementation node; carries the JooqQueryHelper neighbour-contract
  change — the helper has no node of its own; repositories axis is the rev-2 sprint's,
  not in the current nodes.jsonl scan). Validation + enrichment.log + graph re-embed
  recorded below.
- `F-018.yaml`: drift facet `F-018-DRIFT-LSN019-listMostPopular-ranking` bracket-stamped
  FIXED (historical text preserved); UC-001 → `verified` (test_ref both buckets,
  test_demand none); `use_case_coverage` 2 → **3**/15 (note updated — the UC-009-arm
  counting convention preserved); test_matrix unit+integration cells updated (the new
  ranking test + IT-005 moved to covered; P-010 retires into them).
- `integration-tests/`: suites.yaml lane moves (IT-005: known-bugs → feature-complete,
  rejoins ui-e2e, I7 comment re-grounded; PyYAML-validated) + IT-005 protocol re-grounded
  (frontmatter, §1, §4, §5 incl. the locator nuance, cross-references flip provenance) +
  the spec's header comment.
- `probes/P-LSN019-listMostPopular-drift.md`: status `drift-fixed` (the (a)-shaped
  resolution it foresaw).
- `issues/odd-platform/PLT-026.md`: status `filed`, github fields 1773, Thread-status
  section (A shipped / B ADR-first deferred / C re-scoped with the falsification).
- Bookkeeping observed en route: `contributor/CTRIB-006.md` → **merged** (PR #1772 =
  main @ 6f356b72).

## Follow-ups filed on disk (G-C5 / follow-up-on-disk)

- `backlog/docs/DOC-449.md` — the paired release-train doc item (milestone 0.28.0).
- `backlog/tests/TST-042.md` — the known-bugs lane-composition flake instance appended
  (an expected-RED pin flashing GREEN under sequencing change — extends the item's blast
  radius; no new item minted, TST-042 IS the class tracker).
- `issues/odd-platform/PLT-026.md` Thread-status — Threads B + C deferral tracking (no
  new items minted; PLT-026 is the cluster tracker).

## Branch / PR

- Branch `contrib/CTRIB-007-tag-popularity-ordering` pushed to
  `opendatadiscovery/odd-platform` (1 commit `82812cdf`, bot-authored).
- **Draft PR #1775** — https://github.com/opendatadiscovery/odd-platform/pull/1775
  (`draft: true`, "Part of #1773" — NOT Closes; the issue stays open for Threads B/C;
  `Milestone: 0.28.0` line — the issue's milestone re-verified open/unchanged via the
  API at PR time (G-C11); docs note `documentation@release/0.28.0 (6be1f90) — publishes
  with the 0.28.0 release`; review requested from RamanDamayeu, HTTP 201; the bot cannot
  merge — GATE 2 is the human's).

## Definition of Done (LSN-032 four gates)

1. **Unit (full build, working tree = branch content):** ✅ BUILD SUCCESSFUL 6m49s
   (test + checkstyle + assemble) + failing-first RED (verbatim reasons above) → GREEN.
2. **Integration (FULL regression on the working-tree SUT):** ✅ feature-complete 278/0 +
   multi-stack 9/0 + known-bugs 5/5-still-RED (after the triaged TST-042 flake
   interlude) + ingestion-e2e 6/0; IT-005 GREEN-on-fix + ref:main RED proof (LSN-033 —
   SUT a run parameter, built from the tree each run).
3. **Docs:** ✅ READ + CHANGED + ROUTED both routes (train `6be1f90` + main `188eb8e`);
   paired DOC-449; live no-leak verified (main-sync re-check at review).
4. **Ontology:** ✅ two sidecars re-enriched at `82812cdf` + F-018 flow flipped +
   IT-005/suites re-grounded + PLT-026/probe/CTRIB-006 bookkeeping; graph re-embedded;
   ALL COMMITTED (workspace commit hash in the log).

## Comments (issue thread)

- Clarify comment: **none warranted** (G-C6) — recorded above.
- Root-cause + scope comment: ONE comment (drafted above), posts immediately after
  GATE 1 approval, before any code (G-C5; github-write rate-limit honoured).
- **POSTED 2026-06-12 (post-GATE-1, pre-code):**
  https://github.com/opendatadiscovery/odd-platform/issues/1773#issuecomment-4691179092
  (author `odd-contributor[bot]`, HTTP 201; ASCII-verified in-band before post; content =
  the GATE-1-approved draft verbatim).

## Review (2026-06-12, session: separate from the implementing session — post-5264579)

- **Result**: ACCEPTED — `pr-draft` → `review-ready`. GATE 2 (human review + merge of
  draft PR #1775) is the remaining step. Paired DOC-449 flipped `review-ready` →
  `pending-release` (Gate 8 PENDING-RELEASE 0.28.0), with two reviewer corrections
  recorded in it (canonical live URL carries the `features/` prefix — the recorded
  prefix-less form 404s, sitemap-verified; + a new release-gate criterion verifying the
  merge-healed audit rows, below).
- **The PR head moved before review**: the maintainer pressed update-branch at
  15:28+0200 — head `1a196254` = the bot's fix `82812cdf` + main `8b0155f7` (pt-BR
  #1564). Inter-head diff = ONLY the 3 translation files (verified); the fix content is
  byte-identical. **This review ran on `1a196254`** — exactly what merges at GATE 2.
- **Re-verification protocol**: every load-bearing claim re-derived from branch source /
  live GitHub API / `git ls-remote` / live pages / the reviewer's own full-regression
  runs — not from this record.

### Definition of Done (LSN-032 four gates) — re-verified

1. **Unit (full build on the PR head)** — PASS. Reviewer's own
   `scripts/run-platform-tests.sh` (no-arg = `:odd-platform-api:build`: test +
   checkstyle + assemble) on the clean tree @ `1a196254` → **BUILD SUCCESSFUL in
   6m 16s**. Independently: CI `Run tests` on the exact head = success
   (2026-06-12T13:28Z). **One CI anomaly attributed**: the `82812cdf` CI run failed 1 of
   420 — `PrometheusMetricsIngestionTest.testHistogramAndSummary` (500 on
   assertMetrics) — a transient: the same backend content passed CI on `1a196254` (the
   merge added only UI translation files), the implement build, and the reviewer's
   build; the diff touches tag pagination + an assert-only guard, not metrics. Filed
   **TST-046** (flake tracker; check-run 81037139088 annotation preserved).
2. **Integration (FULL regression, reviewer's own runs on the PR-head SUT
   `1a196254`, image digest `sha256:9feb0734…`)** — PASS. One suite at a time:
   `feature-complete` **278 passed / 0 failed (4.6m)** — IT-005 GREEN in-suite (test
   275: all 5 most-used youngest tags render on the Top Tags strip); `multi-stack`
   **9 passed / 0 failed (4.5m)**; `known-bugs` **5 failed / 0 passed — EXPECTED
   all-RED**, every failure its documented pin (IT-007 LSN-001/PLT-086 · IT-006
   TEST-GAP-1013 · IT-004 PLT-052 · IT-003×2 PLT-090/PLT-127), zero unexpected GREENs
   (the implement session's one-off TST-042 lane flake did not recur — and its IT-003
   isolation re-run 2/2-RED triage was verified from the run-log); `ingestion-e2e`
   **6 passed / 0 failed (1.2m)** — the real source→collector→platform→UI stand. All
   counts identical to the implement run. The IT-005 flip chain re-verified from the
   5-entry run-log: born-RED pin → locator defect honestly surfaced at first PASS-side
   run (fix WAS rendered; chip textContent `it005-POP-0055` CSS-margin nuance) →
   re-grounded STRONGER (substring + ALL-5 loop) → GREEN 1/1 → honest SUT-BUILD-FAILED
   interlude → `ODD_SUT=ref:main` RED for exactly the pinned reason (LSN-029/LSN-033).
3. **Docs** — PASS; train half PENDING-RELEASE (0.28.0). **Remote truth via
   `git ls-remote` (DOC-448)**: docs `main` = `188eb8e` (the released-truth correction —
   the local single-branch clone's tracking ref lags; ls-remote authoritative), train
   `release/0.28.0` = `756361c` ⊇ `6be1f90` (parent `f61b9c2` — same-name push as
   recorded). **Main route live-verified** (canonical URLs under the `features/`
   prefix, sitemap-resolved): tagging — entity row "capturing the before-and-after tag
   list" LIVE, "three different decoders" GONE; activity-feed — "Carries
   before-and-after tag lists" + "both carry the full before-and-after tag lists" LIVE;
   raw `<head>` meta descriptions intact (112/182 chars, PyYAML OK both routes).
   **No-leak verified**: the 0.27.x ordering caveat ("sorted by tag id, not by
   popularity") still serves live; zero "Fixed in 0.28.0" live. Doc claims
   code-verified: `TagActivityHandlerImpl.java:26-50` resolves FULL before/after states
   (the entity id is the lookup key); `TermServiceImpl.upsertTags:253-264` has no
   `@ActivityLog`. Gate 11 banned-term grep: zero hits, both routes. Reviewer's
   claim-sweep over the train tree: the only other ordering surface
   (catalog-overview.md "most-used tags") becomes simply TRUE with the fix — no edit
   needed, as the implement session concluded.
4. **Ontology** — PASS. Both sidecars `enriched_at_commit: 82812cdf` + enrichment.log
   13:05Z entries + manifest enrichment block (`enriched_node_count: 214`); the
   repository sidecar's fixed-chain invariants verified against the actual diff
   (aggregate-first shape :137-171, helper exemption :141-146); F-018 PyYAML OK —
   UC-001 `verified` with both test refs, `use_case_coverage` **3/15**, drift facet
   bracket-stamped FIXED with history preserved, matrix updated, P-010 retired into the
   real tests; suites.yaml lane moves exact (IT-005: known-bugs→feature-complete +
   ui-e2e rejoin + I7 comment re-grounded; known-bugs = 4 protocols / 5 tests);
   P-LSN019 `drift-fixed` with provenance; NEW P-249 (post-fix full-directory
   aggregation cost — pending-stress-protocol); PLT-026 `filed` + the 3-thread public
   status section; CTRIB-006 `merged` recorded (PR #1772 = `6f356b72` ✓); graph
   build-info **nodes=7083 / edges=9180 / vectors=8014 @ 2026-06-12** — exactly as the
   commit body claims.

### Contributor gates

- **G-C1 reproduce-first** — PASS. `reproduced:` carries the live API capture (35-tag
  seed: page1/size30 = 30 oldest, zero of the 5 most-used; size=35 control = the 5
  most-used on top) + the D3-entity falsification (old_state 5 names → new_state 2);
  the pre-fix code shape (paginate-by-id-inside-CTE, `82812cdf^` read this review)
  entails exactly that observation; IT-005 RED on pre-fix content in both prior runs.
  The shared-stack 0-residue claim could not be independently re-checked (the review's
  own multi-stack run recreated probe-database before the check landed — race noted
  honestly); the implementer's record states it verified, and the discriminating
  `ctrib007%` marker is absent from the recreated stack.
- **G-C2 running system, not the diff** — PASS via DoD 1+2 (reviewer's own full unit
  build + full FOUR-suite regression on the PR-head SUT + CI on the exact head).
- **G-C3 GATE 1 plan-before-code** — PASS. `plan_approved_by: RamanDamayeu (2026-06-12,
  'Approve as written')`; the verifiable ordering half: scope comment 12:16:27Z →
  first code commit 12:30:58Z (14 min; comment posting is itself gated on GATE-1
  approval per protocol). Single-workspace-commit shape means no separate plan-commit
  timestamp exists (unlike CTRIB-006) — noted; the maintainer's own post-plan actions
  (update-branch + invoking this review) corroborate.
- **G-C4 GATE 2 human merge** — PASS (structural). PR #1775 fetched live: author
  `odd-contributor[bot]`, base `main`, head `1a196254`, **`draft: true`** (the bot never
  left draft), review requested from RamanDamayeu, `mergeable_state: clean`.
- **G-C5 bounded diff + public scope comment** — PASS. Code diff = 4 files +139/−11 =
  exactly the approved plan (aggregate-then-paginate restructure; homogeneityCheck
  computed-alias exemption subsuming RANK_FIELD_ALIAS; 2 failing-first test files).
  Every exclusion verified absent from the diff: no Thread B code (no
  TagServiceImpl/permission change), no Thread C code (no @ActivityLog/schema change),
  no spec change, no UI change, no parallel `paginateAfterAggregation` method. Scope
  comment PUBLIC on #1773 (4691179092, bot-authored, 12:16Z = pre-code, **2994 chars
  100% ASCII** verified via raw API body; content = the GATE-1-approved draft; the
  helper-generalisation deviation from the issue's letter is named in it).
- **G-C6 one-question bar** — PASS. "No question warranted" recorded with reason; issue
  #1773 has EXACTLY 1 comment (the scope comment) — zero clarify noise — via issue API.
- **G-C7 blast-radius** — PASS. `adr_required: false` sound for Thread A: no migration,
  no auth/security-posture change, no contract break — the fix RESTORES the published
  contract (`odd-platform-specification/openapi.yaml:345-346` "sorted by popularity",
  re-located this review). The helper change is loosening-only BY CONSTRUCTION
  (assert-only method: skip-or-throw; previously-throwing inputs were runtime 500s,
  none live; `RANK_FIELD_ALIAS = field("rank")` unqualified → still exempt). Threads
  B/C correctly STOPPED at ADR-first; C's structural blocker re-verified in source
  (`V0_0_48__add_activity.sql:4,12` — `data_entity_id bigint NOT NULL` FK).
- **G-C8 issue-is-data** — PASS. Maintainer-authored issue treated as quoted data; the
  run FALSIFIED the issue's D3-entity claim live and corrected two issue mis-cites
  (TopTagsList client-sort; the LSN-019 citation) — evidence of analysis, not steering;
  the falsification is public in the scope comment. No injection content.
- **G-C9 test integrity, BOTH buckets** — PASS. Unit: the repository test seeds the
  discriminating shape (5 old/low-use low-id + 3 young/most-used high-id, page size 5)
  and asserts exact page-1 membership AND order (`containsExactly`: usage DESC, id-ASC
  ties) + total 8 + hasNext — RED on pre-fix code by construction (ledger's verbatim
  `[18..22]` vs `[23,24,25,18,19]`); the helper test pins the exemption (RED pre-fix)
  AND the still-guarded two-table rejection. Integration: IT-005 re-grounded STRONGER
  (1 exact-match → all-5 substring loop), GREEN-on-fix + RED-on-ref:main, lane move =
  the regression closure. The LEFT-JOIN union shape verified (`:385,:393` + coalesce):
  zero-usage tags survive aggregation — no management-list tag-dropping regression;
  `_total` still counts all filtered tags (both arms verified: window `count() over()` +
  empty-page `fetchCount`).
- **G-C10 ontology + docs move with the code** — PASS (DoD 3+4). Reviewer's converge
  grep: `navigation/` has ZERO stale tag-ordering pointers (the TST-045 class does not
  recur here); every IT-005/LSN-019 workspace surface is flipped or correctly
  historical.
- **G-C11 milestone gate** — PASS. Issue #1773 milestone `0.28.0` OPEN (due 2026-06-22)
  re-verified via issue API at review time; PR body carries verbatim `Part of #1773`
  (NOT Closes — the issue stays open for B/C, correct per the decomposition) +
  `Milestone: 0.28.0` + the two-route docs note; docs routed per the classifier
  (released-truth → main `188eb8e`; unreleased → train `6be1f90`); paired DOC-449
  milestone-gated. (No GitHub milestone OBJECT on the PR — CTRIB-004/005/006 precedent;
  the issue carries it.)

### Universal Quality Bar gates

- **Gate 1 (no duplicates)** — PASS. The ranking test EXTENDS the existing
  TagRepositoryImplTest class; JooqQueryHelperTest is the first test of that class (no
  prior duplicate); the helper exemption SUBSUMES the RANK_FIELD_ALIAS special case
  (net duplication reduction); TST-046 deduped vs TST-042 (unit-CI transient vs e2e
  lane-composition — distinct classes; grep'd backlog first).
- **Gate 2 (aliases)** — N/A. No new doc concept/alias introduced.
- **Gate 3 (caveats)** — PASS. The resolved caveat migrates to a version-anchored
  `{% hint style="info" %}` Fixed-in-0.28.0 note (the DOC-190 companion contract
  honoured); the corrected audit-asymmetry rows stay INSIDE the existing warning
  admonition; all other operator caveats untouched and re-read.
- **Gate 4 (consumer-read)** — PASS. Workspace commit `5264579` carries the 27-file
  `Consumer-read:` footer; key consumers re-walked this review: `paginate` internals
  (order-field resolution BY NAME against the wrapped table — `getOrderFields`),
  `pageifyResult` metadata contract, `getDataEntityWithDatasetFields` union,
  `fetchCount` empty-page total, `TagActivityHandlerImpl`, `TermServiceImpl.upsertTags`,
  `FTSConstants.RANK_FIELD_ALIAS`, the 16 paginate caller files (loosening-only
  argument verified by construction + every FTS caller exercised GREEN in-suite).
- **Gate 5 (unset-parameter)** — N/A (no SDK builder in scope).
- **Gate 6 (bidirectional code↔doc)** — PASS. Code→doc: the behaviour change rides the
  train; the live-falsified doc claim corrected on main. Doc→code: every changed doc
  claim matched to source read this review. Claim-class sweeps (ordering + audit
  payload) across BOTH doc trees: one residual surface found — the TRAIN's stale copy
  of the audit rows (below, editorial) — tracked via DOC-449's new criterion.
- **Gate 7 (layout/completeness)** — PASS. No SUMMARY change needed (in-page edits
  only); no heading changes (in-page TOC unaffected); the
  `#known-limitations-and-operator-caveats` anchor intact on both refs (the
  activity-feed cross-link resolves); suites-lane registration verified.
- **Gate 8 (publishing/live)** — PASS for all public surfaces fetched live this review
  (PR #1775, issue #1773, comment, check-runs ×2 heads, docs pages ×2, sitemap). Docs
  train half: **PENDING-RELEASE (0.28.0)** — branch sub-checks green now; post-merge
  URLs + phrases recorded in DOC-449 **with the canonical `features/`-prefixed URL**
  (the prefix-less URL 404s — caught by this review's live fetch, fixed in DOC-449).
- **Gate 9 (claim provenance)** — PASS. Every load-bearing record claim re-derived
  (diff vs plan; GitHub state via 7 API fetches; train via ls-remote + show + grep;
  live pages via WebFetch + raw curl `<head>`; ontology via disk reads + PyYAML ×3;
  regression via the reviewer's own four-suite + full-build runs; spec via grep at
  `openapi.yaml:345-346`; migration via read at `V0_0_48:4,12`). Outbound URL sweep:
  10 fetches, 0 broken in shipped content; 1 trap caught (the `features/` URL prefix —
  the 404 suggestion + sitemap resolved it). Banned-phrase check over this review:
  none used.
- **Gate 10 (content-type homing)** — PASS. Work record in `contributor/`, run evidence
  in `run-log/`, probes in `probes/`, behaviour caveats on the feature page, audit
  semantics on both feature pages consistently, follow-ups in `backlog/` — per
  canonical-homes.
- **Gate 11 (audience isolation)** — PASS. Banned-term grep over the touched pages at
  BOTH refs (`188eb8e` + `release/0.28.0`): zero hits. PR body + issue comment are
  operator/contributor language (the `contributor/CTRIB-007.md` pointer is repo-public
  traceability, CTRIB-004..006 precedent).

### Verdict bookkeeping

- **Regressions**: none — measured, not inferred: full unit build GREEN (6m16s, mine) +
  CI success on the exact head + feature-complete 278/0 + multi-stack 9/0 + known-bugs
  5/5-still-RED + ingestion-e2e 6/0, all reviewer-run on the PR-head SUT `1a196254`.
  The one CI anomaly (Prometheus flake on `82812cdf`) attributed with 3 green runs of
  the same content → TST-046.
- **Navigation**: consistent — zero stale tag-ordering pointers in
  `navigation/domains/` (grep'd: listMostPopular / oldest-by-id / LSN-019 /
  getPopularTagList).
- **Upstream issues logged**: none new (PLT-026 IS the cluster tracker; Threads B/C
  ride it).
- **Doc-product editorial findings** (audit per
  `playbooks/doc-product-editorial-read.md`):
  - **Coverage this run**: focused pass per CTRIB-004..006 precedent (full-tree sweep
    was 2026-06-08): both touched pages end-to-end at BOTH refs (main `188eb8e` state +
    train `release/0.28.0` state); ordering-claim sweep over the train tree;
    audit-payload claim sweep over both trees; cross-link/anchor checks; a 3-way
    **merge-preview of the train into main**.
  - **Findings**:
    - ONE (parallel-surfaces-with-drift, transient): the train branch still carries the
      pre-correction audit-asymmetry text ("with the entity id in the payload" /
      "three different decoders" — train `tagging.md:100,104`, `activity-feed.md:61,66`)
      because the train was cut before main's `188eb8e` correction. **Merge-preview
      verified the 3-way merge heals it cleanly** (zero conflict markers; the merged
      result = main's corrected rows + the train's Fixed-in note; the falsified text
      survives nowhere). Tracked as a new RELEASE-GATE CRITERION in DOC-449 (the gate
      now explicitly verifies the healed rows) — no new item needed; git's own merge
      machinery guards the conflicting-edit case.
- **Follow-ups filed this review**: `backlog/tests/TST-046.md` (low — the Prometheus
  CI flake instance + recurrence tracking); DOC-449 reviewer corrections (canonical
  URL + heal criterion + `pending-release` flip).
- **Reviewer-committed artefacts**: 4 attributed run-log entries (feature-complete /
  multi-stack / known-bugs / ingestion-e2e on `1a196254`), the harness re-stamps from
  the reviewer's P-001 run (probe-run yaml + feature-flows stamp + 2 sidecar
  appendices), TST-046, DOC-449, this verdict.
