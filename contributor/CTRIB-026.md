---
id: CTRIB-026
github_issue_number: 1768
github_issue_url: https://github.com/opendatadiscovery/odd-platform/issues/1768
backlog_item: PLT-096
class: bug
security_sensitive: false   # public issue, maintainer-authored (RamanDamayeu); FRONTEND-only (React/TS). No auth/security posture, no migration, no wire contract. Defect 1 = list mis-ordering UX; Defect 2 = dead code; Defect 3 = truncation-hint UX.
status: pr-draft           # DRAFT PR #1796 opened (Closes #1768). All 5 DoD gates met. /review (separate session) owns review-ready; GATE 2 (human) owns the merge. NEVER self-merge/done.
milestone: "0.29.0"        # the issue's AUTHORITATIVE GitHub milestone (open, semver ^\d+\.\d+\.\d+$) -> G-C11 PASS. The issue BODY's YAML `suggested_milestone: 0.28.0` is superseded (0.28.0 already shipped 2026-06-17; the open milestone is 0.29.0) — same CTRIB-022/024 precedent.
reproduced: "live runnable demonstration 2026-06-21 of the EXACT defect mechanism using the real comparator (OverviewTags tagsCompare:26-32) and the real expression order. node script: 21 tags = 20 unimportant (a00..a19, wire order) + 1 important (zzz-critical-pii) at wire index 20. CURRENT `tags.slice(0,20).sort(tagsCompare)` -> visible top-20 contains the important tag? FALSE (first 3: a00,a01,a02). FIXED `[...tags].sort(tagsCompare).slice(0,20)` -> TRUE (first 3: zzz-critical-pii,a00,a01). Defect 2: `[...[{gamma},{alpha},{beta}]].sort()` -> [gamma,alpha,beta] UNCHANGED = no-op confirmed. The gold-standard UI-level RED proof (seed >20 tags, drive the Overview, important tag absent on ref:main / present on the fix) is the Phase-D IT-020 extension on ODD_SUT=ref:main."
adr_required: false        # client-side list-ordering correctness + a small UX hint. No migration, no auth/security-posture, no breaking wire/public-API contract. No governing ADR exists for these components (implicit-adrs lists none for the Overview sidebar lists). G-C7 does NOT fire.
docs_routing: "PENDING Phase-D page read. The issue references DOC-263 (an unreleased umbrella page `data-discovery/entity-detail-page.md` documenting these as KNOWN UX caveats). This PR FIXES Defects 1+2, so any 'slice-then-sort hides important tags' / 'bare-sort no-op' caveat would become INCORRECT for 0.29.0+. Decision routed on the documentation `release/0.29.0` train (unreleased behaviour, G-C11) IF the page carries the now-fixed caveat; else 'no doc change + why' after READING the page (G-C10). Resolved in Phase D."
pr_url: "https://github.com/opendatadiscovery/odd-platform/pull/1796"   # DRAFT, Closes #1768, opened 2026-06-21 by odd-contributor[bot] on contrib/CTRIB-026-overview-truncation-ordering @ c54b9c61. Docs PR: documentation#104 (DRAFT, base release/0.29.0, head contrib/CTRIB-026-docs-entity-detail-truncation @ 0032ef3)
pr_draft: true
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
  subtraction, but a refactor well beyond this bug. Logged as a follow-up (`playbooks/follow-up-on-disk.md`).
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
