---
ctrib: CTRIB-028
github_issue_number: 1754
github_issue_url: https://github.com/opendatadiscovery/odd-platform/issues/1754
title: "Term Detail page UI hardening epic (8 defects; FE+BE; labeled 'to decompose')"
class: bug
scope: frontend+backend
milestone: "0.29.0"          # open + semver (due 2026-06-22) → G-C11 PASSES (no hard stop)
status: pending-release      # GATE-2 MERGED 2026-06-22 (PR #1798, squash fd71eb3d on odd-platform origin/main; verified via git fetch — content-identical to the reviewed 75fc06cd, git diff empty over the changed files). /review #3 ACCEPTED. Milestone 0.29.0 → pending-release (NOT done): /review release:0.29.0 owns the done flip — documentation release/0.29.0 train publishes (DOC-478 live-site verify) + G-C10 /enrich at the release substrate scan + real-instance verify on ghcr…:0.29.0. See ## Merge (GATE-2) + ## Review (session #3).
reproduced: "LIVE 2026-06-22 on the running odd-minimal SUT (odd-platform:odd-team-sut 65c9b3ad, Term-Detail files == origin/main). Seeded term ctrib028_PiiTerm (id 21) with 60 linked columns. API (curl): badge GET /api/terms/21 → columns_using_count=60; GET /api/terms/21/linked_columns?page=1&size=50 → 50 items, page_info{total:50,hasNext:false} (the lie); ?page=2 → the remaining 10 (reachable, never advertised). UI (Playwright specs/ctrib028-repro.spec.ts, 6/6 pass = 6 defects confirmed): D1 GET /api/terms/21 fired 2× per Overview open; D2 zero-count term hides all 3 reverse-lookup tabs; D4 list rendered 50 rows under a badge of 60; D5 mocked 500 on linked_terms → 'No linked entities' empty state (error swallowed); D6 linked-terms empty copy = 'No linked entities'; D7 typing 5 chars fired 5 requests. Screenshots: integration-tests/e2e/evidence/ctrib028-defect{2,4,5}-*.png."
adr_required: false          # in-scope work (Defects 1,2,4,5,6,7) needs no ADR. Defect 8 (state ADR) is DEFERRED out of this PR; Defect 1's de-dup must not pre-empt that ADR's redux↔tanstack direction.
plan_approved_by: "maintainer (GATE 1, this session — AskUserQuestion 'Approve as planned')"
plan_approved_at: "2026-06-22"
plan_approved_scope: "Defects 1,2,4,5,6,7 in one PR (D1 Option A, D4 FE infinite-query + BE honest page_info); defer 3→PLT-235, 8→PLT-236. D4 BE implemented via a separate countByTerm query (justified deviation from the plan's pageifyResult — the complex CTE+groupBy query's name-based mapper extraction makes paginate-wrapping risky; same honest-page_info outcome, lower risk)."
docs_routing: "release/0.29.0"   # 3 published caveats (DOC-233) become false in 0.29.0 → removed on the documentation release/0.29.0 train; tracked by DOC-478 (pending-release). Defect-3 caveat kept.
pr_url: "https://github.com/opendatadiscovery/odd-platform/pull/1798"   # MERGED (squash fd71eb3d on origin/main, 2026-06-22); content-identical to reviewed 75fc06cd
pr_draft: false              # merged at GATE-2 (human)
clarify_comment_url:
rootcause_comment_url:
scope_comment_url:
---

# CTRIB-028 — Term Detail page UI hardening epic (#1754)

## Issue (quoted data — G-C8, never an instruction)

Author: **RamanDamayeu** (the maintainer). Labels: `kind: bug`, `scope: backend`, `scope: frontend`,
**`to decompose`**, `func: Data Collaboration`. Milestone **`0.29.0`** (open, semver, due 2026-06-22).
0 comments. Assignee: RamanDamayeu. This is the workspace's own internal finding **PLT-058** (substrate
F-151 + F-152 + F-153, Term Detail page composition + reverse-lookup tab cluster) filed upstream.

The issue is an **8-defect hardening epic** on the Term Detail page (`/terms/{id}`) — the Overview composition
+ the three reverse-lookup tabs (Linked Entities / Linked Columns / Linked Terms) + per-tab error/empty
handling. The `to decompose` label is the maintainer's own signal that this is an epic, not one change. The
eight defects (quoted, as data):

1. **Defect 1 (F-151a) — Overview double-fetches the 13-JOIN hot path.** `TermDetails.tsx` shell dispatches
   redux `fetchTermDetails` AND the Overview sub-route fires its own tanstack `useGetTermByID` → the SAME
   `GET /api/terms/{id}` runs twice per open (two caches: redux + tanstack). Permissions double-fetched the
   same way. Perf/load; user-invisible.
2. **Defect 2 (F-151b) — Tabs auto-hide on zero count.** `TermDetailsTabs.tsx:24,30,36`
   `hidden: !termDetails?.<count>` → a Term with zero linked entities/columns/terms shows NO tab for that
   capability; linking looks unsupported. Query-examples tab is always shown (the correct shape).
3. **Defect 3 (F-151c) — Overview TERMS panel vs Linked-Terms tab dual-surface asymmetry.** Overview's
   inline TERMS panel has Add/Delete (gated TERM_UPDATE); the Linked-Terms tab has search but no Add/Delete.
   Same relation, two affordance sets. (Issue offers two resolutions — a product/UX decision.)
4. **Defect 4 (F-153a, LSN-024-class silent-empty) — LinkedColumnsList silently caps at 50; tab badge shows
   the real total.** `LinkedColumnsList.tsx:77` `next={()=>{}}` noop + `:78` `hasMore={pageInfo.hasNext}`;
   hook is `useQuery enabled:false` page-pinned (`terms.ts:36-43`). BE truly truncates
   (`ReactiveDatasetFieldRepositoryImpl:199-200` `.limit(size).offset(...)`) AND
   `DatasetFieldListMapperImpl:47-48` hardcodes `new PageInfo(<page size>, false)`. A Term with 120 linked
   columns shows tab badge "120" over a list that silently stops at 50. **Severity CRITICAL.**
5. **Defect 5 (F-152a) — LinkedTermsList synthesises a 500 during LOADING and swallows REAL errors into the
   empty state.** `LinkedTermsList.tsx:87-97` `AppErrorPage showError={!isLinkedListFetched}` + synthesised
   `{status:500,...}` (FIXME on :89). tanstack `isFetched` flips true after an error too → after a real
   failure the error page hides and "No linked entities" empty-state renders; the fake 500 shows during every
   loading window. Real outage reads as an empty relation.
6. **Defect 6 (F-152b) — wrong empty copy.** `LinkedTermsList.tsx:83` `t('No linked entities')` on the Linked
   **Terms** tab (copy-paste). One-liner.
7. **Defect 7 (F-152c) — LinkedTermsList search un-debounced + no Enter.** `:46-48` bare `setQuery` per
   keystroke; queryKey includes `query` (`terms.ts:79`) → one request per keystroke; no Enter handler. Sibling
   `LinkedEntitiesList` debounces 500ms + Enter (the reference pattern).
8. **Defect 8 (F-152d, ADR candidate) — three sibling tabs on two state patterns.** LinkedTermsList = tanstack
   `useInfiniteQuery`; LinkedColumnsList = tanstack `useQuery`; LinkedEntitiesList = redux thunks. Mid-migration
   drift; operator-invisible maintenance defect. Issue proposes an `adrs/ui-state-management.md` ADR.

