---
id: CTRIB-051
title: "#1835 follow-up — facet filter chips render RAW values (chip vs dropdown casing divergence: DRAFT→Draft)"
issue: "https://github.com/opendatadiscovery/odd-platform/issues/1835 (Part of #1825; PR will be Part of #1835 — ST-1c remains open, so #1835 does not close)"
parent_epic: 1825
class: "bug — pre-existing FE label-casing divergence (chip vs dropdown), surfaced by maintainer comment issuecomment-4875296513"
status: review-ready            # Phase D+E DONE. GATE 1 APPROVED (Option 1). All 5 DoD gates met (tsc+eslint+vitest RED→GREEN; IT-151 GREEN-on-fix 4/4 / RED-on-base 3/4; docs NONE-read; no ontology node; targeted per Option 1 — full heavy regression waived at GATE 1). DRAFT PR (Part of #1835), bot-authored, cannot self-merge → /review (separate session) → GATE 2 (human merge). Implementer does NOT self-mark done.
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
pr_url: ""
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
