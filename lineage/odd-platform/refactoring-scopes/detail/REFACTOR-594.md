## REFACTOR-594 — Dashboard 'Namespace' filter silently widens to datasource-inherited namespaces (`NAMESPACE.ID = DATA_ENTITY.NAMESPACE_ID OR NAMESPACE.ID = DATA_SOURCE.NAMESPACE_ID`) — operator filtering by namespace X sees MORE entities than expected; the widening is undocumented

**Severity**: MEDIUM
**Category**: name-behaviour-drift (input-name-vs-implementation, TRANSLATES_SILENTLY class)
**Pillars affected**: [P-04 Data Quality — F-032 Quality Dashboard]
**related_features**: [F-032]
**related_pillar_features**: [P-04:F-002]
**Batch**: ZC (2026-05-22)

**Surfaced by**:
- `odd-platform__ts__react-component__component__DataQualityFilters.md:docs_link_semantic.doc_drift_findings.[1]` (MEDIUM) — |-
    "**DOC DRIFT — the Namespace filter's datasource-inheritance widening is undocumented.** The `dashboard` page does not state that the Namespace filter also matches datasource-level namespaces. The SQL joins `NAMESPACE.ID.in(namespaceIds)` against `DATA_ENTITY.NAMESPACE_ID` **OR `DATA_SOURCE.NAMESPACE_ID`** (`ReactiveDataQualityRunsRepositoryImpl.java:288-293`). A namespace selected in the filter therefore matches both entities directly assigned to it and entities whose datasource carries it — a wider result set than 'Namespace' alone implies."
- `odd-platform__ts__react-component__component__DataQualityFilters.md:stress_findings.request_inputs[NamespaceFilter]` (DRIFT_INPUT_NAME_VS_IMPLEMENTATION) — the Category-F trace; confirms `'Namespace'` label vs the actual `OR` SQL bind.

**Description**: The Quality Dashboard's 'Namespace' filter label (`t('Namespace')` at `NamespaceFilter.tsx:29`) promises to narrow the dashboard to entities belonging to the selected namespace(s). The SQL bind site at `ReactiveDataQualityRunsRepositoryImpl.java:288-293` does:

```
NAMESPACE.ID.in(namespaceIds)
  AND (NAMESPACE.ID = DATA_ENTITY.NAMESPACE_ID
       OR NAMESPACE.ID = DATA_SOURCE.NAMESPACE_ID)
```

The `OR` clause silently widens the match: an entity matches if EITHER its own namespace is in the filter OR its datasource's namespace is in the filter. An operator filtering by namespace X gets:
- Entities whose `DATA_ENTITY.NAMESPACE_ID = X` (the literal interpretation of the filter label), AND
- ALSO entities whose own namespace is NULL or different, BUT whose datasource carries namespace X.

The widening doubles as a useful feature (operators who think "all entities under datasource D, even those that haven't been individually namespaced") and as a silent surprise (operators who think "literally entities in namespace X"). The DASHBOARD COUNTS reflect the wider set; an operator triangulating the dashboard against a separate "show me entities in namespace X" view in the directory will see different numbers and cannot tell why.

**Wisdom-test classification**: GAP. (1) Intentional? The OR widening probably IS intentional (it is the same pattern across the catalog's namespace-filtering surfaces — datasource-inheritance is a feature, not a bug). But the LABEL not disclosing the widening is unintentional gap. (2) Structural impact? NO — the bind site is settled architectural; the gap is documentation + label clarity. (3) Refactoring or structural? REFACTORING — relabel + docs; possibly an inline tooltip. → Refactoring scope.

**Primary source citations**:
- `NamespaceFilter.tsx:29` (`name={t('Namespace')}` — the bare label)
- `DataQualityFilters.tsx:70, 85` (the `filterKey='deNamespaceIds'` / `'namespaceIds'` assignments)
- **`ReactiveDataQualityRunsRepositoryImpl.java:288-293`** (the SQL `NAMESPACE.ID.in(...)` bind with the OR-widening)
- WebFetch `https://docs.opendatadiscovery.org/features/data-quality/dashboard` 2026-05-22 status 200 — verbatim absence of any datasource-inheritance disclosure

**Existing-ADR-or-implied-prescription**: same LSN-020 class as REFACTOR-593 (Title filter); also REFACTOR-567 and REFACTOR-496. No ADR prescribes a uniform inheritance-widening disclosure pattern.

**Proposed remedy**: Two layers.

1. **Doc**: update `dashboard.md` to state explicitly "Namespace filter matches entities whose own namespace OR whose datasource's namespace is in the selected set." Add the same clarification on the per-dataset DQ surface if it shares the SQL path.
2. **Label / Tooltip**: optionally add a tooltip on the Namespace filter row reading "Includes datasource-inherited namespaces."

Decide whether the widening is the desired product behaviour (likely yes — it matches how operators typically think about "all DQ data under this namespace") and document the decision. If the team wants the LITERAL interpretation as the default, the SQL needs a flag — but that is a structural change, ADR-shaped, not in this scope.

**Severity rationale**: MEDIUM — operator-counts confusion, not a guide-off-a-cliff. The widening produces MORE results than expected, not fewer; a triaging operator who notices the count discrepancy and reads the docs gets no answer, and the docs gap is the actionable item. Same shape as REFACTOR-593 but lower severity because (a) MORE-than-expected is less harmful than wrong-column-entirely; (b) the operator can cross-check against the directory view and at least see the discrepancy.

**Suggested backlog grouping**: `Quality Dashboard hardening sprint` (with REFACTOR-592 / 593 / 595..617). Pair the doc fix with the REFACTOR-593 doc fix as one DOC-NNN sweep over `dashboard.md` covering all five filter dimensions.

---