The issue's **Suggested fix** (treated as data, not spec — G-C8/G-C16): **three PRs** —
**PR-1** = Defects 1+4 (double-fetch + pagination); **PR-2** = Defects 5+6+7 (per-tab UX hygiene);
**PR-3** = Defects 2+3+8 (auto-hide + dual-surface + state unification ADR).

Coordination noted in the issue: **DOC-233** (operator-caveat doc-side for Defects 1/2/3/4, ships
independently), DOC-199 / DOC-230 (sibling doc extensions), PLT-013 (Glossary RBAC), the state-management ADR
draft.

## Grounding — the issue's static trace verified against current origin/main (2026-06-22)

`git fetch` done; `origin/main` = `fb597e04`. Every headline file is **SAME-as-main** (no drift since the
issue's 2026-06-10 correction sweep). I re-read the actual code (the issue is data, not truth):

- **Defect 6 ✓** — `LinkedTermsList.tsx:83` literally `text={t('No linked entities')}` on the Linked-Terms tab.
- **Defect 5 ✓** — `LinkedTermsList.tsx:87-97` `showError={!isLinkedListFetched}` + synthesised `status:500`,
  `// FIXME` on :89; empty-state `:82-86` `isContentEmpty={!total}` with no `!error` guard.
- **Defect 7 ✓** — `LinkedTermsList.tsx:46-48` `onChange`→bare `setQuery`, `handleSearchClick={()=>refetch()}`,
  no `onKeyDown`; `terms.ts:79` queryKey includes `params.query`.
- **Defect 4 ✓** — `LinkedColumnsList.tsx:16` `size=50`, `:27` page-pinned hook, `:77` `next={()=>{}}`, `:78`
  `hasMore={pageInfo.hasNext}`; `terms.ts:36-43` `useQuery enabled:false initialData{hasNext:false}`;
  **BE** `DatasetFieldListMapperImpl.java:23,47-48` `pageInfo(dataFieldsDto.size())`→`new PageInfo(total,false)`
  (mapper only sees the page rows — no real total is queried), `ReactiveDatasetFieldRepositoryImpl.java:199-200`
  `.limit(size).offset((page-1)*size)`.
- **Defect 2 ✓** — `TermDetailsTabs.tsx:24,30,36` `hidden: !termDetails?.<count>`; `:29` `hint: columnsUsingCount`
  is the badge that contradicts the Defect-4 capped list.

Reference sibling for the fix patterns: `LinkedEntitiesList.tsx` (debounced search + Enter + real error to
`AppErrorPage`) and the linked-terms infinite-query (`terms.ts:75-93` `useGetTermLinkedTerms` +
`addNextPage` client-side `hasNext = items.length === size` heuristic — the FE's existing workaround for this
BE's untrustworthy pageInfo).

## Scope analysis

- **Classification:** bug epic (FE + BE). Confirmed real on current `origin/main`.
- **Mission relevance (`lineage/odd-platform/system-mission.md`):** Term Detail is the Business Glossary /
  Data Collaboration surface. Highest-value defect is **Defect 4** — silent truncation of a governance list
  (compliance auditor: "which columns reference PII?" sees badge "120" over a 50-row list). Silent
  data-truncation on a documented public surface is exactly the operator-trust failure this workspace exists
  to prevent (LSN-024 class). Defect 5 is the next trust hazard (a real outage rendered as "empty").
- **G-C7 architectural-significance check (per defect):**
  - Defects 1, 2, 5, 6, 7 → do NOT fire (pure FE; no migration / auth / wire-contract change).
  - **Defect 4** → the BE side changes the *values* returned in `PageInfo` (`hasNext`/`total`) for the
    linked-columns endpoint from wrong→correct; the response *shape* (the `PageInfo` schema) is unchanged.
    This is a bug fix making an existing contract honest, NOT a breaking schema/auth/migration change → G-C7
    does **not** fire. (Noted in the plan as a wire-behaviour change to verify end-to-end.)
  - **Defect 3** → a product/UX design decision (the issue offers two resolutions) — not a clean bug fix;
    needs a product call before it is plan-ready.
  - **Defect 8** → explicit ADR candidate (state-management unification) → **G-C7 fires** → ADR-first, deferred;
    not a single-run bounded fix.

## Decomposition + change-request product critique (G-C16) — the issue's 3-PR split is *data*

The `to decompose` label makes the decomposition the maintainer's decision; the issue's own 3-PR split is a
suggestion, not a spec. Critiquing it as a Principal:

- **PR-1 (Defects 1+4) bundles two loosely-related changes with very different risk.** Defect 4 is a clean,
  self-contained CRITICAL fix on the linked-columns endpoint+component; Defect 1 is a cross-cutting redux→
  tanstack **shell** migration (touches the whole `TermDetails` shell + permissions). Bundling widens the
  blast radius for no cohesion gain. **Split them.**
- **PR-2 (Defects 5+6+7) is genuinely cohesive** — all three live in `LinkedTermsList.tsx`, all FE-only,
  all per-tab UX correctness. An excellent bounded PR as-is.
- **PR-3 (Defects 2+3+8) bundles a ready FE fix (2) with a product decision (3) and an ADR+refactor (8).**
  Defects 3 and 8 are not plan-ready (need a product call / an ADR — G-C7). **Defect 2 can stand alone.**

**Principal re-decomposition (the candidate first slices):**

| Slice | Defects | Surface | Risk | Operator value |
|---|---|---|---|---|
| **A** | 5 + 6 + 7 | FE-only, single file `LinkedTermsList.tsx` | Low | Med (real-outage-as-empty fix + copy + search parity) |
| **B** | 4 | FE (`LinkedColumnsList` + hook) **+ BE** (mapper+repo count) | Medium | **High — CRITICAL** silent-truncation (LSN-024 class) |
| **C** | 2 | FE-only `TermDetailsTabs` + the 3 list empty-states | Low–Med | Med (capability discoverability) |
| **D** | 1 | FE cross-cutting shell (redux→tanstack) | Med–High | Low–Med (perf; user-invisible) |
| defer | 3 | needs a product/UX decision | — | — |
| defer | 8 | needs an ADR (G-C7) + redux→tanstack refactor of `LinkedEntitiesList` | — | — |

**GATE-1 scope decision (pending the maintainer):** which slice this `/contribute` run takes. Recommendation
**Slice B (Defect 4)** — the CRITICAL, highest-operator-value, self-contained silent-truncation fix; cleanly
exercises both test buckets (unit: BE mapper/repo returns honest `total`/`hasNext`; integration: badge-vs-list
count via Playwright). Lowest-risk alternative is **Slice A (Defects 5+6+7)**. After the slice is chosen:
reproduce-first (Phase B) → root-cause → design-before-build plan (Phase C) → GATE 1.

## Clarify (G-C6)

No public issue-thread question warranted — the issue is fully specified and the trace is verified. The one
open decision is the **decomposition/first-slice**, which is a *session* scoping decision for the maintainer
(asked via AskUserQuestion), not a public clarification (posting "which of 8 first?" to the thread would be
comment-spam). The public **scope comment** (G-C5) — stating what the approved PR covers and what is deferred
where — is drafted and posted *after* GATE 1, before any code.

## Scope decision (maintainer — GATE-1 scope, 2026-06-22)

The maintainer chose a **single PR covering Defects 1, 2, 4, 5, 6, 7** ("Term Detail page hardening"), wider
than the recommended Slice B. **Deferred: Defects 3 and 8** — to be tracked as PLT backlog items + paste-ready
GitHub issue drafts on disk (the maintainer files them; agents never create GH issues — `issues/README.md`):

- **Defect 3** (Overview TERMS panel vs Linked-Terms tab dual-surface asymmetry) → needs a product/UX decision
  (the issue offers two resolutions). PLT draft + GH issue draft.
- **Defect 8** (three sibling tabs on two state patterns) → needs an ADR (state-management unification,
  `adrs/drafts/ui-state-management.md`) + a redux→tanstack refactor of `LinkedEntitiesList`. PLT draft + GH
  issue draft + ADR draft pointer.

**Cross-defect constraint:** Defect 1's de-dup of the double-fetch must be **state-pattern-neutral** — it must
NOT pre-empt Defect 8's deferred ADR (which will decide the redux↔tanstack direction). Favour the fix that
removes the redundant fetch with the least state-pattern commitment (the issue's "Option A" — Overview consumes
the shell's already-loaded data — over "Option B" — migrate the shell to tanstack).

Phase B now reproduces all six in-scope defects on the running system before any plan/code.

## Reproduction (Phase B — LIVE, 2026-06-22)

Stack: the already-running odd-minimal SUT on :18080 (`odd-platform:odd-team-sut` 65c9b3ad; Term-Detail
files verified == origin/main). Seed: `/tmp/ctrib028_seed.sql` — term `ctrib028_PiiTerm` (id **21**) with
**60** linked columns (one dataset `ctrib028_pii_table` → version → 60 fields → 60 `dataset_field_to_term`).

**API (curl) — Defect 4, hard evidence:**
| Probe | Result |
|---|---|
| `GET /api/terms/21` | `columns_using_count: 60` (the tab badge) |
| `GET /api/terms/21/linked_columns?page=1&size=50` | 50 items · `page_info {total:50, hasNext:false}` — **the lie** (total = returned page size, not 60) |
| `GET /api/terms/21/linked_columns?page=2&size=50` | 10 items — rows 51-60 ARE reachable; BE never advertises them |

**UI (Playwright `integration-tests/e2e/specs/ctrib028-repro.spec.ts` — 6/6 PASS, asserting the buggy state):**
| Defect | Live observation |
|---|---|
| 1 | `GET /api/terms/21` fired **2×** on one `/terms/21/overview` open (redux shell + tanstack Overview) |
| 2 | empty term `ctrib028_EmptyTerm` → only Overview + Query-examples tabs; all 3 reverse-lookup tabs **absent** |
| 4 (UI) | linked-columns list rendered **50** rows under a tab badge of **60** (screenshot shows badge "60" over col_060…col_011) |
| 5 | `page.route(linked_terms→500)` → tab renders **"No linked entities"** empty state, no error page (real error swallowed) |
| 6 | linked-terms empty copy literal = **"No linked entities"** (matches existing IT-082 characterization pin) |
| 7 | typing "abcde" fired **5** `linked_terms` requests (one per keystroke; a debounce would fire ~1) |

Screenshots: `integration-tests/e2e/evidence/ctrib028-defect{2,4,5}-*.png`. (The repro spec is a throwaway Phase-B
artifact — it asserts buggy behaviour and is DELETED before the Phase-D regression; the real ITs replace it.)

## Root-cause (per defect)

- **D1** — `TermDetails.tsx` shell dispatches redux `fetchTermDetails` (feeds `TermDetailsTabs` via the
  `getTermDetails` selector) AND `Overview.tsx` independently calls tanstack `useGetTermByID` (`['term',id]`).
  Two separate caches over the same `GET /api/terms/{id}` → 2 executions of the 13-JOIN query.
- **D2** — `TermDetailsTabs.tsx:24,30,36` `hidden: !termDetails?.<count>` removes the tab entirely at count 0.
- **D4** — FE: `LinkedColumnsList.tsx` uses page-pinned `useGetTermLinkedColumns` (`useQuery enabled:false`),
  `next={()=>{}}` noop, `hasMore={pageInfo.hasNext}`; **BE**: `DatasetFieldListMapperImpl.pageInfo(total)` =
  `new PageInfo(dataFieldsDto.size(), false)` — reports the returned **page size** as total and hardcodes
  `hasNext=false`; the real total is never queried in `ReactiveDatasetFieldRepositoryImpl.listByTerm`.
- **D5** — `LinkedTermsList.tsx:87` `AppErrorPage showError={!isLinkedListFetched}` + synthesised `status:500`.
  tanstack `isFetched` flips true after an error too → real failure hides the error page; empty-state
  (`:82-86`, no `!error` guard) renders. Fake 500 also shows during every loading window.
- **D6** — `LinkedTermsList.tsx:83` `t('No linked entities')` on the Linked-**Terms** tab (copy-paste).
- **D7** — `LinkedTermsList.tsx:46-48` `onChange`→bare `setQuery`; `terms.ts:79` queryKey includes `query`
  → re-key + refetch per keystroke; no debounce, no Enter handler (sibling `LinkedEntitiesList` has both).

## Adjacent finding (out of scope — follow-up candidate, NOT fixed here)

**Orphan-column NPE 500:** `DatasetFieldTermsDtoMapper.java:51-52` dereferences `dataEntityPojo`
unconditionally; a term-linked `dataset_field` with no resolvable `data_entity` (orphaned column) 500s the
whole linked-columns page (observed during seeding before I added `dataset_structure`). Reachability depends
on delete-cascade behaviour for term-linked columns. LSN-024/LSN-001 class. → log as a PLT/REFACTOR
follow-up at GATE 1 (`playbooks/follow-up-on-disk.md`); deliberately excluded from this PR (G-C5).

## Plan (GATE-1 artifact — design-before-build, per defect)

### Design-before-build (G-C12)

- **Reuse-scan (no new components):** D1 reuses the existing redux `getTermDetails`/`getResourcePermissions`
  selectors already populated by the shell. D2 reuses `AppTabs` `hint` + the per-tab empty states that already
  exist. D4-FE reuses `useInfiniteQuery` + the generic `addNextPage` helper + `InfiniteScroll` (mirror
  `LinkedTermsList`). D4-BE reuses `JooqQueryHelper.paginate` + `pageifyResult` + `Page`→`PageInfo`
  (the pattern in `ReactiveTagRepositoryImpl`/`ReactiveActivityRepositoryImpl` + `TermMapper`). D5 reuses
  `LinkedEntitiesList`'s real-error→`AppErrorPage` shape + `errorHandling.getErrorResponse`. D7 reuses
  `use-debounce` `useDebouncedCallback` + the Enter handler (both already in `LinkedEntitiesList`). Nothing new
  is invented — every fix conforms to an existing sibling/pattern.
- **ADR-check:** no ADR governs these areas; all are bug fixes conforming to existing patterns. The one ADR
  candidate (D8, state-pattern unification) is **deferred** (see scope exclusions) — a draft pointer is created,
  not decided here. No reverse-engineered ADR needed.
- **Impact checklist:** **i18n** — only ONE new string, `'No linked terms'` (D6), added to all 7 locales
  (`en/br/es/fr/ch/ua/hy`; machine-translated best-effort, en authoritative); D2/D5/D7 reuse existing keys.
  **generated clients** — D4-BE changes pageInfo *values*, not the `DatasetFieldList`/`PageInfo` OpenAPI schema
  → **no client regen**. **consumers** — D4 changes `ReactiveDatasetFieldRepository.listByTerm` (sole caller:
  `DatasetFieldServiceImpl`) + `DatasetFieldListMapper.mapPojos` (sole caller: same service) → bounded.
  **migration** — none (no DB change). **docs** — DOC-233 caveats partly obsoleted (truncation removed) →
  read Business Glossary page, route any update to the `release/0.29.0` train (G-C11). **ontology** —
  `/enrich --touched` F-151/F-152/F-153 + the changed BE nodes; re-embed; commit. **tests** — both buckets
  (below).
- **Product-Owner/SRE lens:** these are corrections to established surfaces (not new feature shapes), so the
  lens is reasoned explicitly rather than via a separate `odd-sme` spawn: each fix restores operator legibility
  on the Business-Glossary governance surface — a compliance auditor now sees all linked columns (not a silent
  50-cap), capability tabs are discoverable at zero count, a real backend failure is surfaced (not shown as
  "empty"), and live search behaves like its siblings. All align with ODD's data-discovery mission.

### Per-defect changes

- **D1 (double-fetch) — recommended Option A (lowest blast radius):** `Overview.tsx` consumes the shell's
  already-loaded redux `getTermDetails(termId)` + `getResourcePermissions(TERM, termId)` instead of firing its
  own tanstack `useGetTermByID` + `useResourcePermissions`. Preserve the Overview linked-term Add/Delete live
  refresh by dispatching redux `fetchTermDetails({termId})` on those two mutations' success (they currently only
  invalidate the tanstack `['term',termId]` key, which Option A no longer reads). Net: one term-details fetch +
  one permissions fetch per page open. Does **not** touch the list-tab state patterns (= D8, deferred).
  *Alternative (Option B): migrate the shell term-details+permissions to tanstack so shell+Overview share
  `['term',termId]` (tanstack dedup). Cleaner re mutation-refresh but higher blast radius on the shell — noted
  for GATE-1; A is recommended.*
- **D2 (auto-hide):** `TermDetailsTabs.tsx` — drop the three `hidden: !termDetails?.<count>` lines; the three
  reverse-lookup tabs always render (the count `hint` shows when > 0). Each tab's existing empty state
  communicates "no linked X yet" (terms copy fixed by D6). Capability becomes discoverable at zero count.
- **D4 (silent 50-cap) — FE + BE:**
  - **FE:** add an infinite `useGetTermLinkedColumns` (mirror `useGetTermLinkedTerms`: `useInfiniteQuery`,
    `getNextPageParam` from the now-honest `page_info`); `LinkedColumnsList.tsx` consumes it — `next={fetchNextPage}`,
    `hasMore={hasNextPage}`, flat-map pages — removing the page-pin + the `next={()=>{}}` noop.
  - **BE (the clean fix — makes `page_info` honest):** `ReactiveDatasetFieldRepositoryImpl.listByTerm` →
    `paginate(...)` + `pageifyResult(records, datasetFieldTermsDtoMapper::mapRecordToDto, fetchCount(termId,query))`
    returning `Mono<Page<DatasetFieldTermsDto>>`; add the term-scoped count; `DatasetFieldListMapper.mapPojos`
    takes the `Page` and emits `PageInfo` from `page.getTotal()`/`isHasNext()`. Touches: repo impl + interface,
    service, mapper interface + impl (5 files, mechanical, established pattern).
- **D5 (error swallowed):** `LinkedTermsList.tsx` — replace the `showError={!isLinkedListFetched}` + synthesised
  `{status:500}` with `AppErrorPage showError={isError}` carrying the **real** mapped error (via
  `errorHandling.getErrorResponse`), and gate the empty state on `!isError` (mirror `LinkedEntitiesList`). No
  fake 500 during loading; a real failure shows an error, not "empty".
- **D6 (wrong copy):** `LinkedTermsList.tsx:83` `t('No linked entities')` → `t('No linked terms')`; add the
  `'No linked terms'` key to all 7 locale JSONs.
- **D7 (un-debounced search):** `LinkedTermsList.tsx` — wrap the query-state update in `useDebouncedCallback(…, 500)`
  + add an `onKeyDown` Enter handler (mirror `LinkedEntitiesList:62-68`). One request per ~500ms, Enter for parity.

### Scope EXCLUSIONS (G-C5 — deliberately NOT touched)

- **Defect 3** (Overview/Linked-Terms dual-surface) — product/UX decision → deferred (PLT + ISS draft below).
- **Defect 8** (three-tab state-pattern unification) — needs an ADR → deferred (PLT + ISS + ADR draft below).
- **Orphan-column NPE 500** (adjacent finding) — deferred (PLT/REFACTOR draft below).
- No DB migration, no OpenAPI/client regen, no auth/posture change. The redux term-details thunk/slice is **not
  deleted** even if Option A leaves it shell-unused (a grep-gated follow-up cleanup, to bound this diff).
- The three list tabs' state patterns are not unified (that is D8).

### Test plan (both buckets — G-C9)

- **Unit (odd-platform CI, `:odd-platform-api:build`):** a repository/Testcontainers test for
  `ReactiveDatasetFieldRepositoryImpl.listByTerm` — seed a term with > size linked columns, assert the returned
  `Page` has `total == N` and `hasNext == true` on page 1, `hasNext == false` on the last page (RED on main:
  total == page size, hasNext == false). Optionally a `DatasetFieldListMapperImpl` unit test (Page→PageInfo).
- **Integration (odd-team `integration-tests/IT-NNN`, e2e):**
  - **NEW IT — term linked-columns pagination (D4):** badge == 60 and all 60 rows reachable by scroll
    (RED on main: 50). (No existing linked-columns IT.)
  - **Extend IT-032 (term detail page):** D1 — one `GET /api/terms/{id}` per Overview open (RED on main: 2);
    D2 — a zero-count term shows the three reverse-lookup tabs (RED on main: absent).
  - **Extend IT-082 (linked-terms tab):** D5 — a forced 500 renders an error, not the empty state; D7 — typing
    fires ~1 request (debounced); **D6 — RE-GROUND the existing characterization pin** (`:116-119`, currently
    asserts "No linked entities") to assert **"No linked terms"** (RED→GREEN per LSN-029/G-C15, never deleted).
  - **Delete** the throwaway `specs/ctrib028-repro.spec.ts` once the real ITs exist.
  - Each authored/changed test RUN RED on `ODD_SUT=ref:main` and GREEN on the working tree before commit (G-C2).

### Docs (G-C10 / G-C11)

Read the Business Glossary published page; DOC-233 already tracks the operator caveats and "ships independently."
Since this PR removes the truncation + auto-hide behaviours (unreleased until 0.29.0), route any doc delta to the
documentation **`release/0.29.0`** train (never docs `main`), paired with a backlog DOC item (`milestone: 0.29.0`
+ post-merge URLs). If no page documents the behaviour, record "no doc change + why" after reading. Decided in
Phase D after reading the page.

### Ontology (G-C10)

`/enrich --touched` on the changed nodes (F-151/F-152/F-153 feature flows + `LinkedColumnsList`/`LinkedTermsList`/
`TermDetailsTabs`/`Overview` + `DatasetFieldListMapperImpl`/`ReactiveDatasetFieldRepositoryImpl`); re-embed the
graph; commit (not narrated).

### Deferred-item drafts (created on disk before the scope comment)

- `backlog/.../PLT-…` + `issues/odd-platform/ISS-…` for **Defect 3** and **Defect 8**; `adrs/drafts/ui-state-management.md`
  pointer for D8; a PLT/REFACTOR note for the **orphan-NPE**. (Agents never file GH issues — the maintainer files
  the ISS drafts.)

### Scope comment (drafted — posts to #1754 immediately after GATE-1 approval, before any code)

> This PR (`contrib/CTRIB-028-term-detail-hardening`) covers the Term Detail hardening epic's defects **1, 2, 4,
> 5, 6, 7**:
> - **1** Overview no longer double-fetches the term-details query; **2** the Linked entities/columns/terms tabs
>   stay visible at zero count (capability discoverable); **4** the Linked columns list paginates past 50 and the
>   backend `page_info` reports the real total/hasNext (badge no longer disagrees); **5** a real backend failure on
>   Linked terms shows an error instead of the empty state (no fake 500 while loading); **6** the Linked terms
>   empty copy reads "No linked terms"; **7** Linked terms search is debounced + Enter-submittable.
>
> **Deferred (tracked separately):** **Defect 3** (Overview vs Linked-Terms dual-surface — needs a product/UX
> decision) and **Defect 8** (unify the three tabs' state-management — needs an ADR). A latent orphan-column NPE on
> the linked-columns endpoint (a term-linked column whose dataset is missing) is also tracked separately. Each
> ships in its own follow-up.

## Implementation ledger (Phase D — 2026-06-22)

**Branch:** `contrib/CTRIB-028-term-detail-hardening` (off `origin/main` fb597e04). GitHub App unconfigured →
the scope comment + draft PR are **on-disk handovers** (PR body: `contributor/CTRIB-028-pr-body.md`).

**Code changed (odd-platform, +133/−85 across 17 files):**
- FE — `Overview.tsx` (D1: read redux), `lib/hooks/api/terms.ts` (D1 mutation refresh + D4 infinite columns hook,
  removed orphaned `useGetTermByID`), `TermDetailsTabs.tsx` (D2: drop `hidden`), `LinkedColumnsList.tsx`
  (D4: infinite + on-demand search), `LinkedTermsList.tsx` (D5 real error / D6 copy / D7 debounce+Enter),
  7 locale JSONs (`No linked terms`).
- BE — `ReactiveDatasetFieldRepository[Impl]` (new `countByTerm`), `DatasetFieldServiceImpl.listByTerm`
  (zip page+count), `DatasetFieldListMapper[Impl]` (honest `PageInfo` via builder).

**Static checks:** FE `tsc --noEmit` ✅ · FE eslint (changed files) ✅ · BE `:odd-platform-api:compileJava` ✅.

**Reproduce→verify on the running system (the bar — G-C2):** pre-fix SUT (= main for Term-Detail): all 6 buggy
(curl `page_info{total:50,hasNext:false}`; Playwright 6/6 buggy). Fix SUT (`odd-platform:odd-team-sut` 1aa660cb,
working tree): all 6 fixed (curl `{total:60,hasNext:true}`; Playwright 6/6 + screenshots
`e2e/evidence/ctrib028-fixed-d{2,4,5}-*.png` — D2 tabs+`0` badges, D4 all 60 rows, D5 a real "500 Internal
Server Error" page not the empty state).

**Test ledger — BOTH buckets (G-C9):**
| Bucket | Test | Fix SUT | `ref:main` (RED proof) |
|---|---|---|---|
| unit | `:odd-platform-api:build` FULL (test+checkstyle+assemble) | GREEN (6m16s) | n/a (full suite) |
| unit | `DatasetFieldServiceImplTest.listByTerm` (new, Mockito) | GREEN | covers the gated changed lines |
| unit | `DatasetFieldListMapperImplTest` (new — page_info math) | GREEN | new code (mapper jacoco-excluded) |
| integ | `IT-139` term-linked-columns-pagination (new — D4) | GREEN | RED (list 50 vs badge 60) |
| integ | `IT-032` +D1 (single-fetch) +D2 (tabs shown) | GREEN | RED (2 fetches / tabs hidden) |
| integ | `IT-082` re-grounded D6 + D5 (error≠empty) + D7 (debounce) | GREEN | RED (all 3) |

RED proof run on `ODD_SUT=main` (a0d448b2): the 6 defect tests FAILED, the 3 bug-independent originals PASSED —
the discriminator (incl. the re-grounded D6 pin still RED on base, G-C15 #3). **Patch-coverage (G-C13):** CI gate
`min-coverage-changed-files: 98`; only `DatasetFieldServiceImpl` is gated (repo `**/repository/**` + mapper
`**/*MapperImpl*` are jacoco-excluded) and its changed `listByTerm` lines are covered by the new Mockito test.

**Docs (G-C10/G-C11):** READ live `…/features/data-glossary/business-glossary` (HTTP 200) — it publishes the
D1/D2/D4 caveats (DOC-233, done). My fix makes them false in 0.29.0 → removed the 3 `{% hint %}` blocks on the
documentation **`release/0.29.0`** train (Defect-3 caveat kept); paired **DOC-478** (pending-release) tracks the
release-gate live-verify.

**Deferred drafts created:** `issues/odd-platform/PLT-235.md` (D3), `PLT-236.md` (D8) + `adrs/drafts/ui-state-management.md`,
`PLT-237.md` (orphan-NPE); `PLT-058.md` annotated; `backlog/docs/DOC-478.md`.

**FULL integration regression — RUN, green-as-expected (2026-06-22, working-tree SUT):**
- `feature-complete` → **310 passed** (run-log `2026-06-22-feature-complete.md`, api:PASS e2e:PASS).
- `multi-stack` → **9 passed** (`2026-06-22-multi-stack.md`, e2e:PASS).
- `known-bugs` → **3 failed = the expected quarantine pins** IT-004 (PLT-052) / IT-006 (TEST-GAP-1013) /
  IT-007 (LSN-001/PLT-086); **no unexpected GREEN** (no un-flipped fix) — the expected-RED outcome.
- `ingestion-e2e` → **6 passed** (`2026-06-22-ingestion-e2e.md`, e2e:PASS).

**Commits — DONE (3 repos; parallel CTRIB-029 work untouched):** odd-platform `75fc06cd`
(`contrib/CTRIB-028-term-detail-hardening`, PUSHED to origin — reconciled from the stale `9d3de146`: reverted
`b5930a75` + reapplied `75fc06cd`, `git diff 9d3de146 75fc06cd` empty / content-identical) · documentation
`980c88e` (`release/0.29.0`) · odd-team `436b695` (`main`).

**REMAINING before `review-ready`** — RESOLVED to `pr-draft` 2026-06-22 (see ## Implementation finish):
1. **Ontology** `/enrich` — **DEFERRED to the 0.29.0 release full-substrate scan** (release-review step 5:
   `lineage-extractor scan odd-platform --full` → `graph-build`, at the released tag). The substrate tracks
   *main*, pinned at `e67461de` (7 commits behind origin/main; origin/main never touched these files — only
   CTRIB-028 did); the code is on an unmerged branch. Nodes confirmed existing + cleanly re-enrichable, so a
   per-file enrich would work — making this a **scheduling** deferral (not a tooling / new-node block): it would
   anchor transient feature-branch SHAs into shared, main-tracking lineage and be redone post-merge. (Also: at
   finish time the lineage tree is dirty again from concurrent probe-run/regression activity — the single-writer
   rule O10 forbids `/enrich` into a dirty tree regardless.) Consistent with CTRIB-029's G-C10 resolution; G-C10
   gates the PR *leaving* draft (= merge), satisfied by the release scan.
2. **Handover:** branch PUSHED to origin @75fc06cd; on-disk pr-body ready (`contributor/CTRIB-028-pr-body.md`,
   partial-#1754 — deliberately NOT `Closes`). App secrets unavailable in the finish session → the real draft PR
   is opened from the compare URL (## Implementation finish) by a maintainer / `/contribute` Phase E; `/review`
   proceeds on the pushed branch meanwhile. DONE (handover recorded).
3. **GATE 2:** `/review` (separate session) → human merge. READY.

## Review-precondition decline (2026-06-22, session: review-ctrib028 / parallel-aware)

- **Result: NOT REVIEWED — precondition decline.** This is **not** an ACCEPT and **not** a defect-REJECT.
  The item is not yet at the review-ready-equivalent state, so the full ACCEPT/REJECT gate run (regression
  confirmation + editorial audit) is deliberately **not** opened — that is exactly what the 2-minute-bounce
  precondition exists to prevent. **Status left at `docs-done`** (not flipped to `blocked`: there is no
  rejected-review and no code defect; the implementer correctly + deliberately deferred the last DoD gate and
  documented it — flipping to `blocked` would mislabel correct in-progress work).

- **Why declined (each cited):**
  1. **Status is `docs-done`, not `pr-draft`** (the contributor review-ready-equivalent — `pillars/contributor`
     review-skill prerequisite). The item has not been submitted for the GATE-2 review.
  2. **2-minute bounce fires (G-C10 DoD gate NOT RUN):** the ledger explicitly flags ontology `/enrich` as
     **DEFERRED** at the reviewed SHA. Ontology-moves-with-the-code is a Definition-of-Done gate, not a trailing
     optional. `/review` is **read-only on `lineage/**`** and `/enrich` is `/implement`'s job — the reviewer
     structurally cannot close this gap (re-enrichment as a review side-effect is forbidden).
  3. **No draft PR exists to hand off.** GitHub App unconfigured → the scope comment + draft PR are on-disk
     handovers (`CTRIB-028-pr-body.md`), un-posted. GATE-2 review presupposes a draft PR (or an explicit
     on-disk-PR review decision); neither has been initiated.

- **Record drift caught (verify-live-state, not the record — O4):** the ledger cites odd-platform
  **`9d3de146`**, but the live branch head is **`75fc06cd`** — `9d3de146` was **reverted** (`b5930a75`, a manual
  maintainer action on the shared checkout, 15:20) then **re-applied** as `75fc06cd`. `git diff 9d3de146
  75fc06cd` is **empty** → content-identical, so the code + the regression evidence stand, but **the recorded
  reviewed-SHA is stale and must be reconciled to `75fc06cd`** before the GATE-2 review.

- **Mis-attribution caught (the lineage lock is NOT CTRIB-029's):** REMAINING-step 1 says the enrich is deferred
  because "CTRIB-029 has uncommitted edits to `lineage/**`." **Verified false.** The dirty `lineage/**` is a
  **`/probe-run` (P-001)** measured-value merge — `feature-flows.yaml` shows `probe_run_id
  R-20260622T123548Z-P-001`, `ran_at 2026-06-22T12:35:48Z`, artefact `probe-runs/2026-06-22-P-001.yaml`
  (untracked) — touching run-status / `DataEntityController`/`DataEntityRunController` nodes. CTRIB-029's own
  enrich is still **pending** (its DoD ledger), and its uncommitted code lives in the `../odd-platform-ctrib029`
  worktree (`auth/filter/**`), **not** in `lineage/**`. The **deferral decision was correct** (do not `/enrich`
  into a dirty lineage), but the **stated owner was wrong** — a second stream trusting this record would
  mis-model who holds the lineage lock. This is the precise failure the coordination registry below closes.

- **Verified solid (so the implementer knows what stands):** code committed, working tree clean (1 unrelated
  untracked `docker/demo.override.yaml`); commit footer present (`Consumer-read:` + `Sources:`); 3-repo commits
  present (odd-platform `75fc06cd`, documentation `980c88e` on `release/0.29.0`, odd-team `436b695`); CTRIB-029
  code fully isolated in its own worktree (zero source overlap, confirmed).

- **Path to review-ready (precise, ordered):**
  1. **Reconcile the SHA** in the frontmatter/ledger → `75fc06cd` (note the revert+reapply, content-identical).
  2. **Clear the lineage lock, then enrich (`/implement`, not `/review`):** the probe-run P-001 residue (6
     `lineage/**` files + the untracked `probe-runs/2026-06-22-P-001.yaml`) must be committed-or-reverted by its
     owner so `lineage/**` is clean + unclaimed; **then** run CTRIB-028's deferred `/enrich --touched` +
     re-embed + commit. Coordinate via `state/active-streams.yaml` (the lineage tree is a single-writer
     serialized resource).
  3. **Handover:** open the draft PR + post the scope comment, or record that the GitHub App is still
     unconfigured and the GATE-2 review will be of the on-disk PR body + the pushed branch.
  4. **Flip `docs-done → pr-draft`** and re-invoke `/review` (separate session) for the full ACCEPT/REJECT.

- **Coordination mechanism (the maintainer's parallel-aware directive):** `state/active-streams.yaml` created
  this session — registers CTRIB-028, CTRIB-029, **and this reviewer** so all parallel parties are mutually
  visible, and records the true holder of every shared resource (incl. the probe-run lineage lock). See that
  file's header for the protocol + the design source (`adrs/drafts/parallel-contribution-infra.md` §5.4).

## Second review pass — precondition decline re-confirmed (2026-06-22T18:17, session: review-ctrib028 #2 / parallel-aware)

- **Result: STILL NOT REVIEWED — precondition decline re-confirmed** (not ACCEPT, not defect-REJECT). Status
  remains **`docs-done`**, which is ≠ the contributor review-ready-equivalent **`pr-draft`**. The contributor
  loop runs `docs → ontology refresh → draft PR [GATE 2]` (`pillars/contributor/pillar.md:36-40`), so
  `docs-done` is **two phases short** of GATE-2. The 2-minute bounce still fires: the `/enrich` DoD gate is
  **NOT RUN** at the reviewed SHA, and `/enrich` is `/implement`'s job (the reviewer is read-only on
  `lineage/**`). **Status left at `docs-done`** — no flip: this is correct deferred in-progress work, with no
  code defect and no rejected review, so `blocked` would mislabel it (same reasoning as the first decline).
- **Two deltas verified-live since the first decline (`33fed88`) — both NARROW the remaining work:**
  1. **Lineage lock CLEARED.** Probe-run P-001's residue is committed (`212b214`); `git status --short
     lineage/` is empty (clean + unclaimed). CTRIB-028's deferred `/enrich --touched` is now **UNBLOCKED** —
     the first decline's path-step-2 blocker is gone; it simply has not been run yet.
  2. **Branch PUSHED.** `contrib/CTRIB-028-term-detail-hardening` is on origin at **`75fc06cd`** (it was an
     on-disk-only handover at the first decline). The draft-PR handoff is now feasible; `pr_url` still unrecorded.
- **Still stale in this ledger (unchanged):** the Implementation-ledger "Commits — DONE" line cites odd-platform
  **`9d3de146`**; the live branch head is **`75fc06cd`**. `git diff 9d3de146 75fc06cd` is **empty**
  (content-identical — the revert `b5930a75` + reapply `75fc06cd`), so the code + the regression evidence stand,
  but the recorded reviewed-SHA must be reconciled.
- **Narrowed path to review-ready — every step is `/implement`/`/contribute`'s job, NOT the reviewer's:**
  1. Run the now-unblocked `/enrich --touched` (F-151/F-152/F-153 + the changed FE/BE nodes) + re-embed + commit.
  2. Reconcile the ledger SHA `9d3de146 → 75fc06cd` (note the revert+reapply; content-identical).
  3. Record the draft-PR handoff: the branch is pushed — open the DRAFT PR (`Closes`-free body per
     `CTRIB-028-pr-body.md`) + set `pr_url`, or record the explicit on-disk-PR review decision.
  4. Flip **`docs-done → pr-draft`** (the `/contribute` transition), then re-invoke `/review` for the full
     ACCEPT/REJECT (regression confirmation + editorial audit).

## Implementation finish — to `pr-draft` (2026-06-22T18:30, /implement CTRIB-028)

The maintainer ran `/implement CTRIB-028` to drive the narrowed finish. Done this session (deterministic; no
lineage write — see the enrich deferral):

- **SHA reconciled.** Ledger "Commits — DONE" now cites the live head `75fc06cd` (was the stale `9d3de146`;
  `git diff 9d3de146 75fc06cd` empty / content-identical via revert `b5930a75` + reapply `75fc06cd`).
- **G-C10 ontology `/enrich` — DEFERRED to the 0.29.0 release full-substrate scan** (NOT run on the branch).
  This **refines** the review's "run the now-unblocked enrich" (written before the substrate state was
  inspected): the shared substrate (`lineage/odd-platform/nodes.jsonl`) tracks *main*, is pinned at `e67461de`,
  and `manifest.enrichment.last_enriched_commit = 82812cdf` — the shared `../odd-platform` checkout (`75fc06cd`)
  is 7+ commits ahead, so `/enrich --touched` would over-enrich the whole origin/main advance, and a per-file
  enrich would bake transient feature-branch SHAs into shared lineage (redone at the post-merge scan). The nodes
  exist + are cleanly re-enrichable (only CTRIB-028 touched these files since the scan) → a **scheduling**
  deferral, matching CTRIB-029's G-C10 resolution. (Also blocked in practice right now: the lineage tree is
  dirty again from concurrent probe/regression activity — O10 forbids `/enrich` into a dirty tree.) The
  comprehensive refresh runs at release-review step 5 (`scan --full` + `graph-build` at the released tag).
- **PR handover.** Branch PUSHED to origin `@75fc06cd`; on-disk pr-body ready. The finish session does NOT hold
  the GitHub App secrets (`GH_APP_ID`/`GH_INSTALLATION_ID`/key all unset), so the real draft PR is opened from
  the compare URL below (maintainer click, or a `/contribute` Phase E / App-enabled context):
  `https://github.com/opendatadiscovery/odd-platform/compare/main...contrib/CTRIB-028-term-detail-hardening?expand=1`
  — title *"Term Detail page hardening (#1754 — defects 1, 2, 4, 5, 6, 7)"*; body `contributor/CTRIB-028-pr-body.md`
  (partial-#1754, deliberately NOT `Closes`). `/review` (separate session) can proceed on the pushed branch +
  on-disk pr-body now.
- **Status flipped `docs-done → pr-draft`** (the contributor review-ready-equivalent). `/review` owns
  `pr-draft → review-ready`; the human GATE-2 merge owns `done`.
- **active-streams.yaml ctrib028→pr-draft reconcile: DEFERRED** — at finish time `state/active-streams.yaml`
  had uncommitted edits from a concurrent session; per the parallel doctrine (never clobber / sweep another
  stream) the coordination mirror is reconciled once the tree clears (next session reconciles per the file's
  protocol).

**For `/review` (GATE 2):** code under review = odd-platform `75fc06cd` (pushed branch) + `contributor/CTRIB-028-pr-body.md`.
Tests (per ledger): unit `:odd-platform-api:build` GREEN + new `DatasetFieldServiceImplTest`/`DatasetFieldListMapperImplTest`;
integration `IT-139` (new) + `IT-032`/`IT-082` (extended) GREEN on the working-tree SUT, RED on `ref:main`.
Affected live URL (release-gated — verify at the 0.29.0 gate, DOC-478): the Business Glossary page
`docs.opendatadiscovery.org/.../features/data-glossary/business-glossary` (retires the D1/D2/D4 caveats on
`release/0.29.0`; live GitBook slug per `/review`).

## Review (2026-06-22, session: review-ctrib028 #3 — full GATE-2 review)

- **Result: ACCEPTED** → `pr-draft` → `review-ready`. (The human GATE-2 merge owns `done`; this flip is the
  contributor review-ready-equivalent.) Reviewed at odd-platform `75fc06cd`. This is the THIRD pass: the two
  prior PRECONDITION DECLINES (status `docs-done` ≠ `pr-draft`; `/enrich` DoD gate not run) are RESOLVED by the
  `/implement` finish (`f981c58`) — status is now `pr-draft`, and the `/enrich` deferral is justified-as-scheduled
  to the 0.29.0 release scan (consistent with the accepted CTRIB-029 resolution).

- **2-minute-bounce precondition — assessed, did NOT fire.** Decoded the run-logs against the docker image
  timeline: the implement-side regression evidence is *valid* (not the no-fix-SUT failure that rejected CTRIB-029's
  first pass). `multi-stack`/`known-bugs`/`ingestion-e2e` each had a build-from-source run at committed `9d3de146`
  (git-identical to `75fc06cd` — `git diff` empty); the `35ca9385` negative control (no term fix) correctly
  *failed* feature-complete. The one gap: `feature-complete` was freshly run by implement only at
  `fb597e04+uncommitted` (`81ba2101`), never build-from-source at the committed SHA. Per `/review` §3 the reviewer
  runs its own confirmation regardless — maintainer-approved (AskUserQuestion).

- **Acceptance criteria (the in-scope defects 1,2,4,5,6,7):**
  - [x] **D1 double-fetch** — PASS. `Overview.tsx` reads redux `getTermDetails`+permissions; mutations dispatch
    `fetchTermDetails`. IT-032 `D1: Overview fetches GET /api/terms/{id} exactly once` (added) GREEN; RED on main (2×).
  - [x] **D2 auto-hide tabs** — PASS. `TermDetailsTabs.tsx` drops the `hidden:!count` lines. IT-032 `D2: zero-count
    term shows the three reverse-lookup tabs` (added) GREEN; RED on main.
  - [x] **D4 silent 50-cap (CRITICAL)** — PASS. BE: `DatasetFieldListMapperImpl` `hasNext=(long)page*size<total`
    + `PageInfo().total(total)` (replaces `new PageInfo(size,false)`); `ReactiveDatasetFieldRepository.countByTerm`
    (`countDistinct(DATASET_FIELD.ID)`, same join/filter as `listByTerm`); `DatasetFieldServiceImpl.listByTerm`
    `Mono.zip(list,count)`. Unit: `DatasetFieldListMapperImplTest` (3 boundary cases) + `DatasetFieldServiceImplTest`
    GREEN. IT-139 (new) badge=60 ∧ all 60 rows reachable GREEN; RED on main.
  - [x] **D5 swallowed error** — PASS. `LinkedTermsList.tsx` real `AppErrorPage showError={isError}`, empty gated on
    `!isError`. IT-082 `D5: a real 500 renders an error, not the empty state` (added) GREEN; RED on main.
  - [x] **D6 wrong empty copy** — PASS. `'No linked entities'`→`'No linked terms'` + 7 locales. IT-082 D6 pin
    **re-grounded** (G-C15-clean, below).
  - [x] **D7 un-debounced search** — PASS. `useDebouncedCallback(…,500)` + Enter. IT-082 `D7: debounced (≤2 reqs
    for 5 keystrokes)` (added) GREEN; RED on main.
  - [x] **Scope bounded (G-C5)** — PASS. D3/D8/orphan-NPE deferred with on-disk drafts (`PLT-235`/`PLT-236`+
    `adrs/drafts/ui-state-management.md`/`PLT-237`), all present; no out-of-scope diff.

- **Quality Bar / contributor gates:**
  - **Footer (Gate 4/9)** — PASS via `git log 75fc06cd`: `Consumer-read:` (extensive FE+BE consumer list) +
    `Sources:` both present.
  - **G-C2 regression — PASS (own confirmation, GREEN-as-expected).** Built the SUT **once** from `75fc06cd`
    (working tree, tracked-clean → digest `cecd88db`), ran all four buckets sequentially against that one pinned
    image (stack recreated — "running stack image != SUT -> recreating"): **feature-complete 310/310** (api:PASS
    e2e:PASS — closes the `fb597e04+uncommitted` gap on the headline suite), **multi-stack 9/9**, **known-bugs
    3-failed = exactly the quarantine pins IT-004(PLT-052)/IT-006(TEST-GAP-1013)/IT-007(LSN-001+PLT-086), 0
    unexpected-green**, **ingestion-e2e 6/6**. Run-logs: `integration-tests/run-log/2026-06-22-*.md` (digest
    `cecd88db`). Own unit CI-replica also GREEN @75fc06cd (`BUILD SUCCESSFUL 4m55s`, `:check`+`:build`).
  - **G-C15 (changed test integrity)** — PASS. The ONLY changed test is the IT-082 D6 pin: `getByText('No linked
    entities')`→`getByText('No linked terms')` + an *added* `'No linked entities'` `toHaveCount(0)`. SoT = the
    corrected copy (not system output); oracle *tightened*; RED-on-`ref:main` preserved (comment states it). All
    other tests are *added* (IT-139, IT-032 D1/D2, IT-082 D5/D7) — additive, safe.
  - **G-C9 (both buckets)** — PASS. Unit (Mockito/in-process) + integration (IT-139 new, IT-032/IT-082 extended);
    the user-facing badge-vs-list contradiction is covered by an integration IT (required by G-C9).
  - **G-C10 ontology** — DEFERRED-as-scheduled (NOT a blocker). `/enrich` scheduled at the 0.29.0 release
    full-substrate scan; the nodes exist + are re-enrichable but the substrate tracks *main* (the code is on an
    unmerged branch), so enriching now would anchor transient feature-branch SHAs into shared main-tracking
    lineage. Matches CTRIB-029's accepted G-C10 resolution. G-C10 gates the PR *leaving draft* (= GATE-2 merge),
    satisfied by the release scan — not the `pr-draft`→`review-ready` flip. **Tracked for the release scan.**
  - **G-C10 docs half / Gate 8 (live-site)** — PENDING-RELEASE (0.29.0). The Business Glossary caveat retirement
    is on documentation `release/0.29.0` @ `980c88e` (verified branch-present: removes exactly the D1/D2/D4 Term-
    Detail caveats, 12 lines; keeps the D3 dual-surface + security caveats). Live GitBook verification scheduled at
    the 0.29.0 release gate — tracked `DOC-478` (pending-release).
  - **Gate 7 (layout)** — PASS. `suites.yaml` registers IT-139; deferred drafts on disk.

- **Regressions**: none. Full confirmation green-as-expected on a fresh `75fc06cd` build (`cecd88db`).
- **Navigation**: consistent. Minor (Low, non-blocking): the new `ReactiveDatasetFieldRepository.countByTerm`
  (linked-columns backend) is not yet listed in `navigation/domains/glossary.md` — optional follow-up, not logged
  separately (trivial; fold into the next glossary-domain navigation touch).
- **Upstream issues logged**: none new (PLT-235/236/237 were created by `/implement`).
- **Banned-phrase check**: none used.
- **Doc-product editorial audit (§5)** — ran a bounded pass; **partitioned**:
  - **Coverage this run**: the `data-glossary` subtree (`business-glossary.md` — the surface this change touches).
    CLEAN: the 0.29.0 caveat retirement is surgical (removes exactly D1/D2/D4), leaves **no dangling cross-
    references** (the `double-fetch`/`silently truncate` grep hits are the *entity*-detail-page + *alerting*
    pages, unrelated), and leaves **no empty subsection headers** (Visibility/Correctness/Performance each retain
    other still-true caveats; the D3 dual-surface caveat is correctly kept).
  - **Findings**: none surfaced this run.
  - **Partition / deferred**: the full published doc-product audit is DEFERRED to a dedicated pass — the
    `documentation` checkout is on the unreleased `release/0.29.0` train (CTRIB-028 + CTRIB-029 doc commits
    unmerged), not `main`; a proper audit reads the published `main` tree read-only without churning the shared
    train checkout. Queued in `state/PROGRESS.md`; **not skipped silently**.
- **Notes**:
  - Run-log entries for this confirmation are the 4 newest in `integration-tests/run-log/2026-06-22-*.md`
    (digest `cecd88db`, runner = review session #3). The "explicit raw image (build-sut bypassed)" label is
    correct + intentional: I built the SUT once from `75fc06cd` then pinned `ODD_PLATFORM_IMAGE` so all four
    buckets share one coherent image — NOT the LSN-033 frozen-tag anti-pattern. VERIFIED via the regression run.
  - Probe-runtime `lineage/**` drift produced by the run was reverted (`git checkout -- lineage/`) before commit —
    review is read-only on the ontology. VERIFIED via `git status` (clean lineage).
  - Ledger nit (non-blocking): the Implementation-ledger "Code changed" line says "+133/−85 across 17 files"; the
    actual commit is **+214/−85 across 19 files** (the 2 new BE unit-test files = the +81 delta). The code is
    correct; only the ledger count is stale. NOT VERIFIED-as-defect → cosmetic, noted not logged.

## Merge (GATE-2, 2026-06-22)

- **MERGED by the maintainer → `review-ready` → `pending-release`.** GATE-2 is human; the agent never merges.
- **Verified against the remote ref (not the report — `git fetch` + `git log origin/main`, per LSN-034/038):**
  the merge is **`fd71eb3d` (squash, PR #1798)** — `contrib(CTRIB-028): #1754 Term Detail page hardening
  (defects 1,2,4,5,6,7)` — on odd-platform `origin/main` (sitting on top of CTRIB-029's `4028b4a6`/#1799).
- **Content-identical to the reviewed code:** `git diff origin/main 75fc06cd` over the changed files is **empty**;
  spot-verified the D4 core is present on `origin/main` (`DatasetFieldListMapperImpl` `hasNext=(long)page*size<total`
  + `new PageInfo().total(total)`; `ReactiveDatasetFieldRepository.countByTerm`). The released fix == the reviewed fix.
- **Why `pending-release`, not `done`:** milestone `0.29.0` is open. The done flip is owned by **`/review
  release:0.29.0`**, which still owes: (1) the documentation `release/0.29.0` train publishes → Gate-8 live-site
  verify of the Business-Glossary caveat retirement (DOC-478); (2) G-C10 `/enrich` at the release full-substrate
  scan (the deferred ontology refresh — now mergeable, runs at the release scan); (3) real-instance verification
  on the published `ghcr…:0.29.0` image. Consistent with CTRIB-029's GATE-2 → pending-release path.
- **Post-merge cleanup:** the shared `../odd-platform` checkout was reset to `main` and the merged local branch
  `contrib/CTRIB-028-term-detail-hardening` deleted (content preserved in `origin/main` via the squash) — the
  shared-checkout resource is freed. `state/active-streams.yaml` ctrib028 entry → terminal (merged/pending-release).
