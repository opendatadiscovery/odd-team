## ADR-CANDIDATE-205 — Multi-channel tag-relation ownership model — `tag_to_*` relation rows encode provenance (origin enum / external boolean) so a UI replace-all only touches the channel the UI owns; Collector-pushed tags are immutable to the UI

**Severity**: HIGH
**Classification**: promote
**Support count**: 3 sidecars (deleteTag + updateDatasetFieldTags + createTermTagsRelations — each surfaces a different facet of the same model; cross-confirmed by the batch-N ReactiveTagRepositoryImpl primary source)
**Axes present**: controllers, services, repositories, schema
**Batch**: X-TAGGING
**Related pillar features**: P-01:F-006 (Manual Object Tagging), P-10 (Integrations & Ingestion — the EXTERNAL/EXTERNAL_STATISTICS channels), P-06 (Data Glossary — term-tag relations), P-09 (Security & Access Control — the operator-vs-ingestion trust boundary)
**related_features**: [F-018]

**Surfaced by**:
- `odd-platform__java__DatasetFieldController__controller-method__updateDatasetFieldTags.md:implicit_adrs.[1]` ("INTERNAL tag relations are owned by the UI/API channel; EXTERNAL and EXTERNAL_STATISTICS are owned by ingestion — `deleteDatasetFieldInternalRelations` deliberately scopes its DELETE to `origin = 'INTERNAL'`. The `TagOrigin` enum's three members encode a multi-channel ownership model at the relation level: this endpoint's replace-all only ever touches the channel it owns.")
- `odd-platform__java__TagController__controller-method__deleteTag.md:implicit_adrs.[1]` ("A tag with Collector-set (`external`) relations is immutable to the delete endpoint — the `.filter(tagDto -> !tagDto.external())` guard refuses to delete a tag the Collector owns, mirroring the identical guard on `update`.")
- `odd-platform__java__TermController__controller-method__createTermTagsRelations.md:concepts.invariants` ("No external-tag carve-out — `tag_to_term` has no `external` or `origin` column ... the term-tag relation has no provenance flag ... because terms are a UI/API-authored concept with no ingestion-side tagging path.")

**Decision statement**: ODD's tag-RELATION tables encode the **provenance channel** of each relation row so that a UI/API replace-all only ever touches the channel the UI owns, and Collector-pushed (ingestion-authored) tag relations survive a UI replace-all and are immutable to UI delete/update. The model has three deliberate, asymmetric shapes:

1. **`tag_to_dataset_field`** carries an `origin` enum column — `TagOrigin` ∈ `{INTERNAL, EXTERNAL, EXTERNAL_STATISTICS}` (`TagOrigin.java:3-7`, `origin varchar NOT NULL DEFAULT 'INTERNAL'`). The UI replace-all (`updateDatasetFieldTags`) DELETEs only `origin='INTERNAL'`; `EXTERNAL` and `EXTERNAL_STATISTICS` (dataset-statistics-derived) relations written by the ingestion path `DatasetFieldServiceImpl.updateFieldsTags` SURVIVE the call.
2. **`tag_to_data_entity`** carries an `external` boolean column. The tag delete/update path is gated by `getDto`'s `boolOr(tag_to_data_entity.external)` aggregate; a `.filter(!external)` guard makes a tag with ANY Collector-set data-entity relation immutable to UI delete AND update (`BadUserRequestException("Can't delete/update tag which has external relations")`).
3. **`tag_to_term`** carries NEITHER an `origin` enum NOR an `external` boolean — terms are a UI/API-authored-only concept with no ingestion-side tagging path, so the term-tag replace-all has no channel to preserve and removes EVERY relation absent from the submitted list.

The decision codifies the **trust boundary between operator-authored and ingestion-authored tagging**: the Collector owns the `external` / `EXTERNAL*` channel, the UI owns the `INTERNAL` channel, and a UI mutation cannot destroy what the Collector pushed. The three asymmetric schema shapes (enum / boolean / nothing) reflect which entity types have an ingestion-side tagging path.

