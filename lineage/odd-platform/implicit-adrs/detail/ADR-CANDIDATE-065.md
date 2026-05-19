## ADR-CANDIDATE-065 — Tag auto-create-on-miss is INTENTIONAL and spec-acknowledged (rare distinction vs. Owner / Title side-channels)

**Severity**: MEDIUM
**Classification**: promote
**Support count**: 1 sidecar (load-bearing — explicitly documented at the OpenAPI spec layer, making this an INTENT anchor where Owner/Title equivalents are silent)
**Axes present**: controllers, services, OpenAPI spec
**Surfaced by**:
- `createDataEntityTagsRelations.md:implicit_adrs[1]` ("Tag auto-creation on data-entity tag assignment is INTENTIONAL and documented at the spec layer — the OpenAPI description `openapi.yaml:1174` explicitly reads 'Also creates corresponding tags in the system if they don't exist.'")

**Decision statement**: When a caller submits `PUT /api/dataentities/{id}/tags` with `tag_name_list: ['novel-name']` for a tag name that does not yet exist in the global `tag` directory, the platform auto-creates the Tag row (with `important = false`) as a side effect of the per-data-entity tag-relation write. This is **explicitly documented** in the OpenAPI spec (`openapi.yaml:1174`: "Also creates corresponding tags in the system if they don't exist."). The decision encodes "tagging is a low-friction operation; gate it at the data-entity level, not the directory level." Auto-created tags are intentionally NON-IMPORTANT (the dedicated `POST /api/tags` route is the only path that can set `important = true`). This is structurally similar to the Owner / Title auto-create side-channels (REFACTOR-199, REFACTOR-206) but DIFFERS in that the spec documents it.

**Evidence**:
- `createDataEntityTagsRelations.md` says: "the OpenAPI description `openapi.yaml:1174` explicitly reads 'Also creates corresponding tags in the system if they don't exist.' This is a deliberate UX decision (typing a new tag in the UI just works, no separate admin step), and the spec-level acknowledgment distinguishes this from the Owner/Title parallel where the auto-create is undocumented and incidental."
- `createDataEntityTagsRelations.md` says: "`important = false` default for auto-created tags is hardcoded — `TagServiceImpl.divideTagsByExistence:155` reads `.map(n -> new TagPojo().setName(n).setImportant(false))`"

**Rationale (wisdom test 3-question)**:
1. *Intentional?* YES — STATED IN THE OPENAPI SPEC. This is the clearest intent_anchor of any candidate in this batch.
2. *Structural impact?* YES — operator-authoring affordance, side-channel permission semantics, directory growth pattern.
3. *Refactoring or structural?* STRUCTURAL — adding a "require TAG_CREATE for auto-create" gate would change the operator-facing UX and Policy authoring model.
→ ADR-CANDIDATE.

**Note on split**: the scope-asymmetry consequence (caller with `DATA_ENTITY_TAGS_UPDATE` can side-door past the management-level `TAG_CREATE` gate, polluting the global Tag directory) is a SEPARATE limitation — REFACTOR-223. The ADR captures the intent; the scope is the unintended-consequence layer that the spec acknowledgment does NOT defend.

**Existing ADR**: none directly; partially overlaps with the batch-F findings on Owner / Title auto-create (REFACTOR-199, REFACTOR-206), which are gap-shaped (no spec acknowledgment).

**Proposed action**: Promote to `adrs/drafts/tag-auto-create-spec-acknowledged.md`. The ADR should articulate: (a) the UX trade-off (low-friction tagging), (b) the `important = false` default and what that means semantically, (c) the cross-reference to REFACTOR-223 (scope-asymmetry) as the gap the ADR does NOT defend.

**Severity rationale**: MEDIUM — pattern-shaping UX decision that distinguishes the Tag side-channel from the Owner / Title parallels via spec-level acknowledgment. Worth promoting both because the intent is clear AND because the maintainer needs to articulate the trade-off the spec text glosses over.

---
