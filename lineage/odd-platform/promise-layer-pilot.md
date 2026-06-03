# Promise-Layer Pilot — LSN-030 fix, proven on the term-linkage cluster

**Date:** 2026-06-03  **Scope:** F-056 (description-mention auto-link) + F-002 (manual term→entity link) + F-047 (column→term link).  **Status:** pilot complete; rollout pending maintainer go.

## What this pilot tested

LSN-030 proved (corpus-wide) that the methodology models a feature as a **drift catalogue, never a promise**: feature schema had `observed_vs_expected` on 113/113 features but a `use_cases` slot on 0/113; the TEST-GAP taxonomy had no `functional` category across 1038 gaps. Consequence: every test demand hardens a presumed-working feature; the user-facing promise is never verified.

This pilot adds the missing layer to three features and measures whether the revised pipeline emits the happy/teardown/render/resolve demands the drift pipeline structurally **could not**.

## Before / after (measured 2026-06-03, all files PyYAML-valid)

| Feature | drift facets | `related_test_gaps` BEFORE | `use_cases` added | `use_case_coverage` | NET-NEW functional gaps |
|---|---|---|---|---|---|
| **F-056** auto-link | 5 (all security/drift) | **[]** (zero) | 7 | **1/7** verified | TEST-GAP-1040…1045 (6) |
| **F-002** manual link | ~30 | **[TEST-GAP-017]** (1 security path regression) | 5 | **1/5** verified | TEST-GAP-1046, 1047 (2) |
| **F-047** column link | 9 (all in a 0/4 test_matrix) | **[]** (zero) | 3 | **0/3** verified | TEST-GAP-1048 (1) |
| **total** | ~44 drift | **1 gap, drift-shaped** | **15 promises** | **2/15 verified** | **9 functional** |

The headline: three features carrying ~44 drift facets between them had, before this pilot, **one** test obligation about what any of them does for a user — and that one (TEST-GAP-017) is a SecurityConstants path-mismatch regression, i.e. still drift. The promise layer surfaced **15 use-cases**, of which **13 are unverified promises** (happy-path link, no-match staging, cross-time resolve, edit-retract, render-deeplink, grammar, unlink, …), now carried as **9 net-new `missing-functional` test obligations**.

## Why the drift pipeline could not have produced these

The 9 functional gaps were generated from the `use_cases` promise layer — authored from a product-owner read of the implementation (TermServiceImpl.java + useTermWiki.ts, code = source of truth). They are emergent, cross-file behaviours (regex → service reconciler → staging table → cross-time drain → React render). A per-node sidecar sees one file and emits method-shaped gaps; the drift facets see what is *wrong*. Neither can express *"a user types a wiki-link and gets a working deeplink"* — there was no schema slot for it and no gap category for it. Proof on the same corpus: even the hand-written `TermServiceImplTest` is **5/5 error-and-guard paths** — because the gaps that drove it were drift-shaped too.

## Byproduct: the promise lens FOUND BUGS the drift catalogue missed

Modelling the happy path surfaced two real suspected defects that the risk-first lens had not (because they live on the *success* path nobody had modelled):
- **TEST-GAP-1042** (cross-time resolve): staged mentions are stored **lowercased** (`buildDataEntityUnknownTerms:513`) but `resolveUnhandledDescriptionMentions` builds the lookup key from the term's **actual-case** name (`:422`) — a term created as `PII` may never resolve a staged `pii` mention. The resolve-later happy-path test pins it.
- **TEST-GAP-1048** (column link): `linkTermWithDatasetField:215` has **no `.switchIfEmpty`** (asymmetric with the data-entity path `:174`) — a duplicate INSERT silently succeeds and flatMaps a null relation (NPE risk). The happy-path test is the anchor.

This is the strongest validation of the fix: a test program that only hardens known risks will never find a bug that lives on an unmodelled promise.

## Methodology changes made (pilot-scoped)

1. **Schema (additive):** `use_cases` + `use_case_coverage` blocks on F-056/F-002/F-047 (`feature-flows/detail/`). Each use-case: `kind / promise / actor / given_when_then / trace / coverage / test_demand`.
2. **Taxonomy:** `missing-functional` registered in `.claude/agents/test-coverage-mapper.md:51` (+ `gaps_by_category` + a `use_case_coverage` second-frontier roll-up at output-schema).
3. **Consumer wiring:** test-coverage-mapper **Step 2b** — read each feature-flow's `use_cases`; every `coverage: unverified` entry is a `missing-functional` candidate; happy-path/resolve-later/teardown rank above edge-case/perf.
4. **Case-law:** `retrospectives/LSN-030-*.md` (root cause + this fix); memory `feedback_testgaps_must_model_feature_behaviour`.

**Deferred (by design):** the 9 new gaps are written as `test-map/detail/TEST-GAP-104{0..8}.yaml` (source of truth) and cross-referenced from each feature's `related_test_gaps`. Their headlines in `test-map/index.yaml` (a 1.7 MB derived dedup cache) are NOT hand-appended — index regeneration is the `test-coverage-mapper` reducer's job and happens on its next run (Step 2b will also pick up the `use_cases` layer automatically). Hand-editing the derived cache would be redundant and error-prone.

## Rollout (Phase 2 — pending go)

- **Producer contract:** edit `.claude/agents/feature-reflector.md` so it EMITS the `use_cases` block from its product-owner read — **including on CONFIRMED hypotheses** (a hand-traced confirmed behaviour with no test is the highest-value test to write), and run reflection **systematically** (F-056 was never reflected; only ~24/113 features are).
- **Retrofit:** generate `use_cases` for the remaining 110 features (prioritise the 38 SHB-seeded ones — they are the most drift-skewed). Each adds its `missing-functional` gaps.
- **Scorecard:** wire the `use_case_coverage` second frontier into `/align` so line-coverage (50%/98% ratchet) can never again pose as behavioural coverage.
- **Acceptance check for the rollout:** after retrofit, `gaps_by_category.missing-functional > 0` for every feature whose `use_case_coverage.verified < total`, and no feature with user-facing use-cases sits at `0/N` silently.

## Verdict

The fix works and is additive (no existing artefact removed). On three features it converted **1 drift-shaped obligation → 15 modelled promises + 9 functional test obligations + 2 newly-suspected bugs**, all from a layer the old pipeline had no slot for. Recommend proceeding to Phase 2 rollout.
