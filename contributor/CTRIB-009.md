---
id: CTRIB-009
github_issue_number: 1755
github_issue_url: https://github.com/opendatadiscovery/odd-platform/issues/1755
class: bug
milestone: "0.28.0"
status: done   # REVIEWED 2026-06-13 (separate session): ACCEPTED — every contributor gate (G-C1..C11), every applicable universal gate (1-11), and the LSN-032 DoD re-verified with the reviewer's OWN evidence (full unit build + RED-proof replication + four-suite regression on PR-head SUTs); GATE 2 (human review + merge of draft PR #1779) is the remaining step | LEDGER-RECONCILED 2026-08-30: was `review-ready`; PR #1779 (`05ecf0a9`) is in the released `0.28.0` tag (published 2026-06-17). GATE 2 is done; `/review release:0.28.0` owns the flip to `done`. | RELEASE-GATE 0.28.0 (2026-08-30): fix confirmed inside the released `0.28.0` tag; the paired doc item(s) live-verified on docs.opendatadiscovery.org; full unit+IT suite and real-instance checks satisfied by the 0.29.0 release record (superseding published artifact ghcr digest a2e0c86d, unit BUILD SUCCESSFUL @ f12b8fbc, feature-complete 317/1, known-bugs 3-expected-RED).
reproduced: "live 2026-06-12 on the PRE-FIX working-tree SUT (odd-platform:odd-team-sut built from clean main @ 3f02dd63, image sha256:def06b3d…, odd-minimal stack). (1) Rail: run-suite.sh IT-068 → 2/2 GREEN — the PLT-147 LSN-029 pin asserts results-GET ≥500 + no row rendered (run-log/2026-06-12-IT-068.md). (2) Manual, transformer class {2} seed id 20688 (entity_class_ids={2}, specific_attributes NULL, FTS vector): POST /api/search {query:'ctrib009xfm'} → 200, total:1, facet entity_classes shows {id:2, count:1} (the self-contradicting 'Transformers | 1'); GET /api/search/{id}/results → 500 {code:SYS001}; GET /api/dataentities/20688 → 500 {code:SYS001}. (3) Manual, quality-test class {4} seed id 20689: search results GET → 500 SYS001; GET /api/dataentities/20689 → 500 SYS001. (4) Container log — all four throw sites: mapPojo:99 (getDataTransformerDetailsDto null → SearchController#getSearchResults checkpoint), mapPojo:114 (getDataQualityTestDetailsDto null), mapDtoDetails:298 (transformer detail → DataEntityController#getDataEntityDetails checkpoint), mapDtoDetails:314 (QT detail, expectationType first deref). (5) Seeds deleted post-capture (count 0); empty-query results GET back to 200 — no toxic residue (CTRIB-005 lesson)."
adr_required: false  # defensive null-guard inside one mapper; no migration, no auth/security-posture change, no public-contract break (G-C7 clean — response SHAPE unchanged; absent sub-projections render as absent fields, exactly the DEG/mapPojo precedent)
plan_approved_by: "RamanDamayeu (GATE 1, 2026-06-12 — 'Approve as written': guards in both methods incl. the symmetric DEG-details guard; unit test + IT-068 flip with detail click-through; no docs change; scope comment posting approved; PLT-223 + TST-047 follow-ups)"
plan_approved_at: "2026-06-12"
docs_routing: "none — both affected pages (data-discovery/search.md, data-discovery/entity-detail-page.md) read end-to-end at the train ref; neither documents the 500-on-null-details behaviour; no claim is made false by bug or fix (full why in the Plan's Docs section)"
pr_url: "https://github.com/opendatadiscovery/odd-platform/pull/1779"
pr_draft: true
---

# CTRIB-009 — DataEntityMapperImpl NPE → 500 SYS001 on null details DTO (search results + entity detail) (#1755)

