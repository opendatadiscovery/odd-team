# ADR-CANDIDATE-215 — Relationship list endpoint is a CATALOG-GLOBAL read surface, NOT an owner-scoped one — distinct from `/api/dataentities/my` which IS owner-scoped; the intent is that relationships are PUBLIC METADATA across the catalog

**Classification**: promote
**Severity**: HIGH
**Pillars affected**: [P-02 Data Modelling, P-04 Data Discovery, P-09 Security & Access Control]
**Batch**: ZE (2026-05-25)

**Surfaced by**:
- `odd-platform__java__RelationshipController__controller-class__RelationshipController.md:implicit_adrs.[1]` (MEDIUM) — "**The relationship list endpoint is a CATALOG-GLOBAL surface, not an owner-scoped one** — distinct from `/api/dataentities/my` which IS owner-scoped (batch-G `getMyObjects`). The intent is that relationships are PUBLIC METADATA across the catalog: a consumer should be able to discover that table A links to table B even if they have no permissions on either. The code embodies this by the absence of any OWNERSHIP JOIN; the data-modelling/relationships.md doc embodies it by NOT documenting any scoping at all. Symmetric to `/api/lineage` (per batch-J Lineage UI) — both are read-collaborative catalog surfaces." — evidence: ReactiveDataEntityRelationshipRepositoryImpl.java:66-72 (conditionList omits OWNERSHIP and EXCLUDE_FROM_SEARCH) + the parallel pattern in lineage — intent_anchor: "the conditionList contains ONLY `DATA_ENTITY.EXTERNAL_NAME` (when query provided) AND `ENTITY_CLASS_IDS = [9]`; no owner / namespace / exclude_from_search clause"

**Decision statement**: `GET /api/relationships`, `GET /api/relationships/erd/{relationship_id}`, and `GET /api/relationships/graph/{relationship_id}` are CATALOG-GLOBAL READ surfaces. Every authenticated user (or every caller under `auth.type=DISABLED`) sees EVERY relationship in the catalog regardless of: (a) which Data Sources they have owner-scope on; (b) which Namespaces are in their policy; (c) whether the underlying source/target entities have `EXCLUDE_FROM_SEARCH = true`; (d) whether the underlying entities are `HOLLOW`. The repository SQL (`ReactiveDataEntityRelationshipRepositoryImpl.java:66-75`) contains NO `OWNERSHIP` JOIN, NO `data_source_id` IN-clause filter, NO `namespace_id` filter, and crucially NO `EXCLUDE_FROM_SEARCH = false` predicate — even though the sibling `/api/dataentities` surface DOES apply the `EXCLUDE_FROM_SEARCH` filter (per batch-T REFACTOR-425). The asymmetry is the decision: relationships are PUBLIC METADATA across the catalog because they describe structural connections (table A FK to table B) that a graph-visualisation consumer needs to render regardless of read permission on the underlying tables. The same posture applies to `/api/lineage` (per batch-J).

**Wisdom test**: PASS (with borderline_flag for the EXCLUDE_FROM_SEARCH asymmetry). Three intent anchors:
1. **Schema-level decision** — the `relationships` table (`V0_0_87__create_relation_tables.sql:1-10`) carries no `owner_id` or `policy_scope` column. The schema went in this way and has been retained across all subsequent migrations.
2. **SQL-level decision** — the conditionList builder at `ReactiveDataEntityRelationshipRepositoryImpl.java:66-75` deliberately constructs ONLY two clauses: `entity_class_ids = [DATA_RELATIONSHIP.id()]` and an optional `external_name` substring filter. The OWNERSHIP / EXCLUDE_FROM_SEARCH / HOLLOW clauses are STRUCTURALLY ABSENT — not commented-out, not behind a `WithPermissions` block, not toggle-able. The absence is consistent.
3. **Parallel in `/api/lineage`** — the lineage feature surfaces the same shape: a consumer can see that A → B even without read permission on A or B (per batch-J Lineage UI sidecar's `concepts.invariants`). The two read-collaborative catalog-graph surfaces share the architectural decision.

Structural impact (alters the trust model for catalog-graph metadata: relationships are not partitioned by tenant; a multi-tenant deployment exposes cross-tenant graph topology to every authenticated user); alternative ("add OWNERSHIP filter on relationships read") is a structural change to the catalog-graph-as-public-metadata contract.

**Borderline_flag**: the EXCLUDE_FROM_SEARCH asymmetry is the live question. The sibling `/api/dataentities` surface applies the filter; the relationships surface does NOT. Two readings:
- **ADR (deliberate)**: relationships ARE a different content type — they ARE public-by-design even when the underlying entities are excluded-from-search. EXCLUDE_FROM_SEARCH semantically means "hide from search results" (UI search box), not "hide from catalog graph". The graph posture is an independent decision.
- **Gap (forgotten)**: the EXCLUDE_FROM_SEARCH filter was added to `/api/dataentities` per batch-T REFACTOR-425, but no parallel addition was made to `/api/relationships`. The maintainer might not have realised the relationships surface also needs the filter.

The maintainer triages: surface to the docs page (data-modelling/relationships.md) describing the relationships-as-public-metadata stance + EXCLUDE_FROM_SEARCH ASYMMETRY, OR add the filter to the relationships repo.

**Operator-visible consequence**:
- Operator A's deployment has a data source `internal_finance` whose every entity is EXCLUDE_FROM_SEARCH=true (per the operator's intent to hide from catalog search).
- Operator A's deployment has a relationship row between `internal_finance.orders` and `internal_finance.payments`.
- A non-finance user calls `GET /api/relationships?query=payments` and sees the relationship — including the source/target entity names — even though `/api/dataentities/?query=payments` would not surface those entities.
- The asymmetry is operator-visible; the doc does not warn.

