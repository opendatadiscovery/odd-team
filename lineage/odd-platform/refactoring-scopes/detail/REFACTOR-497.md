## REFACTOR-497 — `updateTag`'s response `Tag` omits `external` and `usedCount` — the terminal `.map(tagMapper::mapToTag)` uses the bare-`TagPojo` overload; the populating `mapToTag(TagDto)` overload exists but is unused

**Severity**: MEDIUM
**Category**: response-shape-drift
**Batch**: X-TAGGING
**Related pillar features**: P-08 (Management & Administration — Tags tab edit), P-11 (Platform API & Developer Surface)
**related_features**: [F-018]

**Surfaced by**:
- `odd-platform__java__TagController__controller-method__updateTag.md:bugs_limitations_corner_cases[0]` ("`updateTag`'s response `Tag` omits `external` and `usedCount`.")
- `odd-platform__java__TagController__controller-method__updateTag.md:stress_findings.request_inputs[1]` (the available-but-unused `mapToTag(TagDto)` overload smell)

**Statement**: `TagServiceImpl.update` ends with `.map(tagMapper::mapToTag)` applied to a bare `TagPojo` (`TagServiceImpl.java:54`). The `mapToTag(TagPojo)` MapStruct overload (`TagMapper.java:26`) maps only `id, name, important` — `TagPojo` has no `usedCount` or `external` field. The OpenAPI `Tag` response schema declares `id, name, important, external, usedCount`, so a consumer of `PUT /api/tags/{tag_id}` receives `external` and `usedCount` as null/absent. This is INCONSISTENT with `getPopularTagList`'s `Tag` items, which are mapped from a `TagDto` via the `mapToTag(TagDto)` overload (`TagMapper.java:23-24`) that DOES populate `external` and `usedCount`. The populating overload EXISTS and is used elsewhere — `updateTag` simply calls the wrong one. A UI that re-renders a tag chip from the `updateTag` response loses the usage count and the external flag.

**Evidence**: `TagServiceImpl.java:54` (`.map(tagMapper::mapToTag)` on a bare `TagPojo`) + `TagMapper.java:26` (the `mapToTag(TagPojo)` overload — `id, name, important` only) + `TagMapper.java:23-24` (the `mapToTag(TagDto)` overload — populates `external` + `usedCount`, used by `listMostPopular`) + `components.yaml:302-320` (the `Tag` schema declares all five fields).

**Why this is a gap, not an ADR (wisdom test)**:
1. *Intentional?* NO. The OpenAPI `Tag` schema declares five fields; `updateTag` returns three; `getPopularTagList` returns all five. There is no comment or doc defending "updateTag deliberately omits external/usedCount". The populating overload exists and is used by the sibling read endpoint — `updateTag` calls the wrong overload. The available-but-unused `mapToTag(TagDto)` overload is the smoking gun: the maintainer wrote the full-mapping path and `updateTag` just didn't use it.
2. *Structural impact?* NO — the fix is to make `TagServiceImpl.update` return a `TagDto` (re-reading the usage count + external aggregate) and call `mapToTag(TagDto)`, OR to populate the missing fields another way; the response contract is unchanged, only the mapping is corrected.
3. *Refactoring or structural?* REFACTORING — switch the terminal mapping to the populating overload.
→ refactoring scope.

**Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-001 (controllers implement the OpenAPI-generated `*Api` interface; the spec is the contract) is the implied prescription — the response body should match the declared `Tag` schema. The `getPopularTagList` path (which DOES populate all five fields) is the in-codebase reference for the correct behaviour.

**Proposed remedy**: Change `TagServiceImpl.update` so its terminal step produces a fully-populated `Tag` — either re-read the tag as a `TagDto` after the UPDATE (re-running the `getDto` aggregate that supplies `usedCount` + `external`) and call `tagMapper.mapToTag(TagDto)`, or fold the aggregate into the update flow. Add a test asserting the `updateTag` response body's `external` and `usedCount` are populated and match `getPopularTagList`'s shape for the same tag.

**Severity rationale**: MEDIUM — a response-shape contract drift. A consumer of `PUT /api/tags/{tag_id}` relying on `external` / `usedCount` gets null; a UI re-rendering from the response loses the usage count and the external badge. Filed MEDIUM not LOW because it is a spec-vs-implementation mismatch on a response body (a generated strict client would have a typed-but-null field), and the inconsistency with the sibling read endpoint is operator-visible.

**Suggested backlog grouping**: DOC-NNN / OpenAPI contract-hardening sprint OR a small "tag write-path correctness" item — pair with REFACTOR-492 (the status-code drift) as the two `updateTag` contract-conformance fixes.

---
