---
id: CTRIB-051
title: "#1835 follow-up — facet filter chips render RAW values (chip vs dropdown casing divergence: DRAFT→Draft)"
issue: "https://github.com/opendatadiscovery/odd-platform/issues/1835 (Part of #1825; PR will be Part of #1835 — ST-1c remains open, so #1835 does not close)"
parent_epic: 1825
class: "bug — pre-existing FE label-casing divergence (chip vs dropdown), surfaced by maintainer comment issuecomment-4875296513"
status: pending-release   # /review (review-ctrib051, 2026-07-03, separate session) → ACCEPTED = GATE-2-ready. Every AC + gate PASS on the reviewer's OWN independent measurement (revctrib051 rebuild @ f3c71338: vitest GREEN 2/2 fix + RED 2/2 base; feature-complete 335/2 GREEN-FOR-CHANGE incl. IT-151 #1835 chip-raw assertion; the 2 fails non-attributable — unmerged Group-B favorites-star:159 + owner-association-history:129 flake GREEN 2.7s in isolation). Non-blocking follow-ups: PLT-252 (Term/Activity parallel-surface chip drift), TST-057 extended (owner-assoc-history load flake). Stays review-ready — human merges DRAFT PR #1850 (bot cannot self-merge, G-C4) → pending-release 1.0.0 → /review release:1.0.0 owns done. Implementer/reviewer do NOT self-mark done. | LEDGER-RECONCILED 2026-08-30: was `review-ready`; PR #1850 (`dc488aef`) merged, but NOT released — milestone 1.0.0, which is OPEN/UNRELEASED (latest release 0.29.0, 2026-06-26). GATE 2 is done; `/review release:1.0.0` owns the flip to `done`.
plan_approved_by: "maintainer — GATE 1 2026-07-03 (Option 1: shared formatter, targeted tests, skip full regression)"
plan_approved_at: "2026-07-03"
target_repo: odd-platform
milestone: "1.0.0"      # G-C11 — #1835 carries 1.0.0 (open/semver); re-verify live before PR
adr_required: false     # G-C7 does NOT fire — pure FE render transform; no migration/auth/contract change
reproduced: >-
  Root cause traced first-hand @ main e27bf131 (Phase B). Chip renders the facet value via TextFormatted→capitalize
  (SelectedFilterOption.tsx:36) → capitalize('DRAFT')='Draft'; dropdown renders raw (MultipleFilterItemAutocomplete.tsx:129)
  → 'DRAFT'. Divergence is live for any non-Title-case facet value. Live RED = the vitest render test (Phase D).
docs_routing: "NONE — read docs/data-discovery/search.md (@ main) per G-C10: the page documents search/filter USE, with no content on how facet chip values are cased or formatted (no 'chip' / 'capitali' / 'DRAFT' / 'label' / facet-value-formatting mentions). Chip↔dropdown casing consistency is not a documented capability → no user-facing doc change, no train routing. Ontology: no per-node sidecar covers the changed FE files (only unrelated DataQualityFilters); F-017 feature behaviour unchanged (display-only casing) → no /enrich."
effort: small
pr_url: "https://github.com/opendatadiscovery/odd-platform/pull/1850"   # DRAFT, Part of #1835, bot-authored (odd-contributor[bot]) — cannot self-merge (G-C4)
pr_draft: true
merged_sha: ""
---

