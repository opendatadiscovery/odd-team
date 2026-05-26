# SHB-086 — Namespace directory mintable from 4 sister services (TermService / DataSourceService / CollectorService / DataEntityGroupService), bypassing NAMESPACE_CREATE

**Category**: clustering
**Severity**: HIGH

## Hypothesis

Operators authoring an RBAC policy that grants `TERM_CREATE` (or `DATA_SOURCE_CREATE`, or `COLLECTOR_CREATE`, or `DATA_ENTITY_GROUP_CREATE`) but DENIES `NAMESPACE_CREATE` expect that the user cannot expand the platform's taxonomic-scope vocabulary. The actual surface is: any of those 4 sister services calls `namespaceService.getOrCreate(formData.getNamespaceName())` inside the parent create/update path, which mints a new Namespace row if the name is unseen — bypassing the `NAMESPACE_CREATE` gate that the controller `POST /api/namespaces` defends. The mint emits no Activity Event; the new Namespace appears in `GET /api/namespaces` immediately (also ungated-read per SHB-085).

## Evidence

- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/controller/NamespaceController.java:1-62` + `auth/util/SecurityConstants.java:98-108` — POST `/api/namespaces` requires `NAMESPACE_CREATE`; this is the controller-path-anchored gate.
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/service/NamespaceServiceImpl.java:36-50` (estimated; `getOrCreate(name)` per Namespace concept catalog) — auto-create pattern: `getByName(name).switchIfEmpty(repository.create(new NamespacePojo().setName(name)))`. No permission check at the service callsite.
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/service/TermServiceImpl.java:103, 138` — callsite #1: `namespaceService.getOrCreate(formData.getNamespaceName())` inside `createTerm` + `updateTerm`.
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/service/DataSourceServiceImpl.java:57, 75` — callsite #2: same pattern inside `createDataSource` + `updateDataSource`.
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/service/CollectorServiceImpl.java:43, 57` — callsite #3: same inside `create` + `update`.
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/service/DataEntityGroupServiceImpl.java:65, 84` — callsite #4: same inside `createDataEntityGroup` + `updateDEG`.
- `concepts/detail/invariants/namespace-create-tag-create-side-doors-via-termcontroller-unguarded-paths.yaml` — the concept catalog already names this pattern as an invariant.

## Notes

- Same structural class as SHB-084 (Owner-create side-door) — the platform-wide pattern is "auto-create on miss via `getOrCreate`, gate only the controller-path POST." Operators have NO mental model of this — they reason about RBAC permissions per resource type, not per service call graph.
- Combined with the read-collaborative posture (SHB-085), an attacker with limited permissions can: (a) enumerate the Namespace + Owner + Title directories; (b) MINT new entries to either by submitting parent forms; (c) the mutation is audit-silent.
- Operator-visible blast radius: a typo or rogue submission via the DataSource registration form (`namespaceName: "test-typo"`) silently expands the Namespace dimension; subsequent Policy conditions `dataEntity:namespace == 'test-typo'` interact with the new row.
- F-028 (Namespace lifecycle) anchors the controller but does not enumerate the 4 side-doors as feature facets — F-028 describes WHAT the controller does, not the OUT-OF-controller permission bypass.
- DataSourceController sidecar's `coherence_check.conflicts_surfaced[0]` independently calls this out for the DATA_SOURCE_CREATE → NAMESPACE_CREATE chain.

## Next

1. **ENRICH F-028** with this drift facet (`namespace_create_bypassed_by_four_sister_services_side_door`).
2. **REFACTOR-NNN**: gate `NamespaceService.getOrCreate` programmatically with `NAMESPACE_CREATE`; OR introduce `NAMESPACE_MINT_FROM_PARENT_FORM` Permission; OR add `@ActivityLog` so mints are at least audit-traceable.
3. **DOC-NNN**: document the 4 side-doors on the `/permissions` page; update the `/features/management` Namespaces section to warn operators about the implicit-create-via-parent-form behaviour.
4. **TEST-GAP-NNN**: cross-pillar test asserting a user with only `TERM_CREATE` can submit a Term form with a never-seen `namespaceName` and observe a new Namespace row in `GET /api/namespaces`.

## Links

- cluster_with: [F-028, F-031, F-020, F-002, SHB-085, SHB-084]
- merged_into: (open)
- supersedes: []
