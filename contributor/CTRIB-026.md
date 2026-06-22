---
id: CTRIB-026
github_issue_number: 1768
github_issue_url: https://github.com/opendatadiscovery/odd-platform/issues/1768
backlog_item: PLT-096
class: bug
security_sensitive: false   # public issue, maintainer-authored (RamanDamayeu); FRONTEND-only (React/TS). No auth/security posture, no migration, no wire contract. Defect 1 = list mis-ordering UX; Defect 2 = dead code; Defect 3 = truncation-hint UX.
status: review-ready       # /review 2026-06-21 (#2, separate session, max effort) → ACCEPTED. Independently rebuilt the SUT from c54b9c61 and RE-RAN the FULL regression: the test-isolation rework RESOLVES the blocker — test#105 (entity-tags-display:36) PASSES 1.2s inside feature-complete on the reused/polluted stack (DB-confirmed 26 tags on entity 2001). feature-complete 303/304 · multi-stack 9/9 · known-bugs 3 expected-RED (no unexpected GREEN) · ingestion-e2e 6/6 · IT-020 RED proof on published:0.28.0 STILL REDs the #1768 case (G-C15 survives). Lone fail = the known TST-054 owner-association flake (#251 remove-user-owner-mapping/F-173, change-unrelated). Production diff re-read clean. Flip pr-draft → review-ready; GATE 2 (human) owns the merge of PR #1796. Prior review (#1) + ## Rework retained below.
milestone: "0.29.0"        # the issue's AUTHORITATIVE GitHub milestone (open, semver ^\d+\.\d+\.\d+$) -> G-C11 PASS. The issue BODY's YAML `suggested_milestone: 0.28.0` is superseded (0.28.0 already shipped 2026-06-17; the open milestone is 0.29.0) — same CTRIB-022/024 precedent.
reproduced: "live runnable demonstration 2026-06-21 of the EXACT defect mechanism using the real comparator (OverviewTags tagsCompare:26-32) and the real expression order. node script: 21 tags = 20 unimportant (a00..a19, wire order) + 1 important (zzz-critical-pii) at wire index 20. CURRENT `tags.slice(0,20).sort(tagsCompare)` -> visible top-20 contains the important tag? FALSE (first 3: a00,a01,a02). FIXED `[...tags].sort(tagsCompare).slice(0,20)` -> TRUE (first 3: zzz-critical-pii,a00,a01). Defect 2: `[...[{gamma},{alpha},{beta}]].sort()` -> [gamma,alpha,beta] UNCHANGED = no-op confirmed. The gold-standard UI-level RED proof (seed >20 tags, drive the Overview, important tag absent on ref:main / present on the fix) is the Phase-D IT-020 extension on ODD_SUT=ref:main."
adr_required: false        # client-side list-ordering correctness + a small UX hint. No migration, no auth/security-posture, no breaking wire/public-API contract. No governing ADR exists for these components (implicit-adrs lists none for the Overview sidebar lists). G-C7 does NOT fire.
docs_routing: "PENDING Phase-D page read. The issue references DOC-263 (an unreleased umbrella page `data-discovery/entity-detail-page.md` documenting these as KNOWN UX caveats). This PR FIXES Defects 1+2, so any 'slice-then-sort hides important tags' / 'bare-sort no-op' caveat would become INCORRECT for 0.29.0+. Decision routed on the documentation `release/0.29.0` train (unreleased behaviour, G-C11) IF the page carries the now-fixed caveat; else 'no doc change + why' after READING the page (G-C10). Resolved in Phase D."
pr_url: "https://github.com/opendatadiscovery/odd-platform/pull/1796"   # DRAFT, Closes #1768, opened 2026-06-21 by odd-contributor[bot] on contrib/CTRIB-026-overview-truncation-ordering @ c54b9c61. Docs PR: documentation#104 (DRAFT, base release/0.29.0, head contrib/CTRIB-026-docs-entity-detail-truncation @ 0032ef3)
pr_draft: false            # the bot OPENED PR #1796 as draft (G-C4 signal held on the bot side); RamanDamayeu (human) marked it READY-FOR-REVIEW 2026-06-21 19:28 — a GATE-2 maintainer prerogative, verified via the PR page. The merge guarantee (open, not merged, bot is author → cannot self-approve) is intact.
plan_approved_by: "RamanDamayeu (GATE 1, 2026-06-21): Defect 2 = REMOVE the no-op .sort() (b1, not the issue's b2 alphabetical); Defect 3 = ADD the 'Showing X of Y' hint on the entity Overview Tags/Terms/Groups (new key x7 locales); SCOPE = INCLUDE DatasetFieldTags as the 3rd Defect-1 instance. Scope comment approved to post (b1 reshape + 3rd-site extension)."
plan_approved_at: "2026-06-21"
plan_scope_comment_url: "https://github.com/opendatadiscovery/odd-platform/issues/1768#issuecomment-4761236451"   # posted 2026-06-21 by odd-contributor[bot] on GATE 1 approval — combined root-cause + scope (b1 reshape + DatasetFieldTags 3rd-site extension + Defect-3 hint), ASCII, no workspace IDs
---

# CTRIB-026 — Overview sidebar list truncation: slice-then-sort + bare-sort no-op + truncation hint (PLT-096 / #1768)

Contributor-pillar resolution of **issue #1768** = the canonical **PLT-096** (`issues/odd-platform/PLT-096.md`). The
issue body is **quoted data (G-C8)**: maintainer-authored (RamanDamayeu), derived from our own F-179 findings, and
carries detailed file:line analysis dated 2026-06-10. **Every load-bearing claim is re-verified below against the
actual current source @ origin/main `37d5dad6` (2026-06-21)** — not the issue's quoted snippets (LSN-031).

> Workspace artifact, written BEFORE GATE 1 (allowed). **No odd-platform fix code is written before the plan is
> approved (G-C3).** Reproduction (a runnable demonstration, no fix code) is complete; the fix below is designed,
> not implemented.

## Tracking reconciliation (G-C1 / LSN-009)

