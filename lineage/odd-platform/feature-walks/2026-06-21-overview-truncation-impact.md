---
artefact: feature-walk
generated_at: "2026-06-21T00:00:00Z"
generated_at_commit: e67461de
prompt_version: feature-advisor/0.1.0
session_id: session-2026-06-21-01
slug: overview-truncation-impact
maintainer_question: |
  Impact analysis for the CTRIB-026 / odd-platform#1768 change (already implemented on branch
  contrib/CTRIB-026-overview-truncation-ordering @ c54b9c61) — a REVIEW asking the ontology's
  dependency + blast-radius picture to confirm nothing wider than the diff was missed. FRONTEND-only
  (odd-platform-ui), client-side render-ordering on the entity/term Overview sidebar truncation lists:
  Defect 1 sort-before-slice on 3 components (DataEntity Overview OverviewTags, Term-detail OverviewTags,
  DatasetFieldTags); Defect 2 no-op .sort() removed from OverviewGroups + OverviewTerms; Defect 3 a new
  "Showing {visible} of {total}" caption on entity Overview Tags/Groups/Terms with a new i18n key in 7
  locales. No prop/signature/API/DTO/wire/backend/DB change. Ontology node F-179. Sections requested:
  (1) dependencies, (2) blast radius, (3) parallel/coupled untouched sibling sites (the most important),
  (4) docs + tests, (5) reviewer blind spots.
ontology_inputs_consulted:
  sidecars_read: 0
  concepts_referenced: 3
  adrs_referenced: 0
  reducer_artefacts: [concepts.yaml, implicit-adrs.md, refactoring-scopes.md, doc-gaps.md, test-map.yaml]
  doc_urls_fetched: 2
confidence_overall: HIGH
---

# Feature walk — CTRIB-026 / #1768 Overview sidebar truncation-ordering — blast radius review — 2026-06-21

## Question

> Impact analysis for the CTRIB-026 / odd-platform#1768 change (already implemented @ c54b9c61) — a
> REVIEW: confirm via the ontology's dependency + blast-radius picture that nothing wider than the
> FRONTEND-only diff was missed. The change is sort-before-slice on three tag lists (DataEntity Overview
> `OverviewTags`, Term-detail `OverviewTags`, `DatasetFieldTags`), removal of the no-op `.sort()` on
> `OverviewGroups` + `OverviewTerms`, and a new "Showing {visible} of {total}" caption on the entity
> Overview Tags/Groups/Terms (+ a new i18n key in all 7 locales). No prop/API/DTO/backend/DB change.
> Five sections requested; section 3 (untouched parallel sibling sites now behaviourally/visually
> inconsistent) is flagged as the most important.

## Restated as concepts

