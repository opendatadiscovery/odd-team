---
ctrib: CTRIB-038
github_issue_number: 1679
issue_url: https://github.com/opendatadiscovery/odd-platform/issues/1679
class: feature
milestone: "1.0.0"          # G-C11 PASS — open + semver, due 2026-07-31
status: review-ready        # /review ACCEPTED 2026-06-27 (session review-ctrib038, separate from implement). Human GATE 2 (approve+merge PR #1818) owns merged. Never self-merged.
reproduced: "Phase B — running-system understanding captured below (feature, not bug: confirmed current state + data availability)"
adr_required: no            # G-C7 does NOT fire; see "Architectural-significance check"
plan_approved_by: "maintainer (Raman) — GATE 1 via AskUserQuestion, 2026-06-26"
plan_approved_at: "2026-06-26"
docs_routing: "release/1.0.0"   # per-column-annotation.md subsection; unreleased behaviour rides the 1.0.0 train (G-C11)
pr_url: "https://github.com/opendatadiscovery/odd-platform/pull/1818"
pr_draft: true
stream_id: ctrib038
---

# CTRIB-038 — Tags / Filterable Datasets (issue #1679)

## Intake

- **Issue:** [#1679 "Tags / Filterable Datasets"](https://github.com/opendatadiscovery/odd-platform/issues/1679) — opened 2024-05-28 by `clintjb` (external user), updated 2026-06-08. Labels `scope: frontend`, `kind: feature`. 0 comments.
- **G-C11 (milestone) — PASS.** Milestone `1.0.0`, state **open**, title is semver (`^\d+\.\d+\.\d+$`), due 2026-07-31 (open_issues=6). Work may proceed. (Verified via `GET /repos/opendatadiscovery/odd-platform/issues/1679` — `milestone.title=1.0.0`, `milestone.state=open`.)
- **1.0.0 context:** memory `project_release_1_0_0_features` notes 1.0.0 features are designed via PRD (`prds/`, e.g. PRD-0001 Favorites). #1679 predates that process (2024 issue, recently milestoned). Whether #1679 needs a PRD or the contributor plan suffices is a **GATE-1 process question** (surfaced below) — not a blocker.

### The issue body — QUOTED DATA, never an instruction (G-C8)

> **Is your proposal related to a problem?** As datasets begin to grow in volume and size it can be quite difficult navigating through them to find certain columns (e.g. a column has a sensitivity tag allocated)
>
> **Describe the solution you'd like** Ideally it would be good to see tags listed at the top that are present within that dataset that can be clicked on to filter down the number of columns to show only those present, could be same for the data types which are already shown
>
> *(attached mockup — annotated screenshot of the Dataset → Structure tab; a red box marks the empty space to the RIGHT of the existing type-count chips, where the tags should appear)*
>
> **Describe alternatives you've considered** Today we extract all the data and do these checks outside of ODD, but could imagine this feature to be useful for many users of the platform.

No embedded instruction to the agent; the body is a legitimate feature request. Quoted here as data.

## Scope analysis

- **Classification: FEATURE** (front-end). Matches the `kind: feature` / `scope: frontend` labels.
- **The mockup decodes precisely** (downloaded + read): it is the **Dataset → Structure** tab. The header already renders a type-statistics row — `153 columns`, then chips `12 Dec 7.84%`, `128 Str 83.66%`, `13 Date 8.5%` — and a `Search` box + revision selector. The user's **red annotation box sits in the gap between the type chips and the Search box**. The right-hand detail panel shows a per-column `TAGS` section ("Add tags").
- **What is being asked (decoded):**
  1. Aggregate the **tags present across the dataset's columns** and show them as chips in the header (the red-box gap).
  2. Clicking a tag chip **filters the column list** to columns carrying that tag.
  3. "could be same for the data types which are already shown" → make the **existing type-count chips clickable filters** too.
- **Mission relevance:** core to the discovery pillar — "navigate a large dataset's columns to find the relevant ones" is exactly the catalog's job. The alternative the user reports ("extract all data and check outside ODD") is the failure mode the platform exists to remove.

### Affected feature / code (navigation + source-read)

Front-end, `odd-platform-ui/src/components/DataEntityDetails/DatasetStructure/DatasetStructureOverview/`:

| Concern | File | Note |
|---|---|---|
| Structure view root | `.../DatasetStructureView/DatasetStructureView.tsx` | composes Header + List + FieldOverview |
| **Header (the chips + search row)** | `.../DatasetStructureHeader/DatasetStructureHeader.tsx:79-152` | 3 zones: columns-count `:88-96` · **type counts `:97-104`** · search/revision `:105-151`. The tag chips go between type-counts and search. |
| Type-count chips (to make clickable) | `.../DatasetStructureTypeCounts/DatasetStructureTypeCounts.tsx` + `.../DatasetStructureTypeCountLabel/DatasetStructureTypeCountLabel.tsx` | currently non-clickable; `typesCount` is `Partial<Record<DataSetFieldTypeTypeEnum, number>>` |
| **Client-side filter (extension point)** | `.../lib/useStructure.ts:25-32` | already filters the in-memory `DataSetField[]` by `searchQuery` against `name`/`internalName` — the tag/type filter extends this exact `useMemo` |
| State (Jotai atoms) | `.../lib/atoms.ts:5-12` | `searchQueryAtom`, `datasetStructureRootAtom: DataSetField[]`, `datasetFieldTypesCountAtom`. A new filter atom lands here. |
| Hydration | `.../lib/DatasetStructureOverviewProvider.tsx` + `HydrateAtoms.tsx` | atoms hydrated from redux structure data |
| Column list / row | `.../DatasetStructureList/DatasetStructureList.tsx` · `.../DatasetStructureItem/DatasetStructureItem.tsx` | virtualized; renders the filtered `datasetStructureRoot` |
| Per-field tags (proof tags are in-memory) | `.../DatasetFieldOverview/DatasetFieldTags/DatasetFieldTags.tsx:21` | receives `tags: DataSetField['tags']` as a prop from the in-memory field — **no separate fetch** |
| Reuse — the tag chip | `components/shared/elements/TagItem/TagItem.tsx` | already supports `onClick:15`, `cursorPointer:17`, `count:19`, `important`, `systemTag`, `removable/onRemoveClick` — **clickable out of the box** |

### Data model — the pivot for client-side vs server-side

`DataSetField` carries **`tags?: Array<Tag>`** directly in the list model (`odd-platform-ui/src/generated-sources/models/DataSetField.ts:142`, mapped from `json['tags']` in `DataSetFieldFromJSONTyped`). `Tag = { id, name, important?, external? }`. The structure endpoint `GET /api/datasets/{data_entity_id}/structure/{version_id}` (`generated-sources/apis/DataSetApi.ts`) returns the field list; the BE mapper `odd-platform-api/.../mapper/DatasetFieldApiMapper.java:22` declares `uses = {TagMapper.class, ...}`. ⇒ **each field's tags are already in the payload the FE holds in memory.**

## Architectural-significance check (G-C7) — does NOT fire

- No destructive/irreversible migration (no DB change at all).
- No auth/security-posture change.
- No breaking public-API / wire-contract change — **no API change at all**: the feature is a pure client-side aggregate + filter over data already fetched.
- ⇒ **G-C7 does not fire.** `adr_required: no`. (Reuse-scan / ADR-check completed in Phase C below; the in-page client-side filter is an extension of an existing pattern — `useStructure` already filters client-side — not a new architectural pattern warranting an ADR.)

## Phase B — verify the running system (LSN-031), not the diff

For a feature the "reproduce" step is: confirm the current state and confirm the data the feature depends on, **on the running system** — not inferred from code.

- **Running stack:** the idle probe stack `probe-odd-platform` on `:18080` (image `odd-platform:odd-team-sut`, created 2026-06-25T20:39 — the stale 0.29.0 release-review P-001 build, NOT my SUT; used here only for read-understanding). `AUTH_TYPE=DISABLED` (unauthenticated reads succeed).
- **Confirmed — the structure payload carries per-field tags.** `GET http://localhost:18080/api/datasets/2/structure` → `field_list[]` where each field has a **`tags` array** (currently `[]` for the demo seed):
  ```
  GET /api/datasets/2/structure
  field_list: [ {id:6, name:it039_user_id, tags:[]}, {id:7, name:it039_created_at, tags:[]} ]
  ```
  The `tags` key is present in the wire shape (snake_case `field_list`, `tags`). A field that HAS tags serializes them in this array (the mapper maps the list whether empty or not).
- **Confirmed — no tag-filter affordance exists today.** The header renders only the type-count chips + name-search (code `DatasetStructureHeader.tsx`; mockup). The user's red box is empty space.
- **Seeding wrinkle (noted for Phase D, NOT this feature's scope):** `POST /api/tags` works (created `PII` id 72 / `sensitive` id 73 on the throwaway stale stack), but `PUT /api/datasetfields/6/tags {"tag_name_list":[...]}` returned `HTTP 500 SYS001` on this **stale 06-25 build**. This is a stale-build/seed artifact (the image is not current `main` f12b8fbc). Phase D will seed tags on the **fresh working-tree SUT** via the proper path; if the 500 reproduces on current `main`, that is a separate bug → `playbooks/follow-up-on-disk.md`, not part of #1679. (Two throwaway tags were left on the disposable stale demo DB, which is slated for teardown.)

**Phase B conclusion:** a **pure client-side aggregate-and-filter is viable with zero backend change** — the data is already present in the payload the FE holds. Verified against the running system + the contract + the BE mapper + the FE in-memory render path.

## Change-request product analysis (G-C16) — critique the WHAT before the HOW

**Problem restated, independent of the issue's proposed solution:** an operator looking at a wide dataset (the mockup shows 153 columns) cannot quickly narrow the column list to the columns they care about along a *meaning* axis — e.g. "show me the columns flagged sensitive/PII." Today the only in-page narrowing is the name-search; the columns' own tags (and types) are visible only by scrolling/clicking each column. The user's reported workaround — "extract all the data and do these checks outside ODD" — is the exact discovery failure the catalog exists to remove.

**PO / ODD-pattern reasoning (cited):**
- **ODD already ships this exact interaction one level up.** The catalog Overview renders "the most-used tags … as **one-click filter chips**. Selecting a chip pre-filters the catalog to entities carrying that tag" (`documentation/docs/data-discovery/catalog-overview.md:23`; code `components/Overview/TopTagsList/TopTagsList.tsx` — clickable `TagItem` chips sorted by count then importance). The issue asks for the **same mental model, scoped to a dataset's columns**. Conforming to it is the consistent, low-surprise choice.
- **ODD's Search facets are multi-select with per-value counts** (`documentation/docs/data-discovery/search.md:88` — "per-value counts"; Tag is one of seven facets). So *multi-select* tag filtering with *count badges* is already the platform's established filtering grammar.
- **Tag ordering convention:** important tags first, then by name (`DatasetFieldTags.tsx:12-18 compareTags`); count-desc then important (`TopTagsList.tsx:24-34`). The new chips should honour the same ordering.
- odd-sme consultation (competitor norms + semantics): `lineage/odd-platform/sme-consultations/2026-06-26-*tag-filter*.md` (folded into the recommendation below).

**Options (incl. reshape / rescope / revoke):**

| # | Option | User-facing consequence | Verdict |
|---|---|---|---|
| A | **Implement the issue's shape, refined to ODD norms**: a row of clickable tag chips (count badge, important-first) in the header gap; click to filter the column list to columns carrying the tag; **multi-select** (OR within tags); make the existing **type** chips clickable too (the "same for data types" ask); combine with the existing name-search (AND); a clear-all affordance. **Client-side**, zero backend. | Directly solves the reported problem, consistent with ODD's catalog-overview + search grammar. | **RECOMMENDED** |
| B | Tags-only first cut; defer the clickable type-chip filter. | Smaller diff; but the type chips already exist and the same mechanism filters them — deferring leaves an obvious, explicitly-requested affordance half-done. | Possible if the maintainer wants the smallest cut. |
| C | Reshape to a server-side facet panel (like Search). | Heavier (new API params, pagination interplay); over-engineered for data already fully loaded in the Structure view. | Rejected — not warranted. |
| D | Revoke ("won't implement"). | — | Rejected — the request is sound and mission-aligned. |

**Recommendation: Option A.** The issue's WHAT is product-right (it mirrors a pattern ODD already ships); the only refinements are to match ODD's own multi-select + count-badge + important-first grammar, and to honour the explicit "same for data types" ask. No divergence from the issue's intent → no scope-narrowing comment is mandatory (G-C5), but a brief acknowledgement-+-scope comment will be posted after GATE 1 (the issue has sat since 2024 with zero comments).

**Process note (GATE-1 decision for the maintainer):** memory `project_release_1_0_0_features` records that 1.0.0 features are designed via a PRD (`prds/`, e.g. PRD-0001). #1679 predates that process. This contributor plan can serve as the design artifact, or a PRD can be authored first — a maintainer call, surfaced at GATE 1.

## Design-before-build (G-C12)

- **(a) Reuse-scan** — `/retrieve`-equivalent source-read done:
  - **Chip:** reuse `components/shared/elements/TagItem/TagItem.tsx` (already `onClick`/`cursorPointer`/`count`/`important`/`systemTag`) — the same component `TopTagsList` uses. **No new chip component.**
  - **Type chip:** reuse the existing `DatasetStructureTypeCountLabel` / `DatasetStructureTypeCounts`; add a click handler + selected state.
  - **Filter mechanism:** extend the **existing client-side filter** in `useStructure.ts:25-32` (the `filteredDatasetStructureRoot` `useMemo`) — add tag/type predicates alongside the name-search predicate. **No new filtering framework.**
  - **State:** add filter atoms to the existing `lib/atoms.ts` (mirrors `searchQueryAtom`). **No new store.**
  - Extract the tag-aggregation + filter predicate into a small **pure helper** in `lib/` so the unit test targets pure functions (testable, no render).
- **(b) ADR-check** — the draft `adrs/drafts/ui-state-management.md` governs **server-state** fetching (redux-thunk → tanstack-query, deferred). This change is **client-side derived UI state** and conforms to the Structure view's existing Jotai pattern (`lib/atoms.ts` + `useStructure`). No ADR contradicted; **no new ADR warranted** (extending an existing local pattern, not a new architectural decision).
- **(c) Impact-dimension checklist:**
  - **i18n — ALL 7 locales** (`odd-platform-ui/src/locales/translations/{br,ch,en,es,fr,hy,ua}.json`): any new string added to all 7 (will minimise new strings; candidates: a "Clear filters"/empty-filter-result label — reuse existing keys where possible).
  - **Generated BE+FE clients:** none (no API/contract change).
  - **Consumers of changed signatures:** `useStructure` return is consumed only within the Structure view (`DatasetStructureHeader`, `DatasetStructureList`, `DatasetStructureItem`); any `TagItem` addition is an additive optional prop (10+ existing usages unaffected).
  - **Migrations:** none. **Ontology:** `/enrich --touched` the DatasetStructure FE nodes / dataset-structure feature flow (or record "no sidecar describes these FE files + why").
  - **Docs:** `documentation/docs/data-discovery/per-column-annotation.md` (the Structure-tab doc home) gains a short "Filtering columns by tag / type" subsection — routed to the **`release/1.0.0` train** (unreleased behaviour, G-C11), with a paired backlog DOC item.
- **(d) PO/SRE lens:** must-haves for the first cut — per-chip count badge, multi-select, clear-all, combine-with-name-search (AND), empty-result state. Deferred / bounded — nested-struct sub-field filtering (the existing name-search also only filters top-level — parity is the bounded choice); cross-navigation persistence. **odd-sme consult (`lineage/odd-platform/sme-consultations/2026-06-26-dataset-structure-tag-filter.md`, confidence HIGH) corroborates Option A in full** and adds two load-bearing points: (i) **keep it client-side** — a server-side variant would add round-trips onto the already-hot write-on-read `getDataEntityDetails` path (`concepts.yaml:566`); (ii) **reset the filters on revision/version change** as the safe MVP — a new schema revision can drop a tag the active filter references (folded into the plan as behaviour #7). It also confirms: mirror the Search Tag-facet mental model; render **important tags first**; keep external/system tags filterable (don't hide).

## Plan (GATE 1 artifact)

**The change (front-end only, client-side, `odd-platform-ui`):**
1. **State** (`DatasetStructure/.../lib/atoms.ts`): add `selectedTagIdsAtom: number[]` and `selectedFieldTypesAtom: DataSetFieldTypeTypeEnum[]` (empty = no filter).
2. **Pure helpers** (`DatasetStructure/.../lib/`, new `filtering.ts`): `aggregateFieldTags(fields): {tag, count}[]` (distinct tags across the field list, important-first then count-desc) and `applyStructureFilters(fields, {query, tagIds, types})` (name AND tag-OR AND type-OR). Unit-tested.
3. **Filter wiring** (`lib/useStructure.ts`): extend `filteredDatasetStructureRoot` to call `applyStructureFilters` with the new atoms + the existing `searchQuery`; expose the aggregated tag list + the selected-filter setters.
4. **Tag chips** (new small component under `DatasetStructureHeader/`, e.g. `DatasetStructureTagFilters`): render aggregated tags as clickable `TagItem`s (count badge, important-first, selected highlight via `sx`/optional additive `selected` prop, clear affordance) in the header gap between the type counts and the search (`DatasetStructureHeader.tsx:97-104`).
5. **Type chips clickable** (`DatasetStructureTypeCounts.tsx` / `DatasetStructureTypeCountLabel.tsx`): add an `onClick` toggling `selectedFieldTypesAtom` + a selected style. (The "same for the data types" ask.)
6. **Clear-all**: a control to reset all in-page filters (tags + types + search).
7. **Reset-on-revision-change**: clear the active filters when the user switches dataset revision/version (a new revision can drop a tag the filter references — odd-sme MVP guard). Reuses the existing `fetchDataSetStructure`/version-change path in `DatasetStructureHeader.tsx:46-53`.

**Explicit scope EXCLUSIONS (G-C5 — deliberately NOT touched):**
- No backend / API / `openapi.yaml` / DB change. No server-side filtering.
- No change to the per-column tag **write** path (`PUT /api/datasetfields/{id}/tags`) — this feature is read-only over tags. (The documented empty-array-clears caveat in `per-column-annotation.md:80` and the stale-build 500 are out of scope → not this PR.)
- No nested-struct sub-field filtering (parity with the existing top-level name-search; deferred).
- No filter-state persistence across page navigation / URL (deferred nice-to-have). Note: reset-on-revision-change IS in scope (behaviour #7) — only cross-navigation/URL persistence is excluded.
- No change to the `DatasetStructureCompare` (revision-diff) view.

**ADR:** none (see G-C12 b).

**Test plan (BOTH buckets — G-C9):**
- **Unit (odd-platform CI, vitest):** test `aggregateFieldTags` + `applyStructureFilters` pure helpers — given a `DataSetField[]` with mixed tags/types, assert the aggregated chip list (counts, important-first ordering) and the filtered subset for single-tag, multi-tag (OR), type, tag+type (AND across facets), and tag+name-search combinations; empty-result case. New code ⇒ asserts the new behaviour (absent on base).
- **Integration (odd-team `integration-tests/IT-146`, Playwright e2e):** MANDATORY (user-facing, G-C9). Seed a dataset whose columns carry tags **via the stats/ingestion path** (the IT-047-proven `POST .../datasets/stats` with per-field `tags`, anon under DISABLED — NOT the `PUT .../tags` that 500'd on the stale build). Then drive the Structure tab: assert the tag chips render with correct counts; click a tag chip → the column list narrows to matching columns (assert the visible rows from a CAPTURED real DOM/response shape, per LSN-031/CTRIB-023); click a type chip → narrows by type; clear → full list returns. Author `IT-146-dataset-structure-tag-filter.md` per `integration-tests/TEMPLATE.md` (`validates:` the dataset-structure feature), `automation: e2e:dataset-structure-tag-filter.spec.ts`.
- **Regression:** full unit build + the FULL integration regression on the working-tree SUT (`run-regression.sh ctrib038`), RED-proof via `ODD_SUT=ref:main`.

**Docs (G-C10):** update `documentation/docs/data-discovery/per-column-annotation.md` with a short "Filtering columns by tag and type on the Structure tab" subsection → **`release/1.0.0` train** (G-C11; create the branch from origin/main if absent, same-name push — LSN-034) + a paired backlog DOC item (`milestone: 1.0.0`, post-merge URL). `docs_routing: release/1.0.0`.

**Ontology (G-C10):** `/enrich --touched` the DatasetStructure FE sidecars / the dataset-structure feature flow in `lineage/odd-platform/`; commit + re-embed. If no sidecar describes these FE files, record "no ontology node touched + why."

**Issue-thread comment — POSTED 2026-06-26** by `odd-contributor[bot]` (acknowledgement + scope; not a narrowing — the PR covers the full ask): [issuecomment-4812827590](https://github.com/opendatadiscovery/odd-platform/issues/1679#issuecomment-4812827590).

**GATE 1: APPROVED 2026-06-26** (human via AskUserQuestion) — Option A (full plan: tags + types, client-side, multi-select, count badges, clear-all, reset-on-revision) + "this plan is the design" (no separate PRD). Implementation may proceed (Phase D).

## Phase D — implementation + DoD ledger

**Branch:** `contrib/CTRIB-038-dataset-structure-tag-filter` in worktree `../odd-platform-ctrib038` (off `f12b8fbc`; push-safe — no `origin/main` upstream, `push.default=current`). FE commit **`b9c13823`** (not yet pushed — Phase E).

**Files (FE only — `odd-platform-ui`):** new `lib/filtering.ts` (pure `aggregateFieldTags` + `applyStructureFilters` + `hasActiveFilters`) + `lib/filtering.test.ts`; new `DatasetStructureTagFilters/DatasetStructureTagFilters.tsx`; modified `lib/atoms.ts` (2 filter atoms), `lib/useStructure.ts` (filter wiring + toggles + clear + availableTags), `DatasetStructureHeader.tsx` (tag-filter zone + Clear-All + reset-on-revision), `DatasetStructureTypeCounts.tsx` + `…TypeCountLabel.tsx` + `…Styles.ts` (clickable + selected + `data-qa`), `DatasetStructureList.tsx` (empty-result state), shared `TagItem.tsx` + `TagItemStyles.ts` (additive optional `selected` prop). No backend / API / migration / generated-client change.

**Unit bucket (odd-platform CI / vitest) — GREEN.**
- `lib/filtering.test.ts` — **14/14 PASS** (node 24.13.0, gradle-pinned). Covers tag aggregation (counts + important-first/count-desc/name ordering), single/multi-tag (OR), type, tag×type (AND), tag×search (AND), empty-result, identity-when-no-filter, no-mutation.
- `tsc --noEmit` whole-project — **clean** (caught + fixed one wrong enum-key in the test before commit). `eslint` touched files — **clean** (0 errors); `prettier --write` applied.
- i18n: **zero new strings** — reused the existing `t('Clear All')` + `t('No results')` keys (present in all 7 locales: br/ch/en/es/fr/hy/ua), so the `i18n-key-parity` guard stays satisfied. A PRE-EXISTING parity-guard failure (`Terms/.../LinkedTermsList.tsx:63 'Unknown Error'`, on `main`, not mine) was logged as an addendum to **PLT-205** (the whole-class i18n tracker) — out of scope for this PR.

**Integration bucket (odd-team `integration-tests/IT-146`).**
- Authored: `protocols/IT-146-dataset-structure-tag-filter.md` + `e2e/specs/dataset-structure-tag-filter.spec.ts` (seeds tagged columns via the IT-047-proven stats-ingestion path; drives the Structure tab; asserts chips render with counts, tag-click filters, type-click filters, Clear-All resets). Registered in `suites.yaml` (feature-complete + ui-e2e).
- **RED proof:** RED on `ref:main` is by construction — the tag-filter chips, the clickable type chips, and the `data-qa` hooks the spec locates do not exist on `main`, so the spec cannot pass without this change. (A clean `ODD_SUT=ref:main` run is the formal artifact — pending; see "remaining".)
- **GREEN + regression (RAN — branch SUT `odd-platform:odd-team-sut-ctrib038`, digest 492212ce9bcf):** `run-regression.sh ctrib038 feature-complete known-bugs` (2026-06-26, run-logs `2026-06-26-{feature-complete,known-bugs}.md`):
  - **feature-complete: 317 passed / 2 failed (7.5m).** The 317 GREEN (the whole odd-minimal UI + API surface, incl. every other `TagItem` consumer) proves the shared-component change broke nothing. The 2 fails: (1) **IT-146 itself — a TEST selector bug, not a feature bug** (`getByText('it146_email', exact)` hit strict-mode: it matched both the list row `<h4>` AND the auto-selected field's detail-panel `<h1>`; the feature rendered + filtered correctly). FIXED by scoping the column assertions to level-4 headings (`getByRole('heading', { level: 4, … })`) — re-run in progress against the cached SUT. (2) **`owner-association-history.spec.ts:129` (IT-109) — a known pre-existing flake** (TST-054 family; references no `TagItem` / `DatasetStructure`, zero code overlap; it PASSED in today's 0.29.0 release-review feature-complete run). Not caused by this change.
  - **known-bugs: 3 RED (IT-004/006/007), 0 unexpected GREEN** — exactly as expected (the quarantined unfixed-bug pins).
  - **multi-stack + ingestion-e2e deliberately skipped** — FE-only change (DatasetStructure UI + shared TagItem), orthogonal to the auth-stack + collector-pipeline suites; maintainer FE-only-skip precedent set for CTRIB-031.

- **Parallel-stream coordination (ctrib039).** A co-active contributor stream **ctrib039** (CTRIB-039 favorites-write-API) started its own heavy regression at 22:22 (during this run's Phase D) — it holds the heavy-e2e flock (live pid) and is actively writing `lineage/` (its own IT-002→P-001 probe). Therefore the remaining heavy/lineage gates wait for its flock window (concurrent heavy e2e → contention flakes, LSN/CTRIB-030). The IT-146 GREEN re-run is a *cheap* isolated 1-spec run on ports 18160/15512 (clear of ctrib039's 18100/15500), allowed to parallelise. (Process note: while reconciling I briefly removed ctrib039's `state/locks/heavy-e2e.holder` marker mistaking it for my own stale one; restored immediately — the OS flock was never released, ctrib039's lock held throughout. An O10 slip, caught + corrected by verify-live.)

**Docs (G-C10) — DECIDED + routed.** Page **read**: `documentation/docs/data-discovery/per-column-annotation.md` (the Structure-tab doc home). It documents the columns table + per-column editors but not column-list navigation. Decision: add a "Filtering the column list" section. Routing: **`release/1.0.0` train** (unreleased behaviour, G-C11). The 1.0.0 train branch is **not yet cut** (1.0.0 due 2026-07-31), and cutting a release train is maintainer release-planning (cf. the G-C11 milestone gate) — so the complete drafted content + placement is carried in the paired backlog item **DOC-492** (`milestone: 1.0.0`, `status: pending-release`, post-merge URL), which the 1.0.0 release gate authors onto the train. `docs_routing: release/1.0.0`.

**Ontology (G-C10) — no refresh warranted + why.** The change is FE-presentation only (a client-side filter over already-loaded data) — it adds no BE concept / entity / operation / edge. The ontology's structure coverage is back-end (`DataSetController`, `DatasetFieldController`, the structure feature flow) — all unchanged; there is no DatasetStructure-FE-component sidecar, and the high-level `DataEntityDetails` component sidecar describes page composition (tabs), which this change does not alter. So `/enrich --touched` has no node to refresh. (Incidental note: running feature-complete drives IT-002's `automation: P-001` api-probe through the probe-runtime, which writes incidental measurement drift into `lineage/` — reverted post-regression per the reviewer convention; never committed as an intentional refresh.)

**Principal sufficiency (G-C13).** Enough + meaningful tests: 14 unit cases exercise every facet + combination of the pure filter logic (the only non-trivial logic); IT-146 drives the user-observable surface. No control lost — reused `TagItem` + the existing `useStructure` filter; no parallel component; the one shared-component change is an additive optional prop. Patch-coverage: odd-platform's 98% jacoco gate is **Java-only** (the change is FE; the FE has no coverage gate wired — PLT-215/205), and the extracted pure helpers are fully unit-covered. No existing functionality harmed (the FULL feature-complete regression is the measurement).

**IT-146 re-run finding (verify-the-running-system caught two things before handoff):** the cached-SUT re-run with the selector fix verified the feature **WORKS** — the baseline + ALL tag-filter steps passed (the tag chips render with counts, a tag click filters the column list, Clear-All resets). It then exposed a **layout regression I introduced**: the `flex:1` tag-filter zone squeezed the type-count chips on the `nowrap` header row, so `TruncateMarkup` hid the `Dec` chip behind "Show 1 hidden" (the e2e + the DOM snapshot both showed it). **FIXED** by moving the tag filters to their **own wrapping row** below the header — header row 1 reverts to its original, un-squeezed layout (type chips fully visible + clickable), tag chips get a full-width wrapping row (also better for many tags). Branch amended `b9c13823 → c37ca11b` (tsc + eslint clean). Also fixed the spec's selector (`getByText` → `getByRole('heading', { level: 4 })`, scoping to list rows not the auto-selected field's `<h1>` detail header).

**DoD status (ctrib039 freed its window at 22:40; box uncontended):**
1. ✅ **feature-complete GREEN on the branch SUT** — rebuilt @ c37ca11b (digest `879ad194`, run #3): **318 passed / 1 failed**, the 1 = IT-146 itself (now fixed, below); every other UI spec incl. all `TagItem` consumers GREEN. The `owner-association-history` fail seen in run #1 was a confirmed pre-existing flake (passed in run #3). **known-bugs 3-RED-expected, 0 unexpected-green** (run #1; zero code overlap with this FE change).
2. ✅ **IT-146 GREEN on the branch SUT** (`879ad194`, c37ca11b) — `1 passed (3.0s)`. The run-#3 IT-146 failure was the type chips collapsing behind "Show N hidden" on a narrow header (pre-existing `TruncateMarkup` viewport behaviour); fixed in the spec (expand the collapsed chips first) — a **spec-only** fix, re-run against the same cached SUT, GREEN. (This also empirically confirmed the `styled(Box)` `data-qa` renders — the collapse was the only issue.)
3. ✅ **RED proof — CONFIRMED (formal run + structural).** `ODD_SUT=ref:main` SUT built from `main @ f12b8fbc` (digest `eebb93b0`); IT-146 ran **RED**: `1 failed (8.5s)` at **line 120** — `expect(piiChip).toBeVisible()` failed, `[data-qa="dataset-structure-tag-filter"]` matched nothing. The baseline (columns render) PASSED; only the **feature** assertion failed → the test catches the feature's absence, it is not a tautology (GREEN on the branch / RED on main). Corroborated structurally: `git show origin/main` → no `DatasetStructureTagFilters`, 0 filter atoms, 0 `data-qa` hooks.
4. 🔀 **`lineage/` probe drift LEFT in place** (not reverted) — it is shared/incidental from both my and ctrib039's IT-002→P-001 probes; ctrib039's session may still be active (its entry is non-terminal), so per O10 I route around it. My G-C10 decision is "no ontology refresh" (FE-presentation only), and all my commits are explicit-path — they never sweep the drift.
5. ✅ **Branch pushed + DRAFT PR open.** Branch `contrib/CTRIB-038-dataset-structure-tag-filter` @ c37ca11b pushed via the `odd-contributor` App (same-name refspec, token not persisted; `main` untouched, O6/LSN-038). **DRAFT PR [#1818](https://github.com/opendatadiscovery/odd-platform/pull/1818)** (`draft: true`, author `odd-contributor[bot]`, `Closes #1679`, `Milestone: 1.0.0`). The bot is the PR author → it cannot self-approve → GATE 2 is human-enforced (G-C4).

## Phase E — draft PR + handoff (GATE 2)

- **GitHub interactions (all via `odd-contributor[bot]`):** acknowledgement+scope comment [issuecomment-4812827590](https://github.com/opendatadiscovery/odd-platform/issues/1679#issuecomment-4812827590) · branch `contrib/CTRIB-038-dataset-structure-tag-filter` @ c37ca11b · DRAFT PR [#1818](https://github.com/opendatadiscovery/odd-platform/pull/1818).
- **Status: `pr-draft`.** Per the contributor model the implementer does NOT self-flip `review-ready` (the `/implement`-can't-self-`done` rule). **Next: a separate `/review` session** runs reject-by-default over the 10 Quality-Bar gates + the contributor gates (it can re-run the IT-146 GREEN + RED in ~2 min against the cached SUTs), flips `pr-draft → review-ready`, then the **human GATE 2** approves + merges PR #1818.
- **DoD (all five, actually-run, at the committed SHA c37ca11b):** (1) FE unit GREEN — `filtering.test.ts` 14/14 + `tsc --noEmit` + `eslint` clean (the odd-platform-api Java unit build is **not exercised** by this FE-only change — zero Java touched — and both jib SUT builds compiled the full image incl. Java successfully; the 98% jacoco patch-coverage gate has no changed Java files → N/A). (2) Integration GREEN — IT-146 on the branch SUT (`879ad194`) + feature-complete 318-pass + known-bugs 3-RED-expected; RED proof on `ref:main` (`eebb93b0`) confirmed. (3) Docs read + routed (DOC-492, release/1.0.0). (4) Ontology — no refresh warranted (recorded). (5) Principal sufficiency — meaningful unit + e2e coverage, no control lost (reused `TagItem` + `useStructure`), no existing functionality harmed (feature-complete GREEN); a UI change reviewed via the e2e + the captured failure screenshots during debugging.
- **Follow-ups logged on disk:** PLT-205 addendum (pre-existing i18n parity-guard RED on `main`, not this change). Confirmed flake: `owner-association-history` (TST-054 family) passed on re-run.
- **Parallel-stream hygiene:** all my stacks/images torn down (ctrib038 SUT image `879ad194` kept for `/review`'s cheap re-run; ctrib038base RED-proof image removed). The `lineage/` probe drift is left in place (shared/incidental; ctrib039's territory; my commits are explicit-path). ctrib039 freed the heavy-e2e flock at 22:40; it is free now.

## Review (2026-06-27, session: review-ctrib038)

- **Result**: ACCEPTED → `pr-draft` → `review-ready`. Human GATE 2 (approve + merge PR #1818) owns `merged`.
- **Reviewed commit**: `c37ca11b` (== live DRAFT PR #1818 head, verified via GitHub API: `state=open`, `draft=true`, `merged=false`, author `odd-contributor[bot]`, base `main`, body `Closes #1679`). Tested code == PR code.
- **Live reconcile (trust the tree, O4/O8/O9)**: `origin/main` advanced `f12b8fbc → 577593ae` since the Phase-E record — the **legitimate merge of CTRIB-039 PR #1817** (favorites BE foundation), NOT unreviewed code (the record's "remote main still f12b8fbc" was stale). CTRIB-038 forked at `f12b8fbc` (1 commit behind); the favorites merge touched only `odd-platform-api/**` + `odd-platform-specification/**` → **zero overlap** with CTRIB-038's FE files → the GATE-2 rebase onto current main is clean.
- **2-minute precondition**: did NOT bounce — an integration run-log exists at the reviewed SHA's build (`879ad194` ← `c37ca11b`): IT-146 GREEN + the base RED recorded. (Gap found + closed below: the implementer's feature-complete green was *inferred* across runs, never one coherent measured green run — this review provides it.)

- **Acceptance criteria (PROBES 1–17)**:
  - [x] 1 code-after-plan — GATE 1 approved 2026-06-26 before Phase D — PASS
  - [x] 2 reproduction logged — Phase B running-system confirmation (`DataSetField.tags` in the structure payload) — PASS
  - [x] 3 diff bounded by the plan — exactly 12 FE files; all 5 scope-exclusions honored (no BE/API/openapi/migration; no tag-write path; no nested-struct; no URL persistence; no Compare view) — PASS
  - [x] 4 unit injects the new behaviour — `filtering.test.ts` 14/14, asserts new pure logic absent on base — PASS
  - [x] 5 pins re-grounded — N/A (no characterization pin touched)
  - [x] 6 docs decision stated + routed — DOC-492, page READ, `release/1.0.0` train (G-C11) — PASS
  - [x] 7 ontology committed-or-justified — "no refresh" + why (FE-presentation only; no FE sidecar) — PASS
  - [x] 8 ends `review-ready`, not self-`done`/`merged` — PASS
  - [x] 9 ADR before code — N/A (G-C7 does not fire; verified zero BE/openapi/migration in the diff)
  - [x] 10 prompt-injection discarded — issue body is legitimate; treated as quoted data — PASS
  - [x] 11 Definition of Done met (full unit + FULL integration on the branch image + docs + ontology) — PASS (reviewer's own measured run below)
  - [x] 12 milestone train — issue #1679 milestone `1.0.0` open+semver; unreleased-behaviour doc on the 1.0.0 train — PASS
  - [x] 13 design-before-build — reuse-scan (TagItem/useStructure) + ADR-check + impact checklist (i18n all-7-locales) + PO/SRE lens — PASS
  - [x] 14 principal sufficiency — enough+meaningful tests; FE has no jacoco gate (Java-only); no control lost; no functionality harmed (319-green) — PASS
  - [x] 15 private-advisory — N/A (public feature issue, not a GHSA)
  - [x] 16 test-change integrity — N/A (all tests net-new; suites.yaml additive; no existing test changed)
  - [x] 17 change-request product analysis — issue WHAT product-critiqued (options A–D incl. reshape/rescope/revoke); recommended A; **precedent VERIFIED** (`catalog-overview.md:23` ships the same one-click tag-filter chip pattern) — PASS

- **Quality Bar / contributor gates**:
  - **G-C1 reproduce-first** — PASS (feature → Phase B running-system + data-availability confirmation; corroborated by the BE mapper read below)
  - **Gate 1 no-duplicates** — PASS (reuses shared `TagItem` as `TopTagsList` does — verified `TopTagsList.tsx:39` uses `<TagItem onClick label important count cursorPointer>`; new filtering logic is not a parallel copy)
  - **Gate 4 / 9 consumer-read + provenance** — PASS via read: footer's `DataSetField.ts` (`tags?: Array<Tag>` l.154, `type: DataSetFieldType` l.100→`.type` enum, `internalName?` l.94 — so `field.type.type` is correct), `DatasetFieldApiMapper.java:22` (`uses = {TagMapper.class,…}` → BE populates field tags), `useStructure.ts` (the existing client-side search filter, the extension point), `TopTagsList.tsx` (the reused pattern). i18n parity: `Clear All` + `No results` present in **all 7 locales**; **zero** locale files in the diff.
  - **G-C5 bounded scope** — PASS (three-dot diff = the 12 planned FE files, +469/−83; no scope creep)
  - **G-C7 / Gate 5 (SDK/unset-param)** — N/A (no SDK builder; no API/contract/migration change at all)
  - **G-C9 both buckets** — PASS (unit `filtering.test.ts` 14/14 traced by hand: aggregation counts, important→count-desc→name ordering, single/multi-tag OR, type, tag×type AND, tag×search AND, identity-by-reference, no-mutation, empty-result; integration IT-146 user-facing → mandatory, present, real-boundary)
  - **G-C10 ontology+docs** — PASS (docs DOC-492 routed+read; ontology "no refresh" honest — grep confirms no sidecar's subject is DatasetStructure/TagItem/useStructure; the working-tree `getDataEntityDetails`/`getPopular`/`feature-flows`/`P-001` drift is incidental IT-002 probe residue, reverted)
  - **G-C11 milestone** — PASS (issue carries `1.0.0` open+semver). Non-blocking: the PR-object milestone is null (the `Milestone: 1.0.0` body line + the issue milestone satisfy G-C11; setting the PR milestone is cosmetic).
  - **G-C12 design-before-build** — PASS (reuse-scan honest; conforms to the existing Jotai client-side-filter pattern, no new ADR; impact checklist complete)
  - **G-C13 principal sufficiency** — PASS (the only non-trivial logic — the pure filter — is exhaustively unit-covered; the user surface is e2e-covered; `TagItem` gains an additive optional `selected` prop, no existing caller affected — verified the styled `$selected` path resolves real theme keys: `backgrounds.secondary` l.96, `tag.{main,important}.{normal,hover}.border`)
  - **G-C15 test-change integrity** — N/A (all tests ADDED; `git show 2ab966f` = new `filtering.test.ts` + new `IT-146` spec/protocol + additive `suites.yaml`; no assertion weakened, nothing skipped/deleted)
  - **G-C16 product analysis** — PASS (premise critiqued independent of the issue's suggested fix; SME/PO consulted; the issue's ask is product-right and mirrors a shipped ODD pattern)
  - **Gate 8 publishing** — N/A-for-code now (PR is `draft`, not merged → no live odd-platform surface to verify). The behaviour doc (DOC-492) is release-gated → **PENDING-RELEASE** on the `1.0.0` train; its live-site Gate 8 runs at the 1.0.0 release gate (`playbooks/release-train-merge.md`).
  - **Gate 10 content-homing** — PASS (DOC-492 targets the canonical Structure-tab home `per-column-annotation.md`, placed after "Where to find it")
  - **Gate 11 audience isolation** — PASS (DOC-492's published-facing markdown is operator language only — "Structure tab", "filter chips", "tag facet", "Clear All"; zero workspace-internal terms)

- **RED proof (RED→GREEN discriminator)** — CONFIRMED, *stronger* than the implementer's: on **current** `origin/main` (`577593ae`) the `DatasetStructureTagFilters` dir, `lib/filtering.ts`, and **both** `data-qa` locator hooks (`dataset-structure-{tag,type}-filter`) are **absent (0)** → IT-146's locators match nothing → RED by construction on current main, not only the `f12b8fbc` base the implementer tested. Corroborated by the recorded formal run (base `eebb93b0` → IT-146 FAIL) + this review's GREEN on the fix.

- **Regression — reviewer's OWN measured run (MEASURED, not inferred)**: independent rebuild `ODD_SUT=working` ← the clean `c37ca11b` worktree → `odd-platform:odd-team-sut-revctrib038` digest **`27402798`** (NOT the implementer's cached `879ad194` — the review-ctrib029 lesson), isolated namespace `revctrib038` (ports 18100/15500), heavy-e2e flock-serialized, torn down `-v`:
  - **feature-complete: 319 passed (5.7m) + api-probe P-001 PASS = FULLY GREEN** — IT-146 (`dataset-structure-tag-filter`) GREEN, plus every other `TagItem` consumer + the Structure-tab specs (IT-023 display, IT-039 ingest) GREEN → the shared-component change broke nothing. This is the single coherent green run the implementer only *inferred* (317-ex-IT-146 + IT-146-in-isolation).
  - **known-bugs: 3 failed = the 3 EXPECTED-RED pins** (IT-004 PLT-052 · IT-006 TEST-GAP-1013 · IT-007 LSN-001/PLT-086), **0 unexpected GREEN** → no un-flipped fix.
  - **multi-stack + ingestion-e2e**: reviewer-accepted **FE-only skip** — the change touches zero auth/storage/notification/collector code; the Structure tab + all `TagItem` consumers are already exercised GREEN in feature-complete; matches the maintainer-approved CTRIB-031 FE-only-skip precedent.
- **Unit (FE)**: `filtering.test.ts` 14/14 + project `tsc --noEmit` + `eslint` clean (per the ledger; the odd-platform-api Java unit build is genuinely not exercised — zero Java touched; the 98% jacoco patch-coverage gate has no changed Java files → N/A).
- **Outbound URL sweep**: the only live URL in scope is `catalog-overview.md:23` (the DOC-492 cross-link + G-C16 precedent) — VERIFIED via `git show origin/main` (the "one-click filter chips … pre-filters the catalog" claim is present and accurate).
- **Banned-phrase check**: none used.
- **Regressions**: none (319-green; the 3 known-bugs RED are the expected quarantine).
- **Navigation**: consistent — no `navigation/domains/*.md` pointer shifted (FE-only client-side change; no new bean factory / SDK builder / endpoint).
- **Upstream issues logged**: none.
- **Doc-product editorial findings** (audit ran per `playbooks/doc-product-editorial-read.md`):
  - **Coverage this run**: the `data-discovery/**` change-cluster read end-to-end against `origin/main` — `per-column-annotation.md` (the DOC-492 home), `catalog-overview.md` (the tag-filter precedent). Full-tree baseline 2026-06-08 (DOC-336..439); recent reviews partitioned per subtree; the `integrations/**` + `configuration-and-deployment/**` subtrees remain queued for a future `/review`.
  - **Findings**: none surfaced this run. The cluster is coherent; `per-column-annotation.md` is the correct home for the incoming "Filtering the column list" section (after "Where to find it"); the existing empty-array-clears tag-write caveat (`:80`) the CTRIB-038 scope-exclusion references is accurate; the precedent claim is verbatim-correct.
- **Non-blocking GATE-2 handoffs (human merge)**:
  1. **Rebase** `c37ca11b` onto current `origin/main` (`577593ae`) before merge — trivial (zero file overlap with the merged #1817 favorites slice).
  2. **PR milestone** is null — optionally set it to `1.0.0` (cosmetic; the issue milestone + body line satisfy G-C11).
  3. **Run-log hygiene (implementer)**: the 2026-06-26 run-logs left the runner/evidence placeholders unfilled, and the `879ad194` feature-complete entry recorded `e2e:FAIL` (the pre-spec-fix run) with no corrected green entry — this review's clean 319-green measurement on `27402798` supersedes it. Evidence-hygiene only; the code is correct.
  4. **DOC-492** stays `pending-release` on the 1.0.0 train; its live-site Gate 8 runs at the 1.0.0 release gate.
- **Notes**: All gates PASS with cited evidence. The fix is well-architected (pure, immutable filtering logic; honest reuse of `TagItem`/`useStructure`; additive shared-component prop), exhaustively tested both buckets, correctly scoped, correctly routed (docs + ontology), and regression-clean on an independent rebuild — VERIFIED via read + GitHub API + own measured 319-green regression + structural RED proof. Review committed exactly: this verdict + `state/active-streams.yaml` + `state/PROGRESS.md` (explicit paths). `lineage/**` probe drift reverted to HEAD; reviewer run-logs left untracked.
