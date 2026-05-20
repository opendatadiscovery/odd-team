## REFACTOR-348 — DEG-lineage cross-boundary edges silently filtered with NO doc disclosure — operators viewing a DEG's lineage cannot tell that external upstream/downstream context exists outside the DEG; the bidirectional bound-set filter at `ReactiveLineageRepositoryImpl.java:115-117` drops every edge where any endpoint is non-member

**Severity**: MEDIUM
**Category**: doc-code-drift (silent contract carve-out)
**Pillars affected**: [P-05-data-lineage, P-01-data-discovery]
**Batch**: M (2026-05-19)

**Surfaced by**:
- `odd-platform__java__DataEntityController__controller-method__getDataEntityGroupsLineage.md:bugs_limitations_corner_cases.[6]` (MEDIUM) — "**Cross-boundary edges are silently filtered** — `getLineageRelations(List<String>)` at ReactiveLineageRepositoryImpl.java:112-119 requires BOTH endpoints in the member set. An operator viewing a DEG's lineage cannot tell that 'this DEG's data flow has upstream sources outside the DEG' or 'this DEG feeds into consumers outside the DEG'. The UI affordance for 'see the full external context' is to open the per-entity lineage endpoint on individual members — but the DEG-lineage view itself does not surface that there IS an external context. The live docs do not warn about this."
- `odd-platform__java__DataEntityController__controller-method__getDataEntityGroupsLineage.md:docs_link_semantic.doc_drift_findings.[0]` (MEDIUM — live API-reference page does not disclose the inner-DEG suppression OR the cross-boundary edge filter)

**Description**: `ReactiveLineageRepositoryImpl.getLineageRelations(List<String> oddrns)` at lines 112-119 builds:

```sql
WHERE LINEAGE.IS_DELETED.isFalse()
  AND LINEAGE.PARENT_ODDRN IN (?, ?, ...)   -- member oddrns
  AND LINEAGE.CHILD_ODDRN IN (?, ?, ...)    -- same member oddrns
```

The `.and(...)` between the parent-in and child-in predicates is bidirectional: **edges where ANY endpoint is OUTSIDE the member set are DROPPED**. The DEG-lineage view is therefore the **internal** lineage of the group — edges entering the DEG from external upstream sources OR exiting the DEG to external downstream consumers are not surfaced.

The architectural decision IS deliberate (codified at ADR-CANDIDATE-120 NEW — DEG-lineage internal-edge-fetch) — the maintainer's intent is "show the DEG's internal data-flow"; external context belongs to the per-entity lineage endpoints. The gap is **doc-side disclosure**:

1. **Live `/developer-guides/api-reference/lineage` page** (WebFetched 2026-05-19 status 200) documents the endpoint as "Returns the lineage graph **for the group's children** — i.e. the lineage relationships among the entities that belong to the given group". The phrasing "among the entities that belong to the given group" technically discloses the internal-only semantic, but does NOT name the cross-boundary-edge filter explicitly — a consumer reading the doc may expect "lineage of the group's children, including edges to non-member entities".

2. **Live `/features/data-lineage` page** describes the Group Lineage entry point as "opens the lineage of the group's *children*, not of the group itself" with an example: "a Finance DEG containing datasets and ETL jobs returns the lineage union across those eighteen child entities, which is what an operator usually wants when reasoning about a domain or pipeline." The phrasing "lineage union across those eighteen child entities" plausibly reads as "show me the full lineage neighbourhood touching any child" — which would include cross-boundary edges. The current behaviour (only internal edges) is the opposite.

3. **No UI affordance**: The `DEGLineage` React component (`odd-platform-ui/src/components/DataEntityDetails/Lineage/DEGLineage/DEGLineage.tsx`) renders the internal graph but does NOT show a "show external context" toggle or surface a count of cross-boundary edges that were filtered out. The operator viewing a DEG's lineage has no signal that external context exists.

**Operator-impact paths**:
- A data engineer investigating "where does this DEG's data come from?" opens the DEG-lineage tab, sees an internal subgraph with no upstream context, and concludes the DEG is self-contained. The DEG may actually receive data from external collectors (registered via the Postgres collector or other sources outside the DEG); the engineer misses the external dependency.
- A platform operator auditing "what does this DEG feed?" opens the DEG-lineage tab, sees only internal downstream nodes, and concludes the DEG's outputs are not consumed externally. External BI dashboards / downstream pipelines may consume from the DEG's members; the operator misses the external consumer.
- An incident responder tracing "why is this Domain's data stale?" opens the DEG-lineage tab, doesn't see the external upstream source that has failed, and routes the incident incorrectly.

**Primary source citations**:
- `ReactiveLineageRepositoryImpl.java:112-119` (the bidirectional bound-set filter — `PARENT_ODDRN.in(oddrns).and(CHILD_ODDRN.in(oddrns))`)
- `LineageServiceImpl.java:66` (the caller — `lineageRepository.getLineageRelations(entitiesOddrns)`)
- WebFetch `https://docs.opendatadiscovery.org/developer-guides/api-reference/lineage` 2026-05-19 (status 200; the endpoint summary disclosure)
- WebFetch `https://docs.opendatadiscovery.org/features/data-lineage` 2026-05-19 (status 200; the Group Lineage entry-point disclosure)
- `odd-platform-ui/src/components/DataEntityDetails/Lineage/DEGLineage/DEGLineage.tsx` (the UI component — no external-context affordance)

**Existing-ADR-or-implied-prescription**: **ADR-CANDIDATE-120 NEW** (batch M — DEG-lineage internal-edge-fetch) codifies the architectural decision; the doc-side gap is the consequence the ADR does not address.

**Proposed remedy**: Doc-align + UI-disclose:

1. **Live `/developer-guides/api-reference/lineage` page**: Add an explicit note on the `getDataEntityGroupsLineage` endpoint row: "**Internal-only edges**: This endpoint returns only lineage edges where BOTH endpoints are members of the DEG. Edges crossing the DEG boundary (upstream sources outside the DEG; downstream consumers outside the DEG) are not surfaced. To see external context, use the per-entity lineage endpoint on individual DEG members (`GET /api/dataentity/{id}/lineage/{stream_kind}`)."

2. **Live `/features/data-lineage` page**: Add an explicit disclosure on the Group Lineage entry-point description: "Group Lineage shows the **internal** data-flow within the group; external upstream sources and external downstream consumers are not surfaced in this view. To see external context, open the Lineage tab on an individual member entity."

3. **UI affordance (optional, deferred)**: Add a "{N} external upstream sources / {M} external downstream consumers" count badge on the DEG-lineage tab; clicking expands a list of external endpoints with a link to each. Cost: one extra query (LINEAGE rows where exactly one endpoint is in the member set); benefit: operator-visible external context.

The minimum-viable fix is option (1) + (2) — doc-side disclosure. Option (3) is a UX improvement deferred to a feature sprint.

**Severity rationale**: MEDIUM — operator-confusing UX gap on a load-bearing UI surface (DEG lineage tab is the canonical "what does this Domain do?" affordance). Not HIGH because the response shape is contract-coherent (the endpoint returns what it says — the group's children's internal lineage); the gap is the absence of disclosure that external context exists. Compounds operator-debugging cost for incident response on multi-team Domains.

**Suggested backlog grouping**: `DOC-NNN DEG-lineage disclosure tranche` — couple with REFACTOR-345 NEW (404 conflation — same DEG-lineage endpoint), REFACTOR-349 NEW (inner-DEG suppression no test pin), REFACTOR-343 NEW (DEG-lineage cross-owner CO-MEMBERSHIP enumeration).

---
