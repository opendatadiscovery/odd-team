## ADR-CANDIDATE-142 — Re-registration via `POST /ingestion/datasources` is UPSERT-by-ODDRN with PARTIAL-MERGE semantics — only `name` + `description` from the payload OVERWRITE existing values; `connection_url`, `active`, `type`, `namespace_id`, `collector_id`, soft-delete flag, all timestamps are PRESERVED

**Severity**: HIGH
**Classification**: promote (NEW ADR; positive-intent statement — protects operator state from collector overwrites)
**Pillars affected**: [P-10-integrations-ingestion, P-08-management-administration]
**Support count**: 1 sidecar primary-source (batch P createDataSourceEntity) + 1 service-tier test corroboration (DataSourceIngestionServiceTest.createDataSourcesTest 6-case parameterized) + cross-batch consistent with `prepareForUpdate` shape in batch A `IngestionService` sidecar
**Axes present**: services, controllers, repositories
**Batch**: P (2026-05-20)

**Surfaced by**:
- `IngestionController__controller-method__createDataSourceEntity.md:implicit_adrs.[2]` — "Re-registration is UPSERT by ODDRN with PARTIAL-MERGE semantics (name + description only)" — evidence: DataSourceIngestionServiceImpl.java:74-92 (`prepareForUpdate` returns `new DataSourcePojo(a).setName(i.getName()).setDescription(i.getDescription())` — copy-construct from existing then overwrite ONLY name + description) — intent_anchor: "the merge semantics are deliberately narrow. The mapper preserves `connection_url`, `active`, `type`, `namespace_id`, `collector_id`, `token_id`, `is_deleted`, all timestamps, AND any custom fields. This protects operator edits made in the UI (e.g. an operator manually setting `connection_url` after the collector's initial registration) from being overwritten on the collector's next startup."

**Decision statement**: When a Collector re-POSTs a `DataSourceList` containing a datasource by an ODDRN that ALREADY EXISTS in the platform, the platform-side merge is INTENTIONALLY PARTIAL:
- **OVERWRITTEN** (from payload): `name`, `description`.
- **PRESERVED** (from existing row): `connection_url`, `active` flag, `type`, `namespace_id`, `collector_id`, `token_id`, `is_deleted`, all `created_at` / `updated_at` / soft-delete timestamps, all custom fields.

This is a POSITIVE-INTENT design choice protecting operator state from collector overwrites:
- **Operator-mutable-via-UI fields stay UI-mutable** — an operator setting `connection_url` via `PUT /api/datasources/{id}` (UI path) does NOT get overwritten on the next collector startup. The collector's view of the datasource is "I know its name + description; the operator owns the rest."
- **The `collector_id` preservation is the cross-collector protection** — collector A originally registered the datasource; collector B re-POSTing with the same ODDRN cannot "steal" the datasource — the existing `collector_id` is preserved.
- **The trade-off** — a collector cannot self-update `connection_url`, `active`, `type` via this endpoint. If a source's hostname genuinely changed, the collector author has NO mechanism to propagate the change through `POST /ingestion/datasources`; the operator must edit the row via the UI `PUT /api/datasources/{id}` (requires UI auth). The asymmetry is silent — no doc warns; the response is `200 OK` regardless.

The architectural commitments:
- **(a) The Ingestion API is the COLLECTOR's identity-and-discovery boundary, NOT a property-update channel.** Collectors REGISTER themselves and their sources at startup; ongoing property updates flow through UI paths.
- **(b) The CREATE path and the UPDATE path use the SAME 2-field stamp.** The consistency between create and update is the maintainer's signal of intent.
- **(c) Adding a NEW field to `DataSourcePojo` REQUIRES a deliberate maintainer decision** about whether it's payload-driven or operator-only.

**Wisdom test**: PASS on all three questions.
1. **Intentional?** YES — the consistent application of the same 2-field stamp across BOTH create and update paths is the load-bearing signal. The maintainer chose the field list TWICE (once for create, once for update) and chose the SAME list.
2. **Structural impact?** YES — every collector's re-registration semantic; every operator's expectation of "what survives a collector restart"; every future field added to DataSourcePojo's payload-vs-operator triage.
3. **Refactoring or structural?** STRUCTURAL — moving to full-merge would require changing the mapper, updating doc-side caveats, and renegotiating the operator-collector boundary contract.

**Existing ADR**: NEW; complements ADR-CANDIDATE-140 (asymmetric ingestion postures) by providing the merge-semantic for the always-on datasource registration. Cross-link to ADR-CANDIDATE-014 (hand-rolled AlertManager — the OTHER ingestion controller, but with no merge semantic since AlertManager events are append-only).

**Proposed action**: Promote to `adrs/drafts/datasource-registration-partial-merge.md` (new ADR). Document the field list, the operator-collector boundary rationale, the silent-no-propagation caveat for `connection_url`/`type`/`active` changes, the cross-collector preservation of `collector_id`. Live-doc-side: surface the caveat on `developer-guides/build-and-run/custom-collectors` (which today says "Register data sources with the Platform via POST /ingestion/datasources once at startup" with NO mention of merge semantics — see REFACTOR-422 NEW).

**Co-surfaced gaps**: REFACTOR-422 NEW (re-registration only propagates 2 fields — silent for the other N; doc caveat absent), REFACTOR-423 NEW (no log records the silent preservation; an operator UI-editing connection_url has no signal that the collector will not propagate future changes).

**Severity rationale**: HIGH — positive-intent design choice that PROTECTS operator state, but the silent-caveat surface is the trade-off and the doc is silent. The ADR codifies the choice AND surfaces the gap.

---
