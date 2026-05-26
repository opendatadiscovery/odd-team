# SHB-126 — Stats ingestion is a side-channel into the global tag taxonomy — bypasses `TAG_CREATE` RBAC

**Category**: open
**Severity**: MEDIUM

## Hypothesis

Operators believe the Tags management UI is the platform's controlled vocabulary surface, gated by `TAG_CREATE` permission (Management → Tags tab requires the policy rule). In reality, `POST /ingestion/entities/datasets/stats` accepts a `DataSetFieldStat.tags = [{name: 'whatever'}]` array, and the service path calls `tagService.getOrCreateTagsByName(...)` — CREATING any tag name in the payload that doesn't already exist, stamping it `TagOrigin.EXTERNAL_STATISTICS`, and persisting it to the global tag namespace. Combined with the unauthenticated posture (no filter on this endpoint, in WHITELIST_PATHS), this is a side-channel into the tag taxonomy that any HTTP caller can use. The created tags become discoverable to all authenticated users via tag search, tag-filter facets (F-017), Catalog Overview Top-tags chip strip (F-018), and Term-to-Tag relationship rendering.

## Evidence

- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/service/DatasetFieldServiceImpl.java:191-231` — `updateFieldsTags` extracts tag names from `stat.getTags()` across all fields, calls `tagService.getOrCreateTagsByName(...)` (line 202), then writes EXTERNAL_STATISTICS-origin tag relations via `reactiveTagRepository.deleteDatasetFieldRelations + createDatasetFieldRelations`.
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/dto/TagOrigin.java:6` — the enum's `EXTERNAL_STATISTICS` value distinguishes stats-delivered tags from `INTERNAL` (UI-curated) and from other external origins.
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/service/DatasetFieldServiceImpl.java:273-278` — `createExternalStatisticsRelation` sets `origin = TagOrigin.EXTERNAL_STATISTICS.toString()`. The reconciliation at line 218 (`reactiveTagRepository.listTagsRelations(datasetFieldIds, TagOrigin.EXTERNAL_STATISTICS)`) operates ONLY on this origin — UI-curated INTERNAL tags survive. This is intentional and protective for the OPERATOR; the side-channel question is on the OPPOSITE direction (anonymous WRITE).
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/utils/SecurityConstants.java:138` — `PolicyPermissionDto.TAG_CREATE` is the documented RBAC permission for creating tags. The Management Tags tab's create operation IS gated by this; the stats path is NOT.
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/controller/ingestion/IngestionController.java:81-87` + `auth/filter/IngestionDataEntitiesFilter.java:28` + `utils/SecurityConstants.java:95-96` — the endpoint is unauthenticated in every supported mode.

## Notes

- Operator-observable downstream effects:
  - **Search results polluted by attacker-controlled tag names** — `EXTERNAL_STATISTICS`-origin tags surface in the global tag search and the per-entity tag chips identically to UI-curated tags. There is no UI badge distinguishing origin (the badge surface would have to be added).
  - **Catalog Overview Top-tags strip** ranked by `usedCount` (per F-018) — attacker-controlled tags compete for the operator's attention.
  - **Tag-filter facet on search** (F-017) — attacker can mint tags whose names look like internal team names (`team-payments`, `pii-cleared`) and the facet lists them as filter options.
  - **Term-to-Tag relationships** — if a Term-to-Tag link exists, the polluted tag taxonomy bleeds into the Glossary surface too.
- The side-channel doesn't grant the attacker the ability to *delete* or *update* existing tags — they can only *create* new ones AND *attach* them to dataset fields whose ODDRN they know. But created tags persist; once minted, they appear in the catalog vocabulary indefinitely (until the operator manually deletes them in the Tags management UI, which requires `TAG_DELETE` permission).
- The cleanup story is asymmetric: attacker creates anonymously; operator must authenticate + have `TAG_DELETE` to remove. A bulk "remove all EXTERNAL_STATISTICS-origin tags from field X" surgery is not exposed at the UI.
- This is an ENRICHER for F-018 (Manual Object Tagging) — the existing F-018 anchors on the UI surface; this thread surfaces the SECOND minting path that bypasses RBAC entirely. F-018's drift facet `tag_mint_side_channel` would be the new addition.
- Probe shape: emit `POST /ingestion/entities/datasets/stats {datasetOddrn:"//literal:any", fields:{"//literal:any/field/foo":{tags:[{name:"//attacker"}]}}}` with no auth → observe new TAG row in `tag` table with `EXTERNAL_STATISTICS` origin and the polluted name.
- The DELETE-on-absence reconciliation at line 221-223 is itself worth a separate observation: replaying a stats payload with FEWER tags causes the absent EXTERNAL_STATISTICS-origin tags to be removed from the field. This is the F-008 `silent_destruction_replace_not_merge` class applied to the stats-tag plane. Combined with the unauthenticated-mint capability, an attacker can both populate AND silently destroy stats-origin tag relations on any dataset field.
- This is `open`, not `clustering`, because: (a) the mechanism is verified, (b) the operator-observable symptom on the UI surface (Tags tab displays the polluted vocab) is plausible but not yet probe-confirmed, (c) the F-018 enrichment shape is clear but the maintainer should confirm whether to fold this into F-018 or carve a separate `F-NNN — Tag Vocabulary Integrity` feature.

## Next

1. Promote to ENRICHER of F-018 OR carve a new `F-NNN — Tag Vocabulary Mint Surfaces` covering both the UI path and the stats side-channel. Feature-flow-builder triage.
2. Probe-NNN: fire the anonymous mint payload against a local docker-compose mirror; observe the `tag` table for the polluted row + the `tag_to_dataset_field` relation; confirm the polluted tag appears in the Top-tags chip strip and the tag-search facet.
3. SEC-NNN: gate `tagService.getOrCreateTagsByName` invocations from the stats path either by (a) requiring an existing tag name match (reject creation if no matching tag exists), OR (b) requiring an authenticated caller with `TAG_CREATE` permission, OR (c) routing stats-origin tags into a quarantine table that doesn't surface in the global vocabulary until an operator approves them.
4. DOC-NNN: the live `features/data-quality` page should warn that EXTERNAL_STATISTICS-origin tags are created by stats-push integrations without RBAC.

## Links

- cluster_with: [F-018, F-008, F-017]
- merged_into: (open — likely enriches F-018)
- supersedes: []
