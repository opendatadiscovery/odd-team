# SHB-024 — Operator can drive arbitrary backend lineage depth by hand-editing `?d=` URL despite UI dropdown caps

**Category**: open
**Severity**: HIGH

## Hypothesis

Operators see a depth slider in `LineageControls` capped at `[1..20]` (constants.ts:97-99) and reasonably assume 20 is the platform's enforced ceiling. But the depth value lives in the URL query param `?d=` parsed via `query-string` with `parseNumbers: true` (useQueryParams.ts:36) — a user (or attacker, or curious operator) hand-editing the URL to `?d=10000` causes the UI to dispatch `fetchDataEntityDownstreamLineage({lineageDepth: 10000})` without validation, which flows directly into the backend recursive-CTE walk with NO upper bound (REFACTOR-202). The UI presents a soft limit; the URL is the actual contract. There is no `Math.min(d, 20)` clamp anywhere in the React chain (Lineage / HierarchyLineage / LineageGraph / LineageControls), no backend `@Max(...)` annotation (DataEntityApi `@Min(1)` only — per batch-F sidecar), and no service-layer ceiling (LineageServiceImpl sidecar bugs[2]). The "20-cap" lives ONLY in the dropdown options array.

## Evidence

- `odd-platform-ui/src/components/DataEntityDetails/Lineage/HierarchyLineage/lineageLib/useQueryParams.ts:33-36` — `parseNumbers: true` accepts any integer as `d`; no clamp.
- `odd-platform-ui/src/components/DataEntityDetails/Lineage/HierarchyLineage/lineageLib/constants.ts:97-99` — `lineageDepth = [1..20]` — the dropdown options list, NOT a validation constant.
- `odd-platform-ui/src/components/DataEntityDetails/Lineage/HierarchyLineage/HierarchyLineage.tsx:47` — `d` flows straight to `fetchDataEntityDownstreamLineage({lineageDepth: d})` with no clamp.
- `lineage/odd-platform/understanding/odd-platform__ts__react-component__component__LineageGraph.md:176` (bugs[1]) — "No upper bound on `d` URL param parsing — `useQueryParams.ts:36` uses `parseNumbers: true` which converts `?d=999999999` to `d: 999999999`; the UI's depth `<AppSelect>` only exposes [1..20] but the URL accepts any integer."
- `lineage/odd-platform/understanding/odd-platform__java__repository_reactive__repository__ReactiveLineageRepositoryImpl.md:174, 183` (bugs[3]) — "No upper bound on `lineageDepth.getDepth()` at the repository layer — the value is consumed directly at line 174 (`tDepth.lessThan(lineageDepth.getDepth())`) with no defensive `Math.min(...)` or boundary check."
- `lineage/odd-platform/understanding/odd-platform__java__service__service__LineageServiceImpl.md:185` (bugs[2]) — "No upper-bound check on `lineageDepth` at this service — getLineage builds `LineageDepth.of(lineageDepth)` (line 96) and hands the primitive int directly to the repository."
- `lineage/odd-platform/understanding/odd-platform__java__DataEntityController__controller-method__getDataEntityDownstreamLineage.md:115` (bugs HIGH) — "No server-side `lineage_depth` upper-bound cap... a client can request `lineage_depth=10000` and the query will attempt to enumerate the entire reachable subgraph."
- `lineage/odd-platform/understanding/odd-platform__java__repository_reactive__repository__ReactiveLineageRepositoryImpl.md:177` (bugs[0]) — "No cycle-detection inside the recursive CTE... only termination is `tDepth.lessThan(lineageDepth.getDepth())`."

## Notes

- **The 20-cap is UI-presentation-only — a false sense of safety**. Every layer below the dropdown — URL parsing, useEffect dispatch, thunk, OpenAPI client, controller validation, service, repository, SQL CTE — accepts any positive integer.
- **Diamond/cycle amplification**: with no cycle guard at the repository layer (REFACTOR-202) AND no depth ceiling, a user requesting `?d=10000` against a cyclic lineage subgraph causes the CTE to materialise rows up to depth 10000 in Postgres `work_mem` before the outer `selectDistinct` prunes. JVM heap then holds the full edge list via `.collectList()` (LineageServiceImpl.java:102).
- **Authenticated DoS surface**: every authenticated user has the affordance. Under `auth.type=DISABLED` the affordance is unauthenticated (REFACTOR-185 inheritance per LineageServiceImpl sidecar security).
- **Click-through compounds**: per LineageGraph sidecar bugs[3] + implicit_adrs[4], clicking a node title at depth N navigates to that node's Lineage tab with `?d=N` — drilling 5 hops out from root opens a new view with depth=5. A user accidentally navigates to a depth=N view where N grows monotonically per click; no slider state intervenes.
- **The right fix is layered**: (a) `Math.min(d, 20)` at the URL-parse layer for defence-in-depth (cheap, ships now); (b) backend `@Max(20)` on the OpenAPI spec for SDK clients; (c) hard ceiling at the service layer (`Math.min(lineageDepth, MAX_DEPTH)`); (d) Postgres `statement_timeout` for the lineage CTE specifically (not done — JooqReactiveOperations has no per-statement timeout per repository sidecar security[2]).
- This thread is NOT a F-005 facet because F-005's drift discussion stops at "depth flows through unbounded"; it does not name the **UI-vs-URL-vs-backend three-layer absent-validation pattern** as a feature. The feature here is "operator-visible safety boundary that is not actually a boundary" — the UI dropdown IS the boundary the operator sees, and it lies.
- Probable LSN-001-shape ADR candidate: "if the operator sees a control with limited options, every layer below must enforce the same options OR document the asymmetry."

## Next

1. **Verify the asymmetry by probe**: load `/dataentities/{id}/lineage?d=10000`, observe the backend log + Postgres `pg_stat_activity`. Does the CTE run? How long does the request take?
2. **Promote**: this is a feature candidate `F-NNN — Lineage Depth Boundary Contract (UI cap + URL bypass + backend no-cap)` with `seeded_from: SHB-024`, pillar P-05, drift_class `ui_dropdown_cap_is_not_validation_boundary`.
3. **Companion refactoring-scopes**: REFACTOR-NNN (URL clamp at parse layer), REFACTOR-NNN (backend `@Max`), REFACTOR-NNN (service-layer hard cap), REFACTOR-NNN (PG `statement_timeout` for lineage CTE).
4. **DOC-NNN**: the live `https://docs.opendatadiscovery.org/developer-guides/api-reference/lineage` page documents `lineage_depth` with no `maximum`. Either correct the doc OR fix the code AND correct the doc.
5. **Cross-link to F-005 + REFACTOR-202** in the feature flow; the depth-bypass is the **operator-driven realisation** of the backend amplification surface.

## Links

- cluster_with: [F-005, F-016]
- merged_into: (open)
- supersedes: []