**Evidence**:
- `updateDatasetFieldTags.md` intent_anchor: "`.and(TAG_TO_DATASET_FIELD.ORIGIN.eq(TagOrigin.INTERNAL.toString()))`" (`ReactiveTagRepositoryImpl.java:292`).
- `deleteTag.md` says: "the explicit `BadUserRequestException(\"Can't delete tag which has external relations\")` exception message names the contract in user-visible language; the same guard pattern on `update` (`:49-50`) shows it is an intentional cross-method invariant."
- `createTermTagsRelations.md` says: "`tag_to_term` (`V0_0_35__add_terms.sql:18-28`) has no `external` or `origin` column. Unlike `tag_to_data_entity` (which carries `external`) and `tag_to_dataset_field` (which carries `ORIGIN`)... the term-tag relation has no provenance flag."

**Rationale (wisdom test 3-question)**:
1. *Intentional?* YES — the `TagOrigin` enum is a named three-member type; the `origin = 'INTERNAL'`-scoped DELETE is explicit; the `!external` guard carries a user-facing exception message that names the contract; the guard is mirrored across delete + update + `updateRelationsWithDataEntity` (three aligned sites). The schema asymmetry (term has no provenance column) is itself a deliberate consequence of terms having no ingestion path.
2. *Structural impact?* YES — a trust-boundary / security-architecture decision. It defines which mutations a UI caller can and cannot perform on ingestion-authored state, the schema shape of three relation tables, and the replace-all semantics of three endpoints.
3. *Refactoring or structural?* STRUCTURAL — removing the `origin` enum or the `external` guard would let UI users destroy Collector-pushed tagging; adding provenance to `tag_to_term` would be a schema migration + a new ingestion path. Either direction is a structural change, not a refactor.
→ ADR-CANDIDATE.

**Existing ADR**: none directly. Composes with:
- **ADR-CANDIDATE-069** (edge tables are hard-delete) — the `tag_to_*` relations are hard-deleted; this ADR adds the orthogonal provenance dimension.
- **ADR-CANDIDATE-072** (establisher-keyed lineage edge provenance) — a structurally similar "ingestion-vs-operator provenance on edge rows" pattern in the lineage subsystem; the two together suggest a codebase-wide "edge rows carry a provenance discriminator" meta-pattern worth a future consolidation.

**Co-surfaced gaps** (link from `refactoring-scopes.md`):
- **REFACTOR-488** — the `!external` guard on tag delete/update reads ONLY the `tag_to_data_entity` aggregate; it does NOT consult `tag_to_dataset_field.origin`. A tag whose only Collector-set origin is an `EXTERNAL` `tag_to_dataset_field` row passes the guard and CAN be deleted by a UI user — a HOLE in the model this ADR describes. The ADR captures the intended model; REFACTOR-488 captures where the implementation does not fully enforce it.
- **REFACTOR-495** — the dataset-field relation INSERT relies on the `origin` DB column DEFAULT rather than setting it explicitly (the data-entity path explicitly calls `.setExternal(false)`); the model's INTERNAL discriminator is set by a DB default, a fragile-but-functional choice probed by P-030.

**Proposed action**: Promote to `adrs/drafts/multi-channel-tag-relation-ownership.md`. Document: (a) the three asymmetric schema shapes and why (which entities have an ingestion path); (b) the `INTERNAL`-scoped replace-all and the `!external` immutability guard as the trust-boundary enforcement; (c) the cross-link to REFACTOR-488 (the guard's dataset-field-side hole) — the ADR is the prescription, REFACTOR-488 is the gap; (d) the cross-link to ADR-CANDIDATE-072 (lineage establisher provenance) as a sibling pattern.

**Severity rationale**: HIGH — load-bearing trust-boundary / security-architecture decision. The seam between operator-authored and ingestion-authored tag state is exactly the class of decision a future maintainer must understand to make compatible changes: a "let the UI fully replace all tags" PR would silently destroy Collector-pushed tagging across every deployment running collectors.

---