This change touches the **Overview Sidebar List Truncation** feature (F-179) — the per-entity READ
surface for three concepts: **Tag** (`important` boolean flag — the "important tags rise to the top"
promise), **Term** (`LinkedTerm`), and **Data Entity Group** (`DataEntityRef`). The fix realises the
F-179 promise `F-179-UC-1`/`UC-2` ("important tags surface in the visible top-N, including after View
All") that the feature-reflection recorded as *contradicted* pre-fix, and closes the
`slice_then_sort_sorts_only_truncated_window_not_full_list` +
`groups_default_sort_call_with_no_comparator_undefined_behaviour` drift classes. It is the CLIENT-side
sibling of the backend LSN-019 `listMostPopular` ordering drift (the "Top Tags" surface) — same
"the ordering I see is not the ordering the panel promises" failure family, different layer.

## Affected nodes

All five changed components are leaf `.tsx` files. **None has an enriched file-analyser sidecar** — the
F-179 chain hops 1a/1b/1c are all `unresolved` (`F-179.yaml:108,123,134`;
`feature-reflections/detail/F-179.yaml:15-19`). The behaviour summaries below are grounded in a direct
source read of the working tree at `REPO_ROOT_ABS` (which is on the PRE-fix state — see Ontology
coverage gaps) plus the F-179 resolution block describing the post-fix state. See
`ontology_coverage_gaps` for the consequence.

- node_id: "odd-platform ts react-component:OverviewTags (DataEntityDetails/Overview/OverviewTags)"
  sidecar: "(none — chain hop 1a unresolved)"
  why_affected: "Defect 1 + Defect 3 primary site — the `tagsCompare` importance comparator now runs on the whole tag set before the cap-20 slice, and the new 'Showing N of M' caption is added here."
  current_behaviour_summary: "Renders the entity's tag chips, capped at visibleLimit=20, with a View-All Collapse for overflow; `tagsCompare` sorts important-first then alphabetically (OverviewTags.tsx:26-32)."
  caveats_relevant_to_change:
    - "Pre-fix, slice ran before sort so important tags beyond array index 19 were invisible in the top-20 AND remained mis-ordered after View All because the two windows were sorted independently (feature-reflections/detail/F-179.yaml H-001/H-002). The fix must sort once and slice the single sorted array into both windows, else Defect 1b (View-All merge) reopens."
    - "Render branch is NOT gated by isStatusDeleted; only the edit affordance is (OverviewTags.tsx:39,104). A DELETED entity still renders chips — the fix must not regress this (F-179-UC-8 confirmed-but-untested)."
- node_id: "odd-platform ts react-component:OverviewTags (Terms/TermDetails/Overview/OverviewTags)"
  sidecar: "(none — not in any F-NNN chain; term-detail surface)"
  why_affected: "Defect 1 second comparator site — `tagsCompare` (Terms/TermDetails/Overview/OverviewTags/OverviewTags.tsx:20-26) now sorts before slice. Defect 3 caption NOT added here per the question scope."
  current_behaviour_summary: "Renders a term's own tags, cap 20, View-All Collapse; identical tagsCompare shape to the entity panel but gated on TERM_TAGS_UPDATE not DATA_ENTITY_TAGS_UPDATE (Terms/.../OverviewTags.tsx:32)."
  caveats_relevant_to_change:
    - "This surface has NO isStatusDeleted gate at all (Terms/.../OverviewTags.tsx:32-43) — the edit form is always rendered under the permission wrapper. Out of scope for #1768 but note the asymmetry vs the entity panel."
- node_id: "odd-platform ts react-component:DatasetFieldTags (DatasetStructure/.../DatasetFieldTags)"
  sidecar: "(none — leaf component under DatasetStructureOverview)"
  why_affected: "Defect 1 third comparator site — `compareTags` (DatasetFieldTags.tsx:12-18) now sorts before slice. Defect 3 caption NOT added here per question scope."
  current_behaviour_summary: "Renders a dataset FIELD's tags, cap 20, View-All Collapse; standalone `compareTags` function (not the inline tagsCompare), gated on DATASET_FIELD_TAGS_UPDATE (DatasetFieldTags.tsx:41)."
  caveats_relevant_to_change:
    - "isStatusDeleted arrives as a PROP here (DatasetFieldTags.tsx:23,29,42) rather than via useAppSelector — the only one of the three tag sites that takes it as a prop. Confirms no signature change is needed for the sort fix (the prop set is untouched)."
- node_id: "odd-platform ts react-component:OverviewGroups (DataEntityDetails/Overview/OverviewGroups)"
  sidecar: "(none — chain hop 1c unresolved)"
  why_affected: "Defect 2 + Defect 3 — the bare no-op `.sort()` (OverviewGroups.tsx:51,61) is removed, and the 'Showing N of M' caption added."
  current_behaviour_summary: "Renders DEG memberships, cap 10, View-All Collapse; `.slice(0,10).sort()` with NO comparator on DataEntityRef[] (OverviewGroups.tsx:49-51)."
  caveats_relevant_to_change:
    - "The bare .sort() is a verified no-op: DataEntityRef is a plain DTO, stringifies to '[object Object]', all compare equal, V8 TimSort preserves position (feature-reflections/detail/F-179.yaml H-005). Removing it is zero behaviour change; server/insertion order is preserved exactly as before."
- node_id: "odd-platform ts react-component:OverviewTerms (DataEntityDetails/Overview/OverviewTerms)"
  sidecar: "(none — chain hop 1b unresolved)"
  why_affected: "Defect 2 + Defect 3 — the bare no-op `.sort()` removed, 'Showing N of M' caption added. No importance comparator exists for terms, so only Defect 2 + 3 apply (F-179.yaml:38)."
  current_behaviour_summary: "Renders linked-term chips, cap 20, View-All Collapse; `.slice(0,20).sort()` bare no-op on LinkedTerm[] (feature-reflections/detail/F-179.yaml H-004)."
  caveats_relevant_to_change:
    - "Same no-op-removal reasoning as Groups: zero behaviour change. The Terms panel carries no importance flag, so there is no 'important first' promise to honour — only the no-op cleanup + the truncation hint."

Shared leaf items consumed by the changed components (NOT themselves changed — no signature touch):
`TagItem`, `TermItem`, `GroupItem` (`components/shared/elements` for TagItem; co-located for Term/Group).
These take `label`/`important`/`group`/etc. props that the sort fix does not alter
(OverviewTags.tsx:58-64, OverviewGroups.tsx:52-53).

## Related concepts

- concept: "Tag (important flag)"
  contributing_nodes: [TagController, TagServiceImpl, ReactiveTagRepositoryImpl, createDataEntityTagsRelations]
  why_relevant: "The `important` boolean is the product-level promise the fix realises on the READ surface; the comparator's important-first intent is the contract (concepts.yaml Tag, tag.yaml:1-3, OverviewTags.tsx:26-32)."
  security_aggregate_relevance: "MEDIUM overall, INCONSISTENT authorization — but ALL backend; the #1768 change is render-only and touches NO Tag write/read path, so the Tag security posture is unaffected (tag.yaml:244-292)."
  performance_aggregate_relevance: "MEDIUM — backend hot paths (listMostPopular, listDataEntityDtos triple-fetch) are unrelated to a client-side array sort over <=N already-fetched items (tag.yaml:415-474)."
- concept: "Top Tags UI Label vs Implementation Drift (operator-visible)"
  contributing_nodes: [TagController, TagServiceImpl, ReactiveTagRepositoryImpl]
  why_relevant: "The BACKEND symmetric of this fix — LSN-019 slice-then-rank on listMostPopular. Same drift family ('ordering I see != ordering promised'); fixed backend-side in 0.28.0 (live tagging doc, verified this session). #1768 is the CLIENT-side counterpart on the per-entity strip (canonicalisation_candidates/top-tags-ui-label-vs-implementation-drift-operator-visible.yaml:30-58)."
  security_aggregate_relevance: "N/A — this concept is a label/ordering-drift finding, not a security surface."
  performance_aggregate_relevance: "N/A for the client change — the backend LSN-019 cost note is unrelated."
- concept: "Data Entity Overview Tab composition (F-176 anchor)"
  contributing_nodes: [Overview, OverviewTags, OverviewTerms, OverviewGroups, +9 sibling panels]
  why_relevant: "F-176 is the parent composer that mounts the three changed sidebar panels. It passes `tags`/`dataEntityGroups`/termRefs DOWN as props and wraps each in its own per-panel WithPermissionsProvider; it imposes no shared ordering contract, so the sort fix is contained to the leaf panels (F-176.yaml:96-101, :173-197)."
  security_aggregate_relevance: "F-176 per-panel permission model is unchanged — the fix touches neither the WithPermissions wrappers nor the allowedPermissions sets (F-176.yaml:296-322)."
  performance_aggregate_relevance: "F-176 inherits the LSN-017 double-fetch from its parent DataEntityDetails; orthogonal to this render-ordering change."

## ADRs to respect

- adr: "(no accepted ADR governs UI list ordering or the Tag important flag)"
  source: "adrs/ (Glob adrs/**/*.md — only framework drafts: code-lineage-substrate, contributor-pillar, etc.; none about UI ordering or tags)"
  status: IMPLICIT-CANDIDATE
  constraint: "No formal or implicit ADR in implicit-adrs.md or adrs/ codifies a 'sort-before-slice' or 'importance-first' rule. The nearest codified decision is the LSN-019 invariant (backend listMostPopular) which establishes the PROJECT STANCE that 'truncate-before-rank is a bug, not a design' — the 0.28.0 backend fix moved ORDER BY inside the paginate window (live tagging doc). #1768 applies the same stance client-side."
  alignment: ALIGNED
  alignment_reason: "The fix follows the same correctness principle the project already accepted and shipped for the backend Top-Tags surface (rank-then-truncate); it sets precedent on the FE but contradicts no existing decision."

Implication: this change is a **future-ADR seed**. There is no published or implicit ADR stating
'client-side top-N lists must sort before slicing'; #1768 establishes that pattern across three tag
sites but leaves ~7 sibling lists on the old hand-rolled shape (section 3). A maintainer may consider
drafting an implicit-ADR candidate ('truncated read-surface lists rank the full set before the visible
cut') alongside the PLT-232 shared-`<TruncatedList>` follow-up, so the convention is codified rather
than re-discovered per component.

## Refactoring scopes touched

The F-179 feature-flow names three pending refactoring scopes (`F-179.yaml:418-421`) that are still
`REFACTOR-NNN` placeholders — i.e. **not yet minted** in `refactoring-scopes.md`. The change interacts
with the duplication scope the reviewer already expects (PLT-232) as follows:

- scope: "PLT-232 — shared <TruncatedList> follow-up (the ~7-site slice+sort+View-All duplication)"
  source: "Recent commit 43ad0bf 'log PLT-232 — shared <TruncatedList> follow-up (the class behind #1768)'; F-179.yaml:418-421 (related_refactoring_scopes, unminted)"
  category: "duplication / structural (UI list-truncation pattern repeated across components)"
  severity: "MEDIUM (maintenance hazard; the bug class recurs wherever the pattern is hand-rolled)"
  relevance: "#1768 lands BEFORE PLT-232. It fixes the importance-ordering instance of the bug on the three tag lists but leaves the duplicated pattern in place on the untouched siblings (section 3). It therefore PARTIALLY CLOSES the correctness side of the duplication while leaving the structural-debt side fully open — and WIDENS the divergence between fixed and unfixed copies."
  recommendation: "leave-untouched (in #1768) / depend-on-it-being-done-later"
  recommendation_reason: "Extracting a shared <TruncatedList> in this PR would balloon scope from a 5-file ordering fix to a cross-cutting refactor of ~7 components; correct to ship the bounded fix now and let PLT-232 consolidate. But see section 3 — the bounded fix CREATES new fixed-vs-unfixed inconsistencies that PLT-232 should be scoped to absorb."

- scope: "REFACTOR-NNN — Groups comparator supplied / dead-sort removed (F-179 facet 3)"
  source: "F-179.yaml:419-420 (unminted placeholder)"
  category: "dead-code / correctness"
  severity: "LOW"
  relevance: "#1768 Defect 2 directly closes this for OverviewGroups + OverviewTerms by removing the no-op .sort()."
  recommendation: "address-as-part-of-this-feature"
  recommendation_reason: "Already addressed by the diff — the placeholder scope can be retired or marked resolved-by-#1768 when minted."

## Doc gaps to address

The doc-gaps.md reducer carries NO entry for the Overview sidebar truncation/ordering behaviour (Grep
of doc-gaps/index.md for truncat|View All|importance|entity-detail-page returned no match). The
behaviour is instead documented as **live caveats on the published entity-detail-page**, which the fix
now makes STALE — the dominant doc finding of this review.

- doc_gap: "(net-new doc-drift — published entity-detail-page describes PRE-fix behaviour)"
  source: "Live https://docs.opendatadiscovery.org/features/data-discovery/entity-detail-page (WebFetched 2026-06-21, status 200); corroborated by doc-understanding/data-discovery__entity-detail-page.md:33-37"
  relevance: "The live page states verbatim (verified this session): Tags — 'the sort runs after the cut to the first 20 … important tags beyond position 20 won't appear without clicking View All'; Groups+Terms — 'visible-window ordering is undefined … default sort with no comparator … collector-insertion order'. ALL THREE statements describe behaviour #1768 reverses. After the fix: tags ARE importance-ordered across the cap; the bare sorts are gone (Terms/Groups now honestly insertion-order with a 'Showing N of M' cue, not a misleading dead sort)."
  recommendation: blocking-doc-work
  recommendation_reason: "Per CLAUDE.md 'incorrect documentation has higher priority than missing documentation' — a published manual now contradicting shipped code is the Critical class. It rides the release/0.29.0 train as DOC-475 (F-179.yaml:36; feature-reflections/detail/F-179.yaml:55-61), so it is gated to publish AT the release, not blocking the code merge — but it must be written before 0.29.0 ships. The 0.28.0 backend Top-Tags 'Fixed in' notice on the tagging page is the precedent pattern for how to word the entity-detail-page update."

- doc_gap: "(net-new — DOC-286 family caveat on the truncation hint, now partially satisfied)"
  source: "feature-reflections/detail/F-179.yaml:609-619 (H-006 caveat tracked as DOC-286)"
  relevance: "DOC-286 was the caveat that truncation is signalled only by the (N) button suffix with no first-paint cue. Defect 3 ('Showing N of M' caption) directly ADDRESSES that UX gap on the entity Overview panels — so the DOC-286 caveat softens for Tags/Groups/Terms but still holds for the term-detail tags + dataset-field tags (which did NOT get the caption, per question scope)."
  recommendation: parallel-doc-work
  recommendation_reason: "Fold into the same release/0.29.0 doc pass as the ordering correction; note the caption is entity-Overview-only so the DOC-286 caveat is narrowed, not deleted."

## Test gaps to cover

The test-map.yaml reducer has NO F-179 coverage (Grep for F-179|OverviewTags|tagsCompare|truncat
returned only unrelated LDAP/role/login truncation hits). F-179's own `related_test_gaps` are unminted
`TEST-GAP-NNN` placeholders (`F-179.yaml:422-423`). The promise layer records **0 of 9 F-179 promises
verified** (`F-179.yaml:364-366`): the three e2e tests IT-020 (tags) / IT-016 (terms) / IT-024 (groups)
assert only that a chip RENDERS, never its ORDERING (`F-179.yaml:288-291,367-377`).

- test_gap: "(net-new — F-179-UC-1: important tag surfaces in visible top-20 after late add)"
  source: "feature-reflections/detail/F-179.yaml:633-644 (recommended_log_as TEST-GAP-NNN pending)"
  criticality: "HIGH for the fix — this is the exact promise the diff claims to fix; without a pin the regression is invisible (the existing e2e tests would stay GREEN whether sorted or not)."
  relevance: "The question states a vitest was authored RED-on-pre-fix + IT-020's #1768 case RED on ref:main / GREEN on the working-tree SUT (F-179.yaml:36, feature-reflections/detail/F-179.yaml:56-60). Confirm that vitest asserts ORDER (an important tag at index 22 of 25 lands in the first 20 rendered TagItems), not merely presence."
  recommendation: blocking-test-work
  recommendation_reason: "A fix to an ordering bug that ships without an ordering assertion is unguarded; the reviewer should verify the new test asserts DOM order, not chip count. Proposed shape: F-179.yaml:640-644."
- test_gap: "(net-new — F-179-UC-2: View All presents global importance order across both windows)"
  source: "feature-reflections/detail/F-179.yaml:645-654 (H-002, the merge defect — net_new, distinct from PLT-096 single-window framing)"
  criticality: "HIGH — this is the subtle half of Defect 1 the single-window framing under-stated."
  relevance: "If the fix sorts each window independently (sort-then-slice on window 1, separate sort on window 2) the merge defect H-002 REOPENS. The correct shape is `const sorted=[...tags].sort(cmp)` once, then slice sorted into BOTH windows (feature-reflections/detail/F-179.yaml:581-587). The reviewer MUST confirm the diff computes one sorted array, not two."
  recommendation: blocking-test-work
  recommendation_reason: "This is the single highest-value reviewer check in this walk — see Reviewer blind spots. A unit test clicking View All and asserting the important tag renders before the first non-important tag across the merged list pins it (F-179.yaml:652-654)."
- test_gap: "(net-new — F-179-UC-3 / UC-8 happy-path + DELETED-state guards)"
  source: "feature-reflections/detail/F-179.yaml:655-665 (UC-3), :706-717 (UC-8)"
  criticality: "MEDIUM — confirmed-but-untested guards the fix must not regress."
  relevance: "UC-3: an entity with <=20 tags must still show all tags importance-then-alpha (the no-truncation happy path). UC-8: a DELETED entity still renders chips, edit affordance hidden — the render branch must stay ungated (OverviewTags.tsx:39,104)."
  recommendation: follow-up-test-work
  recommendation_reason: "Not blocking the fix (behaviour unchanged by the diff) but per LSN-030 every unverified promise is a missing-functional demand; mint alongside the UC-1/UC-2 pins so a future refactor that gates the render branch is caught."

## Suggested implementation skeleton

The change is already implemented; this section is a **review checklist** scaffold (the verification
steps a reviewer walks against the diff), not a build plan.

- step: "Confirm Defect 1 computes ONE sorted array per panel, sliced into both the visible window and the View-All overflow window."
  files_to_touch: ["DataEntityDetails/Overview/OverviewTags/OverviewTags.tsx", "Terms/TermDetails/Overview/OverviewTags/OverviewTags.tsx", "DatasetStructure/.../DatasetFieldTags/DatasetFieldTags.tsx"]
  pattern_anchor: "feature-reflections/detail/F-179.yaml:581-587 (the H-002 fix shape — sort once, slice into both windows)"
  caveats:
    - "Pre-fix both windows sorted independently (OverviewTags.tsx:54-56 + :70-72). If the fix only flipped window 1 to sort-then-slice but left window 2 as a separate sort, the merge defect (H-002) is NOT fixed — verify both windows derive from the same sorted source."
- step: "Confirm Defect 2 is a pure deletion of the bare `.sort()` on Groups + Terms (both windows), with no comparator substituted."
  files_to_touch: ["DataEntityDetails/Overview/OverviewGroups/OverviewGroups.tsx", "DataEntityDetails/Overview/OverviewTerms/OverviewTerms.tsx"]
  pattern_anchor: "F-179.yaml:26 (resolved_drift_classes — no-op .sort() removed, server/wire order preserved)"
  caveats:
    - "Removing the no-op is behaviour-neutral ONLY because V8 TimSort is stable (feature-reflections/detail/F-179.yaml H-005). The 'Showing N of M' caption is what makes the now-honest insertion order acceptable UX — verify the caption ships WITH the removal, not separately."
- step: "Confirm Defect 3 caption is entity-Overview-only (Tags/Groups/Terms) and NOT on term-detail tags or dataset-field tags."
  files_to_touch: ["the 3 entity Overview panels", "7 locale catalogs en/br/es/fr/ch/ua/hy"]
  pattern_anchor: "question scope statement; F-179.yaml:27,34-35"
  caveats:
    - "Verify the new i18n key exists in ALL 7 catalogs (CLAUDE.md Gate 0 i18n-all-locales) — a missing locale renders the raw key. This is the one place a FE-only change still has a 7-file fan-out the reviewer must check."
    - "The caption narrows but does NOT close DOC-286 for the two surfaces that did not receive it (section 4)."
- step: "Confirm NO prop/signature change leaked to TagItem/TermItem/GroupItem or to the F-176 composer."
  files_to_touch: ["(verification only — none should change)"]
  pattern_anchor: "F-176.yaml:173-197 (composer passes arrays down as props; no shared ordering contract)"
  caveats:
    - "The fix is internal to each panel's render expression; if any panel's props interface changed, the F-176 composer call-sites (Overview.tsx) would need a matching edit — confirm they do not."

## Ontology coverage gaps

- area: "The five changed components are leaf .tsx with NO enriched file-analyser sidecar — F-179 chain hops 1a/1b/1c are all `unresolved`."
  missing: sidecar
  recommended_next: "Run /enrich (file-analyser) on DataEntityDetails/Overview/OverviewTags, OverviewTerms, OverviewGroups (and the term-detail OverviewTags + DatasetFieldTags) so the render/ordering verdicts anchor in sidecar dependencies_semantic + tests_coverage_semantic rather than source reads. The F-179 reflection flags this as its FIRST output (validation_gaps, feature-reflections/detail/F-179.yaml:758-776). Until then this walk's node-level claims rest on direct source reads, cited inline."
- area: "The working tree at REPO_ROOT_ABS is on the PRE-fix state, not the fix branch."
  missing: "(not an ontology gap — a verification-surface gap)"
  recommended_next: "The fix lives on contrib/CTRIB-026-overview-truncation-ordering @ c54b9c61, which is NOT checked out at REPO_ROOT_ABS. The working-tree OverviewTags.tsx:54-56 still shows `.slice(0,visibleLimit).sort(tagsCompare)` (pre-fix). I therefore read the UNTOUCHED siblings (identical on both branches — valid for section 3) directly, and grounded the post-fix state of the five changed files in the F-179 resolution block + the question's described diff. To verify the diff itself, the reviewer must check out c54b9c61 or read the PR — this walk asserts blast radius, not diff-line correctness."
- area: "No substrate concept exists for the sidebar sort-order defect or the truncation caps themselves."
  missing: concept
  recommended_next: "doc-understanding/data-discovery__entity-detail-page.md:37 records this gap explicitly ('No dedicated substrate concept was found for the page's Tags/Terms/Groups sidebar sort-order defect … or for the sidebar truncation caps'). A concept-merger pass could mint an 'Overview sidebar truncation ordering' concept paired with the existing Top-Tags drift candidate, so the FE and BE halves of the ordering-drift family are catalogued together."
- area: "test-map.yaml carries no F-179 / OverviewTags coverage and doc-gaps.md carries no entity-detail truncation entry."
  missing: "test-gap + doc-gap (both unminted)"
  recommended_next: "The F-179 placeholders (TEST-GAP-NNN / DOC-GAP-NNN) should be minted as real IDs by a test-coverage-mapper / doc-gap-finder pass so the UC-1/UC-2 pins and the DOC-475 entity-detail-page correction become tracked artefacts rather than feature-flow placeholders."

## Open questions for the maintainer

- question: "Should the PLT-232 shared-<TruncatedList> follow-up be expanded to ALSO normalise the truncation-hint UX (give AttachmentsList + OverviewMetrics + the term-detail/dataset-field tag panels a 'Showing N of M' cue), or is the entity-Overview-only caption an accepted intentional asymmetry for 0.29.0?"
  why_only_maintainer_can_answer: "This is a product/UX-consistency scope call, not a technical fact — the ontology can show WHICH siblings lack the hint (section 3) but not whether the inconsistency is acceptable for this release."
  default_if_unanswered: "Ship #1768's bounded entity-Overview caption as-is for 0.29.0; log the sibling-hint normalisation as part of PLT-232's acceptance criteria so the divergence is tracked, not lost."
- question: "Should a 'truncated read-surface lists rank the full set before the visible cut' convention be codified as an implicit-ADR candidate alongside PLT-232, given #1768 now sets that precedent on the FE while ~7 siblings remain on the old shape?"
  why_only_maintainer_can_answer: "Whether to formalise a cross-component UI convention as an ADR is an architectural-stewardship judgment; the ontology can show the precedent exists but not whether the team wants it binding."
  default_if_unanswered: "Defer ADR drafting to the PLT-232 work; #1768 alone does not require an ADR (it aligns with the already-shipped backend LSN-019 stance)."

## Parallel / coupled untouched sibling sites (SECTION 3 — the most important)

The reviewer's question: which OTHER components share the hand-rolled slice + .sort() + View-All
collapse pattern that #1768 did NOT touch, and for each — is it (a) carrying the same slice-then-sort
importance bug and now INCONSISTENT with the fixed lists, (b) lacking the new truncation hint (a UX
inconsistency the bounded fix creates), or (c) unaffected. All findings below are grounded in a direct
read of the working-tree source (untouched siblings are identical on both branches).

**Finding A — `OverviewAttachments/AttachmentsList` — (b) + partial pattern-twin, NO importance bug.**
Source: `OverviewAttachments/AttachmentsList/AttachmentsList.tsx:42-63`. It IS a slice + Collapse +
collapse-footer twin: `data.slice(0, visibleLimit).map(renderItem)` (line 45) + a second
`data.slice(visibleLimit).map(renderItem)` inside `<Collapse unmountOnExit>` (line 50) + a "Show
hidden"/"Hide" toggle (line 57). BUT it has **NO `.sort()` at all** — attachments carry no
importance/ordering promise, so there was never a slice-then-sort importance bug here.
Classification: **(b) UX-inconsistent** — it lacks the new "Showing N of M" hint; after #1768 the entity
Overview tag/group/term panels show a count cue while the attachments list (same page, same right rail)
shows only a "Show hidden" toggle with no count. Also note its `visibleLimit` is width-computed
(`offsetWidth / 112`, line 25), not a fixed cap, and its toggle label is "Show hidden" not "View All
(N)" — so it never exposed the count even pre-fix. NOT a correctness regression; a cosmetic divergence
PLT-232 should absorb.

**Finding B — `OverviewMetrics` — (b) only, NO slice, NO sort.**
Source: `OverviewMetrics/OverviewMetrics.tsx:50-84`. It has a View-All/Hide collapse but it is a
**height-based CSS collapse** (`maxHeight=450`, `scrollHeight > maxHeight` → showBtn, line 35-39), NOT a
top-N slice: it renders `data.metricFamilies.map(...)` in full (line 72) and clips visually. No
`.slice()`, no `.sort()`, no count. Classification: **(b) UX-inconsistent** — same family of "long list
+ View All" affordance but no "Showing N of M" cue and no truncation count (it cannot have one — nothing
is sliced). It was never affected by the slice-then-sort bug. Cosmetic divergence only. (Side note:
lines 50-51 are a duplicated identical early-return — a pre-existing dead-line smell, out of #1768
scope, worth a trivial follow-up.)

**Finding C — `OverviewMetadata` — (c) unaffected, different pattern.**
Source: `OverviewMetadata/OverviewMetadata.tsx:59-109`. Renders `customMetadata.map(...)` (line 60) and
`predefinedMetadata.map(...)` (line 100) in FULL, inside a `useCollapse({initialMaxHeight:200})`
height-based collapse (line 23-24). No slice, no top-N cap, no sort, no count. Classification:
**(c) unaffected** — it is a height-clipped full-render, not a top-N truncation; the #1768 pattern does
not apply and it creates no new inconsistency beyond already using a different collapse idiom than the
tag/group/term panels (a pre-existing inconsistency F-176 already notes).

**Finding D — `OverviewStats/OverviewEntityGroupItems` — (c) unaffected, server-paginated.**
Source: `OverviewStats/OverviewEntityGroupItems/OverviewEntityGroupItems.tsx:25-135`. This is a
**server-side paginated InfiniteScroll** (`useGetDataEntityGroupItems({size:10})` + `hasNextPage` +
`fetchNextPage`, lines 25-35, 108-118) — fundamentally different from a client-side `.slice()` of an
already-fetched array. No client truncation, no sort, no View-All-count. Classification:
**(c) unaffected** — not the #1768 pattern at all (it is the DEG-items table, a different surface from
the OverviewGroups membership chips).