## The defect (one line)
A selected facet **chip** shows the value through `capitalize()` (`Draft`) while the **dropdown** shows it raw (`DRAFT`) — same value, two labels. Starkest for statuses (`DRAFT/STABLE/DEPRECATED`); types too (`DATA SET` dropdown vs `Data set` chip). Pre-existing; ST-1d (#1849, now merged) made it visible on shared/deep-linked searches by reliably giving the status chip a *name*.

## Phase B — root cause (first-hand, main @ e27bf131)
- Chip: `SelectedFilterOption.tsx:36` → `<TextFormatted value={filterName}/>` → `capitalize(join(split(v,'_'),' '))` (upper-first / lower-rest).
- Dropdown: `MultipleFilterItemAutocomplete.tsx:128-129` → `facetName==='types' ? name.replaceAll('_',' ') : name` (RAW).
- Single-select: `SingleFilterItem.tsx:63` renders `{option.name}` (RAW).
- **The chip is the ONLY non-raw facet-value renderer** — `TextFormatted`/`capitalize` appears nowhere else in `Search/Filters` (grep-confirmed). So "all facet values raw" is satisfied by exactly this one fix.

## Phase C — product-critique (G-C16) + design (G-C12)
**Product-critique:** the maintainer (PO) specified the target — raw values in chips, consistent with the dropdown. Aligned; no divergence from the ask. Root problem (maintainer's comment) = two FE paths format the same value differently → fix at the source, not per-chip.
**Design:** ONE tiny shared formatter, raw, reused by chip + dropdown (removes the duplicated ternary — Gate-1 no-duplicates + the comment's "one formatter" intent). Reuse-scan: no existing facet formatter (grep). ADR: none. **i18n: the chip renders a DATA value (facet option name / enum), not a translatable UI label → NO locale files.** Consumers / generated clients / migrations: none.

## Plan
1. Add `formatFacetName(facetName, name?)` under `components/Search/Filters/` → `!name ? name : facetName==='types' ? name.replaceAll('_',' ') : name` (undefined-safe).
2. `SelectedFilterOption.tsx`: drop `TextFormatted`; render `{formatFacetName(facetName, filterName)}` (keep `title={filterName}`).
3. `MultipleFilterItemAutocomplete.tsx:128-129`: call `formatFacetName(facetName, option.name)`.
**Scope EXCLUSIONS:** `TextFormatted` unchanged (used for non-facet text elsewhere); status *badge* `EntityStatus` (entity-detail) untouched — not a facet chip; no backend; no locale files.
**Tests:** vitest `SelectedFilterOption` RED→GREEN (statuses `DRAFT`→`DRAFT`; types `DATA_SET`→`DATA SET`); + one assertion in the existing faceted e2e (IT-150) — selected Status chip text === `DRAFT` — as running-system confirmation.
**Docs (G-C10):** read search.md (train); record decision (expect NONE). **Ontology (G-C10):** `/enrich --touched` on the changed FE file(s) if a sidecar exists; else record none.

## must_haves (inline plan-check — G-C19; separate plan-checker agent skipped for token frugality per maintainer directive)
- T1 "a selected Status facet chip reads `DRAFT`, == the dropdown" → `SelectedFilterOption` via `formatFacetName` → wired in `MultipleFilterItem`. ✓ user-observable, RED-on-base.
- T2 "chip and dropdown never disagree for any facet" → shared `formatFacetName` called by BOTH sites (key_link). ✓
- No scope-reduction language; single slice; fully delivers. No BLOCKER.

## Phase D — build + test evidence (2026-07-03)
**Branch** `contrib/CTRIB-051-facet-chip-raw-values` @ `f3c71338` (off main e27bf131; upstream UNSET, push.default=current — LSN-038-safe). 4 files: `formatFacetName.ts` (new) + `SelectedFilterOption.tsx` + `MultipleFilterItemAutocomplete.tsx` + the vitest.

**FE build gate** (node-24 container — host node is 18, too old for vite 7): `tsc --noEmit` OK · `eslint` on the 4 files CLEAN (0 warnings) · vitest `SelectedFilterOption` **GREEN 2/2 on the fix, RED 2/2 on base** (base renders `Draft` / `Data set`).

**Integration IT-151** (odd-team; targeted per GATE-1 Option 1 — full 4-suite heavy regression waived):
- GREEN on the working-tree SUT `sha256:6375dceb…` (built from `f3c71338`): **4/4** incl. the new chip-casing assertion.
- RED on `ODD_SUT=ref:main` (e27bf131) SUT `sha256:d9a71352…`: **3/4 — test 4 fails** on the new assertion `toHaveText('STABLE')` → `Expected "STABLE", Received "Stable"`; tests 1-3 GREEN. (G-C15: stricter assertion, RED-on-base / GREEN-on-fix, not weakened.)

**Docs (G-C10):** NONE — `search.md` documents search/filter use, no facet-chip value-casing content. **Ontology (G-C10):** no sidecar covers the changed FE files; F-017 behaviour unchanged (display-only) → no `/enrich`.

## Definition of Done
1. FE build green on the working tree (tsc + eslint + vitest) ✓
2. Integration: IT-151 GREEN-on-fix / RED-on-base ✓ — full heavy regression **waived at GATE 1 (Option 1)** for a leaf label render ✓
3. Docs read + decided = NONE (justified) ✓
4. Ontology: no node to refresh (justified) ✓
5. Principal sufficiency: meaningful unit + e2e (both RED→GREEN); changed lines covered; no control lost; **rendered surface confirmed** — the e2e reads the actual chip DOM text (`STABLE` on fix vs `Stable` on base); text-only change, no layout/legibility/empty-state impact ✓

→ `review-ready`. DRAFT PR (Part of #1835). `/review` (separate session) → GATE 2 (human merge).

## Review (2026-07-03, session: review-ctrib051 · max-effort · reject-by-default)

- **Result**: ACCEPTED — stays `review-ready` = **GATE-2-ready** (milestone 1.0.0, DRAFT PR #1850 unmerged; the
  human merges → `pending-release` → `/review release:1.0.0` owns `done`). Verdict rests on the reviewer's OWN
  independent measurement (review-ctrib029/048/050 lesson), NOT the implementer's logs.

**Independent measurement (own rebuild — not the implementer's cited images):**
- **SUT**: `ODD_SUT=working` from the clean `../odd-platform-ctrib051` worktree @ `f3c71338` →
  `odd-platform:odd-team-sut-revctrib051` (digest `sha256:d03f61baa3e6`). Worktree verified clean at the
  reviewed SHA before build.
- **vitest** (node:24 container, host node is 18): **GREEN-on-fix 2/2** on `f3c71338`; **RED-on-base 2/2** on
  the main clone @ `e27bf131` — "Unable to find element with text: DRAFT" (base rendered `title="DRAFT"` / text
  `Draft`) and "…: DATA SET" (base rendered `Data set`). The unit RED→GREEN is owned first-hand.
- **feature-complete** on the revctrib051 rebuild (single worker): **335 passed / 2 failed (7.3m) =
  GREEN-FOR-CHANGE**. IT-151 `search-url-facets.spec.ts` GREEN incl. the #1835 chip-raw assertion (`:226`
  `getByTitle('STABLE').toHaveText('STABLE')`) — and `:112` GREEN 3.5s (was CTRIB-050's flake). Both failures
  proven non-attributable:
  - `favorites-star-see-loop:159` — "#1815 Group B" Favorites Description column; on the **unmerged**
    `contrib/CTRIB-039-favorites-group-b` branch, RED on any off-main SUT (CTRIB-050 saw the identical fail).
    Zero coupling to facet chips.
  - `owner-association-history:129` — H-005 server-side free-text search (no facet-chip coupling); ran 1.0m =
    timeout. **Re-run in isolation on the same image → GREEN 2.7s** (a sibling `:93` timed out instead — the
    flake moves run-to-run). Load-timing flake → strengthened **TST-057** (second instance of the class).
- **Reasoned skip** of `multi-stack` / `known-bugs` / `ingestion-e2e`: a pure FE facet-chip *render* touches no
  backend / ingestion / storage / auth / multi-datasource surface; the 1.0.0 release-gate (`/review
  release:1.0.0`) runs all four suites on the released image (ctrib048 precedent). Full heavy set was
  waived at GATE 1 (Option 1); the reviewer exceeded the waiver by measuring the full UI suite.
- **e2e RED-on-base** corroborated by the captured Playwright artifact
  `test-results/search-url-facets-…-echo-label-preserve/error-context.md` (`<p title="STABLE">Stable</p>` →
  Expected "STABLE", Received "Stable") + the deterministic `TextFormatted` `capitalize` (source-read).

- **Acceptance criteria / Definition of Done**:
  - [x] 1 FE build green — PASS (vitest independently GREEN 2/2 + RED 2/2; the SUT jib build bundles + compiles the SPA = tsc clean).
  - [x] 2 IT-151 GREEN-on-fix / RED-on-base — PASS (independent feature-complete GREEN; RED via captured artifact + vitest-on-base + determinism).
  - [x] 3 Docs read = NONE — PASS (`data-discovery/search.md` has no chip/capitalize/facet-value-casing content — grep-corroborated; the search overhaul is unreleased → no live doc to correct).
  - [x] 4 Ontology none — PASS (no sidecar covers `Search/Filters/**`; the two name-matching sidecars are `component:DataQualityFilters` — a different tree).
  - [x] 5 Principal sufficiency — PASS (meaningful unit + e2e RED→GREEN; rendered chip DOM text asserted; no control lost).

- **Quality Bar / contributor gates**:
  - G-C1 reproduce — PASS (first-hand root cause @ `e27bf131`; deterministic vitest + captured Playwright RED).
  - G-C2 verify running system — PASS (own feature-complete GREEN-FOR-CHANGE; 3 backend suites reasoned-skip + release-gate covers) via the run above.
  - G-C3 GATE 1 — PASS (maintainer-approved Option 1, 2026-07-03; recorded in `plan_approved_by`).
  - G-C4 GATE 2 — PASS (bot-authored DRAFT PR #1850, "Part of #1835", open/unmerged, awaiting RamanDamayeu) via WebFetch of the PR.
  - G-C5 scope-bounded — PASS (diff = exactly the 4 planned files; exclusions honored) via `git diff`. The sibling Term/Activity chip renderers are correctly out-of-scope for #1835 but were **not logged** by the item → reviewer logged **PLT-252** (the sole scope-hygiene gap; non-blocking).
  - G-C6 clarify — N/A (maintainer specified the target; no question warranted).
  - G-C7 hard-stops — PASS (`adr_required:false` correct — pure FE render; no migration/auth/contract).
  - G-C8 issue-as-data — PASS (followed the maintainer-PO direction; no injected instruction).
  - G-C9 test integrity, both buckets — PASS (unit vitest NEW + integration IT-151 extended; both RED→GREEN; the user-facing chip symptom is covered by the integration IT).
  - G-C10 ontology+docs DoD — PASS (docs NONE justified + page read; ontology none justified).
  - G-C11 milestone — PASS (#1835 open, milestone 1.0.0 semver open) via WebFetch of the issue.
  - G-C12 design-before-build — PASS-with-note (reuse-scan done — no existing facet formatter; ADR none; i18n correctly excluded — chip renders a data value, not a translatable label). Impact-checklist missed the Term/Activity parallel surfaces → PLT-252 logged.
  - G-C13 Principal sufficiency — PASS (no FE patch-coverage gate — CI's `min-coverage-changed-files:98` is JaCoCo/Backend-only and CTRIB-051 touches zero Java; the untested `!name` guard in `formatFacetName.ts` is a minor nit, behavior-preserving).
  - G-C14 private advisory — N/A (public issue).
  - G-C15 changed-test integrity — PASS: the IT-151 spec change (`a15ce81`) is a **pure addition** of `getByTitle('STABLE').toHaveText('STABLE')` after the existing `toBeVisible()` — no existing assertion modified/weakened, no mock swapped, nothing `.skip`ed; the expected `STABLE` traces to the `DataEntityStatus` enum name + the dropdown's raw render (independent SoT, NOT the buggy `Stable`); the RED **survives** on `ref:main` (captured artifact + my vitest RED 2/2).
  - G-C16 product critique — PASS (maintainer-PO specified raw-consistent-with-dropdown; the fix aligns, no divergence to surface).
  - G-C17 spec-gate — N/A (a clear bug with unambiguous correct behaviour: chip == dropdown, raw).
  - G-C18 decompose — N/A (single leaf fix, not an epic).
  - G-C19 plan-check — PASS-with-note (inline `must_haves` T1/T2 verified satisfied by the diff; the *separate* plan-checker agent was skipped per the maintainer's token-frugality directive — a maintainer-sanctioned GATE-1 deviation for a 4-file leaf change).
  - Universal Gate 1 (no duplicates) — PASS (the fix REMOVES a duplicated ternary via the shared `formatFacetName`; pre-existing parallel components logged PLT-252).
  - Gate 8 (publishing / live-site) — N/A (docs decision NONE → no live doc surface; PR verified draft/bot/Part-of-#1835).
  - Gate 9 (provenance) — PASS (`Sources:`/`Consumer-read:` footers present + verified: `SelectedFilterOption:36`→`formatFacetName`, `MultipleFilterItemAutocomplete:128-129`, `SingleFilterItem:63` raw, `TextFormatted` `capitalize` — all confirmed first-hand).
  - Gate 10/11 (content-type homing / audience isolation) — N/A (code item; zero `documentation/docs/**` lines touched).

- **Regressions**: none attributable. feature-complete 335/2, both non-attributable (unmerged Group-B favorites-star:159; owner-association-history:129 load-timing flake proven GREEN 2.7s in isolation). IT-151 incl. the #1835 chip-raw assertion GREEN.
- **Navigation**: consistent — `navigation/domains/search.md:17` points at `Filters.tsx` (unchanged); no file moved/renamed; the new `formatFacetName.ts` is a leaf helper (no nav pointer warranted); no new bean factory / SDK builder.
- **Upstream issues logged**: `issues/odd-platform/PLT-252.md` (Term-search + Activity filter chips still capitalize — same class as #1835, out of scope, cross-surface drift now visible).
- **Doc-product editorial audit**: DEFERRED — CTRIB-051 is a pure FE-code item with **zero `documentation/docs/**`** touched and docs-decision NONE (verified). The full doc-tree coherence read is orthogonal to this item (ctrib048/049/050 contributor-item precedent); the 1.0.0 release-gate editorial reads the search docs holistically when the overhaul publishes. Not run this session (honestly deferred, not silently skipped).
- **Notes (non-blocking findings)**:
  1. The CTRIB-051 IT-151 run-log entries (`run-log/2026-07-03-IT-151.md` entries 4 & 5) carry the right SUT digests (`6375dceb` / `d9a71352`) + PASS/FAIL outcomes but **unfilled `runner:`/`evidence-notes:` template stubs** — the "4/4 / 3/4 Expected STABLE" detail lives only in this ledger. Same finding CTRIB-050's review flagged; the reviewer had to independently measure. VERIFIED via reading the run-log → fill next time (advisory).
  2. Record slip: the Plan (line 42) + `active-streams` `owns_write` say **IT-150**; the actual assertion landed in **IT-151** (Phase D + the committed spec/protocol are correct). Cosmetic. VERIFIED via `git show a15ce81`.
  3. IT-151 protocol `## Result log` (§7) not appended with a 2026-07-03 CTRIB-051 entry (§5/§6 *were* updated with the #1835 assertion). Minor completeness gap. VERIFIED via reading the protocol.
  4. `TST-057` strengthened (not duplicated) with the owner-association-history second instance + a suite-level-fix AC.
