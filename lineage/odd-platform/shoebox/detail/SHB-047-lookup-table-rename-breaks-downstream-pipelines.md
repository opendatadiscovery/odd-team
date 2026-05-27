# SHB-047 — Renaming a lookup table renames the underlying Postgres table, silently breaking every downstream pipeline that joined against the old name

**Category**: merged
**Severity**: HIGH

## Hypothesis

Operators editing a lookup table's name through the UI (the Edit Name dialog mounted from `LookupTablesListItem`) trigger `PUT /api/referencedata/table/{lookup_table_id}` which, beyond updating the catalog metadata, executes `ALTER TABLE lookup_tables_schema.n_{nsId}__{old_underscored_name} RENAME TO lookup_tables_schema.n_{nsId}__{new_underscored_name}`. Downstream BI dashboards, dbt models, Looker views, Tableau workbooks, Python notebooks, and Airflow DAGs that joined against the physical table name (the documented public surface — per `docs.opendatadiscovery.org/features/master-data-management/lookup-tables`: "Lookup tables are directly queryable via the `lookup_tables_schema` PostgreSQL schema") receive `relation "lookup_tables_schema.n_5__customer_lookups" does not exist` on their next run. There is no deprecation alias, no rename view, no notification, no audit emission, no UI warning at rename-time. An operator renaming "Customer Lookups" to "Customer Lookup Codes" to clarify the concept can break the company's revenue dashboard with no signal.

## Evidence

- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/service/ReferenceDataServiceImpl.java:107-124` — `updateLookupTable` rebuilds the physical table name by re-running `buildTableName(formData.getName(), table.namespacePojo())` — the rename is a side-effect of the metadata edit.
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/repository/ReferenceDataRepositoryImpl.java:181-202` — the DDL chain executing `ALTER TABLE ... RENAME TO ...` against `lookup_tables_schema`.
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/service/ReferenceDataServiceImpl.java:191-194` — `buildTableName`: `name.toLowerCase().replace(" ", "_")`. So "Customer Lookups" → `customer_lookups`; "Customer Lookup Codes" → `customer_lookup_codes`. Any name change that mutates the lowercased-underscored form mutates the table name.
- `documentation/docs/features/master-data-management/lookup-tables` (per ReferenceDataController sidecar `implicit_adrs[3]`): "Lookup tables are directly queryable via the `lookup_tables_schema` PostgreSQL schema" — the doc explicitly TELLS operators to join against the physical name. Doc-promise + code-behaviour = operator footgun.
- `lineage/odd-platform/understanding/odd-platform__java__ReferenceDataController__controller-class__ReferenceDataController.md:bugs_limitations_corner_cases[7]` — sister-sidecar already records this finding at MEDIUM severity; this SHB promotes the impact estimate to HIGH because the doc-promised public-schema surface compounds the blast radius.
- `odd-platform-ui/src/components/MasterData/LookupTables/LookupTableForm.tsx:84-93` (per the LookupTables sidecar) — the form has ONE name field; the user has no UI surface to opt out of the physical rename, no UI surface to set an alias.

## Notes

- The doc-tells-operators-to-join is the load-bearing fact. Without that, this would be a generic refactor-safety gap (severity LOW-MEDIUM). With it, the platform is documenting a public SQL surface AND providing a UI action that silently breaks the surface. That asymmetry is what makes this HIGH.
- The mitigation universe (largest to smallest blast-reduction):
  - **(a)** UI-side rename-time WARNING dialog: "Renaming this lookup table will rename the underlying Postgres table `lookup_tables_schema.n_5__customer_lookups` → `..._codes`. Downstream queries against the old name will fail. Do you want to (1) cancel, (2) rename with an alias view preserving the old name, (3) rename without an alias?"
  - **(b)** Backend-side: create a `CREATE VIEW lookup_tables_schema.n_5__customer_lookups AS SELECT * FROM lookup_tables_schema.n_5__customer_lookup_codes` as a deprecation alias, with a configurable TTL after which the view drops. Operator-managed via a new endpoint.
  - **(c)** Decouple business-name from physical-name entirely: the physical table is `lookup_tables_schema.n_5__lt_{lookupTableId}` (numeric, immutable), the business-name is metadata only. Breaking change vs. the documented public surface — but architecturally the cleanest. Would need a documented migration path for existing tables.
  - **(d)** Just an audit emission + activity-feed entry. Doesn't prevent the break; helps post-mortem.
  - **(e)** Doc-only: rename is not silent — it just isn't named in the docs as the side-effect. Worst option but lowest-cost.
- This is the LSN-001-class default-footgun pattern at the operator-action layer (vs the deployment-config layer). The shape: operator takes a CORRECT-LOOKING action; the action does something correct AND a hidden side-effect that breaks something they care about.
- F-026 (Lookup Tables) records the partial-RBAC + cross-table-jump + XSS as the headline drift. The rename-cascade is conceptually separate — a lifecycle / data-contract gap, not a security gap. Treat as cluster-with-F-026 but distinct.
- **Cross-reference**: Schema renaming as a data-contract concern is a well-known issue class (dbt's `{{ source() }}` indirection exists precisely for this); the platform's silent rename is anti-pattern.

## Next

1. **Probe**: rename a seeded lookup table; query the physical Postgres schema before and after; observe the table name change; observe the audit log (or absence thereof); observe whether any UI warns.
2. **Decide impact**: which mitigation? Likely (a) UI warning + (d) audit emission as the cheap short-term fix; (b) alias-view as the medium-term fix; (c) deferred to a major-version migration. PRD-shape decision the maintainer makes.
3. **Promote**: this is its own F-NNN candidate — "Lookup Table Lifecycle — rename + delete + alias semantics." Cluster with F-026 (creation / RBAC) and F-028 (Namespace lifecycle, the parent).
4. **DOC-GAP**: `docs.opendatadiscovery.org/features/master-data-management/lookup-tables` MUST document the rename-side-effect today as a caveat admonition — operator-protecting documentation is cheap and prevents the next data outage. File DOC-NNN.
5. **TEST-GAP**: no test asserts that renaming a lookup table renames the physical Postgres table (the contract is implicit). Add it as TEST-GAP-NNN — pinning the surface IS the gate against future "let's decouple the names" refactors landing without a deprecation.

## Links

- cluster_with: [F-026, F-028]
- merged_into: F-059
- supersedes: []

## evaluation

- **feature-flow-builder 2026-05-26**: graduated — doc-promised public SQL surface (lookup_tables_schema) is silently broken by UI rename action; the operator-visible action ("edit metadata") has a hidden side-effect (ALTER TABLE DDL) that breaks downstream pipelines with no signal. F-026 (RBAC + cross-table jump + XSS) and F-058 (listing UX) own different surfaces of P-03; SHB-047 is the LIFECYCLE / DATA-CONTRACT gap. 6 evidence refs spanning UI form, controller, service, repository DDL, docs-promised public surface, sister sidecar bugs[7]. Minted F-059 at lineage/odd-platform/feature-flows/detail/F-059.yaml (P-03:F-003 Lookup Table Rename Cascade). Three drift facets: rename_cascade_breaks_documented_public_surface_silently (HIGH), lsn_001_class_default_footgun_at_operator_action_layer (HIGH), no_audit_emission_on_lookup_table_rename (MEDIUM — cross-references F-057's DQ-severity audit-silence pattern). LSN-001-class characterisation explicit.