**Finding E — the two no-op-sort siblings (`OverviewGroups`, `OverviewTerms`) — these ARE in the diff.**
Listed here only to close the enumeration: pre-fix these had the bare `.slice().sort()` no-op
(OverviewGroups.tsx:49-51,59-61). They are Defect 2 targets, so they MOVE from the unfixed cohort into
the fixed cohort with #1768 — NOT untouched siblings.

**Summary of section 3.** No untouched sibling carries the slice-then-sort **importance** bug — that bug
only ever existed where an importance/alphabetical comparator was applied after a slice, i.e. the three
tag lists, all of which #1768 fixes. AttachmentsList is the only true structural pattern-twin
(slice + Collapse + footer toggle) and it never had a sort to get wrong. The inconsistency the bounded
fix DOES create is purely the **(b) truncation-hint UX gap**: after #1768, the three entity Overview tag
/group/term panels gain a "Showing N of M" cue while AttachmentsList and OverviewMetrics (same page) and
the term-detail tags + dataset-field tags (other pages) do not. That is a cosmetic divergence, correctly
deferred to PLT-232 — but it should be named in PLT-232's scope so it is consolidated, not left as
permanent drift. There is **no correctness regression** in any untouched sibling.

## sources

- restated_as_concepts ← concepts.yaml (Tag tag.yaml:1-3); feature-flows/detail/F-179.yaml:5-38; canonicalisation_candidates/top-tags-ui-label-vs-implementation-drift-operator-visible.yaml:30-58
- affected_nodes.[OverviewTags-entity] ← OverviewTags.tsx:18-117 (working-tree read); feature-reflections/detail/F-179.yaml:62-94 (post-fix resolution)
- affected_nodes.[OverviewTags-term] ← Terms/TermDetails/Overview/OverviewTags/OverviewTags.tsx:15-105 (working-tree read)
- affected_nodes.[DatasetFieldTags] ← DatasetStructure/.../DatasetFieldTags/DatasetFieldTags.tsx:12-110 (working-tree read)
- affected_nodes.[OverviewGroups] ← OverviewGroups.tsx:49-61 (working-tree read); feature-reflections/detail/F-179.yaml H-005
- affected_nodes.[OverviewTerms] ← F-179.yaml:38; feature-reflections/detail/F-179.yaml H-004
- related_concepts.[Tag] ← lineage/odd-platform/concepts/detail/entities/tag.yaml:1-3,147-156,244-292,415-474
- related_concepts.[TopTagsDrift] ← concepts/detail/canonicalisation_candidates/top-tags-ui-label-vs-implementation-drift-operator-visible.yaml:30-110
- related_concepts.[F-176] ← feature-flows/detail/F-176.yaml:91-101,173-197,296-322
- adrs_to_respect.[none] ← Glob adrs/**/*.md (framework drafts only, no UI-ordering ADR); implicit-adrs.md (no slice-before-sort entry); live tagging doc 0.28.0 'Fixed in' notice (backend LSN-019 precedent)
- refactoring_scopes_touched.[PLT-232] ← commit 43ad0bf; feature-flows/detail/F-179.yaml:418-421
- refactoring_scopes_touched.[Groups-deadsort] ← feature-flows/detail/F-179.yaml:419-420; :26
- doc_gaps_to_address.[entity-detail-page-stale] ← LIVE https://docs.opendatadiscovery.org/features/data-discovery/entity-detail-page (WebFetched 2026-06-21, status 200); doc-understanding/data-discovery__entity-detail-page.md:33-37; feature-flows/detail/F-179.yaml:36
- doc_gaps_to_address.[DOC-286] ← feature-reflections/detail/F-179.yaml:609-619
- test_gaps_to_cover.[UC-1] ← feature-reflections/detail/F-179.yaml:633-644; F-179.yaml:36
- test_gaps_to_cover.[UC-2] ← feature-reflections/detail/F-179.yaml:573-587,645-654
- test_gaps_to_cover.[UC-3/UC-8] ← feature-reflections/detail/F-179.yaml:655-665,706-717
- suggested_implementation_skeleton.[*] ← feature-reflections/detail/F-179.yaml:581-587; F-179.yaml:26-27,34-35; F-176.yaml:173-197
- section3.A_attachments ← OverviewAttachments/AttachmentsList/AttachmentsList.tsx:42-63 (working-tree read)
- section3.B_metrics ← OverviewMetrics/OverviewMetrics.tsx:50-84 (working-tree read)
- section3.C_metadata ← OverviewMetadata/OverviewMetadata.tsx:59-109 (working-tree read)
- section3.D_groupitems ← OverviewStats/OverviewEntityGroupItems/OverviewEntityGroupItems.tsx:25-135 (working-tree read)
- live_doc_excerpts.[entity-detail-page] ← https://docs.opendatadiscovery.org/features/data-discovery/entity-detail-page (Tags 'sort runs after the cut to the first 20'; Groups/Terms 'visible-window ordering is undefined')
- live_doc_excerpts.[tagging] ← https://docs.opendatadiscovery.org/features/data-discovery/tagging ('Fixed in 0.28.0 — Top tags … rank by true popularity'; important flag 'rendered visually distinct'; entity-level tag order unspecified)

## confidence_per_section

- restated_as_concepts: HIGH
- affected_nodes: HIGH (node identities + behaviour grounded in working-tree source reads + F-179; ordering-fix POST-state grounded in the F-179 resolution + question diff, not a diff read — see coverage gaps)
- related_concepts: HIGH
- adrs_to_respect: HIGH (the absence of a governing ADR is verified via Glob + implicit-adrs.md grep, not assumed)
- refactoring_scopes_touched: MEDIUM (PLT-232 is referenced in a commit message + F-179 placeholder; the scope is not yet minted in refactoring-scopes.md, so its exact category/severity is inferred from its description)
- doc_gaps_to_address: HIGH (live-verified this session; the stale-caveat finding rests on a 200 WebFetch quoting the pre-fix text verbatim)
- test_gaps_to_cover: HIGH (grounded in the F-179 reflection's cross_references; the existence of the authored vitest/IT rests on the question's statement, flagged as such)
- suggested_implementation_skeleton: HIGH
- ontology_coverage_gaps: HIGH

## Maintainer notes

<!-- preserved across refreshes — only block the maintainer hand-edits -->
