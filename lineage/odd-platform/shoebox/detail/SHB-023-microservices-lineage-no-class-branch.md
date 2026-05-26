# SHB-023 — Microservices lineage is rendered by the SAME hierarchy canvas as datasets, with no class-aware affordances

**Category**: open
**Severity**: MEDIUM

## Hypothesis

Operators clicking the Lineage tab on a microservice entity see the SAME hierarchy canvas (`HierarchyLineage` → `LineageGraph`) that powers dataset / transformer lineage — there is **no microservices-specific branch, no operation-name rendering, no trace-timing surface, no service-call-cardinality affordance**. The dispatcher (`Lineage.tsx`) routes ONLY on `isDEG` (data-entity-group vs everything-else); microservices fall through to the non-DEG branch identically to a Postgres table. The live docs page advertises microservices lineage as a distinct view (`https://docs.opendatadiscovery.org/features/data-lineage` — verified 2026-05-20 status 200, per Lineage.tsx sidecar `docs_link_semantic`); the code treats it as a class of data entity reachable through the same `/api/dataentities/{id}/lineage/{up,down}stream` endpoints. Microservices-only data (e.g. OTel span metadata, call rate, latency percentiles, error rate) ingested through `odd-tracing-gateway` is either silently DROPPED at render time or has no corresponding `DataEntityLineageNode` field — third-party UI consumers of the same endpoints cannot tell that microservice nodes are different from dataset nodes.

## Evidence

- `odd-platform-ui/src/components/DataEntityDetails/Lineage/Lineage.tsx:14, 19-25` — the dispatcher checks ONLY `isDEG` (per `getIsDataEntityBelongsToClass` in `redux/selectors/dataentity.selectors.ts:43-45` which tests `ENTITY_GROUP` class). No `isMicroservice` / `isTransformer` / `isQualityTest` branch.
- `odd-platform-ui/src/components/DataEntityDetails/Lineage/HierarchyLineage/HierarchyLineage.tsx:1-138` — single non-DEG renderer. No class-aware sub-components.
- `lineage/odd-platform/understanding/odd-platform__ts__react-component__component__Lineage.md:139` (bugs[2]) — "No microservices-specific branch... All HierarchyLineage caveats (per batch-J: diamond amplification, monotonic LoadMore, no upper bound on `?d=`, click-through-compounds-depth, anchor-set-undefended endpoints causing REFACTOR-203 cross-owner enumeration) apply identically to microservices."
- `lineage/odd-platform/understanding/odd-platform__ts__react-component__component__LineageGraph.md:182` (bugs[7]) — "Microservices ARE data entities; their Lineage tab on the entity-detail page uses the SAME `<Lineage />` component, the SAME `/api/dataentities/{id}/lineage/downstream` endpoint. There is no mode flag, no class-based override... microservices-specific affordances (e.g. service name vs operation name, trace timing) are NOT rendered — they are silently dropped if the response has them."
- `lineage/odd-platform/understanding/odd-platform__java__service__service__LineageServiceImpl.md:39` (concepts.operations) — backend `getLineage` accepts `LineageStreamKind` (UPSTREAM/DOWNSTREAM only); no `EntityClass` parameter, no microservices-specific projection.
- Live doc fetch 2026-05-20 (per Lineage.tsx sidecar) — page names microservices lineage as a distinct surface; code treats it as a class of data entity through the same endpoints.

## Notes

- This is genuinely a SHB-class observation, not a refactoring-scope (which would be "add a class branch to dispatcher"). The hypothesis is **the microservices lineage feature exists as a separate concept in the operator's mental model but has NO existence in the UI rendering chain** — it's a doc-side feature without a code-side anchor. F-005 covers per-entity recursive-CTE lineage; F-016 covers DEG-anchored lineage; no F-NNN anchors microservices lineage as a feature in its own right.
- guess: ingested OTel-spec lineage events may already carry `operation_name` / `span_kind` / timing fields at the spec layer (worth checking `opendatadiscovery-specification` for `MicroserviceEntity` / `ServiceCallEntity` shapes), but the response DTO `DataEntityLineageNode` is class-agnostic.
- The doc-side framing implies the operator should be able to distinguish microservices-lineage UX from dataset-lineage UX. Today they cannot — both render as boxes with names and edges.
- **Cross-owner enumeration amplifies here**: per LineageServiceImpl sidecar bugs[0], `getLineage` applies no owner-scoping. A user can click into ANY microservice and see the full cross-service call graph — including services owned by other teams. This is the F-005 cross-owner gap intersecting with a class of entities whose operational data (latency, error rate) is often more sensitive than table schemas.
- The `/api/dataentities/{id}/lineage/downstream` is the ONLY endpoint backing both views (verified: `LineageServiceImpl.getLineage` has no class branch; same SQL, same response shape).
- guess: a third-party `odd-tracing-gateway` collector that emits microservice-specific lineage metadata (e.g. `propertiesByEntityClass.MICROSERVICE.callsPerMinute`) would have those fields silently dropped at the response-DTO mapper — verify against `LineageMapper.mapLineageDto` and `DataEntityLineageNode` schema.

## Next

1. **Read `LineageMapper.mapLineageDto` + `components.yaml DataEntityLineageNode`** — is there ANY class-specific projection? Or is every node uniformly `{id, oddrn, name, classes, ownership, status}`?
2. **Read `odd-tracing-gateway` repo** for the actual microservice lineage payload shape — does it carry `operationName`, `spanKind`, `errorRate`, `p95Latency`? If yes, those are silently dropped at render.
3. **Confirm via the docs page** what "microservices lineage" actually MEANS as a feature distinct from data-object lineage. If the doc-side feature is purely "microservices are data entities that have lineage", then no thread; if it promises operation-level / span-level / timing affordances, this is a feature-flow candidate.
4. **Probe**: spin up local docker-compose with a microservice entity (or seed `data_entity` with `entity_classes containing MICROSERVICE class id`), navigate to its Lineage tab, observe the canvas. Does the operator see anything that distinguishes it from a dataset's lineage?
5. **If confirmed unique feature**: promote to `F-NNN — Microservices Lineage` with `seeded_from: SHB-023`, pillar P-05, drift_class `microservices_lineage_indistinguishable_from_data_object_lineage_no_class_aware_ui`.

## Links

- cluster_with: [F-005, F-016, SHB-002]
- merged_into: (open)
- supersedes: []
