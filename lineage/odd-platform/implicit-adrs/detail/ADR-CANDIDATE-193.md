## ADR-CANDIDATE-193 — `!external` guard pattern — Collector-pushed tag relations are IMMUTABLE to UI users; UI mutations exclude EXTERNAL rows from delete-set AND hardcode `external=false` on new rows; the Collector owns the EXTERNAL bit and the UI cannot impersonate

**Severity**: HIGH
**Classification**: promote
**Support count**: 3 sidecars (TagController + TagServiceImpl + ReactiveTagRepositoryImpl — three cross-tier confirmations of the same per-method guard pattern)
**Axes present**: controllers, services, repositories, OpenAPI spec

**Surfaced by**:
- `TagServiceImpl.md:implicit_adrs[EXTERNAL relations are immutable to UI users]` (HIGH confidence) — "both `update` and `delete` reject tags with `external = true` aggregate; `updateRelationsWithDataEntity` reads only `!external` relations for the diff; new relations are hardcoded `external = false` (:109). The Collector owns the EXTERNAL bit and the UI cannot impersonate." — intent_anchor: "Three independent guards aligned across three methods = intentional pattern, not coincidence."
- `TagController.md:implicit_adrs[!external guard pattern]` (HIGH) — "exception messages frame the constraint explicitly: 'Can't update tag which has external relations' / 'Can't delete tag which has external relations' — the maintainer-authored exception text IS the architectural statement"
- `TagController.md:invariants[9]` ("The `!external` guard pattern — `TagServiceImpl.update` and `TagServiceImpl.delete` both reject tags with `external = true` usages (lines 49-50 + 62-63) via `BadUserRequestException`.")
- `ReactiveTagRepositoryImpl.md:concepts.entities[TagDto, TagToDataEntityPojo]` — the `external` boolean column on `tag_to_data_entity` (V0_0_47__add_tag_external_attribute.sql:1) AND the `TagOrigin` enum on `tag_to_dataset_field` are the schema-side primitives
- `ReactiveTagRepositoryImpl.md:concepts.invariants` (per the original sidecar, the external bit is part of the TagDto aggregate via `boolOr(tag_to_data_entity.external)`)
- The 3 sidecars together produce the cross-tier evidence; the maintainer-authored exception messages at TagServiceImpl.java:49-50 + 62-63 are the strongest single intent anchor in the batch.

**Decision statement**: The platform's `tag_to_data_entity` row carries a `external` boolean flag distinguishing Collector-pushed relations from UI-set relations (per migration V0_0_47). Symmetrically, `tag_to_dataset_field` carries a `TagOrigin` enum (`INTERNAL | EXTERNAL | EXTERNAL_STATISTICS`). The platform enforces an INVARIANT: the EXTERNAL bit is OWNED by the Collector and IMMUTABLE to UI users. This is implemented across three independent code paths:

1. **`TagServiceImpl.update`** (`:44-55`): after fetching the tag's `TagDto` (which carries `Boolean external` aggregated as `boolOr(tag_to_data_entity.external)` per `:55`), filters `!tagDto.external()`; if external = true, throws `BadUserRequestException("Can't update tag which has external relations")`. A UI user cannot rename or change the Important flag of a Collector-tagged tag.

2. **`TagServiceImpl.delete`** (`:57-70`): symmetric — filters `!tagDto.external()`; if external = true, throws `BadUserRequestException("Can't delete tag which has external relations")`. A UI user cannot remove a Collector-tagged tag from the directory.

3. **`TagServiceImpl.updateRelationsWithDataEntity`** (`:96-121`): reads `listTagRelations(List.of(dataEntityId))` (line 101) and filters to `!pojo.getExternal()` (line 102) BEFORE computing the diff. Then hardcodes `external = false` on all NEW relations (line 109: `.setExternal(false)`). Two-layer immutability: the UI can neither READ external relations as "to be deleted" nor WRITE external relations as new.

The collective effect: a tag attached to a data entity by a Collector (`external = true`) is invisible to UI delete-diff and not deletable from the directory. The Collector retains exclusive write authority on its own rows.

**Wisdom test**: PASS. All three questions resolve toward ADR:

1. *Intentional?* YES. The maintainer-authored exception messages ("Can't update tag which has external relations" / "Can't delete tag which has external relations") name the contract in user-visible language. Three independent guards aligned across three methods is the intent anchor — coincidence requires three independent line-edits to align, the maintainer aligned them by design.

