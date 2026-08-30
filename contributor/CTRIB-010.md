---
id: CTRIB-010
github_issue_number: 1657
github_issue_url: https://github.com/opendatadiscovery/odd-platform/issues/1657
class: bug
milestone: "0.28.0"
status: done   # MERGED 2026-06-13 — PR #1780 squash-merged to odd-platform main as 697a3b39 ("fix(activity): make the Activity feed's User vs Owner distinction explicit (#1657) (#1780)"); GATE 2 done; #1657 auto-closed. Prior: REVIEWED -> ACCEPTED (all 14 acceptance criteria + all Quality Bar gates PASS; reviewer's OWN FULL regression GREEN — unit 5m49s + feature-complete 285/0 incl IT-129 6/6 + multi-stack 9/0 + known-bugs 5-RED-expected + ingestion-e2e 6/0). Doc branches PUSHED (da44e59 main correction + 1bb425a PLT-224 caveat — PRs open for merge). Train docs + DOC-451/452 ride the 0.28.0 release gate. | LEDGER-RECONCILED 2026-08-30: was `merged`; PR #1780 (`697a3b39`) is in the released `0.28.0` tag (published 2026-06-17). GATE 2 is done; `/review release:0.28.0` owns the flip to `done`. | RELEASE-GATE 0.28.0 (2026-08-30): fix confirmed inside the released `0.28.0` tag; the paired doc item(s) live-verified on docs.opendatadiscovery.org; full unit+IT suite and real-instance checks satisfied by the 0.29.0 release record (superseding published artifact ghcr digest a2e0c86d, unit BUILD SUCCESSFUL @ f12b8fbc, feature-complete 317/1, known-bugs 3-expected-RED).
reproduced: "live 2026-06-13 on the PRE-FIX SUT (odd-platform:odd-team-sut, image sha256:6cc6e88b…, built from the clean tree @ 1653a909 — tree byte-identical to main @ 05ecf0a9, verified `git diff --stat` empty; odd-minimal stack). Seeds: owners alpha(id 1)/beta(id 2); mapping alice→alpha ACTIVE; activities by alice (entity 20950), bob (20950, NO mapping), dave (20951, no mapping). (1) Wire: GET /api/activity?…&user_ids=1 → alice's row; user_ids=2 → 0 rows; NO value selects bob (defect 1 — unmapped actor unfilterable). (2) REMAP (alice mapping deleted_at=NOW(), dave→alpha inserted): the IDENTICAL user_ids=1 query → DAVE's row, alice's history unreachable (defect 2 — filter follows the mutable mapping, not the recorded actor); counts user_ids=1 total 1→1 but the counted USER changed. (3) GET /api/activity/users → 404 (no enumeration endpoint). (4) Per-entity surface: GET /api/dataentities/20950/activity?user_ids=1 post-remap → 0 rows (alice authored there). (5) UI drive (Playwright scratch, screenshots captured): the User filter dropdown is fed by GET /api/owners?query=… and listed [repro1657_owner_alpha, repro1657_owner_beta] — alice/bob/dave NOT listable; selecting 'repro1657_owner_alpha' sent user_ids=1 and rendered dave's entity_two row under the alpha chip. Seeds + scratch spec deleted post-capture (residue query = 0; /api/activity 200)."
adr_required: true  # TWO ADRs (G-C7): adrs/drafts/activity-actor-filter-audit-identity.md (3 explicit actor axes; PURELY ADDITIVE — user_ids NO LONGER deprecated) + ADR-0076 (info-(i) affordance — REVERSE-ENGINEERED from the EXISTING InformationIcon-in-AppTooltip pattern after round-2 dropped the duplicate popover; renamed …-tooltip-affordance.md)
contract_variant: "v2 — PURELY ADDITIVE (usernames added; user_ids KEPT as a legitimate axis, renamed in UI; no deprecation, no break). Supersedes v1 Variant A."
plan_approved_by: "v1: RamanDamayeu (GATE 1, 2026-06-13). v2: RamanDamayeu (GATE 1, 2026-06-13 — 'Approve as written' via AskUserQuestion; labels chosen: Owner / Made by (owner) / Made by (user))."
plan_approved_at: "v1 2026-06-13; v2 2026-06-13"
v2_labels: "asset-owner filter = 'Owner' (ownerIds); actor's-current-owner = 'Made by (owner)' (user_ids); external username = 'Made by (user)' (usernames). Action row: username + 'current owner: B' (the as-of-now owner, explicitly labelled; raw usernames in the Made by (user) dropdown). Refined per review 2026-06-13."
docs_routing: "release/0.28.0 train (3-axis filters + dual-name rows rewrite; supersedes the v1 train commit be702da) + docs main released-truth correction (da44e59, the 'entity-ownership axis' error) + a published ADR-log entry for ADR-0076 (info-(i) tooltip affordance, reverse-engineered; maintainer: publish now)"
pr_url: "https://github.com/opendatadiscovery/odd-platform/pull/1780"
pr_draft: false  # merged 2026-06-13 (squash 697a3b39 on odd-platform main)
---

# CTRIB-010 — Activity "User" filter keys on mutable owner mapping instead of the audit actor (#1657)

