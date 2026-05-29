---
doc_page: "docs/master-data-management/lookup-tables.md"
page_title: "Lookup Tables"
live_url: "https://docs.opendatadiscovery.org/features/master-data-management/lookup-tables"
live_url_verified_status: "200"
live_url_resolved_slug: "features/master-data-management/lookup-tables"
live_verified_at: "2026-05-29"
analysed_at_commit: "30795b4"
prompt_version: "doc-analyser/0.1.0"
confidence_overall: HIGH
describes:
  concepts:
    - "Lookup Table (Master Data Management — P-03 anchor; was-empty pillar now anchored at the controller layer)"
    - "Reference Data / Lookup Table CRUD + Faceted Search (the 14-endpoint surface owned by ReferenceDataController — P-03 anchor)"
    - "Lookup-table rename via ALTER TABLE RENAME silently breaks downstream SQL consumers (no deprecation alias, no view)"
    - "Lookup Tables InfiniteScroll scrollableTarget mismatch — references 'directory-entities-list' but container id is 'lookup-tables-list' (pagination broken; UI capped at 30 rows)"
    - "Lookup Tables H1 counter leaks platform-wide population size to every authenticated user (no owner / namespace / permission filter)"
  features:
    - "F-026"   # Lookup Tables (Reference Data Management) — the canonical feature
    - "F-058"   # Lookup Tables list page — 30-row truncation (matches the list-truncation caveat)
    - "F-059"   # Lookup table rename — silent ALTER TABLE downstream break (matches the rename caveat)
  code_nodes:
    - "odd-platform java ReferenceDataController controller-method:createReferenceTable"
    - "odd-platform java ReferenceDataController controller-method:updateLookupTable"
    - "odd-platform java ReferenceDataController controller-method:deleteLookupTable"
    - "odd-platform java ReferenceDataController controller-method:createColumnsForLookupTable"
    - "odd-platform java ReferenceDataController controller-method:updateLookupTableField"
    - "odd-platform java ReferenceDataController controller-method:deleteLookupTableField"
    - "odd-platform java ReferenceDataController controller-method:getReferenceDataSearchResults"
audience: [operator, developer, data-consumer]
doc_claim_vs_code:
  - "RBAC section frames the surface as 'gated by 9 permissions on three surfaces' and lists only CREATE/UPDATE/DELETE on table/definition/data — there is NO LOOKUP_TABLE_*_READ permission, and READ is ungated end-to-end (6 of 14 endpoints carry no SecurityRule; only the global auth filter gates them). An operator reading the RBAC table would assume read is permission-gated; it is not. Evidence: F-026 (read_endpoints_no_security_rule_six_of_fourteen) + invariant:lookup-tables-global-counter-leaks-population-size (READ ungated end-to-end). The page never states reads are visible to every authenticated user (and to anonymous callers under auth.type=DISABLED)."
  - "Page is silent on a cross-table column-jump auth bypass. updateLookupTableField discards the {lookup_table_id} path param: the controller calls referenceDataService.updateLookupTableField(columnId, item) passing ONLY columnId — evidence: odd-platform java ReferenceDataController controller-method:updateLookupTableField / ReferenceDataController.java:131,139 + ReferenceDataServiceImpl.java:127 (signature updateLookupTableField(Long columnId, ...), no table-scope check). Combined with the global LOOKUP_TABLE_DEFINITION_UPDATE permission the page DOES document, a user can PATCH a column belonging to a different table by spoofing the URL. The page documents the global-permission caveat but omits this column-level escalation."
  - "Supported field types lists 9 types as if 9 distinct PostgreSQL types; code defines 9 LookupTableFieldType enum constants but only 8 DISTINCT SQL types — SERIAL and INTEGER both map to the integer SQL type. Minor: the page's SERIAL row already notes it is an auto-incrementing integer, so the operator is not misled on behaviour. Evidence: F-026 (nine_field_types_vs_eight_distinct_sql_types_doc_drift_minor)."
maintainer_curated: false
---

# Lookup Tables — doc understanding

This page is the canonical operator/developer/data-consumer guide for the Master
Data Management pillar's single user-facing surface: operator-curated reference
tables managed inside ODD Platform and backed by REAL PostgreSQL tables in
`lookup_tables_schema` (named `n_{namespaceId}__{lowercased_underscored_name}`).
It maps directly to feature `F-026` and the `ReferenceDataController` 14-endpoint
class surface (Table / Column / Row CRUD + faceted search under
`/api/referencedata/`), confirmed via the concepts
`entitie:master-data-management-lookup-table-pillar-p-03-anchored` and
`operation:reference-data-lookup-table-crud`.

The page is unusually well-aligned with the code: all six "Known operator
caveats" are code-backed and confirmed at primary source — the entity-type id
(`DataEntityTypeDto.java:36` → `LOOKUP_TABLE(24)`), the verbatim/no-escape value
storage (`LookupCharValidator.getValue()` returns its input unchanged), the
`ALTER TABLE … RENAME TO` rename-break (`ReferenceDataServiceImpl.java:107-124`,
`:191-194`; `ReferenceDataRepositoryImpl.java:181-202`; invariant
`lookup-table-rename-via-alter-table-breaks-downstream-sql-consumers`, feature
`F-059`), the 30-row list truncation (`LookupTablesList.tsx:51-53`
`scrollableTarget="directory-entities-list"` vs container id `lookup-tables-list`;
invariant `lookup-tables-infinite-scroll-scrollable-target-mismatch`, feature
`F-058`), and the rename audit-silence.

The residual drift (see `doc_claim_vs_code`) is two omissions in the RBAC story:
the page presents the 9 `LOOKUP_TABLE_*` permissions as the access-control model
without stating that READ is entirely ungated (the H1 "X lookup tables overall"
counter, which the truncation caveat itself relies on as the operator-visible
signal, leaks the platform-wide table count to every authenticated — and, under
`auth.type=DISABLED`, anonymous — caller), and the page is silent on the
`updateLookupTableField` cross-table column-jump (the `{lookup_table_id}` path
param is discarded, so the global `LOOKUP_TABLE_DEFINITION_UPDATE` permission lets
a caller PATCH a column on any table by URL-spoofing). LSN-006 context: this page
was previously the dumping ground for ~1300 words of API-reference content that
now lives at its canonical home `developer-guides/api-reference/reference-data.md`
(F-026 / the operation concept describe that 16-endpoint surface); the page now
correctly links out to it rather than duplicating it.

## Maintainer notes
<!-- preserved across re-analysis; the only block a human hand-edits -->