2. *Structural impact?* YES. The pattern affects:
   - The `tag_to_data_entity` schema (the `external` column added in V0_0_47 specifically for this distinction)
   - The `tag_to_dataset_field` schema (the `TagOrigin` enum)
   - Every UI write-path that touches tags (update, delete, per-entity relations)
   - The Collector's exclusive write authority on its push (the ingestion pipeline can OVERWRITE its own previous push state without UI interference)
   - The `TagDto`'s shape (it carries the aggregated `external` flag)

3. *Refactoring or structural?* STRUCTURAL. Removing the `!external` guard would be a permission-bypass regression (UI users could delete Collector-set tag rows; future Collector pushes would re-create them, creating a UI-Collector tug-of-war). Adding a guard to a new tag relation table is a STRUCTURAL choice (does this new table also have a Collector-vs-UI provenance distinction?).

→ ADR-CANDIDATE.

**Evidence**:
- `TagServiceImpl.java:49-50` — `update` guard: `.filter(tagDto -> !tagDto.external()).switchIfEmpty(Mono.error(new BadUserRequestException("Can't update tag which has external relations")))`
- `TagServiceImpl.java:62-63` — `delete` guard: same shape, different message
- `TagServiceImpl.java:102` — `updateRelationsWithDataEntity` diff filter: `currentRelations.stream().filter(r -> !r.getExternal())`
- `TagServiceImpl.java:109` — hardcoded new-relation external flag: `.setExternal(false)`
- `V0_0_47__add_tag_external_attribute.sql:1` — the migration that introduced the `external` column on `tag_to_data_entity`
- `TagOrigin.java:4-6` — the three-value enum (INTERNAL / EXTERNAL / EXTERNAL_STATISTICS) for `tag_to_dataset_field`'s parallel pattern
- `ReactiveTagRepositoryImpl.java:373-391` — the UNION-ALL CTE that aggregates the `external` boolean from data-entity side AND the `TagOrigin.ne(INTERNAL)` from dataset-field side into a single `external` aggregate in `TagDto`

**Existing ADR**: none directly. Composes with:
- **ADR-CANDIDATE-027** (ingestion trust gradient — `auth.ingestion.filter.enabled` toggle) — that ADR codifies the Collector's trust boundary at the HTTP perimeter; this ADR codifies the Collector's data-ownership semantics POST-perimeter.
- **ADR-CANDIDATE-065** (Tag auto-create-on-miss is spec-acknowledged) — the auto-create UX (`getOrCreateTagsByName`) is the WRITE side; this ADR is the IMMUTABILITY side for what the auto-create produces.
- **ADR-CANDIDATE-072** (Establisher-keyed lineage edge provenance) — the analogous "Collector owns its rows" pattern at the lineage layer. Both are "the Collector pushes; the UI doesn't mutate."

**Co-surfaced gaps** (link from `refactoring-scopes.md`):
- REFACTOR-548 (delete cascade asymmetry — `tag_to_dataset_field` orphans on delete) — the `!external` guard reads `tagDto.external()` which aggregates ONLY the `tag_to_data_entity` side; a tag with INTERNAL data-entity relations + EXTERNAL dataset-field relations would NOT be blocked from delete. This is the EDGE CASE the guard doesn't cover.

**Proposed action**: Promote to `adrs/drafts/external-bit-collector-owned.md` (new ADR). Document:
- The `external` boolean on `tag_to_data_entity` + the `TagOrigin` enum on `tag_to_dataset_field` as the two schema-side primitives encoding Collector provenance.
- The three guards (update, delete, updateRelationsWithDataEntity) as the application-side enforcement.
- The hardcoded `external = false` on new UI-set relations as the "UI cannot impersonate Collector" defence.
- The exception messages as the contract-in-user-language ("Can't update/delete tag which has external relations").
- The edge case: TagDto's aggregated `external` reads only the data-entity side, NOT the dataset-field origin. Cross-link with REFACTOR-548.

**Severity rationale**: HIGH — load-bearing semantic for the Collector-vs-UI write-authority boundary. Three independent guards aligned across three methods (a 3-sidecar intent anchor); affects every write-path that touches tags; structural choice not refactoring. The maintainer's choice would be invisible to a future maintainer reading any ONE of the three methods in isolation; reading the THREE together reveals the pattern. This is the kind of architectural decision an ADR exists to preserve.

---