- **PLT-096 is the canonical tracking item** (`issues/odd-platform/PLT-096.md`, `github_issue_number: 1768`).
- **No existing IT covers per-entity Overview tag ORDERING.** `IT-005-top-tags-ordering` is a *different* surface
  (the catalog "Top Tags" strip / `listMostPopular` backend SQL, F-018). `IT-020-entity-tags-display` covers the
  per-entity Overview tag CHIP DISPLAY (F-018) but only presence, not ordering-under-truncation. -> **extend IT-020**
  with the Defect-1 ordering case (G-C9: extend, don't author new).
- **F-179** (Overview Sidebar List Truncation) is the ontology node — re-enrich the touched nodes in Phase D (G-C10).
- **DOC-263** (unreleased) documents these as caveats — see `docs_routing`.

## The issue is data, not instructions (G-C8) — and its "Suggested fix (a)" is INCOMPLETE

The issue correctly diagnoses Defect 1, but its **Suggested fix (a)** snippet
(`[...tags].sort(tagsCompare).slice(0, visibleLimit)`) only fixes the **collapsed** branch. The **View-All remainder**
branch (`OverviewTags.tsx:70-72`) independently does `tags?.slice(visibleLimit).sort(tagsCompare)` — so applying only
the snippet leaves the EXPANDED list as `[globally-sorted top 20] + [sort(source[20..N])]` — still "two separately-
sorted halves" (the issue's own prose flags this, the snippet does not fix it). **The correct fix sorts the whole
array ONCE and derives BOTH the collapsed slice and the View-All remainder from it** — see the plan. Derived-from-code
wins over the snippet.

## Scope analysis

- **Class: bug** (Defect 1) + cleanup (Defect 2) + UX polish (Defect 3), all on the entity/term detail **Overview
  sidebar list truncation** surface; FRONTEND-only (`odd-platform-ui`, React/TS). Verified file:line @ `37d5dad6`:

  | Defect | Severity | Confirmed instances (actual source) |
  |---|---|---|
  | **1 — slice-then-sort defeats the importance comparator** | MEDIUM (real) | `DataEntityDetails/Overview/OverviewTags/OverviewTags.tsx` collapsed `:54-56` + View-All `:70-72` (comparator `:26-32`, limit 20) · `Terms/TermDetails/Overview/OverviewTags/OverviewTags.tsx` collapsed `:47-49` + View-All `:62-64` (comparator `:20-26`, limit 20) · **`DataEntityDetails/.../DatasetFieldOverview/DatasetFieldTags/DatasetFieldTags.tsx` collapsed `:59-61` + View-All `:75-77` (comparator `compareTags:12-18`, limit 20)** — the 3rd instance, NOT listed in the issue (see GATE-1 decision 3) |
  | **2 — bare `.sort()` no-op on a struct array** | LOW (cleanup) | `DataEntityDetails/Overview/OverviewGroups/OverviewGroups.tsx` collapsed `:49-51` + View-All `:59-61` (limit 10) · `DataEntityDetails/Overview/OverviewTerms/OverviewTerms.tsx` collapsed `:48-50` + View-All `:63-65` (limit 20) |
  | **3 — `View All (N)` is the only truncation signal** | LOW (UX) | `OverviewTags.tsx:85` · `OverviewGroups.tsx:72` (+ the sibling shapes) |

- **Mission relevance:** the entity-detail Overview is the operator's primary at-a-glance surface for an asset. The
  `important` tag flag is a product-level promise — "important tags rise to the top." Defect 1 silently breaks that
  promise for exactly the heavily-tagged entities where it matters most (>20 tags, important ones past wire index 19),
  forcing the operator to expand "View All" and hunt. (`lineage/odd-platform/system-mission.md` — discovery pillar.)
- **Architectural-significance check (G-C7): NO hard stop, NO ADR.** Pure client-side render-ordering correctness +
  an optional UX hint. No migration, no auth/security-posture change, no wire/public-contract change. No governing
  ADR exists for these components.
- **Disclosure: PUBLIC.** Public issue, maintainer-authored. Normal public flow (draft PR + one public root-cause/
  scope comment). NOT a GHSA — G-C14 does not apply.

## Change-request product analysis (G-C16 — critique the WHAT before the HOW)

The bug (Defect 1) is real and its fix-shape (sort-before-slice) is product-correct. Two of the issue's *suggestions*
diverge from the product-right call and are surfaced as **GATE-1 decisions**, never silently absorbed:

### Defect 1 — fix shape: CONFIRMED product-correct (with the completeness correction above)
"Important tags rise to the top" is a legitimate, operator-expected affordance (an importance flag is a first-class
signal). Sort-before-slice is correct. The only correction is completeness: sort ONCE, feed both the collapsed slice
and the View-All remainder, so the full list is a single globally-importance-ordered list. No SME needed — this is a
mechanical correctness fix, not a UX-shape question.

### Defect 2 — the issue prefers (b2) "add an alphabetical comparator"; **product-right is (b1) "remove the no-op"**
- **Restated user-problem (independent of the suggested fix):** the reported defect is *misleading dead code* — a
  `.sort()` that a future maintainer will assume is meaningful. The issue itself rates the order-impact as
  **"effectively nil today."** Nobody reported a wrong ORDER; they reported dead CODE.
- **Verified backend behaviour:** `DataEntityMapperImpl` does NOT sort groups/terms (`:82-92` map `parentGroups`,
  `:265-292` map `parentGroups` + `terms` straight from the repository result); there is no name `ORDER BY` for an
  entity's own terms/groups. So today's rendered order = repository link/id order, and the `.sort()` no-op leaves it
  untouched.
- **The options:**
  - **(b1) Remove the no-op `.sort()` (RECOMMENDED).** Zero behaviour change -> zero regression risk. Solves the
    stated problem (dead code). Groups/terms keep exactly today's order.
  - **(b2) Add an alphabetical comparator (sort-BEFORE-slice).** A *new, unrequested* product change: it alters which
    items appear in the truncated top-N and imposes alphabetical order where the backend gave link order — a
    regression surface for any meaningful wire order, for a list that has **no importance signal** (unlike tags'
    `important` flag) to justify a semantic sort. "Consistency with Tags" is a weak driver: Tags' sort is
    *semantically meaningful*; Groups/Terms' would be *cosmetic*. (If chosen, it MUST be sort-before-slice — the
    issue's implied `.slice().sort()` shape would re-introduce Defect 1.)
- **Verdict (recommendation):** **b1** — subtract the misleading code; do not invent an ordering nobody asked for.
  Surfaced as **GATE-1 decision 1** because the issue author preferred b2 (G-C16). A genuine "alphabetical truncation
  for groups/terms" UX improvement, if wanted, is cleaner as a separate item (and best done via the shared-component
  follow-up below).

### Defect 3 — the truncation hint: reasonable, but additive (i18n cost) -> a GATE-1 scope choice
- **Restated user-problem:** the `(N)` suffix on "View All (N)" is a subtle, post-skim signal; a fast reader can
  under-count. The issue's "Showing 20 of 25" inline hint is a conventional, clear affordance (GitHub/GitLab/catalog
  norm).
