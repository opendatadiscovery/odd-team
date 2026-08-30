---
ctrib: CTRIB-042
github_issue_number: 1816
github_issue_url: https://github.com/opendatadiscovery/odd-platform/issues/1816
title: "Recently Viewed — recency as a dedicated list column (DE / Terms / Query Examples)"
class: feature-followup
milestone: "1.0.0"
status: pending-release   # list-column MERGED (#1828 @ df70e7a0); all gates PASS. The detail-marker UX defect was split out as CTRIB-043 (also merged, #1829) — it was not a defect in this item's deliverable. | LEDGER-RECONCILED 2026-08-30: was `done`; PR #1828 (`df70e7a0`) merged, but NOT released — milestone 1.0.0, which is OPEN/UNRELEASED (latest release 0.29.0, 2026-06-26). GATE 2 is done; `/review release:1.0.0` owns the flip to `done`.
reproduced: "UX defect on the merged S2 (#1827): the list-surface recency marker is inline in the DE name cell (truncates the name) + only on Data Entities"
adr_required: false         # presentation refactor; conforms to the shipped RV foundation
tracking: "maintainer-directed follow-up to #1816 (CTRIB-040 precedent); no new GitHub issue; PR refs #1816"
plan_approved_by: "RamanDamayeu (maintainer) — GATE-1 AskUserQuestion 2026-06-29"
plan_approved_at: "2026-06-29"
docs_routing: "release/1.0.0 (DOC-494 update @ 7cb1773)"
pr_url: "#1828 (DRAFT, follow-up to #1816)"
pr_draft: true
stream: ctrib042
started: "2026-06-29"
---

# CTRIB-042 — Recently Viewed: recency as a dedicated list column (#1816 follow-up)

## Maintainer feedback (the defect)