**Existing ADR**: composes with **ADR-CANDIDATE-003** (GET endpoints intentionally outside SECURITY_RULES — read-collaborative posture); this ADR is the **CATALOG-GRAPH-SPECIFIC INSTANCE** that extends the posture to ALSO ignore EXCLUDE_FROM_SEARCH (the sibling instances apply the filter). Also composes with the IMPLICIT lineage-surface ADR (not yet enumerated as its own ADR-CANDIDATE) which embodies the same shape on `/api/lineage`.

**Co-surfaced gaps** (link from `refactoring-scopes.md`):
- REFACTOR-626 NEW (zero authorization gate on /api/relationships — the operator-actionable consequence of THIS ADR; whether to close the gate is the ADR's borderline_flag triage)
- REFACTOR-627 NEW (relationship_id path-param Category F drift — third-party API consumers get 404)
- REFACTOR-628 NEW (no UNIQUE constraint on relationships.data_entity_id — schema admits multi-row)
- REFACTOR-632 NEW (mapper silently defaults to GRAPH_RELATIONSHIP — corrupt-ingestion-admissible)
- DOC-GAP — `data-modelling/relationships.md` does NOT articulate the relationships-as-public-metadata stance OR the EXCLUDE_FROM_SEARCH asymmetry

**Proposed action**: Promote to `adrs/drafts/relationships-catalog-global-read.md` (new ADR). Document:
1. The decision: relationships are catalog-global read; no owner-scoping, no namespace-scoping, no EXCLUDE_FROM_SEARCH filter.
2. The parallel: lineage shares the same shape; both are graph-as-public-metadata surfaces.
3. The EXCLUDE_FROM_SEARCH asymmetry: relationships ignore the filter that `/api/dataentities` applies. The maintainer's stance is "graph topology is intentionally always visible."
4. The operator-facing implication: a multi-tenant deployment exposes cross-tenant graph topology; the underlying entity reads remain access-controlled, but graph EDGES are public.
5. The maintainer's choice between "preserve the catalog-global posture and DOC-disclose" (current stance reading) vs "add OWNERSHIP / EXCLUDE_FROM_SEARCH filters" (structural change closing the asymmetry).

**Severity rationale**: HIGH — load-bearing architectural decision affecting the entire P-02 Data Modelling pillar's read surface AND analogous to the lineage pillar. The EXCLUDE_FROM_SEARCH asymmetry is operator-visible and operator-actionable; the multi-tenant cross-tenant graph topology exposure is the canonical concrete consequence. Pairs with REFACTOR-626 (the operator-actionable closure of the gate).

**Coherence check** (LSN-018):
- STRENGTHENS: ADR-CANDIDATE-003 (GET-collaborative posture) — this is the catalog-graph-specific instance that EXTENDS the posture to ignore EXCLUDE_FROM_SEARCH.
- SUPERSEDES: none.
- CONFLICTS: none currently. (If the maintainer later resolves the borderline_flag toward "close the gate", this ADR becomes the SUPERSEDED record of the prior stance.)

---