Issue #1755 is the filed form of PLT-147 (`issues/odd-platform/PLT-147.md`, status `filed`,
github fields backfilled 2026-06-11). Author: the maintainer (RamanDamayeu). Labels `kind: bug`,
`scope: backend`; milestone **0.28.0** (open, due 2026-06-22, semver title — **G-C11 PASS**,
verified via issue API at intake 2026-06-12); 0 comments at intake; assignee RamanDamayeu.
Issue body treated as quoted data (G-C8); every load-bearing claim independently re-verified
against the odd-platform working tree (`main` @ `3f02dd63`, clean, = origin/main — includes
the merged CTRIB-008 PR #1777).

## Intake — the issue's claims (quoted data)

`DataEntityMapperImpl` branches per entity class in `mapPojo` (search results list via
`mapPojos`) and `mapDtoDetails` (entity detail). The `DATA_TRANSFORMER` and
`DATA_QUALITY_TEST` branches dereference their class-specific details DTO with no null
guard; when the DTO is null the mapper NPEs and the whole response 500s as `SYS001` — on
the catalog search results list and on the entity detail endpoint. `DATA_CONSUMER` /
`DATA_INPUT` deref directly too (don't currently fault on the dimensions path);
`DATA_ENTITY_GROUP` in `mapPojo` DOES guard (`dto.getGroupsDto() != null`) — the guard
pattern exists, applied inconsistently. Reproduction: seed a searchable class-`{2}` entity
with a `search_entrypoint` vector and no transformer details → search session finds it →
`GET /api/search/{id}/results` → 500. Fix shape per the issue: null-guard the branches in
both methods, skipping the list mapping (lists left empty), mirroring the existing DEG guard.
Regression guard: IT-068 / F-148 LSN-029 characterization pin (GREEN today, RED on fix =
closure signal); convergent re-confirmation via the IT-073 / F-206 build.

## Claim verification (issue is data — re-verified against main @ 3f02dd63)

1. **Throw sites CONFIRMED** (`DataEntityMapperImpl.java`, line numbers re-verified on
   main @ 3f02dd63 — identical to the issue's):
   - `mapPojo`: TRANSFORMER `:99` (`getDataTransformerDetailsDto().sourceList()`) + `:105`
     (`targetList()`); QUALITY_TEST `:114` (`linkedUrlList()`) + `:116` (`datasetList()`);
     CONSUMER `:125`; INPUT `:133`. DEG `:140` guarded (`&& dto.getGroupsDto() != null`).
   - `mapDtoDetails`: TRANSFORMER `:298`/`:304`; QUALITY_TEST `:313-331` (seven derefs:
     `expectationType()`, `expectationParameters()`, `datasetList()`, `linkedUrlList()`,
     `latestTaskRun()`, `suiteName()`, `suiteUrl()`); CONSUMER `:335`; INPUT `:352`.
   - **Beyond the issue text:** `mapDtoDetails`' DEG branch `:343`/`:347`
     (`dto.getGroupsDto().entities()` / `.hasChildren()`) is ALSO unguarded — the issue's
     "the DEG branch DOES guard" holds only for `mapPojo:140`. (Reachable-null: NO on the
     current path — `getDetails` always runs `enrichEntityClassDetails`, which
     unconditionally sets `groupsDto` for DEG-classed entities at
     `DataEntityServiceImpl.java:593-601`; the guard there is defensive symmetry.)
2. **Null-safety contrast CONFIRMED:** `DATA_SET` branch is safe — `mapStats` returns an
   empty `DataSetStats()` on null (`:551-554`); `mapLinkedUrlList` is null-safe on the
   *collection* (`CollectionUtils.emptyIfNull`, `:523-527`) but not on the details DTO
   that carries it.
3. **Root-cause mechanism CONFIRMED** (the hydration/mapper class-key mismatch):
   `DataEntityServiceImpl.enrichEntityClassDetails` (`:534-602`) populates details DTOs by
   iterating the parsed `specific_attributes` JSONB **keys** (`dto.getSpecificAttributes()
   .forEach(switch ...)`); the mapper branches on `entity_class_ids`. Any entity whose
   `entity_class_ids` carries a class with no matching `specific_attributes` block reaches
   the mapper with a null details DTO. DEG is the exception — hydrated unconditionally from
   `entity_class_ids` (`:593-601`), which is exactly why only DEG got the mapper guard.
4. **Error surface CONFIRMED:** no `NullPointerException`-specific handler; the global
   `@RestControllerAdvice` catch-all maps it to HTTP 500 `SYS001`.
5. **Detail path single-caller CONFIRMED:** `mapDtoDetails` has exactly one caller —
   `DataEntityServiceImpl.getDetails:208`.
6. **FE tolerance of the fix shape CONFIRMED (static):** search row transformer/QT/consumer
   columns render via `TruncatedCell` with `dataList?.map(...)`
   (`TruncatedCell.tsx:85` — optional-chained); DEG `itemsCount` renders via
   `searchResult?.itemsCount`. Absent list fields render as empty cells, not crashes.
   (Live confirmation = the flipped IT-068 browser drive, Phase D.)
7. **Existing test surfaces CONFIRMED:** IT-068 (`search-class-tab-filter.spec.ts`, lanes
   `feature-complete` + `ui-e2e`; `regresses: [PLT-147]`) — LSN-029 pin GREEN-today
   asserting results-GET ≥500 + no row, flip pre-authored in protocol §5. IT-073 / F-206
   runs its corner on a DATA_SET row *because of* this bug (un-blocks post-fix — follow-up,
   not this PR). No unit test exists for `DataEntityMapperImpl`'s class-branch mapping
   (`mapper/` test dir grep: only `DataEntityStatusKnownBugTest`, a PLT-027 structural pin
   on `applyStatus` — different method, untouched by this fix).
8. **Adjacent risk (out of scope, follow-up):** `mapDataQualityTest` (`:362-383`) derefs
   `dto.getDataQualityTestDetailsDto()` unguarded on the data-quality list path (`:365`,
   `dqDto.latestTaskRun()` etc.) — same defect class, third surface, NOT named by the
   issue and NOT reproduced this run → logged on disk as a follow-up, not widened into
   this PR (G-C5).

## Scope analysis

- **Class: bug** (defensive-coding gap; user-facing 500 on two primary surfaces). Features:
  **F-148** (Search Result Class-Tab Filter — carries the IT-068 pin), **F-206** (search-row
  class badge — its IT-073 corner was constrained by this bug), the search results list +
  entity detail surfaces generally. Mission relevance: catalog search and entity detail are
  the platform's most-touched discovery surfaces (release-plan row 2: "One such entity 500s
  the whole search results list AND its detail page — the most-touched surface").
- **Architectural significance (G-C7): NO ADR.** No migration, no auth/security-posture
  change, no public-contract break — a null-guard inside one mapper, mirroring the file's
  own existing DEG guard pattern. Response shape for affected entities changes from
  500-error to 200-with-absent-sub-fields — the documented/intended behaviour.
- **Clarify (G-C6): no question warranted** — maintainer-authored issue with verified
  line numbers, deterministic reproduction, explicit fix shape, and the regression-pin
  flip pre-authored. Nothing left that would change the implementation.
- **Consumers of the changed artifact:** `mapPojo` ← `mapPojos` (search results list,
  browse/list endpoints); `mapDtoDetails` ← `getDetails` (entity detail);
  `mapDataQualityTest` calls `mapPojo(dto)` then derefs the QT DTO itself (out-of-scope
  surface, see Claim 8). FE consumers: `ResultItem.tsx` (search row),
  `OverviewTransformerStats.tsx` (detail overview), `TruncatedCell` (all null-tolerant).

## Root cause (verified on source; live confirmation in Phase B)

The platform has two different authorities for "what classes does this entity have":
`entity_class_ids` (the integer array on the row — what the mapper branches on) and the
`specific_attributes` JSONB keys (what hydration branches on). `enrichEntityClassDetails`
only constructs a class's details DTO when the attributes block exists; the mapper assumes
it always does for TRANSFORMER / QUALITY_TEST / CONSUMER / INPUT. Entities where the class
id is present but the attributes block is absent (minimal/partial ingestion, hollow
entities, raw-seeded rows) make `mapPojo` / `mapDtoDetails` throw an NPE, and the
catch-all advice turns one bad row into a 500 for the WHOLE response — the entire search
results page or the entire detail page. The DEG branch proves the intended pattern: its
hydration is unconditional AND its `mapPojo` branch still guards.

## Reproduction (Phase B — CAPTURED, G-C1)

Full capture in the `reproduced:` frontmatter. Headline: all four failing surfaces driven
live on the pre-fix SUT — transformer search-results 500 + detail 500, quality-test
search-results 500 + detail 500 — each NPE log-localized to its exact mapper line
(`mapPojo:99`/`:114`, `mapDtoDetails:298`/`:314`), all wrapped to `SYS001` by the
catch-all advice. The IT-068 rail (2/2 GREEN, pin semantics) is the standing automated
reproduction. Seeds cleaned; the stack verified non-poisoned afterwards.

## Plan

**Branch:** `contrib/CTRIB-009-mapper-null-details-guard` on `opendatadiscovery/odd-platform`
(from `main` @ `3f02dd63`). **One draft PR**, body `Closes #1755`, `Milestone: 0.28.0` line.
One cohesive code commit (the guards + the failing-first unit test).

### Change — `DataEntityMapperImpl.java` only (no other source file)

Null-guard every class branch that derefs a possibly-null details DTO, mirroring the
file's own existing guard (`mapPojo:140`, DEG):

- **`mapPojo`** — add `&& dto.getXxxDetailsDto() != null` to the branch condition for
  `DATA_TRANSFORMER` (`:98`), `DATA_QUALITY_TEST` (`:113`), `DATA_CONSUMER` (`:124`),
  `DATA_INPUT` (`:132`). (DEG `:140` already guarded.)
- **`mapDtoDetails`** — same for `DATA_TRANSFORMER` (`:297`), `DATA_QUALITY_TEST`
  (`:312`), `DATA_CONSUMER` (`:334`), `DATA_INPUT` (`:351`). For the **DEG branch**
  (`:342`) guard only the `groupsDto`-derived statements (`setEntities`/`setHasChildren`)
  with an inner `if (dto.getGroupsDto() != null)`, keeping
  `setManuallyCreated(...)` unconditional — it reads the pojo, not the DTO.
  (DEG-details reachable-null is NO today — `getDetails` always hydrates `groupsDto` —
  this line is defensive symmetry with `mapPojo:140`; the asymmetry is exactly how this
  bug class survives review.)
- **Behaviour when the DTO is null:** skip the class-specific mapping; the class-specific
  response fields stay unset (omitted from JSON) — identical to the DEG-guard precedent
  and to what every other class's absence already looks like. FE renders empty cells
  (`TruncatedCell.tsx:85` `dataList?.map` — static-verified; live-verified by the flipped
  IT browser drive).
- **NOT touched:** `mapDataQualityTest` (`:362-383`, the data-quality list path — same
  defect class, third surface, unreproduced; follow-up below), `mapStats` (already safe),
  hydration code (`DataEntityServiceImpl`), FE code, openapi.yaml (response shape: the
  affected fields were already optional).

### Tests (G-C9, both buckets; failing-first)

- **Unit → odd-platform CI:** NEW `mapper/DataEntityMapperImplTest.java` (plain
  JUnit + Mockito mocks for the 11 collaborators — the first behavioural test of this
  mapper's class-branch logic). Cases:
  1. `mapPojo` × {TRANSFORMER, QUALITY_TEST, CONSUMER, INPUT} with the class id set and
     the details DTO null → **RED on main (NPE), GREEN on the fix** (entity maps; the
     class-specific lists stay null);
  2. `mapDtoDetails` × the same four + DEG-with-null-groupsDto (entities/hasChildren
     absent, `manuallyCreated` still set);
  3. populated-DTO locks per method (a transformer with source/target pojos still maps
     to refs — proves the guards didn't break the hydrated path).
  RED proof captured verbatim pre-fix; full CI replica `scripts/run-platform-tests.sh`
  (no-arg build) on the fixed tree.
- **Integration → odd-team, the pre-authored IT-068 flip (LSN-029 — never deleted):**
  - `search-class-tab-filter.spec.ts` test 2: pin (≥500 + no row) → **fixed contract**
    (results GET 200 + the transformer row renders), per the protocol's own §5 flip note.
    EXTEND the flipped test with the detail click-through: click the rendered transformer
    row → the detail page loads (the `mapDtoDetails` surface, user-facing — the second
    surface #1755 names). Seed shape unchanged (raw class-`{2}`, no `specific_attributes`
    — exactly the null-details shape). QT-class coverage delegated to the unit bucket
    (same guard, same branch shape; keeps the e2e fast).
  - Protocol `IT-068-*.md` re-grounded (§1/§4/§5 + frontmatter `regresses: [PLT-147]`
    kept as regression-lock provenance — CTRIB-008 precedent); suites.yaml comment lines
    (wave-2 "GREEN-now pins" list; **no lane moves** — IT-068 already lives in
    `feature-complete` + `ui-e2e`).
  - Inner loop: `run-suite.sh IT-068` on the working-tree SUT → GREEN.
  - RED proof: `ODD_SUT=ref:main run-suite.sh IT-068` with the flipped spec → RED for
    exactly the pinned reason (500 on pre-fix main).
  - **FULL regression (the gate, 2026-06-11/12 directive)** on the fix SUT, one suite at
    a time, actual counts read: `feature-complete` (green-target; contains the flipped
    IT-068) + `multi-stack` (green-target) + `known-bugs` (expected all-RED) +
    `ingestion-e2e` (green-target). Unit full build on the same tree.

### Docs (G-C10 + G-C11) — READ + decided: **no doc change**

- **READ this run, end-to-end:** `data-discovery/search.md` + `data-discovery/entity-detail-page.md`
  (both at the train ref `release/0.28.0` @ `f67851e`; main's copies differ only by the
  already-shipped 0.28.0 anchors). Neither page — and no other page (repo grep:
  SYS001/NPE/"Internal Server Error" → no operator-facing claim about this failure) —
  documents the 500-on-null-details behaviour. No claim is made false by the bug or the
  fix; the fix RESTORES the behaviour both pages already describe (results render;
  per-class panels show what was ingested).
- **Docs MAIN: no change** — a freshly-authored 0.27.x caveat would live ~10 days
  (0.28.0 due 2026-06-22), then need train reconciliation — churn without operator value;
  the failure is tracked publicly as #1755 with the milestone.
- **Train: no change** — post-fix the pages stay accurate as written; an "absent
  sub-projection renders empty lists" note would document an unremarkable empty state
  the pages already imply (entity-detail's per-class matrix describes panels rendering
  *what was ingested*; the silent-absence warning at :70 covers a different state —
  no-panel-at-all).
- `docs_routing: none`.

### Ontology refresh (G-C10)

- **No substrate sidecar maps to `DataEntityMapperImpl.java`** (verified — grep over
  `lineage/odd-platform/understanding/`: only sidecars *mentioning* the class; recorded
  explicitly, the CTRIB-008 precedent). The refresh is the feature/test layer + re-embed,
  all COMMITTED:
- `F-206.yaml`: bracket-note — PLT-147 FIXED; IT-073's DATA_SET-only raw-seed constraint
  lifted post-merge (widening IT-073 = follow-up TST item, not this PR).
- IT-068 protocol + spec (above); suites.yaml comments; today's run-log entries.
- `issues/odd-platform/PLT-147.md`: fix-shipped note + PR URL (status `filed` → `closed`
  at the human merge).
- `state/release-plan-2026-06.md` row 2 (PLT-147): SHIPPED note + PR number.
- NEW follow-up `issues/odd-platform/PLT-223.md` (draft): `mapDataQualityTest`
  (`DataEntityMapperImpl.java:362-383`) derefs `getDataQualityTestDetailsDto()` unguarded
  on the data-quality list path — same class, third surface, needs its own reproduction
  before filing.
- NEW follow-up `backlog/tests/TST-047.md` (small): widen IT-073's raw-seed corner to a
  second entity class once #1755's fix merges (the constraint PLT-147 imposed).
- Bookkeeping observed en route: **CTRIB-008 → `merged`** (PR #1777 = main `3f02dd63`);
  PLT-141 → `closed` (auto-closed by the merge; verify via API).
- Graph re-embed; workspace commits.

### Scope EXCLUSIONS (G-C5 — deliberately NOT touched)

- **NO `mapDataQualityTest` guard** (third surface, unreproduced — PLT-223 tracks it).
- **NO hydration-side change** (`DataEntityServiceImpl.enrichEntityClassDetails` —
  making hydration unconditional like DEG's is a larger ingestion-semantics decision;
  the mapper guard is the issue's prescribed, precedent-consistent fix).
- **NO FE changes** (FE is already null-tolerant).
- **NO openapi.yaml / contract changes** (fields were already optional).
- **NO IT-073 widening** (follow-up TST-047).
- **NO new caveat docs** (decision + why above).

### Scope/root-cause comment (posts to #1755 immediately after GATE 1 approval — ASCII, one comment)

> Re-reproduced and root-caused on a local stack built from current main (3f02dd63),
> ahead of the fix PR. All four failing surfaces captured live: a class-{2} entity with
> no transformer details 500s both GET /api/search/{id}/results (NPE at
> DataEntityMapperImpl.mapPojo:99) and GET /api/dataentities/{id} (mapDtoDetails:298);
> a class-{4} quality-test entity fails the same two surfaces (mapPojo:114,
> mapDtoDetails:314). The facet aggregator stays null-tolerant, so the search session
> simultaneously reports "Transformers | 1" over the errored list - the
> self-contradicting surface the issue describes.
>
> Root-cause detail worth recording: the platform has two authorities for "what classes
> does this entity have". Hydration (DataEntityServiceImpl.enrichEntityClassDetails)
> builds the per-class details DTOs by iterating the specific_attributes JSONB KEYS;
> the mapper branches on entity_class_ids. Whenever the two disagree (class id present,
> attributes block absent - partial ingestion, hollow entities, raw rows), the mapper
> derefs a null DTO. DATA_ENTITY_GROUP is the exception that proves the pattern: its
> hydration is unconditional AND its mapPojo branch still guards.
>
> The PR will carry: null-guards on the DATA_TRANSFORMER / DATA_QUALITY_TEST /
> DATA_CONSUMER / DATA_INPUT branches in both mapPojo and mapDtoDetails, mirroring the
> existing getGroupsDto() != null guard - one deviation from the issue's letter: the
> guard is ALSO added to mapDtoDetails' DATA_ENTITY_GROUP branch (the issue notes the
> DEG branch "does guard", which holds for mapPojo only; the details-side branch derefs
> groupsDto unguarded - unreachable-null on the current call path, guarded for symmetry).
> Plus: a new DataEntityMapperImpl unit test covering every guarded branch (fails on
> main with the exact NPEs above), and the pre-authored e2e characterization pin flipped
> to lock the fixed contract (the search results render the transformer row; clicking
> through to its detail page loads - both surfaces the issue names).
>
> Deliberately NOT in this PR: mapDataQualityTest (the data-quality list path) derefs
> the same details DTO unguarded - same defect class, third surface, not named by the
> issue and not yet reproduced; tracked for a separate issue so this fix stays bounded.
> The hydration-side asymmetry (making all class hydration unconditional like DEG's) is
> likewise out of scope. Closes #1755 via the mapper guards.

**POSTED 2026-06-12 (post-GATE-1, pre-code):**
https://github.com/opendatadiscovery/odd-platform/issues/1755#issuecomment-4695651669
(author `odd-contributor[bot]`, created 2026-06-12T21:37:47Z; body = the GATE-1-approved
draft verbatim; ASCII-verified in-band before post — 2395 chars, 0 non-ASCII).

## Test ledger (implement run, 2026-06-12/13)

- **Mid-run base note:** the maintainer shipped hotfix #1778 (badge reference, content-
  trivial) in parallel and fast-forwarded local main + the contrib branch base
  `3f02dd63` → `cc248bac` (reflog-verified). All fix-SUT evidence below is on
  `cc248bac` + the uncommitted fix; the reproduction (pre-fix) evidence was on
  `3f02dd63` — the mapper is byte-identical between the two bases (#1778 touches only
  the README badge).
- **Unit — failing-first (RED on the pre-fix tree, captured verbatim):**
  `scripts/run-platform-tests.sh --tests 'DataEntityMapperImplTest'` → BUILD FAILED,
  **12 tests completed, 9 failed** — every null-details case NPEd at its branch
  (mapPojo transformer/QT/consumer/input; mapDtoDetails transformer/QT/consumer/input
  + DEG-null-groupsDto); the 3 populated-path locks passed pre-fix (as designed —
  they lock, not pin). Checkstyle clean on the new test.
- **Unit — GREEN on the fix:** same targeted run → BUILD SUCCESSFUL (12/12). One
  checkstyle interlude: the two `DATA_QUALITY_TEST` guard lines were 121 chars —
  caught by the local gate's checkstyleMain, wrapped, re-run green (the gate working
  as built, PR #1743 class).
- **Unit — full CI replica on the fixed tree:** `scripts/run-platform-tests.sh`
  (no-arg `:odd-platform-api:build` = test + checkstyle + assemble) →
  **BUILD SUCCESSFUL in 5m 35s**.
- **Integration — the flipped IT-068, GREEN on the fix SUT** (image `52e2db04…` built
  from the working tree @ cc248bac+uncommitted): **2/2 passed (6.5s)** — F-148
  happy-path + the re-grounded regression lock (results GET 200, the transformer row
  renders, row click-through → entity-detail GET 200, the detail page renders the
  name). Run-log 2026-06-12 (third entry).
- **Integration — RED proof on pre-fix main** (`ODD_SUT=ref:main`, throwaway image
  `ad1c1690…` from main @ cc248bac without the fix): **1 failed / 1 passed** — the
  regression lock failed for EXACTLY the pinned reason (`Expected: 200 / Received:
  500` on the results GET, spec :159); the happy-path test passed. First attempt died
  on the known gradle GC-thrash transient (CTRIB-005..008 class, not a test failure;
  logged), retried clean.
- **Integration — FULL regression (the gate, 2026-06-11/12 directive) on the fix SUT
  (image built fresh from the working tree per suite), one suite at a time, actual
  counts read:**
  - `feature-complete`: **279 passed / 0 failed (3.9m)** — baseline held exactly; the
    flipped IT-068 regression lock GREEN in-suite; api-probe rail PASS.
  - `multi-stack`: **9 passed / 0 failed (3.1m)**.
  - `known-bugs`: **5 failed / 0 passed — EXPECTED all-RED**, every failure its
    documented pin (IT-007 LSN-001/PLT-086 · IT-006 TEST-GAP-1013 · IT-004 PLT-052 ·
    IT-003×2 PLT-090/PLT-127); zero unexpected GREENs (no un-flipped fixes).
  - `ingestion-e2e`: **6 passed / 0 failed (56.0s)**.
- **Post-fix drive (LSN-031 / reproduce-first step 5) — the reproduction re-run, now
  correct:** on the fix-SUT stack (recreated fresh en route — fixtures re-seeded
  incl. data_source 2001), the SAME four surfaces that 500d pre-fix: transformer
  search results **200** (row maps: classes `[DATA_TRANSFORMER]`, `source_list`/
  `target_list` absent), quality-test search results **200** (`linked_url_list`/
  `datasets_list` absent), transformer detail **200**, quality-test detail **200**
  (`expectation`/`suite_name` absent). Container log: **0** `NullPointerException`.
  Seeds + the temp data_source deleted (count 0); empty-query results 200 — no
  residue.

## Docs ledger (G-C10 + G-C11) — READ + decided: NO change (routed: none)

- **READ end-to-end this run:** `documentation/docs/data-discovery/search.md` (the full
  page incl. the Known-limitations section) + `data-discovery/entity-detail-page.md`
  (the full page incl. the per-class panel matrix + the silent-absence warnings) — both
  at the train ref `release/0.28.0` (`f67851e` head at read time). Neither page — nor
  any other (repo grep for the failure surface) — documents the 500-on-null-details
  behaviour; no claim is made false by the bug or the fix.
- **Docs MAIN: no change** (a fresh 0.27.x caveat would live ~10 days until 0.28.0, then
  need train reconciliation — churn without operator value; #1755 is the public record).
- **Train: no change** (the fix restores the behaviour the pages already describe; an
  "absent sub-projection renders empty" note would document an unremarkable empty state).
- No paired DOC item needed (nothing rides the train for this fix).

## Ontology refresh (G-C10) — committed, not narrated

- **No substrate sidecar maps to `DataEntityMapperImpl.java`** (verified via
  `understanding/` grep — only sidecars *mentioning* the class; `/enrich --touched` has
  no sidecar target — recorded explicitly, the CTRIB-008 precedent).
- `F-206.yaml` UC-7 `test_ref`: the PLT-147 raw-seed blocker bracket-noted LIFTED →
  TST-047 tracks the IT-073 widening.
- IT-068: spec re-grounded (pin → fixed-contract regression lock + the detail
  click-through), protocol re-grounded (§1/§2/§4/§5 + cross-refs; frontmatter
  `regresses: [PLT-147]` kept as regression-lock provenance), suites.yaml wave-2
  comment updated (PLT-147 moved to the FLIPPED list; **no lane moves** — IT-068
  already in `feature-complete`+`ui-e2e`).
- IT-073: protocol KNOWN-BUG box + spec header bracket-annotated (constraint lifted;
  TST-047).
- `issues/odd-platform/PLT-147.md` fix-shipped note (+PR #1779; flips `closed` at the
  human merge); NEW `issues/odd-platform/PLT-223.md` (mapDataQualityTest same-class
  risk, draft, needs-repro); NEW `backlog/tests/TST-047.md` (IT-073 widening);
  `state/release-plan-2026-06.md` row 2 SHIPPED (+#1779).
- Bookkeeping observed en route: **CTRIB-008 → `merged`** (PR #1777 = main `cc248bac`'s
  parent `3f02dd63`, merged-true + #1759-closed verified via API); `PLT-141.md` →
  `closed`; release-plan row 6 → MERGED.
- Graph re-embedded (counts in the workspace commit body).

## Branch / PR

- Branch `contrib/CTRIB-009-mapper-null-details-guard` pushed to
  `opendatadiscovery/odd-platform` (1 commit `1653a909`, author + committer
  `odd-contributor[bot]`; base `main` @ `cc248bac`). Diff = exactly the approved plan:
  2 files, +251/−13 (`DataEntityMapperImpl.java` guards +
  `DataEntityMapperImplTest.java`).
- **Draft PR #1779** — https://github.com/opendatadiscovery/odd-platform/pull/1779
  (`draft: true`, `Closes #1755`, `Milestone: 0.28.0` line — the issue's milestone
  re-verified open/unchanged via the API at push time (G-C11); docs note
  `Docs: none — no documentation page describes the failure`; review requested from
  RamanDamayeu, HTTP 201; the bot cannot merge — GATE 2 is the human's).

## Definition of Done (LSN-032 four gates) — implement-side

1. **Unit (full build on the fixed tree):** ✅ BUILD SUCCESSFUL 5m35s (test + checkstyle
   + assemble) + failing-first RED→GREEN (12 run / 9 NPE-failed on main → 12/12 green).
2. **Integration (FULL regression on the fix SUT):** ✅ feature-complete 279/0 +
   multi-stack 9/0 + known-bugs 5/5-still-RED (zero unexpected GREENs) + ingestion-e2e
   6/0; flipped IT-068 GREEN-on-fix + RED-on-ref:main (Expected 200 / Received 500);
   post-fix drive: all four pre-fix-500 surfaces now 200, 0 NPE in the container log.
3. **Docs:** ✅ READ (both pages end-to-end) + decided `none` + routed `none` — the why
   recorded above; nothing rides the train.
4. **Ontology:** ✅ flows + protocols + suites + issues + release-plan updated; no
   sidecar target (recorded); graph re-embedded; committed.

## Outcome

Draft PR #1779 open (GATE 2 pending) · `/review` in a separate session is the next
step · PLT-223 + TST-047 logged · PLT-147 flips `closed` when the human merges (#1755
auto-closes) · CTRIB-008/PLT-141 merge bookkeeping folded in en route.

## Review (2026-06-13, session: separate from the implementing session — post-cce4044)

- **Result**: **ACCEPTED** — `pr-draft` → `review-ready`. GATE 2 (human review + merge of
  draft PR #1779) is the remaining step.
- **PR head unmoved**: branch + PR head = `1653a909` = exactly the commit this review ran
  on (git fetch + PR API at review time); base `main` @ `cc248bac` = origin/main head.
- **Re-verification protocol**: every load-bearing claim re-derived from branch source /
  live GitHub API / the reviewer's own unit build + failing-first RED replication +
  four-suite regression on PR-head SUTs / docs-repo git + tree greps / disk reads — not
  from this record.

### Definition of Done (LSN-032 four gates) — re-verified

1. **Unit (full build on the PR head)** — PASS. Reviewer's own
   `scripts/run-platform-tests.sh` (no-arg = test + checkstyle + assemble) on the clean
   tree @ `1653a909` → **BUILD SUCCESSFUL in 5m 11s**; `DataEntityMapperImplTest`
   **12/12** in-run (test XML read). Independently: CI on the exact head — all 6 check
   runs SUCCESS (`run_tests` + `Test Results` 22:21–22:22Z). **Failing-first REPLICATED
   by the reviewer**: throwaway worktree @ `cc248bac` (pre-fix mapper, 0 guards) + the
   committed test file → **12 tests / 9 failed**, every null-injection case NPE'd at its
   branch (XML verdict: the exact 9 null cases failed, the exact 3 populated locks
   passed) — byte-identical to the implement ledger's claim. BUILD FAILED 1m35s as
   expected; worktree removed.
2. **Integration (FULL regression, reviewer's own runs, SUT built fresh per suite from
   the clean tree @ `1653a909`)** — PASS. One suite at a time, actual counts read:
   `feature-complete` **279 passed / 0 failed (3.9m)** (image `0cf73aad…`; IT-068 both
   tests GREEN in-suite — the F-148 happy path 2.1s + the flipped PLT-147 regression
   lock 2.1s: results GET 200, row renders, detail click-through 200; api-probe rail
   P-001 PASS). `multi-stack` **9/0 (3.3m)** (`8526cc43…`). `known-bugs` **5 failed /
   0 passed — EXPECTED all-RED** (`d77bbd9d…`): every failure its documented pin (IT-007
   LSN-001/PLT-086 · IT-006 TEST-GAP-1013 · IT-004 PLT-052 · IT-003×2 PLT-090/PLT-127),
   ZERO unexpected GREENs. `ingestion-e2e` **6/0 (1.0m)** (`6cc6e88b…`). Platform
   container log under suite load: **0** `NullPointerException`. Counts identical to the
   implement run — now measured on the COMMITTED head (the implement integration evidence
   was on `cc248bac`+uncommitted; this closes that gap, CTRIB-004 precedent). RED half:
   the implement run-log carries the `ODD_SUT=ref:main` proof (1 failed / 1 passed —
   `Expected: 200 / Received: 500` at spec `:159`, exactly the pinned reason; the
   GC-thrash transient honestly logged + retried clean), and the reviewer's own unit RED
   replication independently re-proves the NPE mechanism.
3. **Docs** — PASS (routed: `none`, verified). Both pages read END-TO-END by the reviewer
   at the train ref (`release/0.28.0` @ `f67851ed`; main @ `188eb8e1`): no claim made
   false by bug or fix — the per-class panel matrix describes panels rendering what was
   ingested (a null-details entity now renders empty class fields = the documented DEG
   precedent), and `entity-detail-page.md`'s silent-absence warning covers a different
   state (no-panel-at-all: empty/unrecognised class array or run-classes). Repo-wide
   train-tree grep `SYS001|NullPointerException|Internal Server Error`: 4 hits, ALL other
   failures (Azure logout-uri NPE ×2, lineage_depth NPE ×2 pages, GenAI timeout) — no
   page documents THIS failure, so there is no published claim to retire (the
   CTRIB-007/008 contrast, where train edits retired existing caveats). Doc log since
   2026-06-12: zero CTRIB-009 commits on main or train — `docs_routing: none` true on the
   remote. The train-vs-main diff on both pages = pre-existing 0.28.0 content (view-count,
   search-expiry — other items' fingerprints, not this one's).
4. **Ontology** — PASS, verified on disk. F-206 UC-7 `test_ref` bracket-note LIFTED +
   TST-047 pointer (history preserved); IT-068 protocol + spec re-grounded with flip
   provenance (frontmatter `regresses: [PLT-147]` retained as regression-lock provenance);
   IT-073 spec + protocol bracket-annotated (constraint lifted, original rationale kept);
   suites.yaml wave-2 FLIPPED-list comment updated, **no lane moves** (IT-068 confirmed
   in the `feature-complete` + `ui-e2e` member lists); PLT-147 `fix_note` (+#1779, status
   stays `filed` until the human merge); NEW PLT-223 (draft, needs-repro) + NEW TST-047
   (pending) both dedup-verified; release-plan row 2 SHIPPED; CTRIB-008 `merged` +
   PLT-141 `closed` verified against origin/main (`3f02dd63` = merged #1777); **no
   substrate sidecar maps to the mapper** (understanding/ grep re-run — recorded, not
   skipped); P-001 probe merge-backs are append-only `probe_verifications` entries; graph
   build-info `nodes=7083 / edges=9180 / vectors=8014` @ 2026-06-13 — exactly as the
   commit body claims.

### Contributor gates

- **G-C1 reproduce-first** — PASS. Run-log `2026-06-12-IT-068.md` entry 1 = the pre-fix
  rail reproduction (2/2 pin-GREEN on the clean-main SUT, image `def06b3d…`) + the manual
  four-surface captures (transformer + quality-test × search-results + detail, NPE frames
  log-localized to `mapPojo:99/:114` + `mapDtoDetails:298/:314`); seeds cleaned, residue
  checked. The reviewer's RED replication re-proves the NPE mechanism empirically.
- **G-C2 running system, not the diff** — PASS via DoD 1+2: all reviewer-own runs on the
  committed PR head.
- **G-C3 GATE 1 plan-before-code** — PASS. `plan_approved_by: RamanDamayeu (2026-06-12,
  'Approve as written')`; verifiable ordering: scope comment 21:37:47Z → fix commit
  authored 22:14:58Z (2026-06-13T00:14:58+02:00). The maintainer's invocation of this
  review corroborates.
- **G-C4 GATE 2 human merge** — PASS (structural). PR #1779 fetched live: author
  `odd-contributor[bot]`, base `main`, head `1653a909`, **`draft: true`** (the bot never
  left draft), `mergeable_state: clean`, review requested from RamanDamayeu.
- **G-C5 bounded diff + public scope comment** — PASS. Diff = exactly the approved plan:
  2 files +251/−13 (`mapPojo` 4 guards; `mapDtoDetails` 4 guards + the DEG inner guard
  with `setManuallyCreated` kept unconditional; 2 constraint-stating comments; the new
  test). Every exclusion verified absent: `mapDataQualityTest` untouched (still derefs
  at `:372+` post-fix numbering), `DataEntityServiceImpl` / FE / openapi.yaml untouched
  (2-file diffstat). Scope comment PUBLIC on #1755 (4695651669, bot-authored,
  **pre-code**, 2395 chars / 0 non-ASCII via raw API) naming the one deviation from the
  issue's letter (the symmetric DEG-details guard) AND the deferred third surface.
- **G-C6 one-question bar** — PASS. "No question warranted" recorded with reason
  (maintainer-authored issue, verified line numbers, deterministic repro, pre-authored
  flip); issue #1755 has EXACTLY 1 comment (the scope comment) — zero clarify noise.
- **G-C7 blast-radius** — PASS. `adr_required: false` sound: no migration, no
  auth/security-posture change, no public-contract break — the affected response fields
  were already optional (absent-field rendering = the existing DEG precedent); a
  defensive guard inside one mapper.
- **G-C8 issue-is-data** — PASS. Maintainer-authored issue treated as quoted data; every
  claim re-verified against main; the one beyond-issue finding (the `mapDtoDetails` DEG
  branch was ALSO unguarded — the issue's "DEG does guard" holds for `mapPojo` only)
  handled transparently and named publicly in the scope comment. No injection content.
- **G-C9 test integrity, BOTH buckets** — PASS. Unit: REAL behavioural Mockito test
  (first of this mapper's class-branch logic — verified against the `cc248bac` test tree:
  only `DataEntityStatusKnownBugTest` existed, a different method); 9 null-injection
  cases with the failing condition injected explicitly (`entityClassIds` set, details DTO
  null) + 3 populated-path locks; RED→GREEN proven by the reviewer's own runs on BOTH
  sides. Correctly homed in the unit bucket (pure Mockito, no boundary). Integration: the
  LSN-029 pin RE-GROUNDED per its own pre-authored flip note (never deleted) + EXTENDED
  with the user-facing detail click-through (the second #1755 surface — LSN-031);
  GREEN-on-fix in-suite (reviewer's run) + RED-on-`ref:main` (implement run-log).
- **G-C10 ontology + docs move with the code** — PASS (DoD 3+4).
- **G-C11 milestone gate** — PASS. Issue #1755 milestone `0.28.0` OPEN (due 2026-06-22)
  re-verified via issue API at review time; PR body carries `Closes #1755` +
  `Milestone: 0.28.0` + the docs-none note; `docs_routing: none` — correctly nothing
  rides the train; no paired DOC item needed.

### Universal Quality Bar gates

- **Gate 1 (no duplicates)** — PASS. PLT-223 is the SOLE tracker of the
  `mapDataQualityTest` deref (PLT-178's mention is the pagination defect — different
  class); TST-047 disjoint from TST-026 (raw-seed e2e widening vs palette-lockstep unit
  guard); the unit test is first coverage of the surface (grep-verified pre-fix tree).
- **Gate 2 (aliases)** — N/A. No new doc concept/alias.
- **Gate 3 (caveats)** — PASS/N-A. No doc change; the fix's empty-state is the
  already-documented composition behaviour; no new caveat owed (verified by the
  end-to-end page reads + the train-tree grep).
- **Gate 4 (consumer-read)** — PASS. `Consumer-read:` + `Sources:` footers on workspace
  commit `cce4044`; key consumers re-walked this review: `enrichEntityClassDetails`
  iterates `specific_attributes` keys (`DataEntityServiceImpl.java:546`) with DEG
  hydrated unconditionally (`:593-601`); `mapDtoDetails` single production caller
  (`:208`, full-repo grep); `TruncatedCell.tsx:85` `dataList?.map` (FE null-tolerance).
- **Gate 5 (unset-parameter)** — N/A (no SDK builder in scope).
- **Gate 6 (bidirectional code↔doc)** — PASS. Code→doc: the behaviour change restores
  the documented behaviour (no-doc-change decision verified independently); doc→code:
  both pages' claims checked against the fix — nothing falsified either direction.
- **Gate 7 (layout/completeness)** — PASS. No doc-tree change (no SUMMARY/TOC impact);
  workspace artefacts in canonical homes; suites.yaml membership verified, no lane moves.
- **Gate 8 (publishing/live)** — PASS. All public surfaces fetched live this review
  (PR #1779, issue #1755 + comment via raw API, check-runs on the head); no docs URL
  affected — nothing to verify on the live manual; the unmerged draft PR is the EXPECTED
  GATE-2-pending end state per the contributor lifecycle (not a DEFERRED).
- **Gate 9 (claim provenance)** — PASS. Every load-bearing record claim re-derived: diff
  vs plan via git; GitHub state via 4 live API fetches; unit via the reviewer's own build
  + test XML; failing-first via the reviewer's own RED replication; integration via the
  reviewer's own four suite runs; docs via `git show` + tree greps at both refs; ontology
  via disk reads; en-route bookkeeping via origin/main log. Outbound URL sweep: the
  record's URLs (PR / issue / comment) all fetched live, 0 broken. Banned-phrase check
  over this review: none used.
- **Gate 10 (content-type homing)** — PASS. Work record in `contributor/`, issue drafts
  in `issues/odd-platform/`, the test item in `backlog/tests/`, protocol truth in
  `protocols/`, run evidence in `run-log/` — per canonical-homes.
- **Gate 11 (audience isolation)** — PASS. No published doc page touched (the mechanical
  grep has no scope); public GitHub artifacts re-read — operator/contributor language;
  the upstream test javadoc's `odd-platform#1755 (PLT-147)` cross-ref is the established
  provenance convention (CTRIB-008 precedent).

### Verdict bookkeeping

- **Regressions**: none — measured, not inferred: reviewer's own full unit build
  (5m11s) + CI 6/6 on the head + feature-complete 279/0 + multi-stack 9/0 + known-bugs
  5/5-still-RED + ingestion-e2e 6/0, all on SUTs built fresh from the clean tree @
  `1653a909`; 0 NPE under load.
- **Navigation**: consistent — zero `DataEntityMapperImpl` pointers existed; nothing
  stale.
- **Upstream issues logged**: none new this review (PLT-223 + TST-047 were logged by the
  implement session; both dedup-verified here).
- **Doc-product editorial findings** (audit per
  `playbooks/doc-product-editorial-read.md`):
  - **Coverage this run**: focused pass per CTRIB-004..008 precedent (full-tree sweep
    was 2026-06-08): both affected pages end-to-end at the train ref + the
    failure-surface claim-class grep over the whole train tree (4 hits classified — all
    other failures) + the train-vs-main diff on both pages (pre-existing 0.28.0 content).
  - **Findings**: none surfaced this run — both pages cohere post-fix.
- **Minor notes (non-blocking)**: the implement session's integration evidence was
  gathered on the working tree (`cc248bac`+uncommitted) before the commit existed; the
  reviewer's four suite runs on the committed `1653a909` close that gap (mapper
  byte-identical — same class as CTRIB-004's review-side closure). VERIFIED via the
  reviewer's own runs above.
- **Reviewer-committed artefacts**: 4 attributed run-log entries (feature-complete /
  multi-stack / known-bugs / ingestion-e2e on `1653a909`), the P-001 harness re-stamps
  (probe-run yaml + 2 sidecar appendices + feature-flows pointer), this verdict + the
  status flip + the PROGRESS update.
