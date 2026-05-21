## REFACTOR-496 — `getPopularTagList`'s `ids` query parameter reuses the shared `IdsParam` component whose description reads "Entity ids" — but it filters by TAG id (LSN-020-class input-name-vs-implementation drift)

**Severity**: LOW
**Category**: contract-typo
**Batch**: X-TAGGING
**Related pillar features**: P-01:F-006 (Manual Object Tagging), P-11 (Platform API & Developer Surface — the OpenAPI contract)
**related_features**: [F-018]

**Surfaced by**:
- `odd-platform__openapi__tags__openapi-tag__tag.md:bugs_limitations_corner_cases` ("`IdsParam` describes the `ids` query parameter as `Entity ids` but `getPopularTagList` filters by TAG id (LSN-020 class).")
- `odd-platform__openapi__tags__openapi-tag__tag.md:stress_findings.request_inputs[ids]`
- `odd-platform__java__TagController__controller-method__getPopularTagList.md:concepts.entities` (`ids` is a TAG-id-set filter — `TAG.ID.in(ids)`)

**Statement**: `getPopularTagList` (`GET /api/tags`) references the SHARED OpenAPI component `IdsParam` for its `ids` query parameter (`openapi.yaml:351` → `components.yaml:4239-4248`). The `IdsParam` component's `description` field reads `Entity ids`. But `TagController.getPopularTagList` binds `ids` as `List<Long>` and the implementation filters the TAG DIRECTORY by TAG id — `if (CollectionUtils.isNotEmpty(ids)) conditions.add(TAG.ID.in(ids))` (`ReactiveTagRepositoryImpl.java:141-142`). A consumer reading the rendered spec for `getPopularTagList`, seeing "Entity ids", would supply DATA-ENTITY ids and receive empty / nonsensical results (none of those ids exist in the `tag` table — unless one collides with a tag id, in which case they get a wrong tag). The defect is operation-LOCAL: the `IdsParam` component IS shared and IS accurate for its OTHER consumer (`openapi.yaml:139`, a data-entity-scoped operation) — a tag-scoped operation reuses an entity-scoped parameter component. Placeholder probe P-031 pins the SQL-bind confirmation.

**Evidence**: `components.yaml:4239-4248` (`IdsParam` — `name: ids`, `description: Entity ids`) + `openapi.yaml:351` (getPopularTagList references `IdsParam`) + `openapi.yaml:139` (the data-entity-scoped operation for which `Entity ids` IS accurate) + `TagController.java:36-44` (binds `ids` straight to `tagService.listMostPopular`) + `ReactiveTagRepositoryImpl.java:141-142` (`TAG.ID.in(ids)`) + `lineage/odd-platform/probes/P-031.yaml`.

**Why this is a gap, not an ADR (wisdom test)**:
1. *Intentional?* NO. The `ids` parameter filters by `tag.id`; the shared component's description says "Entity ids". There is no comment or doc defending the reuse. This is a parameter-component-reuse mistake — an entity-scoped component pulled onto a tag-scoped operation — i.e. a contract typo / misdescription.
2. *Structural impact?* NO — the fix is a dedicated `TagIdsParam` component (description "Tag ids") or an operation-level parameter `description` override on `getPopularTagList`.
3. *Refactoring or structural?* REFACTORING — add a dedicated parameter component or an inline override in the spec.
→ refactoring scope.

**Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-008 (OpenAPI tags follow URL-prefix scoping, resource-shaped) is tangentially relevant — `getPopularTagList` is a tag-scoped operation; reusing an entity-scoped parameter component on it is the kind of cross-resource leak the resource-shaped convention is meant to avoid. The implied prescription is parameter-description accuracy: a parameter's documented description must match what the operation does with it.

**Proposed remedy**: Add a dedicated `TagIdsParam` component to `components.yaml` (`name: ids`, `description: Tag ids`, `type: array` of `int64`) and reference it from `getPopularTagList` (`openapi.yaml:351`) instead of the shared `IdsParam`; OR add an operation-level parameter `description` override on `getPopularTagList`. Do NOT change the SQL bind — `TAG.ID.in(ids)` is correct; only the spec description is wrong. Promote placeholder probe P-031 to a quick assertion (supply a value that is BOTH a valid data-entity id AND a valid tag id, confirm the operation returns the TAG).

**Severity rationale**: LOW — a spec-rendering / contract-description defect. A consumer reading the rendered spec is misled, but the practical impact is bounded (they get empty results and figure it out, or get a collision-wrong tag — annoying, not destructive). It is a documentation-correctness gap, not a behaviour bug — `getPopularTagList` does the right thing; the spec describes it wrong.

**Suggested backlog grouping**: DOC-NNN / OpenAPI contract-hardening sprint — pair with REFACTOR-492 (the 200-vs-201 status drift) and REFACTOR-226 (the create-vs-replace naming drift); all three are OpenAPI-spec-vs-reality corrections on the tag surface.

---
