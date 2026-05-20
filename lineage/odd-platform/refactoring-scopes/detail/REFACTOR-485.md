## REFACTOR-485 — Lookup-table rename via `ALTER TABLE ... RENAME TO` breaks downstream SQL pipelines pinning `lookup_tables_schema.n_5__customer_lookups`

**Severity**: MEDIUM
**Category**: doc-code-drift + breaking-change + silent-data-pipeline-break
**Batch**: V (2026-05-20)
**Pillars affected**: [P-03-master-data-management, P-08-management-administration (operator UX), P-10-integrations-ingestion (downstream BI consumers)]

**Surfaced by**:
- `ReferenceDataController__controller-class__ReferenceDataController.md:bugs_limitations_corner_cases.[7]` (MEDIUM) — "`updateLookupTable` rebuilds `tableName` by re-running `buildTableName(formData.getName(), table.namespacePojo())` — if the operator renames the lookup table, the physical Postgres table gets renamed too (via `ALTER TABLE ... RENAME TO` in `ReferenceDataRepositoryImpl.java:191-201`). Downstream pipelines that hardcoded `lookup_tables_schema.n_5__customer_lookups` break silently on rename. No deprecation alias / view."
- `ReferenceDataController__controller-class__ReferenceDataController.md:performance.known_performance_gaps.[0]` (MEDIUM) — "DDL serialization risk: rename / delete take ACCESS EXCLUSIVE LOCK; concurrent read-heavy traffic on a popular reference table blocks during operator edits."

**Statement**: At `ReferenceDataServiceImpl.java:107-124` + `ReferenceDataRepositoryImpl.java:181-202`, the lookup-table rename path issues `ALTER TABLE lookup_tables_schema.n_{namespaceId}__{old_lowercased_name} RENAME TO n_{namespaceId}__{new_lowercased_name}`. The platform commits to the SQL-joinable contract (per ADR-CANDIDATE-166 NEW batch V) — downstream BI tools, ETL pipelines, ad-hoc operator queries, and any external system that JOINs against `lookup_tables_schema.n_5__customer_lookups` are pinned to the table-name template.

When an operator renames the lookup table via PUT /api/referencedata/table/{lookup_table_id} (gated by `LOOKUP_TABLE_UPDATE` permission, well within a typical steward's role grant), the physical Postgres table is renamed. Downstream consumers break silently:

- A nightly ETL SQL job that does `INSERT INTO fact_orders SELECT ... FROM lookup_tables_schema.n_5__customer_lookups JOIN ...` fails with `relation "lookup_tables_schema.n_5__customer_lookups" does not exist` on the next run.
- A BI dashboard's query referencing the old table-name returns a 500 error.
- An ad-hoc operator query in psql against the old name returns the same error.
- A future operator who has never seen the old name has no path to discover what the table was called before.

**No mitigation exists in the code**:

- NO deprecation alias view (`CREATE VIEW lookup_tables_schema.n_5__customer_lookups AS SELECT * FROM lookup_tables_schema.n_5__customer_lookups_renamed;`)
- NO history table tracking old-name → new-name mappings
- NO operator-facing audit log entry at the workflow tier (`@ActivityLog` is NOT emitted on lookup-table mutations per the ReferenceDataController sidecar `dependencies_semantic.requires-runtime` — same audit-asymmetry class as QueryExampleController per ADR-CANDIDATE-167 NEGATIVE half)
- NO doc-side warning that renames break downstream SQL (verified via WebFetch 2026-05-20 of `https://docs.opendatadiscovery.org/features/master-data-management/lookup-tables`)
- NO operator UI confirmation dialog ("Renaming this lookup table will rename the underlying Postgres table from `n_5__customer_lookups` to `n_5__customer_lookups_v2`; downstream SQL queries pinning the old name will break. Continue?")

**Combined with ADR-CANDIDATE-166's SQL-joinable contract**, this scope is a structural design-vs-feature-gap collision:

- ADR-CANDIDATE-166 promises operators a STABLE PUBLIC SQL surface (`lookup_tables_schema.n_{namespaceId}__{name}`).
- The rename feature BREAKS the stability of that surface.
- The contradiction is unresolved at the doc tier AND at the code tier.

**Evidence**:
- `ReferenceDataServiceImpl.java:107-124` — `updateLookupTable` rebuilds `tableName` from formData
- `ReferenceDataRepositoryImpl.java:181-202` — `ALTER TABLE ... RENAME TO` DDL
- `ReferenceDataServiceImpl.java:191-194` — `buildTableName` is the table-name template function (`name.toLowerCase().replace(" ", "_")`)
- absence of: deprecation view creation, history table writes, doc-side warning, UI confirmation dialog
- live doc `https://docs.opendatadiscovery.org/features/master-data-management/lookup-tables` (2026-05-20, status 200) — does NOT mention rename consequences

**Existing-ADR-or-implied-prescription**:
- ADR-CANDIDATE-166 (NEW batch V) codifies the SQL-joinable contract — this scope is the rename-consequence gap.
- No existing ADR addresses the rename consequence; the implicit prescription (per the ADR's stability promise) is "the table name SHOULD be stable across renames" — currently violated.

**Proposed remedy**:

1. **Path A — Create a deprecation view on rename**: at `ReferenceDataRepositoryImpl.updateLookupTable` (lines 181-202), AFTER `ALTER TABLE ... RENAME TO`, ADD `CREATE VIEW lookup_tables_schema.<old_name> AS SELECT * FROM lookup_tables_schema.<new_name>;`. The view persists until a future cleanup (e.g. via a housekeeping job that drops deprecation views older than `housekeeping.ttl.deprecation_view_days`). Operators get a transition window; downstream pipelines have time to update their SQL.

2. **Path B — Audit-log the rename via the QueryExample-pattern dedicated audit table** (per ADR-CANDIDATE-167's POSITIVE template): create a `lookup_table_activity` table with `RENAME_FROM` + `RENAME_TO` typed events. Operators monitoring the audit table can subscribe to renames and update their downstream SQL automatically.

3. **Path C — UI confirmation + doc-side warning**: ADD a confirmation dialog in the operator UI ("Renaming will break downstream SQL pinning the old name. Confirm rename?"); ADD a doc-side caveat at `https://docs.opendatadiscovery.org/features/master-data-management/lookup-tables` explicitly warning operators that renames break downstream SQL.

4. **Path D — Forbid rename entirely** (the most conservative): change `updateLookupTable` to ONLY allow editing the `description` field (analogous to ADR-CANDIDATE-142's UPSERT-by-ODDRN partial-merge pattern at the datasource tier). The table-name becomes immutable after creation. Operators wanting a new name must create a new lookup table + migrate data.

Path A is the cleanest middle ground; Path B is the architectural improvement; Path C is the necessary doc-side companion; Path D is the structural fix. Paths A + B + C can be combined.

**Severity rationale**: MEDIUM — operationally significant (silent breakage of downstream pipelines); reachable via a routine operator action (rename) without warning; cross-link with ADR-CANDIDATE-166's SQL-joinable contract that the rename violates; no audit trail downstream consumers can subscribe to; not security-critical so MEDIUM (not HIGH).

**Suggested backlog grouping**: `Lookup-tables hardening sprint` — covers REFACTOR-485 (this), REFACTOR-486 (auth-scope bypass on column edit), and any future lookup-table-tier scopes; cross-link with ADR-CANDIDATE-166 + ADR-CANDIDATE-168 promotion work.

---
