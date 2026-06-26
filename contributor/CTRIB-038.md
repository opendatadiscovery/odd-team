---
ctrib: CTRIB-038
github_issue_number: 1679
issue_url: https://github.com/opendatadiscovery/odd-platform/issues/1679
class: feature
milestone: "1.0.0"          # G-C11 PASS — open + semver, due 2026-07-31
status: plan-approved       # GATE 1 PASSED 2026-06-26 — full plan + "this plan is the design" (no PRD)
reproduced: "Phase B — running-system understanding captured below (feature, not bug: confirmed current state + data availability)"
adr_required: no            # G-C7 does NOT fire; see "Architectural-significance check"
plan_approved_by: "maintainer (Raman) — GATE 1 via AskUserQuestion, 2026-06-26"
plan_approved_at: "2026-06-26"
docs_routing: "release/1.0.0"   # per-column-annotation.md subsection; unreleased behaviour rides the 1.0.0 train (G-C11)
pr_url:
pr_draft:
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
