## REFACTOR-380 — Tag resurrection of soft-deleted tag does NOT restore relations — `TagServiceImpl.delete` hard-deletes the relation tables (`tag_to_*`), then soft-deletes the tag; a subsequent `bulkCreate(name)` succeeds but gets a NEW id; the prior relations are lost without operator-visible audit

**Severity**: LOW
**Category**: silent-data-loss-on-resurrection
**Surfaced by**: `ReactiveTagRepositoryImpl.md:bugs_limitations_corner_cases[4]`

**Description**: `TagServiceImpl.delete` (lines 64-66) issues `Flux.zip(deleteTermRelations(tagId), deleteDataEntityRelations(tagId))` (BOTH HARD DELETES via ReactiveTagRepositoryImpl.java:236-241 / 280-286), then `delete(tagId)` (soft-delete on the directory row).

Subsequent `bulkCreate(new TagPojo().setName(name))` with the same name succeeds (the partial unique index per ADR-CANDIDATE-070 permits it because the soft-deleted row's deleted_at IS NOT NULL) but gets a NEW `id`. The `tag_to_*` rows that referenced the old id are gone.

**The architecture-acknowledged trade-off**: ADR-CANDIDATE-069 (edge tables are hard-delete) DELIBERATELY chose hard-delete for edges. The consequence is "resurrected entity loses attachment history". The Tag specifically pays this cost — a Tag deleted and recreated with the same name has NO continuity of attachments.

There is no maintainer-visible audit of this — a Tag silently deleted then recreated loses ALL its prior assignment history. Operators using the Tag dropdown see the recreated Tag as fresh.

**Primary source citations**:
- `TagServiceImpl.java:58-70` — the delete sequence
- `ReactiveTagRepositoryImpl.java:227-241, 272-286` — the hard-delete-relations methods
- `V0_0_64__remove_is_deleted_field.sql:105` — the partial-index that allows reuse

**Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-069 (edge tables hard-delete) ACCEPTS this trade-off; ADR-CANDIDATE-128 NEW (onDuplicateKeyIgnore for relations) explains the create-side hard-state model. This scope is the operator-documentation gap.

**Proposed remedy**:
1. **Doc-side remedy** — add a paragraph to `documentation/docs/features/data-discovery/tagging` explaining the delete-then-recreate behaviour.
2. **Add a confirmation dialog at the UI** — when the operator deletes a tag with N attached entities, surface "Deleting this tag will remove N attachments; recreating the tag by name will NOT restore them. Proceed?".
3. **Add an activity event** — emit `TAG_DELETED_WITH_ATTACHMENTS_LOST` activity event capturing the deleted tag's attachment count. Surfaces in the operator's activity feed.

Option 1 is the smallest blast radius.

**Severity rationale**: LOW — documented behaviour of the architecture; not a defect. Operator-surprise surface in the dropdown UX.

**Suggested backlog grouping**: `DOC-NNN tagging-lifecycle-disclosure`.

---
