# SHB-017 — Description-edit emits dual activity events + `[[ns:term]]` auto-linking + DELETE-term cannot remove description-linked terms

**Category**: open
**Severity**: MEDIUM

## Hypothesis

Operators see a "term auto-linking from description text" behaviour because every per-entity description edit AND every per-column description edit runs the description body through a regex `\[\[([^:]*?):([^\]]*?)\]\]` (`TermServiceImpl.java:67` / line 344-348) to extract `[[namespace:term]]` mentions and create/remove `data_entity_to_term` (or `dataset_field_to_term`) rows with `is_description_link = true`. Every such mention auto-links a glossary term to the entity without an explicit user action AND emits a SECOND `*_TERM_ASSIGNMENT_UPDATED` activity event alongside the `DESCRIPTION_UPDATED` event — operators see TWO activity-feed rows per description edit. Worse, the per-entity / per-column `DELETE /terms/{id}` endpoint filters DELETE on `IS_DESCRIPTION_LINK.isFalse()` (TermRelationsRepositoryImpl.java:179) — terms linked via description CANNOT be removed via the term-management surface. F-004 (Description Editing) covers the markdown verbatim-storage; F-002 (Term-to-Entity Linkage) covers term-link permission gates; this thread anchors the **auto-linking parser surface + dual-event behaviour + cascade asymmetry** between description and term-link channels.

## Evidence

- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/service/term/TermServiceImpl.java:67` — `private static final Pattern TERM_PATTERN = Pattern.compile("\\[\\[([^:]*?):([^\\]]*?)\\]\\]");` (the regex).
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/service/term/TermServiceImpl.java:198-207` — `handleDataEntityDescriptionTerms` is `@ReactiveTransactional` + `@ActivityLog(TERM_ASSIGNMENT_UPDATED)`. Called from `DataEntityServiceImpl.upsertDescription` (line 329-332).
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/service/term/TermServiceImpl.java:243` — `handleDatasetFieldDescriptionTerms` emits `DATASET_FIELD_TERM_ASSIGNMENT_UPDATED`. Called from `DatasetFieldServiceImpl.updateDescription` chain.
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/repository/reactive/TermRelationsRepositoryImpl.java:179` — DELETE filter for `deleteRelationWithDatasetField`: `.and(DATASET_FIELD_TO_TERM.IS_DESCRIPTION_LINK.isFalse())`. Same pattern at `TermRelationsRepositoryImpl.java:86-106` for `data_entity_to_term`.
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/service/internal/DataEntityInternalStateServiceImpl.java:28` — `@ActivityLog(DESCRIPTION_UPDATED)` on `updateDescription`. The FIRST event of the dual emission.
- Live doc: `https://docs.opendatadiscovery.org/features/active-platform-features/activity-feed#event-types` (verified 2026-05-20 status 200) lists both `DESCRIPTION_UPDATED` and `TERM_ASSIGNMENT_UPDATED` as separate event types — but does NOT explain that a single description edit emits BOTH.
- Cross-ref: `lineage/odd-platform/understanding/odd-platform__java__DataEntityController__controller-method__upsertDataEntityInternalDescription.md:bugs_limitations_corner_cases[7]` (term-linker pattern injection finding).
- Cross-ref: `lineage/odd-platform/understanding/odd-platform__java__DatasetFieldController__controller-class__DatasetFieldController.md:bugs_limitations_corner_cases[3]` (dual-event finding).

## Notes

- **Operator-visible scenarios**:
  - User edits description from "raw data" to "raw data via [[finance:cost_centre]]" — saves. Activity feed shows TWO rows at the same timestamp: `DESCRIPTION_UPDATED` (the edit) and `TERM_ASSIGNMENT_UPDATED` (the auto-link). The operator may infer two distinct user actions.
  - User has linked term `[[finance:cost_centre]]` both via explicit POST `/terms` AND via description marker. They click DELETE on the linked-term row. The manual row is deleted (returns 204 No Content); the description-link row survives because of the `IS_DESCRIPTION_LINK.isFalse()` filter. The term REMAINS visible in the linked-terms tab. Operator: "I deleted it, why is it still there?"
  - User writes a description containing `[[a:b:c]]` (extra colon) — the regex's group 2 matches `b:c`, term-lookup with that name silently fails. BUT if a term `b:c` was previously created by another code path (unusual but possible), the marker silently links it.
  - User writes description containing 1000+ `[[ns:term]]` mentions — every save runs the regex over the whole body, creates/removes hundreds of relation rows, emits one large activity event with full before/after term state. No bound on description length, no cap on mention count.
- **Why "open" not "clustering"**: 2-3 evidence axes (regex, dual-event, cascade asymmetry); the maintainer call is whether this is a graduation-ready feature or facets of F-002 / F-004. Recommendation: facets of F-002 (Term-to-Entity Linkage). The OPERATOR-FACING FEATURE is "auto-link terms from description text" — and F-002 anchors the explicit-link surface, not the auto-link one.
- **The DELETE-term operator confusion is the highest-leverage finding** because it violates the operator's mental model AND there's no visible signal. The endpoint description ("Delete term from current dataset field terms list" / "Delete term from current data entity terms list") doesn't warn. P-155 emits a probe for the dataset-field side.
- **Cross-cutting with F-004 description editing**: F-004 anchors the markdown body and the XSS-class verbatim-storage. The TERM-AUTO-LINKING is a SEPARATE side-effect of the same write — F-004 doesn't enumerate it as a separate concept.
- **Cross-cutting with F-002 Term-to-Entity Linkage**: F-002 anchors the permission gate on explicit term-add. The description-link channel BYPASSES the per-link permission — anyone with `DATA_ENTITY_DESCRIPTION_UPDATE` can effectively `ADD_TERM` to an entity by writing `[[ns:term]]` in the description.

## Next

1. **Cluster** with F-002 and F-004 — the maintainer-call is whether to graduate or fold into one of those flows. Recommend folding the dual-event behaviour into F-004 (it's a description-edit side-effect) and the DELETE-term cascade asymmetry into F-002 (it's a term-management contract).
2. **REFACTOR-NNN — MEDIUM** — the `IS_DESCRIPTION_LINK.isFalse()` DELETE filter SHOULD EITHER (a) be removed (DELETE removes all rows + UI warns operator that the description still contains the marker), OR (b) the DELETE endpoint returns 409 Conflict when there's a description-link row, with a body explaining "this term is also referenced in the description; edit the description to remove the marker."
3. **REFACTOR-NNN — LOW** — emit a single composite activity event `DESCRIPTION_AND_TERMS_UPDATED` for the description-edit case, rather than two separate events at the same timestamp. Cleaner audit-trail UX.
4. **SEC-NNN — MEDIUM** — the description-link channel bypasses per-term `DATA_ENTITY_ADD_TERM` permission. Operators authoring policies that restrict term-add should know they cannot reliably enforce term-link gates while the description channel exists. EITHER document this explicitly OR add the `ADD_TERM` permission check inside `handleDataEntityDescriptionTerms`.
5. **DOC-NNN** — the activity-feed page should clarify that DESCRIPTION_UPDATED + TERM_ASSIGNMENT_UPDATED at the same timestamp represent one user action, not two.
6. **TEST-NNN — MEDIUM** — no test exercises the description-link DELETE survival behaviour (P-155 emits the probe for dataset-field side).

## Links

- cluster_with: [F-002, F-004]
- merged_into: (open)
- supersedes: []
