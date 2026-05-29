---
doc_page: "docs/data-discovery/custom-metadata.md"
page_title: "Custom metadata"
live_url: "https://docs.opendatadiscovery.org/features/data-discovery/custom-metadata"
live_url_verified_status: "200"
live_url_resolved_slug: "features/data-discovery/custom-metadata"
live_verified_at: "2026-05-29"
analysed_at_commit: "30795b4"
prompt_version: "doc-analyser/0.1.0"
confidence_overall: HIGH
describes:
  concepts:
    - "Custom Metadata Field + Value"
    - "MetadataField catalogue listing is theatre-paginated — PageInfo block lies (total=size, hasNext=false), no LIMIT/OFFSET/ORDER BY, unbounded return (batch ZF)"
    - "metadata_field asymmetric uniqueness by origin (INTERNAL name-only; EXTERNAL (type,name))"
    - "metadata_field soft-delete + partial-unique-index mismatch (REFACTOR-223-class)"
    - "Upsert Data Entity Metadata Field Value (UPDATE-only despite the name)"
  features:
    - "F-013"
    - "F-046"
  code_nodes:
    - "odd-platform java DataEntityController controller-method:createDataEntityMetadataFieldValue"
    - "odd-platform java DataEntityController controller-method:upsertDataEntityMetadataFieldValue"
    - "odd-platform java DataEntityController controller-method:deleteDataEntityMetadataFieldValue"
    - "odd-platform java MetadataFieldController controller-method:getMetadataFieldList"
    - "odd-platform java org.opendatadiscovery.oddplatform.controller controller:MetadataFieldController"
audience: [operator, developer]
doc_claim_vs_code:
  - "Page lists SEVEN API field types (STRING/INTEGER/FLOAT/BOOLEAN/DATETIME/ARRAY/JSON); the code enum carries EIGHT — UNKNOWN is omitted from the page. Evidence: entitie:custom-metadata-field-value / MetadataTypeEnum.java:3-12 (INTEGER/FLOAT/BOOLEAN/DATETIME/ARRAY/JSON/STRING/UNKNOWN). Low severity (UNKNOWN is a defensive fallback, not operator-selectable), but the page's 'accepts seven types in the API' is literally inexact."
  - "Page's four named caveats omit the no-type-validation defect: the value is written verbatim into the text column regardless of declared type (a STRING '42' is accepted on an INTEGER field; 'not a number' is accepted on an INTEGER field). Evidence: F-013 finding (3) / entitie:custom-metadata-field-value defect 2. Page says 'the type drives the value-editor's input shape and the display formatter' — true for the UI editor, but silent that the API performs no server-side type enforcement, so SDK/direct-API writers can persist type-violating values. Low-medium severity completeness gap for the developer audience."
  - "Page's caveats omit that EXTERNAL-origin (collector-ingested) field values are writable via the per-entity PUT/POST — the upsert path does not check MetadataFieldPojo.getOrigin(), so an operator with _UPDATE can overwrite a collector-ingested value until the next ingestion pass replaces it. The page states EXTERNAL fields 'cannot be edited or added from the UI' (true for the UI affordance) but is silent that the API itself does not gate origin. Evidence: F-013 finding (4) / entitie:custom-metadata-field-value defect 3. Low-medium severity completeness gap for the developer/integrator audience."
maintainer_curated: false
---

# Custom metadata — doc understanding

This page documents the per-entity custom-metadata surface end-to-end: the two-table model (a deployment-global `metadata_field` catalogue keyed on name+type, and a per-`(data_entity_id, metadata_field_id)` `metadata_field_value` binding), the three permission-gated write endpoints, the INTERNAL/EXTERNAL origin split, case-sensitive field naming, and four operator caveats. It binds to the entity concept `Custom Metadata Field + Value` and to the two feature flows `F-013` (the per-row write path) and `F-046` (the catalogue read surface), all confirmed via graph-node.

The page is unusually well-aligned with the implementation — it was evidently authored from the same primary-source code-walk that produced `F-013` / `F-046`. Its four caveats map one-to-one to confirmed code facts: the silent UPDATE-not-UPSERT no-op (`ReactiveMetadataFieldValueRepositoryImpl.update` lines 95-104 issues a pure SQL UPDATE with no INSERT...ON CONFLICT — `F-013` finding 1); the `active`-column-to-NULL regression (`DataEntityServiceImpl.java:292-295` omits `setActive(...)`, the UPDATE writes NULL, DB `DEFAULT TRUE` fires on INSERT only — `F-013` finding 6); the unauthenticated + unbounded catalogue read with PageInfo theatre (`MetadataFieldController.getMetadataFieldList` → `ReactiveMetadataFieldRepositoryImpl.java:44-56` has no LIMIT/OFFSET/ORDER BY, `MetadataFieldMapperImpl.java:30-33` mocks `total=size`/`hasNext=false` — the `metadata-fields-pageinfo-theatre` invariant + `F-046`); and the dead `CUSTOM_METADATA_*` activity enum (`ActivityEventTypeDto.java:18`, no emitting code path — `F-013` finding 5). The three write endpoints (`POST`/`PUT`/`DELETE /api/dataentities/{id}/metadata[/{field_id}]`) and the catalogue read (`GET /api/metadata/fields`) are all confirmed CodeNodes with verbatim controller paths.

The `doc_claim_vs_code` entries are completeness gaps, not contradictions: the page lists seven of the eight enum types (UNKNOWN omitted), and its four named caveats do not include the no-type-validation defect or the API-side EXTERNAL-origin-writable defect that `F-013` documents — both relevant to the developer/integrator audience reading the page for SDK behaviour. None rise to a LSN-001/002-class data-loss-on-default trap; the page already carries the high-severity caveats prominently.

## Maintainer notes

- **Substrate-staleness observation (not page drift):** the `metadata-fields-pageinfo-theatre` invariant's "CONTRAST WITH THE LIVE DOCS" block (dated 2026-05-25) records `/features/data-discovery/custom-metadata` as "not in sitemap" and the active-platform-features index as not listing custom metadata — i.e. the feature was undocumented at that scan. As of this analysis (2026-05-29) the page resolves **200** with all nine section anchors present, so that documented doc-gap has since been closed. Both `F-046` (`feature_undocumented_no_live_doc_page`) and the invariant carry now-stale "no live doc page" assertions; a substrate refresh should retire them. This is the doc-lineage layer doing exactly its job — surfacing that code-side notes about doc absence are out of date because the page now exists in the graph.
