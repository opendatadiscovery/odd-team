- **DOC-GAP-165**: `getDataEntityGroupsLineage` filters edges BIDIRECTIONALLY at `ReactiveLineageRepositoryImpl.java:115-117` (`LINEAGE.PARENT_ODDRN.in(oddrns).and(LINEAGE.CHILD_ODDRN.in(oddrns))`) — only edges where BOTH endpoints are DEG members appear in the response; edges EXITING the DEG (from a member to a non-member) AND edges ENTERING the DEG (from a non-member to a member) are SILENTLY DROPPED; the operator viewing a DEG's lineage cannot tell that "this DEG's data flow has upstream sources outside the DEG" or "this DEG feeds into consumers outside the DEG"; the live `/features/data-lineage` and `/developer-guides/api-reference/lineage` pages do NOT warn about this; for operators using DEGs as Domain or Pipeline scopes, the silently-truncated boundary edges produce misleading "isolated subgraph" impressions of the DEG's actual data flow (MEDIUM; new boundary-edge-truncation finding on the DEG-lineage surface)
  - **Category**: drift
  - **Surfaced by**:
    - `odd-platform__java__DataEntityController__controller-method__getDataEntityGroupsLineage.md:bugs_limitations_corner_cases.[6]` (MEDIUM) **(NEW batch M — controller-method primary source)**
    - `odd-platform__java__DataEntityController__controller-method__getDataEntityGroupsLineage.md:implicit_adrs.[4]` (HIGH — BIDIRECTIONAL filter is a deliberate stance: DEG-lineage is INTERNAL to the DEG)
    - `odd-platform__java__DataEntityController__controller-method__getDataEntityGroupsLineage.md:concepts.invariants.[5]` (the DEG-internal edge filter is BIDIRECTIONAL)
  - **Evidence**:
    - `ReactiveLineageRepositoryImpl.java:112-119` — verbatim signature:
      ```
      public Flux<LineagePojo> getLineageRelations(final List<String> oddrns) {
          ...
          .where(LINEAGE.PARENT_ODDRN.in(oddrns)
              .and(LINEAGE.CHILD_ODDRN.in(oddrns))
              .and(LINEAGE.IS_DELETED.isFalse()))
          ...
      }
      ```
      The `.and(LINEAGE.CHILD_ODDRN.in(oddrns))` predicate is the BIDIRECTIONAL filter — both endpoints must be in the supplied oddrn list.
    - `LineageServiceImpl.java:66` — verbatim call site:
      ```
      lineageRepository.getLineageRelations(entitiesOddrns).collectList()
      ```
      The `entitiesOddrns` argument is the DEG's transitive member set per the recursive-member CTE; the lineage edge fetch is bounded to edges WITHIN that set.
    - **Behavioural impact**: a DEG containing a dataset that is consumed by an external transformer (outside the DEG) and produced by an external collector (outside the DEG) will surface the dataset NODE in the response but NEITHER the input edge (from the external collector) NOR the output edge (to the external transformer). The operator viewing the DEG's lineage canvas sees the dataset as a graph leaf — appearing to have no upstream and no downstream — when in reality both exist.
    - The complementary affordance — "see the full external context" — is to open the per-entity lineage endpoint on individual members. But this affordance is itself a separate UI navigation step; the DEG-lineage canvas provides no in-page signal that external context exists.
    - The design intent (per the sidecar's `implicit_adrs[4]`): the DEG-lineage view is INTENTIONALLY INTERNAL to the DEG. External context is NOT shown by design. This is a deliberate stance that an operator may find surprising without disclosure.
    - WebFetch `https://docs.opendatadiscovery.org/developer-guides/api-reference/lineage` 2026-05-19 status 200 (re-verified in current session) — does NOT mention the boundary-edge filtering. The api-reference description ("Returns the lineage graph for the group's children") is consistent with the implementation but does NOT call out the boundary filtering as a design decision.
    - WebFetch `https://docs.opendatadiscovery.org/features/data-lineage` 2026-05-19 status 200 (sidecar-recorded) — silent on the boundary filtering.
  - **Proposed doc action**: **Two-part action**.
    1. **Doc-side primary**: extend `developer-guides/api-reference/lineage.md` and `features/data-lineage.md` for the DEG-lineage endpoint with a "Boundary edges" sub-section: "**The DEG-lineage view shows ONLY edges where BOTH endpoints are members of the DEG.** Edges crossing the DEG boundary — from a member entity to an external consumer, or from an external producer to a member entity — are NOT included in the response. This is by design: the DEG-lineage canvas is internal to the DEG. To see the full external context of a particular member entity, open the per-entity lineage endpoint (`GET /api/dataentity/{id}/lineage`) on that entity. The DEG-lineage view is intentionally inward-facing." Optionally include a one-paragraph diagram comparing the two views.
    2. **Code-side optional** (file `/log-issue odd-platform`): two ordered options. (a) **Minimum**: extend the response shape to include a `boundaryEdges: { external_upstream: int, external_downstream: int }` field per member node, signalling without listing the count of boundary edges; the operator can then drill into per-entity lineage for those members. (b) **Full**: add a query parameter `include_boundary_edges: true|false` (default `false` for backwards compat) that, when enabled, returns the boundary edges with a `external: true` marker on the affected edges; clients can render them differently (greyed-out, dashed-line, "external" badge).
  - **Cross-references**:
    - DOC-GAP-159 (NEW batch M — DEG-anchored lineage cross-owner enumeration) — sibling DEG-lineage finding; the boundary edges interact with the cross-owner posture (boundary edges may cross owner boundaries)
    - DOC-GAP-163 (NEW batch M — DEG-lineage 404 conflation) — sibling DEG-lineage finding
    - DOC-GAP-164 (NEW batch M — inner-DEG suppression deferred-feature) — sibling DEG-lineage finding; boundary-edge filtering is the COMPLEMENT to inner-DEG suppression
    - DOC-GAP-105 (lineage recursive-CTE primary source) — same repository class; different code path (the DEG-lineage uses the simpler `getLineageRelations(List<String>)` overload, not the recursive-CTE one)
    - DOC-GAP-167 META (NEW batch M — REV-3 LAYER-0 P-05 Data Lineage sub-feature overpromise) — pillar-level cross-cut
  - **Severity rationale**: MEDIUM — the operator-debugging cost is real for operators using DEGs as Pipeline / Domain scopes; the architectural intent is documented in the code (the `implicit_adrs[4]` evidence is the bidirectional filter at the repository) but not in the operator-facing docs. The doc-side action is a single sub-section; the code-side action is optional and predicated on operator demand. The MEDIUM severity reflects the operator-impact axis as the primary motivator.