- **Reuse-scan (G-C12a):** NO existing "Showing X of Y" pattern in the codebase (grep) — this is a new string. It
  must use `t(...)` (the `#1751`/PLT-205 "no unwrapped JSX literal" guard) and the new key must exist in **all 7
  locale catalogs** (`en,br,es,fr,ch,ua,hy`) or the `i18n-key-parity` vitest test fails ("every non-en catalog has
  EXACTLY en.json's keys").
- **Verdict (recommendation):** include it on the **entity-detail Overview lists (Tags / Terms / Groups)** for a
  consistent, bounded change; the new interpolated key in all 7 locales (machine translations marked best-effort).
  Surfaced as **GATE-1 decision 2** (add vs defer) because it is the one genuinely-discretionary, additive piece.

## Clarify (G-C6)

**No clarifying COMMENT on the issue thread warranted.** The setup is fully specified, the bug is reproduced, and the
only open choices are product decisions resolved at GATE 1 (the plan gate), not setup questions. Posting a thread
question would be noise (and the maintainer authored the issue). The product decisions go to GATE 1, not a comment.

## Reproduction log (G-C1 — runnable, deterministic; the real comparator + the real expression order)

A pure client-side logic bug; reproduced by executing the EXACT mechanism (not reasoning). See `reproduced:`.
```
CURRENT (slice-then-sort) visible top-20 includes the important tag?   false   -> first 3: a00, a01, a02
FIXED   (sort-then-slice) visible top-20 includes the important tag?   true    -> first 3: zzz-critical-pii, a00, a01
Defect 2: [...groups].sort() -> [gamma, alpha, beta]  (UNCHANGED -> bare-sort no-op confirmed)
```
Decision (reproduce-first step 3): Defect 1 is a **bug** (the visible list misrepresents importance), not documented/
expected behaviour. Defect 2 is **dead code** (no behavioural effect). The gold-standard UI-level RED proof (seed
>20 tags, drive the Overview, the important tag absent on `ref:main` / present on the fix) is the Phase-D IT-020
extension — captured against `ODD_SUT=ref:main`.

## Root cause (re-verified against actual source @ origin/main 37d5dad6)

- **Defect 1:** `Array.prototype.slice` runs first and returns the first `visibleLimit` elements in **source (wire)
  order**; `Array.prototype.sort(tagsCompare)` then orders only that already-truncated window. An important tag whose
  wire index is >= `visibleLimit` is never in the window, so it cannot rise — the comparator is computed over the
  wrong set. The View-All remainder branch repeats the same mistake on `slice(visibleLimit)`, so even expanded the
  list is two independently-sorted halves. `tagsCompare` itself is correct (important-first, then `localeCompare`).
- **Defect 2:** `Array.prototype.sort()` with no comparator coerces elements via `String(...)`; every
  `DataEntityRef` / `LinkedTerm` stringifies to `"[object Object]"`, all compare equal, the sort is a stable no-op.
  The list renders in the array's existing (backend/wire) order either way.
- **Defect 3:** the truncated state exposes only the parenthetical `(N)` on the "View All (N)" button; there is no
  always-visible "this list is truncated" affordance.

## Plan (GATE 1 artifact — design-before-build per G-C12; PENDING APPROVAL)

### Design-before-build (G-C12)
- **(a) Reuse-scan.** No new *component* is built. The fix restructures existing slice/sort/map expressions. Defect 3
  reuses MUI `<Typography variant='caption'>` + the existing `t()` i18n machinery (no new styled component required;
  an inline caption matches the existing `Typography variant='subtitle2'` "Not created" pattern in these files).
  **Reuse note / follow-up:** the slice + View-All-collapse pattern is hand-rolled in ~7 places (the 4 issue lists +
  `DatasetFieldTags` + `OverviewMetrics` + `OverviewAttachments`). A shared `<TruncatedList>` is the real subtraction
  — logged as a follow-up (G-C5), NOT done here (out of scope; would balloon the diff).
- **(b) ADR-check.** No ADR governs these components; none proposed (a client-side correctness fix is not an
  architectural decision).
- **(c) Impact-dimension checklist.**
  - *i18n:* Defect 1 + Defect 2 add **no** strings. Defect 3 adds ONE interpolated key
    `"Showing {{visible}} of {{total}}"` to **all 7 locales** (en authoritative; br/es/fr/ch/ua/hy best-effort,
    marked) — the parity test enforces it. (If Defect 3 is deferred at GATE 1, zero i18n change.)
  - *generated clients:* none — no contract/OpenAPI change (FE-only, no DTO touched).
  - *every consumer:* the edited components are leaf render components; no signature/prop change -> no external
    consumer. (Defect 2 b1 only deletes a `.sort()` call.)
  - *migration:* none.
  - *docs + ontology:* `docs_routing` (DOC-263 page, Phase D) + F-179 re-enrich (G-C10).
  - *tests:* unit (vitest render) + integration (IT-020 extension) — below.
- **(d) Product-Owner / SRE lens.** Covered in the Change-request product analysis above (the operator value of
  Defect 1 = important tags actually visible; Defect 2 = honest code; Defect 3 = a clear "there's more" signal). The
  one shape question (Defect 2 b1-vs-b2) is the GATE-1 decision. No `odd-sme` note needed — these are render-
  correctness + a conventional truncation affordance, within maintainer/PO expertise; the SME's prior tag-importance
  framing (IT-005/F-018) already affirms "important tags are a first-class surface."
- **(e) Look at the pixels (G-C12 step 5):** if Defect 3 ships, screenshot the rendered hint (caption legibility /
  spacing above the chips / not confusable with a chip) during impl, not just a green e2e.

### The changes (per GATE-1 decisions)

**Defect 1 — sort ONCE, slice both branches (all approved instances):**
For each Tags component, compute the sorted array once and derive both slices from it:
```tsx
// OverviewTags.tsx (and the term-detail OverviewTags; DatasetFieldTags pending decision 3)
const sortedTags = [...tags].sort(tagsCompare);          // copy -> no prop mutation; sort the WHOLE set once
// collapsed:   sortedTags.slice(0, visibleLimit).map(...)
// View-All:    sortedTags.slice(visibleLimit).map(...)   // remainder of the SAME globally-sorted list
```
(Exact placement adapts to each file; `tags` is guarded by the existing `tags?.length ?`. The spread copy is required
because `.sort` mutates and `tags` is redux-derived. Instances: the 2 issue-listed Tags lists + DatasetFieldTags iff
GATE-1 decision 3 = include.)

**Defect 2 — remove the no-op (b1, recommended) OR add an alphabetical comparator (b2), per GATE-1 decision 1:**
- *b1:* delete `.sort()` from `OverviewGroups.tsx:51,61` and `OverviewTerms.tsx:50,65` (collapsed + View-All). No
  behaviour change.
- *b2 (only if chosen):* add a name comparator and apply sort-BEFORE-slice (same shape as Defect 1) on both branches.

**Defect 3 — truncation hint (per GATE-1 decision 2; if "add"):**
Above each truncated list, when `length > visibleLimit` and not expanded:
```tsx
{!viewAll && tags && tags.length > visibleLimit && (
  <Typography variant='caption' color='text.secondary' sx={{ width: '100%', mb: 0.5 }}>
    {t('Showing {{visible}} of {{total}}', { visible: visibleLimit, total: tags.length })}
  </Typography>
)}
```
on the entity-detail Overview Tags / Terms / Groups. Key added to all 7 locales.

### Tests (G-C9 — both buckets; G-C15 for any CHANGED test)
- **Unit (vitest, `odd-platform-ui`):** NOTE — odd-platform PR CI runs `:odd-platform-api:build` (backend) +
  Playwright; it does **not** run vitest, so these are a LOCAL + dev guard (run here per G-C2, not CI-gated). Still
  authored: the precise RED->GREEN localizers.
  - *NEW `OverviewTags.test.tsx`:* render with 21 tags (1 important at wire index 20); assert the important tag's
    chip is in the rendered (collapsed) list. RED on base (absent), GREEN on fix. (+ a Defect-3 case if shipped:
    the "Showing 20 of 21" caption is present when truncated, absent at <=20.)
- **Integration (odd-team `IT-020`, extend — the load-bearing CI/maintainer gate via `run-suite.sh`):**
  - *NEW case:* a bulk seed helper inserts >20 tags on `ENTITY_ID` with the `important` one last (raw SQL, the IT-005
    pattern: `INSERT INTO tag(name, important)` + `tag_to_data_entity`). Open `/dataentities/{id}/overview`; assert
    the important tag is visible WITHOUT expanding View-All. **Capture the real `/api/dataentities/{id}` tag wire
    order ONCE before writing the assertion** (the IT discipline — never an assumed shape). RED on `ODD_SUT=ref:main`
    (important tag hidden), GREEN on the working-tree SUT. This is the user-facing proof (G-C9: user-facing ->
    integration mandatory).
  - *Confirm* IT-020's existing display + negative cases still GREEN.
- **Defect 2 (b1):** NO new behavioural test — a no-op removal has no behaviour to assert RED->GREEN; safety = the
  existing `IT-024-entity-groups-display` / `IT-016-entity-terms-display` staying GREEN (display order unchanged).
  Stated honestly (not a gap). (If b2 is chosen instead, add an ordering assertion.)

### Regression (G-C2 — FULL set, both buckets, working-tree SUT; impacted IT = inner loop, not the gate)
- Unit: `scripts/run-platform-tests.sh` (full `:odd-platform-api:build`) — verifies the FE-only change does not break
  the backend build/bundle (the UI is bundled into the SUT). Plus `cd odd-platform-ui && npm test` (vitest, local) for
  the FE unit + the i18n parity guard.
- Integration (one e2e suite at a time; actual pass/fail counts): `run-suite.sh feature-complete` (green) +
  `multi-stack` (green-target) + `known-bugs` (expected RED — watch an unexpected GREEN) + `ingestion-e2e` (green);
  + the IT-020 RED proof on `ODD_SUT=ref:main`.
- **Local patch-coverage gate (G-C13):** the backend JaCoCo 98%-changed-files gate is **N/A** — this change touches
  **zero Java lines** (FE-only), so there are no changed Java lines to cover. (vitest has no enforced coverage gate
  in this repo's CI.) Sufficiency is the meaningful unit + the user-facing IT, not a coverage %.

### Scope exclusions (G-C5 — deliberately NOT in this PR)
- **A shared `<TruncatedList>` component** to de-duplicate the ~7 hand-rolled slice/View-All blocks — the real
  subtraction, but a refactor well beyond this bug. **Logged as `issues/odd-platform/PLT-232.md`** (carries the
  cross-cutting class, the un-applied-hint inconsistency, and the still-open scroll-position facet).
- **`OverviewMetrics` / `OverviewAttachments` truncation** — different list shapes, not tag/group/term importance
  ordering; no reported defect. Not touched.
- **Defect 3 on the term-detail / dataset-field lists** — kept to the entity-detail Overview for a bounded change
  (the issue names Tags+Groups there). Folds into the shared-component follow-up.
- **Backend term/group ORDER BY** — out of scope; the fix is purely client-side. (b1 deliberately preserves the
  backend order.)

### Drafted public comment (posts on GATE 1 approval — folded root-cause + scope, ONE comment, ASCII, no workspace IDs)
```
Confirmed all three defects against the current source (re-verified the file:line; minor drift from the
2026-06-10 quotes, mechanism identical).

Defect 1 (the real one): tags.slice(0, 20).sort(compare) slices BEFORE it sorts, so the importance
comparator only orders the first 20 tags in wire order -- an important tag past index 19 never reaches
the visible list. The View All branch sorts the remainder separately, so even expanded the list is two
independently-sorted halves. Reproduced deterministically (21 tags, the important one last: it is absent
from the visible top-20, and present once we sort before slicing).

Fix (this PR, milestone 0.29.0):
- Defect 1: sort the whole tag list ONCE, then slice -- for both the collapsed view and the View All
  remainder, so the full list is a single importance-ordered list. Applied to every tag list that uses
  the importance comparator, including the dataset-field tags list (a third occurrence of the same bug,
  not listed in the report).
- Defect 2: the bare .sort() on the groups/terms lists is a no-op (it stringifies structs to
  "[object Object]"); since those lists already render in the order the backend returns and no specific
  order was requested, this removes the misleading dead code rather than inventing an alphabetical order.
- Defect 3 [if approved]: an inline "Showing 20 of N" hint above a truncated list so the truncation is
  visible without clicking.

Covered by a unit test (an important tag past the cap is rendered after the fix) and the team's
integration suite (driving the entity Overview with >20 tags). No API/contract change.
```

## Test / Docs / Ontology ledger (Phases D-E)

Implementation commit: **odd-platform `c54b9c61`** on `contrib/CTRIB-026-overview-truncation-ordering`
(12 files +123/-96: 5 components, 7 locales, 1 new unit test). FE-only — **zero Java lines changed**.

| Item | Status |
|---|---|
| Defect 1 — sort-before-slice on entity `OverviewTags`, term-detail `OverviewTags`, `DatasetFieldTags` (one sorted array feeds both the collapsed slice + the View-All remainder) | DONE (`c54b9c61`) |
| Defect 2 — removed the no-op `.sort()` on `OverviewGroups` + `OverviewTerms` (both branches) | DONE |
| Defect 3 — inline `Showing {{visible}} of {{total}}` hint on entity Overview Tags/Terms/Groups | DONE |
| i18n — new key in ALL 7 locales (en authoritative; br/es/fr/ch/ua/hy best-effort) | DONE — `i18n-key-parity` vitest GREEN (10/10; exact key-set parity across catalogs) |
| `tsc --noEmit` (typecheck) | DONE — exit 0 |
| `eslint` (changed files) | DONE — 0 errors, 0 warnings (after `prettier --write`) |
| Unit (vitest) `OverviewTags.test.tsx` — important tag past the cap renders; hint shows when truncated, absent when not | DONE — **3/3 GREEN on the fix**; **RED on origin/main** (2 failed: important tag absent + no hint) — RED proof captured by swapping the pre-fix component. NOTE: vitest is NOT in odd-platform CI (PR CI = `:odd-platform-api:build` + Playwright); this is a local/dev guard, run here per G-C2 |
| Integration IT-020 (extended) — `seedEntityImportantTagPastCap` (25 filler + 1 important `zzz-` tag past the cap) → Overview shows the important tag collapsed + the `Showing 20 of 26` hint | DONE — **e2e:PASS** on the working-tree SUT @ `c54b9c61` (digest `sha256:1b4c8248…`), 3/3 incl. the #1768 case (run-log `2026-06-21-IT-020.md`) |
| IT-020 RED proof | DONE — **e2e:FAIL on the pre-fix baseline**: the #1768 case FAILS (important tag hidden + no hint, 11.7s timeout), the 2 display cases PASS. `ODD_SUT=ref:main` (37d5dad6) build OOM'd at gradle's 512 MiB heap (environmental — the CTRIB-024 precedent), so the RED was taken on `ODD_SUT=published:0.28.0` (digest `sha256:0b0391b0…`, the latest published release = pre-fix; same slice-then-sort bug). G-C15: the test catches the bug (RED on base, GREEN on the fix), not hidden. |
| FULL integration regression on the working-tree SUT @ `c54b9c61` | **`feature-complete` 304/304 PASS** (api:PASS e2e:PASS; incl. every entity-detail Overview spec — IT-013/016/020/024/etc.) · **`multi-stack` 9/9 PASS** · **`known-bugs` 3 expected-RED** (IT-007/PLT-086 attachment durability, IT-006/F-042 error-boundary, IT-004/PLT-052 dashboard WARNING-status — identical to the established baseline; none touch tag-list rendering; **no unexpected GREEN** = no un-flipped fix) · **`ingestion-e2e` 6/6 PASS**. G-C2 met. Run-logs `integration-tests/run-log/2026-06-21-{suite}.md`. |
| Full unit build (`:odd-platform-api:build`) | N/A-to-this-change (zero Java lines) — the working-tree SUT build (which DOES bundle the FE + compiles the backend) succeeded for every IT run above; backend untouched |
| Local patch-coverage gate (G-C13) | backend JaCoCo 98%-changed-files = **N/A** (zero changed Java lines); FE has no enforced coverage gate in CI. Sufficiency = the vitest unit + the user-facing IT-020 |
| Docs (G-C10/G-C11) — `entity-detail-page.md` Section 5 revised (importance-ordered across the cap + the inline hint + Groups/Terms server-order; removed the pre-fix caveats) | DONE — documentation `0032ef3` on `contrib/CTRIB-026-docs-entity-detail-truncation` (base `release/0.29.0`); paired **DOC-475** (`backlog/docs/DOC-475.md`, milestone 0.29.0, pending-release). Page READ first (G-C10). Frontmatter parses; description 189 chars (≤200). Sibling pages checked — `tagging.md:63` is the SEPARATE Top-tags catalog bug (already fixed 0.28.0); `data-discovery.md`/`groups-domains.md` references are neutral nav text, still accurate → no change |
| Ontology (G-C10) — F-179 flow + reflection annotated `resolution` (5 of 6 drift classes resolved; `view_all_collapse_…_scroll_position` left out-of-scope) | DONE — `F-179.yaml` (flow) + `feature-reflections/detail/F-179.yaml` (reflection front-section); both PyYAML-valid. Graph re-embed DEFERRED-with-rationale (annotation-only on existing nodes; no incremental embed tool; rides the next ontology batch — CTRIB-024 precedent) |
| G-C12 step 5 — pixel review of the rendered hint | DONE — screenshot (`test-results/ctrib026-hint.png`, on the working-tree SUT @ c54b9c61): the `Showing 20 of 26` hint renders as a legible muted-gray caption above the chips (good contrast, single line, no wrap) and the important tag `zzz-it020-important-pii` (orange "important" border) is FIRST in the collapsed list. Reuses the standard `Typography variant='caption' color='texts.secondary'` pattern (9× precedent) — no raw-string-in-wrapper defect (LSN-035 absent). |
| G-C13 — Principal sufficiency | MET — enough + meaningful tests (vitest RED-on-base/GREEN-on-fix + the user-facing IT, both run); backend patch-coverage gate N/A (zero Java); no control lost (5 leaf components restructured, no shared signature/util changed; no shared truncated-list component introduced — logged as a follow-up); no existing functionality harmed (full FE suite 46/46 + full integration regression green). |
| **Definition of Done (5 gates)** | **MET** — (1) FE unit build green on the working tree (vitest 46/46, tsc, eslint) + backend untouched · (2) FULL integration regression on the working-tree SUT @ c54b9c61 (feature-complete 304 / multi-stack 9 / ingestion-e2e 6 green; known-bugs 3 expected-RED, no unexpected GREEN) + IT-020 GREEN-on-fix / RED-on-pre-fix · (3) docs read + revised + routed (release/0.29.0, DOC-475) · (4) ontology re-annotated + committed (F-179 flow + reflection) · (5) Principal sufficiency + pixel review. |
| Draft PR `Closes #1768` (odd-platform) + docs PR (documentation@release/0.29.0) | DONE — **odd-platform DRAFT [PR #1796](https://github.com/opendatadiscovery/odd-platform/pull/1796)** (`Closes #1768`, `Milestone: 0.29.0`) + **documentation DRAFT [PR #104](https://github.com/opendatadiscovery/documentation/pull/104)** (base `release/0.29.0`). Both `draft:true` (the bot cannot self-merge — G-C4). Branches pushed by `odd-contributor[bot]`. |

## GATE 1 — APPROVED (2026-06-21, RamanDamayeu)
All three recommended options chosen:
1. **Defect 2 = b1** — remove the no-op `.sort()` (NOT the issue's b2 alphabetical). Zero behaviour change.
2. **Defect 3 = ADD** — the "Showing X of Y" hint on the entity Overview Tags/Terms/Groups; new interpolated key in
   all 7 locales.
3. **Scope = INCLUDE `DatasetFieldTags`** — the 3rd Defect-1 instance, beyond the issue's listed files.

Next: post the combined root-cause + scope comment (b1 reshape + DatasetFieldTags extension), record the URL, branch
`contrib/CTRIB-026-overview-truncation-ordering`, implement.

## Review (2026-06-21, session: independent /review — max effort, separate from implement)

- **Result**: **REJECTED → `blocked`**. The **production fix is CORRECT and fully proven** (diff read line-by-line; IT-020 #1768 case GREEN on a reviewer-built branch SUT and RED on pre-fix `published:0.28.0`; **feature-complete 304/304 GREEN on a clean stack**). It is blocked on a **single, in-scope, test-harness-only defect**: the new IT-020 helper `seedEntityImportantTagPastCap` pollutes shared entity 2001 and REDs feature-complete under the recommended pinned/reused-stack run pattern. Production code (odd-platform PR #1796) is unaffected and ready; the rework is small and touches only the odd-team integration suite.

### Reviewer's own runtime evidence (SUT built from the reviewed commit)
- **SUT**: `build-sut.sh ref:contrib/CTRIB-026-overview-truncation-ordering` → `built from source: …@ c54b9c61`, image `odd-platform:odd-team-sut` (my build digest `sha256:352d8b80…`). No OOM (`-Xmx3g`).
- **IT-020 #1768 GREEN proof** (branch SUT): `3 passed` incl. `…:58 › an important tag past the truncation cap is visible while collapsed (#1768)`. VERIFIED via `run-suite.sh IT-020`.
- **IT-020 #1768 RED proof** (pre-fix `published:0.28.0`, digest `sha256:0b0391b0…`): test#3 (#1768) **FAILS** — `getByText('zzz-it020-important-pii')` element-not-found (10s); test#1/#2 pass. The test is a valid RED→GREEN discriminator (G-C9). VERIFIED via `ODD_SUT=published:0.28.0 run-suite.sh IT-020`.
- **Full regression on a CLEAN stack** (pinned branch SUT, fresh DB): **feature-complete 304/304 PASS** · **multi-stack 9/9 PASS** · **known-bugs 3 expected-RED (no unexpected GREEN)** · **ingestion-e2e 6/6 PASS**. Matches the implementer's claim on a clean run. VERIFIED via `run-suite.sh` per suite.
- **The defect (feature-complete on a PINNED/REUSED stack): 2 failed / 302 passed.**
  - **#105** `entity-tags-display.spec.ts:27 › a tagged entity renders the tag` (✘ 11.4s): `getByText('IT020GoldTag')` not found. **Root cause = test pollution**: the new `seedEntityImportantTagPastCap` leaves **26 tags** on shared entity 2001 (DB-confirmed: `SELECT count(*) FROM tag_to_data_entity WHERE data_entity_id=2001` → `26`, incl. `zzz-it020-important-pii`+25 `it020-wire-*`). On a reused stack, test#1 (`seedEntityTag`, no pre-clear) adds a 27th tag that the (correct) importance-sort pushes past the 20-cap → not visible → timeout. **The production behaviour is correct** (a non-important tag past the cap *should* stay hidden); the TEST's assumption is what breaks. PASSES on a clean stack (✓ 1.4s) — confirming pollution, not regression.
  - **#251** `remove-user-owner-mapping.spec.ts:123 › F-173` (✘ 60s `waitForResponse` timeout): an **owner-mapping** flake, zero relationship to the tag/Overview change. PASSES on the clean re-run (✓ 2.0s) → transient flake, not change-related, not reproducible.

### Acceptance criteria (contributor DoD, G-C2/G-C9/G-C10 + the 5-gate DoD)
- [x] Reproduce-first (G-C1) — PASS: runnable demonstration logged; mechanism re-verified against `37d5dad6`. VERIFIED via the diff base.
- [x] Fix shape matches the approved plan (Defect 1 sort-before-slice on the 3 tag lists; Defect 2 b1 no-op removal; Defect 3 hint on entity Overview Tags/Terms/Groups) — PASS. VERIFIED via `git diff 37d5dad6 c54b9c61` over all 5 components.
- [x] Unit test injects the failing condition (G-C9) — PASS: `OverviewTags.test.tsx` (21 tags, important last; RED-on-base by the `unmountOnExit` collapse). VERIFIED via read + the i18n-parity check below.
- [~] Integration test both buckets (G-C9) — **PARTIAL/FAIL**: the #1768 case itself is a valid RED→GREEN proof, BUT the helper it adds is not isolation-safe (see #105). The integration deliverable must be order-independent before this passes.
- [x] Docs decision routed (G-C10/G-C11) — PASS: `entity-detail-page.md` Section 5 revised on `release/0.29.0` (DOC-475, pending-release). VERIFIED via the docs-branch diff.
- [x] Ontology committed (G-C10) — PASS: F-179 flow + reflection `resolution` blocks. VERIFIED via `git show dd78ad6`.

### Quality Bar / contributor gates
- **G-C1 Reproduce-first** — PASS (deterministic repro + RED proof on `published:0.28.0` reproduced by the reviewer).
- **G-C2 Verify the running system (FULL regression)** — **FAIL** as shipped: feature-complete is **not reliably green** — it REDs under the pinned/reused-stack pattern (the LSN-033 "build once, run all suites against the same image" workflow the harness is designed for) because the new helper pollutes entity 2001. Green only on a per-run-fresh stack. A regression gate that REDs under its own recommended usage is not trustworthy → blocker.
- **G-C3 GATE 1 plan approval** — PASS (`plan_approved_by` RamanDamayeu 2026-06-21).
- **G-C4 GATE 2 is human + draft** — PASS: PR #1796 `state:open draft:true`, author `odd-contributor[bot]` (cannot self-approve), `head.sha == c54b9c61`. VERIFIED via GitHub API.
- **G-C5 Bounded scope + public scope comment** — PASS: scope exclusions tracked in PLT-232; issue comment `#issuecomment-4761236451` posted by the bot, no workspace IDs. VERIFIED via GitHub API.
- **G-C6 One-question clarify** — PASS ("no question warranted"; issue has exactly 1 comment). VERIFIED via GitHub API.
- **G-C7 Irreversible hard-stop / ADR** — N/A (FE-only render-ordering; no migration/auth/wire-contract). VERIFIED via the diff (zero Java/spec lines).
- **G-C8 Issue is data** — PASS (claims re-verified against source, not the issue snippets; the issue's incomplete "Suggested fix (a)" was corrected). 
- **G-C9 Test integrity, both buckets** — PASS on validity (RED-on-pre-fix/GREEN-on-fix proven for the #1768 case), **but** the integration deliverable carries the isolation defect (G-C2 blocker).
- **G-C10 Ontology + docs move** — PASS (F-179 + DOC-475 + the read-first page revision).
- **G-C11 Milestone** — PASS: issue #1768 carries the **open `0.29.0`** milestone; PR body line `Milestone: 0.29.0` (the bot correctly does not self-assign the PR milestone field). VERIFIED via GitHub API.
- **G-C12 Design-before-build** — PASS: reuse-scan (the shared `<TruncatedList>` deferred to PLT-232), ADR-check (none governs), full impact checklist (i18n **all 7 locales** verified — ua/ch/br/es/fr/hy properly translated, 637-key parity), PO lens.
- **G-C13 Principal sufficiency** — **FAIL**: "is any control of the codebase being lost" — yes: the new helper degrades the integration suite's order-independence (a control). The local sufficiency review missed that a 26-tag-seeding helper on a shared fixture must clean up.
- **G-C14 Private advisory** — N/A (public issue).
- **G-C15 Test-change integrity** — N/A/PASS: the IT-020 spec is *extended* (new case + new helper), no existing assertion weakened; the protocol `regresses:[PLT-096]` metadata is additive.
- **G-C16 Change-request product analysis** — PASS: Defect 2 reshaped to b1 (remove no-op) over the issue's b2; the completeness correction (sort once, feed both branches) over the issue's partial snippet; both surfaced as GATE-1 decisions.

### Universal/doc gates (the docs deliverable)
- **Gate 7 Layout** — PASS: `entity-detail-page.md` has its SUMMARY entry; the change edits Section 5 of an existing page (no SUMMARY/TOC change needed).
- **Gate 8 Publishing** — **PENDING-RELEASE (0.29.0)**: docs ride `release/0.29.0`; branch sub-checks PASS (frontmatter parses; description 191 chars ≤200; no new links). Post-merge URL recorded in DOC-475: `https://docs.opendatadiscovery.org/data-discovery/entity-detail-page`. (Note: docs PR #104 is on the **private** `documentation` repo — unverifiable via WebFetch/no `gh`; branch content verified via authenticated git; PR draft-state defers to the release gate.)
- **Gate 9 Provenance** — PASS: every claim re-verified against source (`texts.secondary` is a real theme key — `palette.ts:82`, 17× precedent; the docs reframe is accurate to the fix).
- **Gate 11 Audience isolation** — PASS: the published page uses operator language; the fix *removed* prior impl-jargon ("stringification defect", "DataEntityRef[]"). Mechanical grep clean.

- **Outbound URL sweep**: GitHub API — PR #1796, issue #1768, comment #4761236451 all VERIFIED; `documentation` repo confirmed **private** (404 unauth) so docs PR #104 NOT VERIFIABLE here → defers to the release gate.
- **Banned-phrase check**: none.
- **Regressions**: none in production. feature-complete green-on-clean (304/304); the 2 pinned-run failures are the helper-pollution (#105, this change) + an unrelated owner-mapping flake (#251).
- **Navigation**: consistent (no pointer shifts).
- **Upstream issues logged**: none new (the issue thread already carries the scope comment).
- **Doc-product editorial findings** (audit per `playbooks/doc-product-editorial-read.md`):
  - **Coverage this run**: change blast-radius — whole-tree term-sweep for `importance|important tag|View All|truncat|slice|Showing 20 of` (clean: `tagging.md:63` = the *separate* 0.28.0 Top-tags catalog bug; `business-glossary.md:181`/`query-examples.md:75`/`alerting.md` = unrelated truncation surfaces) + `entity-detail-page.md` (internally coherent) + `tagging.md`/`groups-domains.md` siblings. **Queued for a dedicated editorial pass**: the remaining doc tree (`data-quality/**`, `integrations/**`, `configuration-and-deployment/**`, `developer-guides/**`) — not read end-to-end this run.
  - **Findings**:
    - **DOC-476** (low, parallel-surfaces-with-drift) — `groups-domains.md:98` calls the entity-detail page's Groups note a "visible-window truncation **caveat**", but #1768 downgraded that `warning` to an `info` (server-order) note; "caveat" mildly lags. Same release train. Logged.
    - Sub-threshold (NOT logged): `entity-detail-page.md` hint-intro uses "Showing 20 of N" as the generic example while Groups caps at 10 — the exact caps (10/20) are stated twice in the same section, so it's a representative-example nit, not a contradiction. Noted in DOC-476 as a secondary line.

### Rework fix-list (small, in-scope — re-submit after)
1. **Make the IT-020 #1768 deliverable order-independent.** `seedEntityImportantTagPastCap` (or `entity-tags-display.spec.ts`) must restore entity 2001 to a clean tag state so it does not pollute sibling tag-display specs on a reused stack. Cleanest: add `test.afterEach(async () => { await clearEntityTags(); })` to the describe block (`clearEntityTags()` already exists — `helpers/db.ts:613`, deletes all `tag_to_data_entity` for entity 2001); or have test#1 (`seedEntityTag`, line 27) `clearEntityTags()` first, matching test#2's discipline.
2. **Re-measure with the run order that exposed it**: build the branch SUT once, `ODD_PLATFORM_IMAGE`-pin it, run `IT-020` then `feature-complete` against the same image → confirm **feature-complete 304/304 GREEN** (no pollution). That is the gate.

### Separate follow-up (genuinely separable — NOT touched by the rework)
- **#251 owner-mapping flake** — `remove-user-owner-mapping.spec.ts:123` (F-173) can hard-timeout (60s `waitForResponse` for `/api/owner_association_request`) under a long single-worker run; passed in 2.0s on the clean re-run. Pre-existing, unrelated to #1768. Logged as a low-priority test-hygiene watch item (`backlog/tests/TST-054.md`).

**Status flip**: `pr-draft` → `blocked`. The implementer applies the one-line cleanup, re-runs feature-complete pinned, and re-submits to `/review`. The production diff (PR #1796), the docs train, and the ontology stay as-is — all verified correct.

### Ontology impact analysis (added 2026-06-21, on maintainer request — `/code-walk`)
Ran the `feature-advisor` over the full ontology (F-179 flow+reflection, concepts, implicit-adrs, refactoring-scopes, doc-gaps, test-map, live docs) → `lineage/odd-platform/feature-walks/2026-06-21-overview-truncation-impact.md` (HIGH confidence). It **corroborates the bounded blast radius** and adds precision:
- **No wider correctness blast radius.** F-176 (the parent Overview composer) passes the arrays down as props and imposes **no shared ordering contract** (`F-176.yaml:173-197,296-322`), so the fix is contained to the leaf panels; no dependent is structurally affected (no signature change). Bounded to the entity-Overview / term-detail-Overview / dataset-field surfaces.
- **Untouched siblings classified (the "what else shares the pattern" question), source-grounded + reviewer-spot-checked:** `AttachmentsList.tsx:42-63` = structural pattern-twin (slice+Collapse+toggle) but **NO `.sort()` → never had the importance bug**; `OverviewMetrics`/`OverviewMetadata` = height-collapse (no slice); `OverviewEntityGroupItems` = server-paginated. **NO untouched sibling carries the slice-then-sort importance bug** — the only divergence the bounded fix creates is the **(b) truncation-hint UX gap** (3 fixed panels gain "Showing N of M"; AttachmentsList/OverviewMetrics + the term-detail & dataset-field tag lists don't). Already captured by **PLT-232** — the walk recommends naming these specific siblings in PLT-232's acceptance criteria so the divergence is consolidated, not left as permanent drift.
- **Confirmed the two highest-value reviewer checks (independently already done in this review):** (UC-2) the fix must compute **ONE** sorted array feeding both the collapsed slice AND the View-All remainder (else the H-002 "two-independently-sorted-halves" merge defect reopens) — verified in the diff (`const sortedTags = [...tags].sort(...)` once); (UC-1) the ordering assertion — the unit test's important-tag-present-in-the-capped-view + the IT-020 #1768 case both assert the ordering property, not mere presence.
- **Reinforces the test concern:** `test-map.yaml` has **no F-179 coverage**; the pre-existing e2e tests (IT-016/020/024) assert chip *presence*, never *ordering* — i.e. this feature's test layer is thin, consistent with the review's test-deliverable blocker. The rework should pin UC-1/UC-2 (the walk proposes shapes).
- **No governing ADR** (verified absent via Glob + implicit-adrs grep). The fix aligns with the already-shipped backend LSN-019 "rank-then-truncate" stance (the 0.28.0 Top-Tags fix); the walk flags a *future* implicit-ADR seed ("truncated read-surface lists rank the full set before the visible cut") to consider alongside PLT-232 — strategic, non-blocking.
- **Docs**: corroborates DOC-475 — the live `entity-detail-page` still describes pre-fix behaviour, correctly release-gated to 0.29.0 (not currently wrong — it describes the live 0.28.0). No new doc action.
- **One trivial net-new pre-existing smell surfaced (NOT #1768):** `OverviewMetrics.tsx:50-51` is a **duplicated identical early-return** (dead line). Upstream, harmless, out of scope — candidate for a `/log-issue` draft if the maintainer wants it tracked.
- **Honest coverage gap the walk flags:** the 5 changed leaf `.tsx` have **no enriched sidecars** (FE enrichment is thin; substrate last scanned `e67461de`), so the walk asserts *blast radius*, not *diff-line correctness* — the latter is covered by this review's own `git diff` read against `c54b9c61`. A follow-up `/enrich` on these components would close the gap.

**Net:** the ontology analysis does not change the verdict (the test-isolation blocker stands) — it independently confirms the change is correctly bounded with no hidden dependents, and sharpens PLT-232's scope with the named siblings.

## Rework (2026-06-21, maintainer-directed — resolve the `/review` blocker)

**The blocker is fixed.** Per the maintainer's instruction to implement the test change needed to close the item, the single test-isolation defect from the `/review` was fixed and re-verified against the exact scenario that exposed it.

### The fix (one file, test-harness only — no production code)
`integration-tests/e2e/specs/entity-tags-display.spec.ts` — added a hermetic reset to the describe block so every test owns its precondition:
```ts
test.beforeEach(async () => {
  await clearEntityTags();
});
```
Rationale: the `#1768` case seeds >20 tags via `seedEntityImportantTagPastCap`; without a per-test reset, a reused/pinned stack (the LSN-033 "build once, run IT-020 then feature-complete on one image" pattern) carried that 26-tag residue into the positive test (`a tagged entity renders the tag`, line 27), pushing its single seeded tag past the importance-ordered 20-cap. `clearEntityTags()` (`helpers/db.ts:613`) already existed; this just makes the spec order-independent. **No assertion changed; the `#1768` RED-proof test is untouched** (G-C15 safe — it still seeds 26 + asserts the important tag visible).

### Verification — re-ran the EXACT blocker scenario (reviewer's own SUT, rebuilt from the reviewed commit)
- **SUT** rebuilt from `contrib/CTRIB-026-overview-truncation-ordering @ c54b9c61` (the OOM that hit the first rebuild was cleared by raising the gradle daemon heap to 3g via `~/.gradle/gradle.properties` — an env config, not a repo change).
- **IT-020 (with the fix): 3 passed** (incl. the `#1768` case) — `e2e:PASS`.
- **feature-complete PINNED on the reused stack (the scenario that previously RED'd): test#105 `entity-tags-display:27` now PASSES** — the blocker is gone. Suite = **303 passed / 1 failed**.
- **The lone failure is NOT the blocker and NOT a `#1768` regression:** `direct-bind-create.spec.ts:60` (F-172 admin owner-binding modal) — the "Create association" button missed its 10s render window (11.0s). **Re-ran it isolated → 3 passed (1.2s)** = a confirmed transient flake, same owner-association admin-UI class as the earlier `#251 remove-user-owner-mapping`. Tracked in **TST-054** (now 2 observed instances).

### Status
`blocked` → **`pr-draft`** (the rework is done; the change's test deliverable is now order-independent and the `#1768`-relevant suite is green). The production diff (PR #1796), docs train, and ontology are unchanged — all still verified correct. **A SEPARATE `/review` session owns the `pr-draft` → `review-ready` flip** (this session implemented the rework, so it cannot self-advance past the gate); GATE 2 (human) owns the merge.

## Review #2 (2026-06-21, session: independent separate-session `/review` — opus-4-8, max effort, reject-by-default)

- **Result**: **ACCEPTED → `pr-draft` → `review-ready`.** This is the post-rework re-review (a session distinct from the rework). The test-isolation rework **RESOLVES the Review-#1 blocker**, and I confirmed it by **rebuilding the SUT from the reviewed commit `c54b9c61` myself and re-running the FULL regression**, including the exact LSN-033 reused-stack scenario that exposed the original defect. The production fix is correct (diff re-read line-by-line), the docs train is accurate + audience-clean, the ontology moved, and GitHub state is human-gated. GATE 2 (the human merge of PR #1796) owns `done` — never self-merged.

### Scope of this re-review
Since Review #1 the ONLY change is the odd-team test-isolation fix (`integration-tests/e2e/specs/entity-tags-display.spec.ts` +9: a `test.beforeEach(clearEntityTags)` on the F-018 describe block — commit `7bc7dad`). The odd-platform production diff is byte-identical at `c54b9c61` (PR #1796 unchanged). So this review (a) re-confirms the production diff, (b) gates the **test change** under G-C15, and (c) re-measures the FULL regression under the reused-stack pattern that REDed in Review #1.

### Reviewer's own runtime evidence (SUT built from the reviewed commit — not a reused/pinned tag)
- **SUT**: `build-sut.sh ref:contrib/CTRIB-026-overview-truncation-ordering` → `built from source: …@ c54b9c61`, image `odd-platform:odd-team-sut` digest `sha256:fa7160a9…`. No OOM (gradle `-Xmx3g`). VERIFIED via the build log.
- **The Review-#1 blocker is RESOLVED — reproduced the exact pollution and watched it pass.** Pinned the fix image (`ODD_PLATFORM_IMAGE`), ran **IT-020 first** (its `#1768` test seeds 26 tags on shared entity 2001 and leaves them — DB-confirmed **`SELECT count(*) … data_entity_id=2001` → 26** mid-run), then ran **feature-complete on the SAME persistent stack** (the LSN-033 build-once/reuse pattern). The previously-failing **test#105 `entity-tags-display.spec.ts:36 › a tagged entity renders the tag` now PASSES in 1.2s** (Review #1: `✘ 11.4s getByText('IT020GoldTag') not found`). The `beforeEach(clearEntityTags)` makes the test own its precondition; the 26-tag cross-run residue no longer leaks in. VERIFIED via the feature-complete run (line 177 of the run log).
- **IT-020 (fix SUT)**: `3 passed` incl. the `#1768` case. VERIFIED via `run-suite.sh IT-020`.
- **FULL regression on the working-tree SUT @ `c54b9c61` (my own runs, actual pass/fail counts):**
  - **`feature-complete` 303 passed / 1 failed** (6.0m). The 3 entity-tags-display tests (#105/#106/#107) all GREEN in-suite. The lone fail is the **known TST-054 owner-association flake** (`remove-user-owner-mapping.spec.ts:123` / F-173 / 1.0m `waitForResponse` timeout) — change-unrelated (see below).
  - **`multi-stack` 9 passed** (4.0m).
  - **`known-bugs` 3 failed = the EXPECTED expected-RED set, no unexpected GREEN**: IT-007/PLT-086 attachment-durability (LSN-001), IT-006/F-042 error-boundary, IT-004/PLT-052 dashboard out-of-enum WARNING crash. No un-flipped fix. VERIFIED via the per-test ✘ lines.
  - **`ingestion-e2e` 6 passed** (1.1m).
  - **RED proof — IT-020 on `published:0.28.0` (pre-fix)**: test#1 ✓, test#2 ✓, **test#3 (`#1768`) ✘ 11.3s `toBeVisible() failed`** (the important tag is hidden by the pre-fix slice-then-sort). **The RED proof SURVIVES the `beforeEach` change** — the changed describe block still REDs on the unfixed base and GREENs only on the fix (G-C15 rule 3, the single discriminator). VERIFIED via `ODD_SUT=published:0.28.0 run-suite.sh IT-020`.

### Acceptance criteria (contributor DoD)
- [x] Reproduce-first (G-C1) — PASS: runnable demo + my own IT-020 RED proof on `published:0.28.0`. VERIFIED via the RED-proof run.
- [x] Fix shape matches the approved plan — PASS: re-read `git diff 37d5dad6 c54b9c61` over all 5 components — sort-once-then-slice-both-branches on the 3 importance tag lists (`[...tags].sort(...)` copy, no prop mutation); b1 no-op `.sort()` removal on Groups+Terms (both branches); `Showing {{visible}} of {{total}}` hint on the entity Overview Tags/Terms/Groups. VERIFIED via the diff.
- [x] Unit test injects the failing condition (G-C9) — PASS: `OverviewTags.test.tsx` (20 wire tags + 1 important last, RED on the pre-fix slice-then-sort). VERIFIED via the diff.
- [x] Integration both buckets (G-C9) — **PASS (was the Review-#1 blocker)**: the IT-020 `#1768` case is a valid RED→GREEN discriminator AND its helper is now isolation-safe — feature-complete is green on the reused/polluted stack. VERIFIED via my own runs.
- [x] Docs decision routed (G-C10/G-C11) — PASS: `entity-detail-page.md` Section 5 revised on `release/0.29.0` (docs `0032ef3`, DOC-475 pending-release). VERIFIED via the docs-branch diff.
- [x] Ontology committed (G-C10) — PASS: F-179 flow (valid YAML) + reflection (valid frontmatter; frontmatter+markdown is the reflector format) carry `resolution` blocks citing CTRIB-026/#1768. VERIFIED via read + PyYAML.

### Quality Bar / contributor gates
- **G-C1 Reproduce-first** — PASS (deterministic repro + my own RED proof reproduced).
- **G-C2 Verify the running system (FULL regression)** — **PASS**: feature-complete is now reliably green on the reused/pinned stack (the LSN-033 pattern the harness is designed for) — the Review-#1 regression-trustworthiness blocker is gone. All four suites measured on my own SUT @ `c54b9c61`. The single non-green is the change-unrelated TST-054 flake.
- **G-C3 GATE 1 plan approval** — PASS (`plan_approved_by` RamanDamayeu 2026-06-21).
- **G-C4 GATE 2 is human + the merge is GitHub-gated** — PASS: PR #1796 `state:open`, author `odd-contributor[bot]`, `head.sha == c54b9c618b…` (== `c54b9c61`), `Closes #1768`, body `Milestone: 0.29.0`. The bot OPENED it as draft (signal held on the bot side); **RamanDamayeu (human) marked it ready-for-review 2026-06-21 19:28** — a maintainer GATE-2 prerogative, not a bot self-undraft. The merge guarantee (bot is author → cannot self-approve; not merged) is intact. VERIFIED via the PR page. (Note: the item's `pr_draft` frontmatter was stale `true`; corrected to `false` with the human-undraft provenance.)
- **G-C5 Bounded scope + public scope comment** — PASS: scope exclusions tracked in PLT-232; scope comment `#issuecomment-4761236451` recorded + prior-verified (the public issue page lazy-loads comments — not re-fetchable via WebFetch, same tooling limit as Review #1). VERIFIED via the recorded URL + Review #1.
- **G-C6 One-question clarify** — PASS ("no question warranted").
- **G-C7 Irreversible hard-stop / ADR** — N/A (FE render-ordering + an odd-team test; zero Java/spec/migration/auth lines). VERIFIED via the diff stat.
- **G-C8 Issue is data** — PASS (claims re-verified against source @ `37d5dad6`/`c54b9c61`, not the issue snippets; the issue's incomplete "Suggested fix (a)" was corrected to sort-once-feed-both).
- **G-C9 Test integrity, both buckets** — PASS (unit RED-on-base/GREEN-on-fix; IT-020 `#1768` RED-on-`published:0.28.0`/GREEN-on-fix, both re-run by me).
- **G-C10 Ontology + docs move** — PASS (F-179 + DOC-475 + the read-first page revision).
- **G-C11 Milestone** — PASS: issue #1768 carries the **open `0.29.0`** milestone; PR body `Milestone: 0.29.0`. VERIFIED via the issue + PR pages.
- **G-C12 Design-before-build** — PASS: reuse-scan (the shared `<TruncatedList>` deferred to PLT-232), no governing ADR, full impact checklist (i18n **all 7 locales** verified — en authoritative + ua/ch/br/es/fr/hy properly translated, not en-copies; `texts.secondary` is a real theme key), PO lens.
- **G-C13 Principal sufficiency** — **PASS (was the Review-#1 FAIL)**: the lost control (the integration suite's order-independence) is restored — the `beforeEach(clearEntityTags)` makes every F-018 tag-display test own its precondition; the helper no longer degrades sibling specs on a reused stack. Enough + meaningful tests; backend patch-coverage N/A (zero Java); full regression green modulo a tracked flake.
- **G-C14 Private advisory** — N/A (public issue).
- **G-C15 Test-change integrity (the rework's `beforeEach`)** — **PASS** — checked all four conditions: (1) **no expected value changed** — the change adds a setup hook, asserts nothing new; (2) **no assertion weakened** — no matcher loosened, no boundary mocked, nothing `.skip`/deleted; the hook makes the tests *more* hermetic; (3) **the RED proof SURVIVES** — IT-020 test#3 (`#1768`) still REDs on `published:0.28.0` with the current spec and GREENs only on the fix (re-run by me — the single discriminator); (4) **touches only the test's reading of the system** — a DB cleanup in test setup (`clearEntityTags` = `DELETE FROM tag_to_data_entity WHERE data_entity_id=2001`, `helpers/db.ts:613`), no production code. A textbook isolation fix.
- **G-C16 Change-request product analysis** — PASS: Defect 2 reshaped to b1 (remove no-op) over the issue's b2; the completeness correction (sort once, feed both branches) over the issue's partial snippet; both surfaced as GATE-1 decisions.

### Universal / doc gates (the docs deliverable)
- **Gate 7 Layout** — PASS: `entity-detail-page.md` has its SUMMARY entry on `release/0.29.0` (and on `main`), line 16; the change edits Section 5 only (no SUMMARY/TOC change needed). VERIFIED via `git show origin/release/0.29.0:docs/SUMMARY.md`.
- **Gate 8 Publishing** — **PENDING-RELEASE (0.29.0)**: docs ride `release/0.29.0` (docs PR #104, base `release/0.29.0`, draft). Branch sub-checks PASS — frontmatter parses, description **191 chars** (≤200), no new outbound links (the diff removes links/prose, adds none). Live verification scheduled at the 0.29.0 release gate; the live `main` page currently (correctly) describes the pre-fix 0.28.0 behaviour. Post-merge URL recorded in DOC-475: `https://docs.opendatadiscovery.org/data-discovery/entity-detail-page`.
- **Gate 9 Provenance** — PASS: every runtime claim re-verified against source (`texts.secondary` real key; the docs reframe is accurate to the verified fix). The public odd-platform commit carries a mechanism-level provenance narrative (not a workspace `Sources:` footer — correct: workspace `G-C`/`LSN` provenance would be a Gate-11 leak in a public commit; the CTRIB record + `reproduced:` field hold it instead).
- **Gate 11 Audience isolation** — PASS: mechanical banned-term grep on the changed `entity-detail-page.md` (docs `0032ef3`) is CLEAN — no `Cornerstone`/`Gate N`/`LSN`/`CTRIB`/`G-C`/impl-jargon; the reframe REMOVED the prior impl-jargon ("stringification defect", "DataEntityRef[]", "LinkedTerm[]") in favour of operator language. VERIFIED via grep.

- **Outbound URL sweep**: PR #1796, issue #1768 (open, milestone 0.29.0) re-verified via WebFetch; the scope comment + docs PR #104 not WebFetch-reachable (GitHub lazy-loaded comments / `documentation` is a private repo) → recorded URLs + Review-#1 verification stand; docs live-verification defers to the release gate. 0 broken links found.
- **Banned-phrase check**: none used.
- **Regressions**: **none introduced.** feature-complete green modulo the single change-unrelated TST-054 flake (`remove-user-owner-mapping`/F-173) — the SAME spec/line/signature Review #1 hit and confirmed transient (isolated 2.0s), in the owner-association admin-UI flake class that is architecturally independent of tag rendering (the change touches 5 FE tag/group/term-list leaf components + the one odd-team tag-display spec). **My own isolated IT-108 re-run was deferred at the maintainer's direction (run declined twice)**; the flake characterization rests on change-unrelatedness + the TST-054 prior confirmations (now 3 observed instances across Review #1 / rework / this review), not a fresh isolated pass.
- **Navigation**: consistent (no pointer shifts — leaf-component change).
- **Upstream issues logged**: none new.
- **Doc-product editorial findings** (audit per `playbooks/doc-product-editorial-read.md`):
  - **Coverage this run**: change blast-radius (whole-tree sweep for `slice|stringif|importance-order|important tag|View All|truncat|Showing N of` — clean; only `entity-detail-page.md` (fixed on the train) + `groups-domains.md` (DOC-476, already logged) describe the old behaviour) + a full owner-read of the `data-quality/**` subtree (dashboard / sla-statuses / test-results-import — internally coherent). **Queued for a future pass**: `configuration-and-deployment/**`, `developer-guides/**`, `integrations/**`, and the remaining hubs (carried forward from Review #1's partition; not read end-to-end this run).
  - **Findings**:
    - **DOC-477** (low, code-doc drift) — `data-quality/dashboard.md:48` enumerates a bare **"Title"** filter dimension, but the dashboard's Title filter was deliberately relabeled **"Owner title"** in odd-platform (`#1767`/CTRIB-011) *precisely because* bare "Title" "silently misleads operators" (`TitleFilter.test.tsx:9-10`). The doc now reproduces the exact ambiguity the UI fix removed. Pre-existing, unrelated to #1768. Logged with a routing-verification note. VERIFIED via the UI source vs the page.
    - DOC-476 (parallel-surfaces-with-drift, from Review #1) stands — `groups-domains.md:98` "truncation caveat" lags the warning→info reframe; same 0.29.0 train.

### Status flip
`pr-draft` → **`review-ready`.** Every contributor gate + acceptance criterion passes with cited, reviewer-reproduced evidence; the Review-#1 blocker is resolved and the regression suite is trustworthy again on the reused-stack pattern. The production diff (PR #1796), the docs train (PR #104 / DOC-475), and the ontology (F-179) are unchanged from Review #1 — all re-verified correct. **GATE 2 (the human merge of PR #1796) owns the move to `done`/`merged` — never self-merged.** Editorial finding DOC-477 is logged as parallel work; it does not gate this flip.
