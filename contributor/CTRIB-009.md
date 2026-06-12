---
id: CTRIB-009
github_issue_number: 1755
github_issue_url: https://github.com/opendatadiscovery/odd-platform/issues/1755
class: bug
milestone: "0.28.0"
status: pr-draft  # implement complete 2026-06-13: DoD all four gates green (ledger below); draft PR #1779 open; /review (separate session) then GATE 2 (human merge) remain
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