Issue #1657 ("Filter on Activities doesn't work properly for Users"), author RamanDamayeu
(the maintainer), label `kind: bug`, milestone **0.28.0** (open, due 2026-06-22, semver title —
**G-C11 PASS**, verified via issue API at intake 2026-06-13), assignee Vladysl, 1 comment
(links the 2024 draft PR #1658). Issue body treated as quoted data (G-C8); every load-bearing
claim independently re-verified against odd-platform main @ `05ecf0a9` and the running system.

## Intake — the issue's claims (quoted data)

The Activity tab (global page + per-entity) offers a filter "to find records by user name",
but it "looks for Owners and filters out records changed by the associated Owners", causing:
(1) users without an Owner association cannot be filtered at all; (2) if the User–Owner
association changes over time the filter "mistakenly filters records for wrong users".
Proposed solution (the issue's letter): "use values from the audit table for Users directly".
The issue links `ActivityEventTypeDto.java` as the tracked-event list.

**Prior art:** draft PR #1658 (Vladysl, 2024-04-17, still open/draft, head `e23bb887ea`) — BE-only
blueprint: replaced `user_ids:int64[]` with `usernames:string[]` on the three endpoints, added
`GET /api/activity/users` (paginated DISTINCT `created_by` + current-owner left-join), switched the
condition to `ACTIVITY.CREATED_BY.in(usernames)`. Its own body lists the FE half as not done. It
predates the PLT-176 EXISTS-semi-join refactor (its diff edits a `buildBaseQuery(datasourceId,
namespaceId, tagIds, ownerIds)` signature that no longer exists) → cannot be rebased mechanically;
this run re-derives the change on current main and credits #1658 as design precedent. Two latent
defects in the prior art not to copy: `components.yaml` `ActivityUser.required: [name]` names a
non-existent property; `ActivityUser.owner_id` is not renderable without a second lookup.

## Claim verification (issue is data — re-verified on main @ 05ecf0a9)

1. **Filter mechanism CONFIRMED** — `ReactiveActivityRepositoryImpl.getCommonConditions:274-277`:
   `userIds` ⇒ `USER_OWNER_MAPPING.OWNER_ID.in(userIds)` + `DELETED_AT.isNull()`, over the base-query
   join `USER_OWNER_MAPPING.OIDC_USERNAME = ACTIVITY.CREATED_BY AND deleted_at IS NULL`
   (`buildBaseQuery:219-222`, count queries `:156-158/:177-179/:198-200`). The filter is an ACTOR
   axis keyed by the actor's CURRENT owner binding — both issue defects follow mechanically.
2. **Defect 1 CONFIRMED (live)** — an actor with no `user_owner_mapping` row can never match
   (LEFT JOIN null): no `user_ids` value selects bob's rows (reproduction step 1).
3. **Defect 2 CONFIRMED (live)** — re-binding owner alpha from alice to dave flips the IDENTICAL
   query's result from alice's history to dave's (reproduction step 2).
4. **Dropdown source CONFIRMED** — the FE "User" filter lists OWNERS: `MultipleFilterAutocomplete.tsx:44-47`
   dispatches `fetchOwnersList` for every non-tag filter; UI drive captured
   `GET /api/owners?query=repro1657…` feeding the dropdown.
5. **Wire contract CONFIRMED** — `openapi.yaml` declares `user_ids:int64[]` on `/api/activity`
   (:3248), `/api/activity/counts` (:3328), `/api/dataentities/{id}/activity` (:1406). The FE
   generated client is NOT checked in (built from the spec at build time) — the spec is the single
   contract source for both sides.
6. **Display already actor-aware** — rows render `createdBy.owner?.name || createdBy.identity.username`
   (`ActivityItem.tsx:77`); `Activity.created_by` is an `AssociatedOwner` built from
   `ACTIVITY.CREATED_BY` + the current-mapping owner (`ActivityMapper.mapUser:307-311`). Only the
   FILTER ignores the recorded actor.
7. **Schema CONFIRMED** — `activity.created_by varchar(512)` nullable (`V0_0_48`); mapping uniqueness
   is `(oidc_username, provider) WHERE deleted_at IS NULL` + one ACTIVE mapping per owner
   (`V0_0_89`) — so the join key is per-actor-current, and a same-username-two-providers row can
   even fan out the current join (out of scope; F-021 facet `provider_agnostic_actor_resolution…`).
8. **Existing test surfaces CONFIRMED** —
   `ActivityActorFilterKnownBugTest` (odd-platform, structural @pins LSN-020) asserts the buggy
   binding string EXISTS; its own flip protocol pre-authorizes: on fix, confirm actor binding,
   delete the pin, close the finding. `AdrActivityContractScanTest` enforces ADR-0021/0022 and
   greps the WHOLE controller file for `doesNotContain("Integer page")` — the new enumeration
   endpoint (legitimately offset-paginated, like every non-feed list endpoint per ADR-0021's own
   text) requires precision-scoping that assertion to the feed methods.
   `ReactiveActivityRepositoryFanOutTest` (BaseIntegrationTest) + `ActivityServiceImplTest`
   (Mockito) call the to-be-widened signatures — mechanical updates. IT-088 (F-021 global feed),
   IT-089 (F-196 entity tab), IT-126 (PLT-176 fan-out lock) cover adjacent facets; none covers the
   User filter.
9. **Release-plan tension CONFIRMED** — `state/release-plan-2026-06.md` hard rule: "no API contract
   breaks … deferred to a deliberately release-noted train"; #1657 is NOT in the 15+5 slate; its
   prescribed fix (replace `user_ids`) is a contract break. Resolved via the G-C7 ADR at GATE 1.
   Note: a query-param REMOVAL is a SILENT break (Spring ignores unknown params → old scripts get
   unfiltered results, not errors) — named in the ADR.

## Scope analysis

- **Class: bug** (user-facing; both global + per-entity surfaces; compliance-grade wrongness — an
  auditor filtering "what did this user do" gets another user's records after a re-association).
  Features: **F-021** (Activity Feed global page — carries the LSN-020/H-001 finding + the UI-tier
  "User filter label misleads compliance" drift facet) and **F-196** (per-entity Activity tab).
  Mission relevance: the Activity Feed is the catalog's audit trail (system-mission audit pillar);
  an audit filter that re-attributes history under mapping churn defeats its purpose.
- **Architectural significance (G-C7): FIRES** — the issue's letter prescribes a breaking
  wire-contract change (param replacement on 3 endpoints). ADR drafted:
  `adrs/drafts/activity-actor-filter-audit-identity.md`. Decision (additive-deprecate vs replace)
  + this plan are jointly the GATE 1 sign-off. No migration, no auth-posture change either way.
- **Clarify (G-C6): no public question warranted** — maintainer-authored issue with explicit
  mechanism prescription + prior art; the one implementation-changing fork (contract shape under
  the maintainer's own release-plan rule) is a GATE 1 in-band decision, not a public thread
  question. Recorded here.
- **Consumers of the changed artifacts:** `ActivityController` + `DataEntityController` (the only
  controller callers); `ActivityServiceImpl` → `ReactiveActivityRepositoryImpl` (sole impl);
  FE: `Filters.tsx` ×2, `MultipleFilter*` ×3, `common.ts`, `activity.thunks.ts`, `lib/api`
  (generated client regenerates from the spec at build).

## Root cause (verified on source + the running system)

The platform records the audit actor immutably (`activity.created_by` = the authenticated
principal's username at write time) and already DISPLAYS it, but the FILTER resolves the actor
through `user_owner_mapping` — a MUTABLE, present-time association table whose rows are
soft-deleted and re-created as people join/leave/move teams. Filtering an immutable audit log
through a mutable identity mapping cannot be correct: actors without a mapping are invisible to
the filter (defect 1), and every re-association silently re-attributes the entire history
(defect 2). The fix class: audit-surface filters must key on the identity recorded ON the audit
row (the username), with the mapping used only for display enrichment — exactly what the issue
prescribes and what the display path already does.

## Reproduction (Phase B — CAPTURED, G-C1)

Full capture in the `reproduced:` frontmatter. Headline: all four defect surfaces driven live on
the pre-fix SUT — unmapped-actor unfilterable (wire), remap re-attribution on the identical query
(wire, global + per-entity), no enumeration endpoint (404), and the rendered UI dropdown listing
owners instead of audit actors then displaying the wrong user's history under the selected name
(Playwright drive). Seeds cleaned; stack verified non-poisoned.

## REVISED PLAN v2 (maintainer reframe 2026-06-13) — GATE 1 re-approval pending

**The reframe.** #1657's true defect is the **User vs Owner terminology confusion** on the Activity feed
(memory `reference_odd_user_vs_owner_actor_model`), not "the filter uses owner_ids". ODD has an external
**User** identity (immutable, `activity.created_by`) and an internal **Owner** concept reached via a
**mutable** `user_owner_mapping` association; the feed conflates three different axes under two ambiguous
labels and shows only the actor's *current* owner name on each row. The v1 fix (replace the User filter's
binding with `usernames`) was too shallow — it hid the conceptual problem instead of making it clear.
**Goal: make the Activity feed crystal clear.** Same branch, same issue.

### Three deliverables

**1. NEW reusable platform info `(i)` popover affordance** (its own ADR —
`adrs/drafts/platform-info-popover-affordance.md`; G-C7). A shared MUI-`Popover`-based `(i)` button that
opens rich, i18n help (title + explanation + optional links) inline next to any label. Built IN this
ticket (maintainer: do not defer to 0.28.0; the activity clarity work needs it). First consumer: the
three activity filters + the action-row actor names. Component-agnostic; future surfaces reuse it.

**2. Three explicit Activity filters** (was two ambiguous ones), each with an `(i)` popover:
- **Owner (of the asset)** — KEEP binding (`ownerIds` -> `OWNERSHIP.OWNER_ID`); label/help clarify
  "owner of the data entity where the change happened".
- **The actor's current owner** — KEEP binding (`user_ids` -> `USER_OWNER_MAPPING.OWNER_ID`, the v1-era
  filter); **RENAME** the label (proposal: "Owner of editor" / "Made by (owner)" — maintainer's call) +
  help clarify it is the *current, mutable* owner associated with whoever made the change. **`user_ids`
  is NOT deprecated** (revert the v1 spec deprecation) — it is a legitimate axis.
- **User (external username)** — NEW; `usernames` -> `ACTIVITY.CREATED_BY` (REUSE v1's BE work); immutable;
  fed by `GET /api/activity/users` (v1 endpoint); works for users with no owner association. Proposal:
  label "User" / "Username".

**3. Action row shows BOTH actor names** — the immutable external **username** (`created_by`) AND the
**current associated owner name** (e.g. "A (as Owner B)"); no association → just the username. Makes
filter values == row values: User=A and actor-owner=B both surface the rows the card labels A/B; after A
re-associates to owner C, the same rows are User=A / actor-owner=C. (`ActivityItem.tsx:77` currently shows
only `owner?.name || username`.)

### v1 → v2 deltas (what changes from the already-implemented v1)

- **KEEP (reuse):** BE `usernames` filter + `GET /api/activity/users` + repo/service/mapper/controller
  wiring; the unit test `ReactiveActivityRepositoryActorFilterTest`; IT-129; the LSN-020 pin deletion.
- **REVERT:** the v1 `user_ids` **deprecation** in `openapi.yaml` (3 endpoints) — un-deprecate; `user_ids`
  stays a first-class param.
- **FE rework (the bulk of v2):** instead of REPLACING the User filter with usernames, expose **three**
  multi-filters — `ownerIds` (asset Owner), `user_ids` (actor's current owner, renamed), `usernames`
  (external user, new). `common.ts ActivityMultipleFilterNames` = `tagIds | ownerIds | userIds | usernames`
  (userIds returns). Dropdowns: ownerIds + userIds -> `/api/owners`; usernames -> `/api/activity/users`.
  Both Activity Filters surfaces (global + per-entity).
- **NEW FE:** the info-`(i)` component + wiring on the 3 filter labels; the dual-name action row
  (`ActivityItem.tsx` for both global + per-entity ActivityItem variants).
- **Tests:** extend IT-129 — assert all three filters coexist + the dual-name row; the `user_ids`
  (actor's-current-owner) path stays GREEN (it is now intentional). Keep the unit behavioural test;
  add a row-rendering assertion (unit or e2e) for the dual name.
- **Docs:** the train rewrite (be702da) and the main correction (da44e59) describe the *shallow* v1 fix —
  **rewrite both under v2** (three axes + dual-name rows + the info popovers); the ADR-log gains the
  info-popover entry (published now per the maintainer). DOC-451 updated.
- **ADRs:** `activity-actor-filter-audit-identity.md` rewritten (additive, 3 axes — done); the
  info-popover ADR drafted (done). Both need GATE 1 re-approval before v2 code.

**Agreement comment POSTED to #1657** (2026-06-13, supersedes the v1 scope comment 4695…/4698316206):
https://github.com/opendatadiscovery/odd-platform/issues/1657#issuecomment-4698583656
(author `odd-contributor[bot]`; ASCII-verified, 2965 chars; the agreed 3-part reframe).

### Open for GATE 1 (the maintainer's calls)

- Final filter **labels** (asset "Owner"; the actor's-current-owner rename; the new external "User"/"Username").
- The info-popover **component/icon names** + whether its ADR-log entry publishes to docs `main` now vs
  rides the 0.28.0 train.
- Whether the dual-name row format is "A (as Owner B)" or another layout.

### Test / docs / ontology / DoD for v2

Same shape as v1 (unit full build + the FULL integration regression on the working-tree SUT + docs read &
routed + ontology re-enriched & committed) — re-run end-to-end after the v2 code, since the FE + row +
component are new. The draft PR opens only after the v2 DoD is met.

---

## Plan v1 (SUPERSEDED by Plan v2 above — kept for provenance; the v1 code is implemented on the branch)

**Branch:** `contrib/CTRIB-010-activity-actor-filter` on `opendatadiscovery/odd-platform`
(from `main` @ `05ecf0a9`). **One draft PR**, body `Closes #1657`, `Milestone: 0.28.0` line,
superseding-#1658 note (credit Vladysl's design). One cohesive code commit (BE + spec + FE +
tests).

### Contract decision (the G-C7 ADR — GATE 1 picks the variant)

- **Variant A — additive-deprecate (RECOMMENDED):** ADD `usernames: string[]` to the three
  endpoints; KEEP `user_ids` accepted with today's semantics, marked `deprecated: true` in the
  spec (description points at `usernames`); REMOVE `user_ids` later on the release plan's own
  "deliberately release-noted" semantics train. Honors the 0.28.0 hard rule (no contract breaks);
  identical user-facing fix (the UI switches to `usernames`); avoids the silent-degradation trap
  (removal makes old scripts silently UNFILTERED — worse than deprecated-but-unchanged).
- **Variant B — replace (the issue's letter + prior art):** swap `user_ids` → `usernames` on the
  three endpoints. Cleaner code (no legacy branch), but a breaking change that contradicts the
  release plan's hard rule and degrades old callers SILENTLY (unknown query params are ignored).
- Both variants: new `GET /api/activity/users` enumeration endpoint + the FE rebind.

### Change — odd-platform (assuming Variant A; deltas for B noted)

- **Spec (`openapi.yaml` + `components.yaml`)** — the contract source (FE client + BE interfaces
  regenerate at build): add `usernames` (query, `type: array, items: string`, with description)
  to `/api/activity`, `/api/activity/counts`, `/api/dataentities/{id}/activity`; mark `user_ids`
  `deprecated: true` + description "Deprecated: filters via the current user–owner mapping; use
  `usernames`" (Variant B: remove `user_ids` instead); add `GET /api/activity/users`
  (operationId `getActivityUsers`, tag `activity`, params `SearchParam`+`PageParam`+`SizeParam`)
  → NEW `ActivityUserList { items: AssociatedOwner[], page_info: PageInfo }` (reuses
  `AssociatedOwner` — the exact shape activity rows already carry in `created_by`, so the FE
  renders dropdown options with the same `owner?.name || identity.username` formula; no new
  user-shaped schema, no prior-art `required:[name]` defect).
- **`ReactiveActivityRepositoryImpl`** — `getCommonConditions`: add
  `if isNotEmpty(usernames) → ACTIVITY.CREATED_BY.in(usernames)` (keep the `userIds` branch —
  Variant B: replace it and drop the now-dead `USER_OWNER_MAPPING` left-joins from the three
  count queries); NEW `getActivityUsers(page, size, query)` → `Mono<Page<AssociatedOwnerDto>>`:
  paginated CTE over `selectDistinct(ACTIVITY.CREATED_BY) where created_by is not null
  [+ containsIgnoreCase(query)]` ordered by username, left-joined to current mapping + OWNER
  (prior-art SQL shape, current-main helpers `JooqQueryHelper.paginate`/`pageifyResult` +
  `OrderByField`); `countDistinct(created_by)` for the page total.
- **`ReactiveActivityRepository` / `ActivityService(Impl)`** — thread `usernames: List<String>`
  through the 8 existing read signatures (param added next to `userIds`; Variant B replaces);
  NEW `getActivityUsers(page,size,query)` service method mapping via `ActivityMapper`.
- **`ActivityMapper`** — NEW `mapToActivityUserList(Page<AssociatedOwnerDto>)` reusing the
  injected `AssociatedOwnerMapper` (the same mapper that builds row `created_by`) + `PageInfo`.
- **`ActivityController` / `DataEntityController`** — regenerated interface params
  (`usernames` added); NEW `getActivityUsers` override.
- **FE (`odd-platform-ui`)** — `common.ts`: `ActivityMultipleFilterNames` gains `'usernames'`
  (drops `'userIds'` — the UI stops sending the deprecated param either variant);
  `ActivityFilterOption.id: number | string`; `Filters.tsx` (global) +
  `DataEntityActivity/Filters/Filters.tsx`: `filterName='usernames'`;
  `MultipleFilterAutocomplete`: for `usernames` dispatch NEW thunk `fetchActivityUsersList`
  (`activityApi.getActivityUsers({ page, size, query })`), options
  `{ id: identity.username, name: owner?.name ? username + ' (' + owner.name + ')' : username }`
  keyed on the username; `MultipleFilter`: for `usernames` derive selected chips directly from
  the query params (no id→name resolution fetch — the value IS the name);
  `SelectedFilterOption`: remove-by-value works for string ids unchanged;
  `activity.thunks.ts`: the new thunk (no redux slice — options are component-local, same as
  owners/tags autocomplete today).
- **Behaviour when both `user_ids` and `usernames` are sent (Variant A):** AND semantics —
  consistent with every other filter pair; the UI never sends both.
- **NOT touched:** attribution WRITE path (`createActivityEvent` — already records the
  principal); display enrichment join in `buildBaseQuery` (display stays
  current-mapping-enriched by design); `MY_OBJECTS`/dependent view modes' `ownerIds` semantics
  (PLT-174 territory); the cross-provider join fan-out facet (F-021, out of scope); no DB
  migration (no index on `created_by` v1 — the enumeration is debounced + paginated; measured on
  the seeded stand before PR, follow-up PERF item if the measurement says otherwise).

### Tests (G-C9, both buckets)

- **Unit → odd-platform CI:**
  - NEW `ReactiveActivityRepositoryActorFilterTest` (BaseIntegrationTest, the FanOutTest
    pattern): (a) `usernames` filter selects an UNMAPPED actor's rows (defect 1 — the failing
    condition injected: actor with no mapping row); (b) filter result INVARIANT under mapping
    churn (assert identical result before/after soft-delete + re-map — defect 2); (c) the same
    on `getTotalActivitiesCount` + `findDataEntityActivities` (counts + per-entity surfaces);
    (d) `getActivityUsers`: distinct usernames, `query` substring, pagination + total,
    current-owner enrichment (mapped actor carries the owner, unmapped null), `created_by IS
    NULL` rows excluded; (e) Variant A only: one lock that `userIds` keeps its legacy
    (mapping-mediated) semantics until the removal train.
  - `ActivityActorFilterKnownBugTest` — **flip per its own pre-authored protocol**: the actor
    filter is now bound to the recorded identity → the structural pin is deleted and its lock
    duty transfers to the behavioural tests above (stronger than the source grep); LSN-020
    finding closed at merge.
  - `AdrActivityContractScanTest` — precision-scope the ADR-0021 `doesNotContain("Integer
    page")` assertion to the feed methods (`getActivity`/`getActivityCounts` signatures), with a
    javadoc note: the users ENUMERATION endpoint is offset-paginated like every non-feed list
    endpoint (ADR-0021's own text scopes the cursor exception to the feed). ADR text unchanged.
  - `ActivityServiceImplTest` + `ReactiveActivityRepositoryFanOutTest` — signature updates;
    service gains the `getActivityUsers` pass-through case.
  - Unit RED framing (honest): the new-contract tests cannot compile pre-fix (the params don't
    exist) — the RED proof for the BUG is the e2e on `ref:main` (below) plus the deleted pin's
    GREEN-today assertion of the buggy binding; the repository tests are new-behaviour locks
    with the failing conditions (unmapped actor, churned mapping) injected explicitly.
- **Integration → odd-team:** NEW **IT-129 — "Activity User filter selects by audit actor"**
  (next free id; `validates: [F-021, F-196]`, `automation: e2e:activity-user-filter.spec.ts`,
  stack odd-minimal, seeds = the reproduction shape: alice mapped / bob unmapped / dave
  remap-target): (1) the User dropdown is fed by `GET /api/activity/users` and lists usernames
  INCLUDING unmapped bob; (2) selecting bob renders exactly bob's rows (impossible pre-fix);
  (3) after the mapping churn (alice→alpha soft-deleted, dave→alpha inserted) selecting alice
  STILL returns alice's rows (the defect-2 lock); (4) per-entity tab: the same filter narrows by
  actor. RED proof: `ODD_SUT=ref:main run-suite.sh IT-129` — pre-fix the dropdown lists owners
  (no bob option exists; step 1 fails for the pinned reason). suites.yaml: add IT-129 to
  `feature-complete` + `ui-e2e` + the activity/collab suite (IT-088's lanes).
- **Runs (the gate, 2026-06-11/12 directive):** inner loop `run-suite.sh IT-129` on the
  working-tree SUT; RED via `ODD_SUT=ref:main`; then the FULL regression on the fix SUT, one
  suite at a time, actual counts read: `feature-complete` (green) + `multi-stack` (green) +
  `known-bugs` (expected all-RED) + `ingestion-e2e` (green); unit: full
  `scripts/run-platform-tests.sh` (no-arg = test + checkstyle + assemble) on the fixed tree.

### Docs (G-C10 + G-C11) — READ + decided: TWO routed changes

Read end-to-end this run: `active-platform-features/activity-feed.md` (the canonical Activity
page — read at main @ `188eb8e`).

- **Docs MAIN (released-truth correction, ships now):** the page's User-filter bullet (line 36)
  + the per-entity table row (line 132) mis-describe the CURRENT mechanism as an
  "entity-ownership axis" ("narrows to events on entities owned by the selected user's owner
  binding"). Code-verified FALSE: the join keys on `ACTIVITY.CREATED_BY` — it is an ACTOR axis
  keyed by the actor's CURRENT owner binding (defects: unmapped actors invisible; re-binding
  re-attributes history). Surgical correction of the mechanism sentences; the protective
  guidance ("does not reliably answer 'what did Alice do'") stays.
- **Docs TRAIN (`release/0.28.0`, publishes at the release gate):** rewrite the User-filter
  bullet for the new behaviour (actor axis on recorded usernames; dropdown lists audit
  usernames enriched with current owner names; works for never-associated users; attribution
  immutable under association churn), update the per-entity table row, remove the
  "future rename or rebind is on the platform roadmap" sentence (this IS that item), add an API
  note (`user_ids` deprecated → `usernames`; Variant B instead: `user_ids` removed — breaking
  note). Paired backlog DOC item (milestone 0.28.0, `pending-release`) with affected URLs, per
  `playbooks/release-train-merge.md`; the item flags the main↔train overlap on this page for
  the release-gate reconciliation.

### Ontology refresh (G-C10)

`/enrich --touched` on the changed nodes' sidecars (ActivityController, ActivityServiceImpl,
ReactiveActivityRepositoryImpl, ActivityMapper — whichever have sidecars; recorded explicitly
if none); F-021: the LSN-020/H-001 finding + the UI-tier "User filter misleads compliance"
facet bracket-noted FIXED by #1657 (closes at the human merge); F-196 same; IT-129 protocol +
spec + suites.yaml; the ADR draft cross-linked; graph re-embed; all COMMITTED.

### Workspace bookkeeping (folded into this run's commits)

CTRIB-009 → `merged` (PR #1779 = main `05ecf0a9`; verify via API) + PLT-147 → `closed`;
release-plan: addendum row for #1657 (maintainer-directed via /contribute, outside the original
slate); LSN-020 retrospective flip note at merge.

### Scope EXCLUSIONS (G-C5 — deliberately NOT touched)

- NO attribution-write changes (`created_by` recording is correct today).
- NO display-enrichment change (rows keep current-mapping owner display — by design).
- NO `user_ids` REMOVAL in this PR under Variant A (deferred to the semantics train; follow-up
  logged). Variant B removes it — that IS the approved scope then.
- NO `ownerIds` / view-mode changes (PLT-174 tracks the dropped view-mode threading).
- NO fix for the cross-provider mapping fan-out on the display join (F-021 facet, separate).
- NO `activity(created_by)` index migration v1 (measured first; PERF follow-up if warranted).
- NO closing of PR #1658 by us (a human action for the maintainer; the PR body notes the
  supersession).

### Scope/root-cause comment (posts to #1657 immediately after GATE 1 — ASCII, one comment)

> Re-reproduced and root-caused on a local stack built from current main (05ecf0a9), ahead of a
> fix PR. The "User" filter is an actor filter resolved through the CURRENT user-owner mapping:
> the base query left-joins user_owner_mapping on oidc_username = activity.created_by (deleted_at
> is null) and getCommonConditions applies USER_OWNER_MAPPING.OWNER_ID.in(user_ids). Both
> reported defects reproduce mechanically: (1) an actor with no association can never be matched
> (and the dropdown is fed by GET /api/owners, so such users are not even listable); (2) after
> re-associating an owner to a different user, the IDENTICAL user_ids query returns the NEW
> user's history -- captured live: filter by owner X returned alice's records before the remap
> and dave's records after, with alice's history unreachable by any filter value.
>
> The PR will implement the issue's prescription -- filter directly on the audit-recorded
> username: a usernames query parameter on /api/activity, /api/activity/counts and
> /api/dataentities/{id}/activity backed by ACTIVITY.CREATED_BY.in(usernames); a new
> GET /api/activity/users endpoint (paginated distinct created_by with current-owner enrichment
> for display) feeding the UI dropdown; and the front end rebound to it on both the global
> Activity page and the per-entity Activity tab. This supersedes draft PR #1658 (same design
> direction, BE-only, predates the current repository code) -- credit to it for the endpoint
> shape. [VARIANT-DEPENDENT CLOSER -- A: The existing user_ids parameter stays accepted with its
> current semantics and is marked deprecated in the OpenAPI spec; its removal is deferred to a
> release-noted cleanup so 0.28.0 stays free of contract breaks. | B: The user_ids parameter is
> replaced by usernames -- a breaking change to the three activity endpoints, called out in the
> 0.28.0 release notes.] Closes #1657.

**POSTED 2026-06-13 (post-GATE-1, pre-code, Variant A closer):**
https://github.com/opendatadiscovery/odd-platform/issues/1657#issuecomment-4698316206
(author `odd-contributor[bot]`; ASCII-verified in-band before post — 1880 chars, 0 non-ASCII;
milestone re-verified `0.28.0` open at post time — G-C11).

## Test ledger (implement run, 2026-06-13)

**Unit (odd-platform CI bucket):**
- NEW `ReactiveActivityRepositoryActorFilterTest` (Testcontainers `BaseIntegrationTest`) — **3/3 GREEN**
  on the fix. Defect 1: a NO-mapping actor (`token_bob`) is selectable by `usernames`. Defect 2:
  re-associating owner_alpha alice→dave flips the deprecated `user_ids` filter's result (alice→dave =
  the bug) while the `usernames` filter still returns alice's rows (the fix — churn-invariant).
  `getActivityUsers`: distinct actors incl. unmapped, null `created_by` excluded, current-owner
  enrichment, substring narrowing. (Failing conditions injected explicitly; per-test tokens keep the
  shared-DB cases disjoint.)
- **LSN-020 pin disposition:** the structural `ActivityActorFilterKnownBugTest` (which asserted the
  buggy `USER_OWNER_MAPPING.OWNER_ID.in(userIds)` string EXISTED) is **DELETED** — under Variant A that
  string is the intentionally-retained deprecated path, so the pin can no longer flip RED and would
  falsely read "bug still present." Its protective duty transferred to the behavioural test above
  (stronger; references LSN-020 in its javadoc). Transparent subtraction, not hiding (LSN-029 spirit:
  the bug is proven fixed by a better test).
- `AdrActivityContractScanTest` re-scoped — the ADR-0021 `doesNotContain("Integer page")` assertion now
  targets the `getActivity` FEED signature substring only (the new `getActivityUsers` enumeration
  endpoint legitimately uses offset `page`+`size`, per ADR-0021's own feed-only scope). ADR text
  unchanged. **3/3 GREEN.**
- `ActivityServiceImplTest` — `usernames` threaded through; NEW `getActivityUsers` dispatch test.
  **5/5 GREEN.** `ReactiveActivityRepositoryFanOutTest` (PLT-176) signature updated — **1/1 GREEN.**
- Targeted: `run-platform-tests.sh --tests "*Activity*"` → BUILD SUCCESSFUL (3+5+1+3 = the activity
  tests + checkstyleMain/Test). One checkstyle interlude (a 121-char guard comment line) wrapped + re-run.
- **Full CI replica on the fixed tree:** `scripts/run-platform-tests.sh` (no-arg `:odd-platform-api:build`
  = test + checkstyle + assemble) → **BUILD SUCCESSFUL in 5m 42s.**
- RED framing (honest): the new-contract unit tests cannot COMPILE pre-fix (the `usernames` param does
  not exist on main) — so the bug's RED proof is the e2e on `ref:main` (below). The repository tests are
  new-behaviour locks with the two defects injected as explicit failing conditions.

**Integration (odd-team `IT-129`, working-tree SUT):**
- NEW `IT-129` (`activity-user-filter.spec.ts`; `validates: [F-021, F-196]`, `regresses: [LSN-020]`;
  suites `feature-complete` + `ui-e2e` + activity/collab) — **3/3 GREEN on the fix SUT**
  (image `sha256:8db4f8ad…`, built from the working tree): the User dropdown is fed by
  `GET /api/activity/users` and lists the unmapped actor bob; selecting bob sends `usernames=` (not
  `user_ids=`) and renders only bob's entity; the per-entity Activity tab uses the same source.
- **RED proof on `ODD_SUT=ref:main`** (clean origin/main @ `05ecf0a9`, image `sha256:539f4ac5…`, no fix):
  **3/3 FAIL** — `/api/activity/users` 404s, the dropdown is owner-fed, bob is not listable → the
  `usersFetch` wait times out, exactly the pinned reason. (First main build hit the known gradle
  GC-thrash transient — SUT-BUILD-FAILED, not a test failure; retried with `-Xmx3g`, clean.)
- A scratch FE-data-qa gap surfaced en route: the per-entity `DataEntityActivity/Filters/Filters.tsx`
  User filter had no `dataQA` (the global page's does) — added `dataQA='user_filter'` for testability +
  cross-surface consistency (same file already in scope; FE tsc re-verified clean).

**FULL regression (the gate, 2026-06-11/12 directive) on the fix SUT, one suite at a time, actual counts:**
- `feature-complete`: **282 passed / 0 failed (4.0m)** (image `sha256:935c8fb1…`) — baseline 279 + the 3
  new IT-129; IT-088/089/126 (activity feed + per-entity tab + PLT-176 fan-out) all GREEN on the changed
  activity code; api-probe rail PASS.
- `multi-stack`: **9 passed / 0 failed (4.2m)** (image `sha256:ae74942d…`).
- `known-bugs`: **5 failed / 0 passed — EXPECTED all-RED** (image `sha256:6e117486…`): IT-007
  (LSN-001/PLT-086) · IT-006 (TEST-GAP-1013) · IT-004 (PLT-052) · IT-003×2 (PLT-090/PLT-127); ZERO
  unexpected GREENs (no un-flipped fixes).
- `ingestion-e2e`: **6 passed / 0 failed (1.0m)** (image `sha256:5cc38e33…`).

**Post-fix running-system drive (LSN-031 / reproduce-first step 5):** the reproduction's UI symptom,
re-driven by IT-129 GREEN — the dropdown now lists audit usernames (incl. the unmapped actor) and the
selection filters by `usernames` — is the corrected behaviour the live capture in `reproduced:` lacked.

## Docs ledger (G-C10 + G-C11) — READ + decided: TWO routed changes

- **READ end-to-end this run:** `active-platform-features/activity-feed.md` (full page, both refs:
  main @ `188eb8e` and the train `release/0.28.0` @ `f67851e` — identical on the User-filter bullet
  + the per-entity table row). The page's User-filter bullet (`:36`) + per-entity table row (`:132`)
  describe the CURRENT mechanism as "an entity-ownership axis, not an actor axis" — **code-verified
  FALSE** (the filter resolves `created_by` → owner via `user_owner_mapping` and keeps events whose
  ACTOR maps to a selected owner = an actor axis on the mutable mapping).
- **Docs MAIN (released-truth correction, immediate flow — its own branch, NOT the train):** branch
  `docs/CTRIB-010-activity-user-filter-mechanism`, commit **`da44e59`** (2 lines: the User bullet +
  the table row). Describes the real 0.27.x behaviour + its two gaps. Ships now; verified at its own
  merge (not the release gate).
- **Docs TRAIN (`release/0.28.0`, unreleased behaviour — publishes at the release gate):** commit
  **`be702da`** — the User bullet + table row rewritten for the fixed behaviour (actor axis by
  recorded username; works for unassociated users; stable under churn; roadmap sentence retired).
  Paired backlog item **`backlog/docs/DOC-451.md`** (`pending-release`, milestone 0.28.0, affected
  page + expected post-merge phrases + the main↔train same-line overlap flagged for the gate).
- Both doc commits carry a `Sources:` footer (the DOC-450 reviewer flagged this convention; done).
- `docs_routing: release/0.28.0` (train, paired DOC-451) **+** `main` (immediate correction da44e59).
  Other Activity-feed pages / API-reference: no other page describes the User filter mechanism
  (repo grep) — nothing else to route.

## Ontology refresh ledger (G-C10) — filled in Phase D step 13

---

## v2 implementation outcome (2026-06-13) — DoD green, draft PR #1780 open (GATE 2 pending)

**Branch / commit / PR:** `contrib/CTRIB-010-activity-actor-filter` pushed to
`opendatadiscovery/odd-platform` (1 commit `2ed71256`, author + committer `odd-contributor[bot]`;
base `main` @ `05ecf0a9`; 31 files +443/-95). **Draft PR #1780** —
https://github.com/opendatadiscovery/odd-platform/pull/1780 (`draft:true`, `Closes #1657`,
`Milestone: 0.28.0` re-verified open at push, docs note `release/0.28.0`; review requested from
RamanDamayeu, HTTP 201; the bot cannot merge — GATE 2 is the human's).

### Diff = the approved v2 plan (G-C5)
- **Spec (additive, no break):** `usernames` added to 3 endpoints; `user_ids` **un-deprecated**;
  `GET /api/activity/users` + `ActivityUserList` (reuses `AssociatedOwner`).
- **BE:** `ReactiveActivityRepositoryImpl` (both axes + `getActivityUsers` CTE), signatures threaded,
  `ActivityMapper.mapToActivityUserList`, controllers. (BE Java unchanged from v1 except via the spec
  regen; the un-deprecation is spec-only.)
- **FE:** `InformationHint` (new reusable `(i)` popover on `AppPopover`) + `ActivityFilterHints`;
  three filters (Owner/Made by (owner)/Made by (user)) on both Filters surfaces; `ActivityActorLabel`
  dual-name rows on both ActivityItem surfaces; `common.ts` (userIds rejoins), `Input.label` widened to
  ReactNode, en.json (13 keys). `user_ids` NO LONGER deprecated.
- **Excluded (verified):** no attribution-write change, no `user_ids` removal, no migration, no
  auth-posture change, no FE for other surfaces; the diffstat is activity + the shared InformationHint
  + Input.tsx only.

### Test ledger (v2)
- **Unit:** full CI replica `scripts/run-platform-tests.sh` (no-arg `:odd-platform-api:build`) →
  **BUILD SUCCESSFUL 5m30s**. `ReactiveActivityRepositoryActorFilterTest` 3/3 (unmapped-actor +
  churn-invariance + getActivityUsers); `ActivityServiceImplTest` 5/5; `AdrActivityContractScanTest`
  3/3 (ADR-0021 scoped to the feed); `ReactiveActivityRepositoryFanOutTest` 1/1. LSN-020 structural
  pin DELETED → behavioural test (re-grounding; LSN-029 spirit).
- **Integration IT-129 (6 v2 tests):** GREEN on the working-tree SUT (digest `eac3c8a5`): three
  filters present · "Made by (user)" lists unmapped bob (source `/api/activity/users`) · usernames
  select · `user_ids` (Made by (owner)) select · dual-name row (alice + owner_alpha) · per-entity tab.
  **RED proof on `ODD_SUT=ref:main`: 6/6 FAIL** (no made_by filters, no `/api/activity/users`).
- **FULL regression on the fix SUT (the gate):** `feature-complete` **285/0** (282 baseline + 3 net IT-129;
  IT-088/089/126 activity specs green on the changed code) · `multi-stack` **9/0** · `known-bugs`
  **5 failed — EXPECTED all-RED**, zero unexpected GREENs · `ingestion-e2e` **6/0**.

### Docs ledger (v2) — routed
- **Train `release/0.28.0`:** `3a4f6ad` (`activity-feed.md` — 8 facets, the three filters, dual-name
  rows, info-popover hint, per-entity table) + `fc72cd4` (**ADR-0076** info-(i) popover + README +
  SUMMARY). Paired item `backlog/docs/DOC-451.md` (`pending-release`).
- **Docs `main` (released-truth, immediate):** `da44e59` (branch
  `docs/CTRIB-010-activity-user-filter-mechanism`) — corrects the 0.27.x "entity-ownership axis" error.
  Overlaps the train on the same lines → resolve at the release gate by taking the train (DOC-451 flags it).
- Both doc branches are LOCAL (committed); the maintainer pushes them (the bot is scoped to odd-platform).

### Ontology ledger (v2) — committed, not narrated
- Touched sidecars annotated with the v2 delta (ReactiveActivityRepositoryImpl, ActivityController
  class, ActivityServiceImpl, the `activity` TS route); F-021 + F-196 carry a top fix-note (the LSN-020
  surface is addressed; drift facets kept as the historical record). Graph re-embedded
  (`graph-build odd-platform`: nodes=7083 edges=9180 vectors **8017**). The delta notes make the
  sidecars truthful now; a `/enrich --touched` structured regeneration will refresh the generated fields
  on the normal ontology cadence (no separate obligation — the notes carry the load-bearing truth).

### Definition of Done (LSN-032 four gates) — v2
1. **Unit full build** ✅ 5m30s. 2. **FULL integration regression on the working-tree SUT** ✅
   (feature-complete 285/0 + multi-stack 9/0 + known-bugs 5-RED-expected + ingestion-e2e 6/0; IT-129
   6/6 GREEN-on-fix + RED-on-`ref:main`). 3. **Docs** ✅ read + decided + routed (train + main + ADR-0076
   + DOC-451). 4. **Ontology** ✅ annotated + re-embedded + committed.

### Outcome
Draft PR #1780 open · status `pr-draft` · **`/review` in a separate session is the next step**
(it owns `pr-draft → review-ready`; the bot never self-reviews) · GATE 2 (human review + merge) closes it ·
the doc branches + DOC-451 ride the 0.28.0 release gate.

### Review-feedback refinement (2026-06-13, on the draft PR before /review)

Maintainer review of the draft PR flagged two display defects (memory
`feedback_dropdown_raw_values_audit_temporal_explicit`):
1. the "Made by (user)" dropdown showed an artificial `Owner (User)` composite — now lists the **raw
   usernames** it filters on;
2. the row "bob as Owner test_1" was ambiguous about *when* test_1 was the owner — now renders
   "bob  **current owner: test_1**" with a tooltip making explicit it is the **as-of-now** association
   (ODD does not record the change-time owner).
Pushed additively as commit **`a823bcb1`** (no history rewrite — the force-push was correctly blocked;
new commit on top of 2ed71256). Re-verified: FE tsc clean; **IT-129 6/6 GREEN** + **feature-complete
285/0** on the refined SUT. (unit build unaffected — FE-display-only, BE byte-identical; multi-stack /
known-bugs / ingestion-e2e orthogonal to a FE-activity-display change + green on the parent v2 commit;
`/review` re-runs the full four on the committed head.) Train doc + workspace artefacts synced to the
"current owner" wording.

### Review-feedback round 2 (2026-06-13) — reuse existing pattern + a caveat logged

Two more maintainer comments on the draft PR:
1. **Reuse the existing info-(i) affordance (a real miss).** I had built a NEW `AppPopover`-based
   `InformationHint`; the platform ALREADY ships the pattern — `InformationIcon` in an `AppTooltip`
   (Data Entity overview "About" `InternalDescriptionHeader`, Term definitions, the DQ SLA report).
   Refactored the activity filter hints to reuse it; **deleted `InformationHint`**; corrected the
   train doc + **ADR-0076** to DESCRIBE the existing pattern ("information icon in a hover tooltip",
   reverse-engineered) and renamed it `…-tooltip-affordance.md`. odd-platform commit `8ec0baac`; train
   commit `f6f9ccc`. Re-verified: FE tsc clean + IT-129 6/6 GREEN. Memory:
   `feedback_search_existing_ui_pattern_before_building`.
2. **Lookup-table Description caveat.** Unrelated finding the maintainer surfaced: the Create/Edit
   Lookup Table "Description" is stored on the lookup-table record only — `mapCreatedLookupTablePojo`
   never sets the entity's `internal_description`, so it never shows on the entity overview "About".
   Code-verified + reproduced live (lookup_tables.description set, data_entity.internal/external
   description empty). Logged **`issues/odd-platform/PLT-224.md`** (draft) + a released-truth doc caveat
   on `master-data-management/lookup-tables.md` (docs main branch `docs/lookup-table-description-caveat`,
   commit `1bb425a`).

Also added unit coverage the patch-coverage gate (98% changed-files) demanded (the new endpoint +
mapper + threaded params were uncovered): odd-platform commit `2feb1a2e` (ActivityControllerTest,
DataEntityControllerActivityTest, ActivityMapperTest.testMapToActivityUserList, ActivityServiceImplTest
getActivityCounts/getDataEntityActivityList) — ActivityController 0%->100%, ActivityMapper 95.2%->98.1%,
ActivityServiceImpl 59%->96% (the residual whole-file misses are pre-existing methods, not changed lines).

### Review-feedback round 3 (2026-06-13) — the tooltip render fix + the process gate it proves

The maintainer rejected the reused info-`(i)` tooltip on sight: *"that is a disaster... no background
highlighting, long text in a single row... I could not go with it to users. We did just junior formal
implementation."* And, separately, asked to fix the **process** so four recurring classes stop
recurring (no reuse/ADR scan; no Product-Owner/SRE lens; no Principal test-sufficiency review;
incomplete impact analysis / i18n).

**Process (the root fix), odd-team commit `8fc8a70`.** `retrospectives/LSN-035` + a universal
`playbooks/design-before-build.md` (reuse-scan · ADR-check · impact-dimension checklist · PO/SRE lens ·
**LOOK at the rendered pixels**) + contributor `G-C12`/`G-C13` + the `/contribute` Phase-C design step +
CLAUDE.md "Gate 0". The tooltip fix below is the **first application** of that gate's step 5.

**Root cause of the bad render.** The round-2 reuse-refactor wired the hints through `AppTooltip` but
passed the hint **text as a bare string**. `AppTooltip`'s `"light"` popper
(`AppTooltipStyles.tsx`) supplies only `backgroundColor: background.default` with **`padding: 0`** and
**`maxWidth: 'unset'`** — so a bare string renders edge-to-edge, in one unwrapped row, with no card to
set it off the page. The established surfaces (`InternalDescriptionHeader`, `TermDefinition`) never pass a
bare string: they wrap content in a styled `S.Tooltip` body that brings the padding, the wrapping
max-width, and the border/radius/shadow. I had reused the outer component but **not its content
container** — the exact miss the new playbook's step-5 note now calls out.

**Fix — odd-platform commit `094c8a0a` (3 files, +33/-5).** A shared
`components/shared/elements/Activity/Activity.styles.ts` `TooltipBody` (padding · `maxWidth: 360px` ·
`whiteSpace: normal` · border · `borderRadius: 8px` · `boxShadow: shadows[9]`), used by **both**
`ActivityFilterHints` (the 3 filter hints) **and** `ActivityActorLabel` (the row's "current owner" note —
which had the identical bare-string defect). One shared body, not a 5th per-surface copy or a cross-file
import smell. `docker/demo.yaml` (the maintainer's local) left untouched.

**Visual verification (G-C12 step 5 — the pixel gate, not a green test).** Built the working-tree SUT
(`sha256:45a27df…`; the build's `tsc --noEmit && vite build` is the FE type gate — clean), then drove the
running UI and **screenshotted every tooltip**: all four (Owner / Made by (owner) / Made by (user) filter
hints + the actor-row "current owner" note) now render as **padded, wrapped, bordered cards** with clear
contrast. The in-context shot also confirmed the dual-name row and all three filters. (Capture spec was a
throwaway — removed; not a committed visual-regression test.)

**i18n impact dimension (the named gap, applied to this change).** The eight new activity strings are
`en.json`-only; the six other locales (otherwise ~420/434 keys — actively maintained, NOT en-fallback by
default) carry none → a non-English operator sees them in English. Per the new impact checklist this is
**tracked, not machine-translated** into a published catalog I cannot verify (Ukrainian/Chinese/Armenian):
**`issues/odd-platform/PLT-225.md`** (draft), the PLT-190 (#1748) precedent. Named in the PR scope-exclusions.

**Regression (the fix SUT `45a27df…`).** `IT-129` **6/6 GREEN** · `feature-complete` **285 passed / 0
failed** (`api:PASS e2e:PASS`; same count as the parent v2 run — the CSS-only delta changed nothing).
Unit bucket unchanged (zero Java touched — FE styling only); `multi-stack`/`known-bugs`/`ingestion-e2e`
are backend/data/ingestion lanes a tooltip-CSS wrap cannot affect and were green/expected-RED on the
parent commit. `/review` (separate session) re-runs the literal full set as the gate.

Pushed additively (commit `094c8a0a`) onto the draft PR branch — no history rewrite.
**[review correction]** the published HEAD is `97978249`, not `094c8a0a` — `git reflog` shows `094c8a0a`
was AMENDED into `97978249` (the amend added the `Consumer-read:` footer; reflog: `commit (amend)`).
origin == local == `97978249`. The shipped artefact is well-formed; the ledger cited the pre-amend SHA.

---

## Review (2026-06-13, session: `/review` separate-session — distinct from implement)

**Lifecycle (contributor pillar):** `/review` owns `pr-draft → review-ready`; GATE 2 (human review + merge of
draft PR #1780) owns the tail. This is a separate session from the implement/refinement sessions — the prior
"review round 1/2/3" commits were maintainer-feedback refinements **during implement**; this is the formal
independent gate. Reviewed head: odd-platform **`97978249`** (verified origin == local).

- **Result**: **ACCEPTED** — `pr-draft` → `review-ready`. Every contributor acceptance criterion (1–14) and every Quality Bar gate passes with cited evidence; the reviewer's own FULL regression (unit BUILD SUCCESSFUL 5m49s + feature-complete 285/0 incl. IT-129 6/6 + multi-stack 9/0 + known-bugs 5-expected-RED + ingestion-e2e 6/0) is GREEN. Gate 8 is PENDING-RELEASE (0.28.0 train) + DEFERRED for the two local released-truth doc branches the maintainer pushes. **Next: human GATE 2 — review + merge draft PR #1780** (`Closes #1657`).

### Contributor acceptance criteria (gates.md §Acceptance 1–14)
1. **Code-after-plan** — PASS (`plan_approved_by` v1+v2 GATE 1 2026-06-13; reflog: every code commit follows approval).
2. **Reproduction logged** — PASS (`reproduced:` frontmatter — 5 defect surfaces driven live on the pre-fix SUT `sha256:6cc6e88b…`).
3. **Diff bounded by plan** — PASS (33 files = the approved v2 plan; exclusions verified IN CODE: `user_ids` retained + deprecation-commented, no migration, no write-path change, no auth-posture change). via `git diff merge-base..HEAD`.
4. **Unit test injects the failing condition** — PASS (`ReactiveActivityRepositoryActorFilterTest`: unmapped `bob` = defect 1; mapping churn `alice→dave` = defect 2 — both injected explicitly; `user_ids` re-attributes (the bug) while `usernames` stays invariant (the fix), asserted side-by-side). via read.
5. **Pins re-grounded, not deleted** — PASS — the LSN-020 pin was a **structural source-grep** asserting `USER_OWNER_MAPPING.OWNER_ID.in(userIds)` EXISTS; under the *additive* fix that string is intentionally retained, so the pin can never flip RED again. Re-grounded into the stronger behavioural test (its javadoc cites LSN-020/LSN-029; the deleted pin's own flip-protocol pre-authorized deletion on fix). Transparent subtraction. via read of both.
6. **Docs decision + routed** — PASS (released-truth correction `da44e59`→docs `main`, page read + code-verified; unreleased behaviour→`release/0.28.0` train `3a4f6ad`/`0a88d37`/`f6f9ccc`; DOC-451 `pending-release`). via `git log`/`git show`.
7. **Ontology committed** — PASS (4 touched sidecars carry the v2 delta on disk; `ReactiveActivityRepositoryImpl` sidecar `## CTRIB-010 … update (2026-06-13)` §; graph re-embedded per ledger). via grep.
8. **Status review-ready, not self-done** — PASS (was `pr-draft`; this separate session flips it).
9. **Architectural ADR before code** — PASS (G-C7 fired — breaking-contract risk; resolved ADDITIVE; ADR `activity-actor-filter-audit-identity` + ADR-0076; GATE 1 approved both before code).
10. **Prompt injection discarded** — N/A (maintainer-authored issue, treated as quoted data per G-C8; no injection present).
11. **DoD met before draft** — PASS (unit build GREEN 5m49s reviewer-run + integration below + docs read + ontology committed).
12. **Milestone gate** — PASS (milestone `0.28.0` open semver; re-verified at intake + push; docs on the `release/0.28.0` train).
13. **Design before build (G-C12)** — PASS (reuse-scan found the existing `AppTooltip`+`InformationIcon` → ADR-0076 reverse-engineered; the duplicate `InformationHint` deleted round 2; i18n ALL-locale dimension tracked as PLT-225 (NOT machine-translated — correct); PO/SRE lens = the 3-axis clarity reframe).
14. **Principal sufficiency (G-C13)** — PASS (patch-coverage gap closed `2feb1a2e` — ActivityController 0→100%, ActivityMapper 95.2→98.1%, ActivityServiceImpl 59→96%; both ActivityItem surfaces wired to `ActivityActorLabel`; tooltip render fixed to a styled card — the LSN-035 pixel gate applied).

### Quality Bar gates
- **Gate 1 (no duplicates)** — PASS (reuse of `AppTooltip`; the duplicate `InformationHint` deleted round 2; no parallel component). via diff.
- **Gate 4 (consumer-read)** — PASS (`2ed71256` + `97978249` footers name the consumers; cross-checked vs actual code — `getCommonConditions`/`buildBaseQuery`, `AssociatedOwnerMapper`, the FE filter wiring, `AppTooltipStyles`). via read.
- **Gate 5 (unset-param SDK)** — N/A (no SDK builder in scope).
- **Gate 6 (bidirectional code↔doc)** — PASS (every functional claim → code; the user-visible change → `activity-feed.md` both refs + ADR-0076).
- **Gate 8 (publishing)** — **PENDING-RELEASE (0.28.0)** for the train docs (publish at the release gate; branch sub-checks PASS — PyYAML valid, descriptions 182c/198c ≤200, tree-relative links). **DEFERRED** for the released-truth corrections `da44e59` (main, the "entity-ownership axis" fix) + `1bb425a` (PLT-224 lookup caveat): both are on LOCAL documentation branches — the bot is scoped to odd-platform, so **the maintainer must push + merge them**; live-site verification runs post-merge. Post-merge URLs to verify: `docs.opendatadiscovery.org/active-platform-features/activity-feed` (the User-filter bullet) + `…/master-data-management/lookup-tables` (the Description caveat).
- **Gate 9 (provenance)** — PASS (footers cite SoT; ADR-0076 code snippet byte-identical to `ActivityFilterHints.tsx`; doc claims code-verified; outbound links tree-relative). via read + Web-equivalent grep.
- **Gate 10 (content homing)** — PASS (ADR content→ADR log; feature behaviour→`activity-feed.md`; caveat→`lookup-tables.md` admonition; no misplaced reference content).
- **Gate 11 (audience isolation)** — PASS (banned-term grep clean on all touched published docs; the two `pillar` hits = ODD's published "governance pillars" vocabulary, pre-existing footer lines). via grep across `main`/`release/0.28.0`/caveat branches.

### Regression (G-C2 — reviewer's OWN runs, working-tree SUT @ `97978249`)
- **Unit**: `scripts/run-platform-tests.sh` (= `:odd-platform-api:build` = test + checkstyleMain + checkstyleTest + assemble) → **BUILD SUCCESSFUL in 5m 49s**. Includes the new `2feb1a2e` coverage tests + `ReactiveActivityRepositoryActorFilterTest` + the re-scoped `AdrActivityContractScanTest`. (Independently closes the "is a full build green on the commit that includes the new test files?" gap.)
- **Integration** (`run-suite.sh`, SUT rebuilt fresh from the working tree @ `97978249` — LSN-033; digests per suite in the run-log):
  - **feature-complete: 285 passed / 0 failed (4.1m)** — api:PASS e2e:PASS. **IT-129 6/6 GREEN** (three filters present · "Made by (user)" lists an unmapped actor · username-filter narrows · "Made by (owner)"=user_ids axis · dual-name row · per-entity tab) + IT-088/089/126 (activity feed + per-entity + PLT-176 fan-out) GREEN on the changed code.
  - **multi-stack: 9 passed / 0 failed (3.3m)**.
  - **known-bugs: 5 failed / 0 passed — EXPECTED all-RED, zero unexpected GREENs** (the 5 = IT-007/LSN-001 · IT-006/TEST-GAP-1013 · IT-004/PLT-052 · IT-003×2/PLT-090+PLT-127 — all pre-existing pins, none activity-related → no regression, no un-flipped fix).
  - **ingestion-e2e: 6 passed / 0 failed (59.7s)**.
  - Verdict: the reviewer's own FULL-set regression (both buckets) is GREEN; the activity change introduced no regression. via `integration-tests/run-suite.sh` + `run-log/2026-06-13-*`.

### Editorial audit (step 5, `playbooks/doc-product-editorial-read.md`)
- **Coverage this run**: the changed surface read end-to-end (`activity-feed.md` main+train, ADR-0076 train, `lookup-tables.md` caveat) + a parallel-surface sweep across `docs/**` for the activity User-filter mechanism. Broader subtrees covered by prior `/review` passes.
- **Findings**: **DOC-452** (low, *parallel-surfaces-with-drift*) — train `activity-feed.md` says "eight facets" but `Features.md:126` still says "seven facets on the global filter panel"; publishes at 0.28.0; paired with DOC-451 at the release gate. Source: `documentation/docs/Features.md:126`. Logged on disk.

### Notes
- **Provenance**: ledger's round-3 `094c8a0a` = pre-amend SHA; published HEAD `97978249`. Corrected above. VERIFIED via `git reflog` + `git cat-file`.
- **Workspace-draft hygiene** (NOT a PR blocker): `adrs/drafts/platform-info-popover-affordance.md` carries a correction header but its Decision body still describes the REJECTED popover (self-contradictory), and it was NOT renamed to `…-tooltip-affordance.md` as the round-2 ledger claims. The **published** ADR-0076 (train) IS correct (renamed + rewritten to the reused tooltip pattern). Recommend deleting/superseding the stale draft. NOT VERIFIED fixed → noted here.
- **Banned-phrase check**: none used.
- **Upstream/follow-ups on disk**: PLT-224, PLT-225 (both ASCII-clean, `user_facing_verified: true`); DOC-451 (`pending-release`); DOC-452 (this review).

---

## GATE 2 — merged (2026-06-13)

Human GATE 2 complete: the maintainer merged draft **PR #1780**. It **squash-merged** to
`opendatadiscovery/odd-platform` `main` as **`697a3b39`** ("fix(activity): make the Activity feed's
User vs Owner distinction explicit (#1657) (#1780)"); `origin/main` `05ecf0a9 → 697a3b39` — verified via
`git fetch` + `git log origin/main` (the reviewed head `97978249` is not a direct ancestor because the
merge squashed the 5 commits into one). **Issue #1657 auto-closed** by the PR (verified state **Closed**,
closed-by #1780).

**Documentation branches pushed** (the bot is scoped to odd-platform; the maintainer authorized the push):
- `docs/CTRIB-010-activity-user-filter-mechanism` (`da44e59`) — the released-truth `main` correction.
  PR: https://github.com/opendatadiscovery/documentation/pull/new/docs/CTRIB-010-activity-user-filter-mechanism
- `docs/lookup-table-description-caveat` (`1bb425a`, PLT-224 caveat).
  PR: https://github.com/opendatadiscovery/documentation/pull/new/docs/lookup-table-description-caveat

Both still need a docs `main` merge to publish live — the `da44e59` correction fixes a **currently-live**
error (the User filter is described as an "entity-ownership axis"). The 0.28.0 train docs + DOC-451 + DOC-452
publish at the release gate (`/review release:0.28.0`). PLT-224 / PLT-225 issue drafts remain for the
maintainer to file (the bot never creates issues).

