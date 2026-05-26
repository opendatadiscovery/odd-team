## STRENGTHENS — Search.tsx final-refresh primary source in batch ZL re-confirms the debouncer-recreation bug at substrate commit 4ec2b20

DOC-GAP-248 (Search.tsx debouncer recreation defeats 1500ms rate-limit) was originally surfaced at batch ZA via the Search component. Batch ZL refreshes the Search.tsx sidecar — described as "FINAL refresh consolidating the Search page root with stress_findings + probes" — and re-confirms the bug remains at substrate commit `4ec2b20`.

### Added surfaced_by (new sidecar cited)

- `odd-platform__ts__react-component__component__Search.md:bugs_limitations_corner_cases.[Debouncer is RECREATED on every facet-state change]` (MEDIUM per sidecar — verbatim: "Lines 50-65: `useCallback(useDebouncedCallback(..., 1500, {leading: true}), [searchId, searchFacetParams])`. The `useCallback` deps include `searchFacetParams` — which changes on every facet click. Each click constructs a NEW `useDebouncedCallback(...)` instance — the prior debouncer's pending timer is unreachable. With `{leading: true}`, the new debouncer fires on its FIRST call (immediately) AND would defer a trailing call until 1500ms — but the trailing call NEVER fires because the next click constructs yet another debouncer. **Effective behaviour: every facet click dispatches `updateDataEntitiesSearch` immediately; the 1500ms 'debounce' is not actually rate-limiting anything.** A user rapidly clicking 5 facets in 2 seconds dispatches 5 PUT calls instead of the intended 1.")
- `odd-platform__ts__react-component__component__Search.md:stress_findings.name_behavior_pairs.[updateSearchFacets debouncer]` (DRIFT_NAME_VS_BEHAVIOR — "useCallback wraps useDebouncedCallback with deps [searchId, searchFacetParams]. Because searchFacetParams changes on every facet click, the useCallback recreates the debouncer on every click, defeating the debounce. Effective behaviour: every click dispatches immediately.")
- Probe **P-189** (per Search.tsx sidecar `stress_findings.probes_emitted`) — pin dispatch cardinality per facet-click batch (P-189 confirms the BROKEN-DEBOUNCER hypothesis).

### Severity update

Severity remains **MEDIUM** — primary-source re-confirmation at substrate commit `4ec2b20` confirms the bug persists. The doc-side fix (operator-facing notice about the rate-limit gap) + the code-side fix (extract `useDebouncedCallback` outside the component, or use a stable `useRef`-wrapped debouncer) remain the primary actions.

---

**Batch ZL contribution**: 1 PRIMARY SOURCE re-confirmation at substrate commit `4ec2b20`; coverage unchanged (1 sidecar — Search.tsx); severity unchanged (MEDIUM); probe P-189 cross-referenced.