After merging S2 (#1827), the maintainer flagged the **list-surface** recency marker as "weird and
inconsistent": it is rendered **inline next to the favorite star in the Data-Entity search row, which
truncates the name**, and it is **only on the Data-Entity list** (not Terms, not Query Examples). The
ask: make it **a separate field/column in the table**, on **all three** list surfaces, and (later) allow
**sorting by recently-viewed**. (The detail-header marker is fine — only the list placement is the defect.)

This is owned as my S2 miss: a per-asset marker on a list table belongs in the table's own column system,
consistent across kinds — not crammed inline. (Memory: `feedback_reuse_platform_ui_patterns`.)

## GATE 1 — APPROVED (2026-06-29)

- **Tracking:** maintainer-directed, no new issue (CTRIB-040 precedent); the PR refs #1816 (1.0.0).
- **Column position:** trailing, by Created/Updated.

## Design-before-build (the three list surfaces)

All three are column tables; the cell **reuses the existing `RecentlyViewedTag`** (shows "Viewed {when}"
+ remove when the asset is in the user's history, else nothing) — no new component:

- **Data Entity search** (`Search/Results`): a proportional 12-col grid (`gridSizes`, 9 tab-variants ×
  lg/md) + `TableHeader` + `ResultItem` cells. Added an `rv` column carved from the **namespace/owner/group**
  widths (nd/ow/gr) in every variant — the **Name column (nm) keeps its full 2.68 width** and gains room now
  the inline marker is gone (the whole point). Removed the inline tag from the name cell; updated the skeleton.
- **Terms (Dictionary)** (`TermSearchResults` + `TermSearchResultItem`): flex columns (`$colType`) — added a
  `colsm` "Recently viewed" header + cell; the flex redistributes (no manual rebalance).
- **Query Examples** (`QueryExamplesListHeader` + `QueryExamplesListItem`): flex `Table.Cell`s. The item +
  header are **shared with the linked-QE tables** (term/dataset details), so the column is gated to the
  **standalone** list (`showRecentlyViewed` on the header, the existing `showFavorite` on the item) — the
  linked tables are untouched.
- i18n: a "Recently viewed" column header in all 7 locales (the tag strings already shipped in S2).
- **Sort by recency:** deferred (a later enhancement; needs a backend sort key on the search/list APIs). The
  column is its foundation. The #1825 Search overhaul will consolidate these three surfaces into one
  configurable column system — this fixes the three current surfaces in the interim.

## Implementation

Branch `contrib/CTRIB-042-recently-viewed-list-column` @ `0e5cc70c` (off merged main 3cbb3b85; same-name,
never main). Worktree `../odd-platform-ctrib041` (reused; ctrib041 PRs merged). 16 FE files (the 9
components/styles + 7 locales). The RecentlyViewedTag component is unchanged.

## Test ledger (DoD)

- **Unit FE:** `tsc --noEmit` GREEN · `eslint` GREEN (after prettier). The `recentlyViewed` slice test is
  unchanged (still green); the changed files are presentation (type-covered by tsc; behaviour by IT-149).
- **Integration / IT-149 (extended):** added a second test — *the list surface shows recency as a dedicated
  column, not inline*: seed a searchable entity, open it (record), then on `/search` assert the **"Recently
  viewed" column header** + the entity row's **recency marker** (`data-qa=recently-viewed-tag`). RED on
  `ref:main` (3cbb3b85 — the S2 inline placement, no column) by construction; GREEN on this fix. Pixel
  screenshot captured (`it149-recency-list-column.png`).
- **Full e2e regression** (`run-regression.sh ctrib042`, SUT from worktree @ 0e5cc70c): GREEN-FOR-CHANGE.
  feature-complete **325 pass / 1 fail** — IT-149 BOTH tests GREEN (test 264 the open->see loop; test 265 the
  new list-column "recency in a dedicated column, not inline"); the 1 fail = the unchanged co-stream Group-B
  Description test (not mine). The rebalanced DE search table + the Term/QE lists regressed nothing:
  catalog-search, term-search, query-examples-crud-search, search-class-tab-filter, search-result-row-click
  all GREEN (the CTRIB-004 shared-surface guard). known-bugs 3-RED-expected/0-unexpected-green; multi-stack 9;
  ingestion-e2e 15.
- **RED proof — run-confirmed:** IT-149 on `ODD_SUT=ref:main` (3cbb3b85) → **1 passed / 1 failed**: test 1
  (open->see loop) PASSED (S2's panel/detail/remove are on main); test 2 (the list-column) **FAILED** —
  `getByText('Recently viewed')` (the column header) not found, because on the merged-S2 base the marker is
  inline with no column. So the new test is RED on base, GREEN on the fix (regression test 265) — it
  discriminates the column, not neutered.

## Docs (G-C10)

DOC-494 updated: `documentation@release/1.0.0` @ `7cb1773` — `recently-viewed.md` "last viewed marker"
section now describes the dedicated **Recently viewed column** across the three list surfaces (name keeps
full width). Publishes at the 1.0.0 release gate.

## Ontology (G-C10)

No refresh — presentation-only change (no new/changed backend node); same deferral basis as S2.

## Status

`implementing` → (regression + RED proof) → DRAFT PR (refs #1816) → `/review` (separate session) → GATE 2.

## Review (2026-06-29, session: review-ctrib042)

- **Result**: the list-column change **PASSES every gate** on independent verification. The ITEM is flipped
  to **`blocked`** per the maintainer's 2026-06-29 directive — a maintainer-found UX defect on the
  **detail-page** recency marker (below) blocks the Recently-Viewed feature from reaching `done`. The fix
  ships this session as **[[CTRIB-043]]** (`contributor/CTRIB-043.md`).
- **POST-MERGE**: PR #1828 was already squash-merged to `origin/main` as **df70e7a0** (author
  `odd-contributor[bot]`, parent 3cbb3b85). `git diff 0e5cc70c df70e7a0` is EMPTY → the reviewed branch is
  byte-identical to merged main. All gates run in full; any defect is fix-forward.

- **Acceptance criteria**:
  - [x] Dedicated "Recently viewed" column on the Data Entity search list — PASS (`ResultItem.tsx:245-251` new `rv` `SearchCol`; inline tag removed from the name cell; `TableHeader.tsx` `rv` header; `SearchResultsSkeleton` matched) — verified via diff + IT-149 spec 265 GREEN on my rebuild.
  - [x] Same column on the Terms (Dictionary) list — PASS (`TermSearchResults.tsx` header + `TermSearchResultItem.tsx` `colsm` cell).
  - [x] Same column on the standalone Query Examples list; linked QE tables untouched — PASS (`QueryExamplesListHeader.showRecentlyViewed` + `QueryExamplesListItem.showFavorite` gating; `QueryExamplesList.tsx` passes BOTH; `TermQueryExamples`/`DataEntityDetailsQueryExamples` pass NEITHER → never desyncs).
  - [x] The asset name keeps full width — PASS (`gridSizes` `nm=2.68` unchanged in **all 12 variants**; `rv:1.0` carved from `nd(-0.40)/ow(-0.30)/gr(-0.30)`; every variant column-sum preserved exactly).
  - [x] i18n all 7 locales — PASS (each locale +1 `"Recently viewed"` key, real translations, not en-fallbacks).
  - [x] RED→GREEN integration test — PASS (IT-149 test 2 GREEN on the fix [my run, spec 265]; RED on 3cbb3b85 per the implementer run-log + by-inspection — the column header cannot render on the inline-marker base).

- **Quality Bar / contributor gates**:
  - Gate 1 — PASS (reuses `RecentlyViewedTag`; no parallel component) via diff.
  - Gate 4 — PASS (`Consumer-read:` footer files match the diff) via read.
  - Gate 6 — PASS (DOC-494 reflects the column) via `git show`.
  - Gate 7 — PASS (`recently-viewed.md` in `docs/SUMMARY.md:17`; the 3 doc-link targets exist on the train) via `git cat-file`.
  - Gate 8 — **PENDING-RELEASE (1.0.0)**: DOC-494 `7cb1773` is an ancestor of `origin/release/1.0.0` (authored on the train, not a backlog draft — the review-ctrib040 failure mode avoided). Post-merge live check at the 1.0.0 gate — URL `https://docs.opendatadiscovery.org/data-discovery/recently-viewed`, phrase "dedicated **Recently viewed** column".
  - Gate 9 — PASS (`Sources:` = maintainer feedback on #1816 + merged #1827) via read.
  - Gate 11 — PASS (no workspace-internal terms in the published doc) via grep.
  - G-C2 (FULL regression, own independent rebuild of df70e7a0, digest `ca38d7bd`) — PASS: **feature-complete 325 pass / 1 fail** — the 1 fail is the co-stream `ctrib039gb` IT-148 test-4 (`favorites-star-see-loop.spec.ts:159` "the Favorites tab Description column … **#1815 Group B**"), which asserts UNMERGED Group-B behaviour and fails on any non-Group-B SUT (independent of CTRIB-042, confirmed by the failing test's own title). **IT-149 BOTH tests GREEN** (spec 264 open→see loop, 265 the list column). `catalog-search`/`term-search`/`query-examples-crud-search`/`search-class-tab-filter`/`search-result-row-click` all GREEN — the grid rebalance regressed nothing. **known-bugs 3-RED-expected / 0-unexpected-GREEN** (attachment-durability LSN-001, error-boundary, quality-dashboard PLT-052).
  - G-C9 / G-C15 (test integrity) — PASS: the IT-149 change is **purely additive** (test 1 byte-unchanged; a `search()` helper + test 2 added); no assertion weakened, no matcher widened, no mock swapped; the new test's RED survives on `3cbb3b85`.
  - G-C5 (bounded) — PASS (16 files, all `odd-platform-ui/src`).
  - G-C10 — PASS docs (DOC-494 on the train, content accurate); ontology no-refresh (presentation-only) honest.
  - G-C12 (design-before-build / PO-SRE lens) — PASS: reuses `RecentlyViewedTag` (no new component); the column form-factor is maintainer-directed (GATE 1) and platform-consistent (the per-row `null`-when-empty marker mirrors the favorite-star pattern); trailing position per GATE 1.
- **multi-stack / ingestion-e2e**: reviewer-assessed **FE-only skip** (pure search-table presentation; no collector/ingestion/multi-datasource path touched) — precedent CTRIB-031/038/040; the implementer's run-logs show both PASS.
- **Outbound URL sweep**: the 3 doc cross-links (`search.md`, `business-glossary.md`, `query-examples.md`) resolve on the train (Gate 7); live GitBook verification deferred to the 1.0.0 release gate (Gate 8 PENDING-RELEASE).
- **Banned-phrase check**: none used.
- **Regressions**: none attributable to CTRIB-042.
- **Navigation**: consistent (no `navigation/domains` pointer shift; FE-only).
- **The blocker (maintainer-directed, 2026-06-29)**: the **detail-page** recency marker shows a meaningless
  "Viewed 0 seconds ago" — the detail page records-on-open, so `lastViewedAt ≈ now` and the relative form is
  always ~0, resetting on every refresh. Root cause: `RecentlyViewedTag` renders relative time everywhere.
  Fix = **CTRIB-043** (absolute open time — browser tz + explicit UTC offset, UTC fallback — on the 3 detail
  headers; the list columns + home panel keep the relative form, where recency genuinely varies).
- **Doc-product editorial audit**: scoped this run to the data-discovery cluster (`recently-viewed`,
  `favorites`, `catalog-overview`, `search`) given the session's pivot to the maintainer-directed CTRIB-043
  fix — no new coherence findings in that cluster (the RV page reads coherently; the Popular-vs-recency hint
  and the DISABLED-auth shared-bucket warning are correct admonitions). Full-tree audit **deferred to the
  next `/review`** (partition noted) — NOT VERIFIED for the rest of the tree this session.
- **Disposition**: `pr-draft` → **`blocked`**. The list-column change is correct and already on `origin/main`;
  the Recently-Viewed feature advances to `pending-release` (1.0.0) once CTRIB-043 lands and the maintainer is
  satisfied. Every note ends VERIFIED-via or NOT-VERIFIED as marked.
