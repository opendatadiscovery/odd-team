## ADR-CANDIDATE-143 — Namespace is INHERITED FROM the Collector, NOT from the payload — the platform's collector-tenancy model (one Collector = one namespace)

**Severity**: MEDIUM
**Classification**: promote (NEW ADR; tenancy-architecture statement)
**Pillars affected**: [P-10-integrations-ingestion, P-08-management-administration]
**Support count**: 1 sidecar primary-source (batch P createDataSourceEntity) + cross-batch consistent with the Namespaces sub-feature of P-08 (system-mission.md)
**Axes present**: services, config_classes
**Batch**: P (2026-05-20)

**Surfaced by**:
- `IngestionController__controller-method__createDataSourceEntity.md:implicit_adrs.[3]` (HIGH confidence per sidecar) — "Namespace is inherited from Collector, NOT from payload — collector-scoped tenancy model" — evidence: DataSourceIngestionServiceImpl.java:99-111 (`mapDataSources` calls `dataSourceIngestionMapper.mapIngestionModel(ds, MappingUtils.extractFieldFromNullableObject(c.namespace(), NamespacePojo::getId), c.collectorPojo().getId())`) — the namespace_id parameter comes from the Collector's `namespace()`, NEVER from the DataSource payload — intent_anchor: "this is the platform's namespace-as-collector-tenant model: a Collector belongs to ONE namespace (configured at Collector creation in the UI), and every datasource the Collector registers inherits that namespace. … A collector's datasources are namespace-scoped consistently. The trade-off: a Collector cannot register datasources in MULTIPLE namespaces — one Collector = one namespace."

**Decision statement**: A datasource's namespace_id is ALWAYS the COLLECTOR's namespace_id, regardless of any namespace field in the inbound DataSource payload. The mapping at `DataSourceIngestionServiceImpl.java:106` passes `MappingUtils.extractFieldFromNullableObject(c.namespace(), NamespacePojo::getId)` as the namespace argument — `c.namespace()` is the Collector's namespace, NEVER the payload's `namespace_name`.

The architectural commitments:
- **(a) One Collector = one namespace.** A Collector entity is created in the UI bound to exactly one Namespace; that binding propagates to EVERY datasource the Collector registers.
- **(b) Multi-namespace datasources require multiple Collectors.** An operator wanting "team-A datasources" and "team-B datasources" from the same collector process must create TWO Collector entities (each with its own token + namespace).
- **(c) The payload's `namespace_name` field is SILENTLY IGNORED.** No log records the silent drop. No doc warns about it.
- **(d) Namespaces are the discovery scoping dimension** — per system-mission.md P-08 Namespaces sub-feature, namespaces act as cross-pillar filter dimensions. The collector-tenancy choice is the SOURCE-side implementation of that dimension.

**Wisdom test**: PASS on all three questions.
1. **Intentional?** YES — the mapping line at DataSourceIngestionServiceImpl.java:106 is deliberate. The explicit reach into `c.namespace()` rather than `ds.getNamespaceName()` is the architectural statement.
2. **Structural impact?** YES — affects multi-namespace deployment topology; affects the collector-binary's lifecycle; affects every search/filter dimension across the catalog.
3. **Refactoring or structural?** STRUCTURAL — moving to payload-driven namespace requires revising contract semantics, breaking the existing invariant, redesigning search/filter scoping.

**Existing ADR**: NEW; complements ADR-CANDIDATE-142 (partial-merge upsert — `namespace_id` is in the PRESERVED list, so even on re-registration the Collector's namespace is what stays).

**Proposed action**: Promote to `adrs/drafts/collector-tenancy-model.md` (new ADR). Document the one-Collector-one-Namespace invariant, the silent-drop of payload `namespace_name`, the multi-namespace operator workflow, the cross-pillar implication. Live-doc-side: surface the namespace inheritance on `developer-guides/build-and-run/custom-collectors` AND on the Integrations / Collectors documentation.

**Co-surfaced gaps**: REFACTOR-424 NEW (payload `namespace_name` silently ignored — doc-product gap).

**Severity rationale**: MEDIUM — tenancy-architecture decision; affects collector deployment topology; silently surprises custom-collector authors but doesn't cause data loss or security exposure.

---
