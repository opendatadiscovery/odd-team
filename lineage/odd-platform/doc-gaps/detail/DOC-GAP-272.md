---
doc_gap_id: DOC-GAP-272
severity: MEDIUM
category: drift
batch: ZC
generated_at: "2026-05-25T00:00:00Z"
generated_at_commit: ede5d277
prompt_version: "doc-gap-finder/0.1.0"
maintainer_curated: false
related_pillar_features:
  - "P-04:F-002"
related_features:
  - F-022
related_doc_gaps:
  - DOC-GAP-264   # Title filter LSN-020 — sibling filter-dimension binding drift
  - DOC-GAP-271   # de* prefix + spec descriptions — adjacent OpenAPI-side surface
---

## DOC-GAP-272 — Quality Dashboard "Namespace" filter SQL widening is undocumented — the live `/features/data-quality/dashboard` page lists "Namespace" as one of the five filter dimensions but never warns that the SQL match is `NAMESPACE.ID.in(namespaceIds).and(NAMESPACE.ID.eq(DATA_ENTITY.NAMESPACE_ID).or(NAMESPACE.ID.eq(DATA_SOURCE.NAMESPACE_ID)))` — i.e. selecting namespace X matches BOTH entities directly assigned to X AND entities whose datasource is in X; the result set is WIDER than "entities in namespace X" implies, and the doc-side silence means an operator doing a tenant-scoped quality check (counting tables in their tenant's namespace) will silently include cross-tenant tables that happen to live in a datasource registered in that namespace

**Severity**: MEDIUM
**Category**: drift (Category-F TRANSLATES_SILENTLY input-name-vs-implementation; the name "Namespace" implies entity's namespace, the implementation widens to datasource-inherited namespaces)

### Surfaced by

- `odd-platform__ts__react-component__component__DataQualityFilters.md:docs_link_semantic.doc_drift_findings.[1]` (MEDIUM per sidecar — *"DOC DRIFT — the Namespace filter's datasource-inheritance widening is undocumented. The `dashboard` page does not state that the Namespace filter also matches datasource-level namespaces. The SQL joins `NAMESPACE.ID.in(namespaceIds)` against `DATA_ENTITY.NAMESPACE_ID` **OR `DATA_SOURCE.NAMESPACE_ID`** (`ReactiveDataQualityRunsRepositoryImpl.java:288-293`). A namespace selected in the filter therefore matches both entities directly assigned to it and entities whose datasource carries it — a wider result set than 'Namespace' alone implies."*)
- `odd-platform__ts__react-component__component__DataQualityFilters.md:stress_findings.request_inputs[Namespace filter]` — Category-F drift classification `DRIFT_INPUT_NAME_VS_IMPLEMENTATION`; the routes_to_finding field points to `docs_link_semantic.doc_drift_findings[1]`. Verbatim from the Q3-vs-Q4 trace: *"TRANSLATES_SILENTLY — the SQL matches the entity's OWN namespace OR its DATASOURCE's namespace. 'Namespace' implies the entity's namespace; the OR-clause silently widens the match to datasource-inherited namespaces. The dashboard doc does not disclose this widening."* + *"An operator filtering by namespace X sees MORE entities than expected: every entity whose datasource is in namespace X is included even if the entity itself has no namespace or a different one. Result counts in the rings are wider than 'entities in namespace X'."*
- `odd-platform__ts__react-component__component__DataQualityFilters.md:bugs_limitations_corner_cases` — implicitly anchored via the SQL-trace evidence pattern shared with the Title-filter LSN-020 finding (DOC-GAP-264 sibling)

### Evidence

- WebFetch `https://docs.opendatadiscovery.org/features/data-quality/dashboard` 2026-05-25 status **200** (DIRECT FETCH this session) — the page lists the five filter dimensions verbatim *"Namespace, Datasource, Owner, Title, and Tag"* but does NOT mention datasource-namespace inheritance, OR-widening, or any caveat about the Namespace filter's match semantics. Q8 confirmed *"'Title' Filter Operation: No description provided. The 'Title' dimension is listed among available filters but receives no explanation of how it operates or what it filters."* — the same broader pattern (no per-dimension explanation) applies to Namespace.
- `odd-platform-api/src/main/java/.../repository/reactive/ReactiveDataQualityRunsRepositoryImpl.java:288-293` — verbatim SQL bind: `NAMESPACE.ID.in(namespaceIds).and(NAMESPACE.ID.eq(DATA_ENTITY.NAMESPACE_ID).or(NAMESPACE.ID.eq(DATA_SOURCE.NAMESPACE_ID)))` (per sidecar's stress_findings.request_inputs[Namespace filter])
- `odd-platform-ui/src/components/DataQuality/DataQualityFilters/FilterItem/NamespaceFilter.tsx:29` — UI label is bare `t('Namespace')` (no qualifier like "Entity Namespace" or "Namespace (incl. datasource)")
- `odd-platform-ui/src/components/DataQuality/DataQualityFilters/DataQualityFilters.tsx:70, 85` — both panels (tables-side and tests-side) instantiate `NamespaceFilter` with the same widening behaviour, so the drift applies across both filter sets

### Drift narrative

The Namespace filter is the canonical "filter by this dimension" affordance an operator reaches for first. The name carries a strong implicit promise: "narrow to entities whose namespace equals my selection". The implementation honours that promise PLUS a second one the operator didn't ask for — "...OR whose datasource is in my selected namespace".

Concrete operator scenario: a multi-tenant ODD deployment uses namespaces to scope tenants. Tenant A's data team curates their tables under namespace `tenant-a`; Tenant B's data team uses namespace `tenant-b`. The platform's catalog also has a few shared datasources (e.g. a centrally-managed Snowflake instance) registered under a shared namespace `shared`. Some tables physically live in the shared Snowflake datasource but have been explicitly assigned (via the UI's namespace-edit affordance) to `tenant-a` or `tenant-b`.

Now Tenant A's lead opens `/data-quality`, selects namespace `tenant-a` in the filter, and expects to see Tenant A's quality posture. What they see instead is:

- All tables directly assigned to `tenant-a` (correct — what they expected).
- PLUS all tables whose datasource is registered under `tenant-a` (correct if Tenant A's datasource is in `tenant-a` — also expected).
- PLUS (under the widening) all tables that are assigned to `tenant-b` BUT whose datasource is registered under `tenant-a` (NOT expected — these are cross-tenant inclusions).

The widening makes the dashboard count tables outside the operator's intended scope, silently. The operator's quality posture for "Tenant A's tables" is over-counted by the cross-tenant inclusions, and they have no doc-side signal that the filter widens.

The opposite direction also bites: a table directly assigned to `tenant-a` whose datasource is in `tenant-b` would NOT be matched by selecting `tenant-b` (because the entity's namespace is `tenant-a`, not `tenant-b`) — but the operator could reasonably expect "select tenant-b → see everything in the tenant-b datasource". The widening is asymmetric: it widens the entity-namespace match with datasource-namespace, but doesn't widen the other way. Without doc-side framing, the operator can't predict either direction.

### Proposed doc action

**Single-part action — extend the "Filter dimensions reference" sub-section (proposed in DOC-GAP-264) with a Namespace caveat**.

`documentation/docs/features/data-quality/dashboard.md` — in the "Filter dimensions reference" sub-section, the Namespace entry (which DOC-GAP-264's proposed action sketches) should be expanded:

> **Namespace** — narrows the dashboard to entities whose namespace OR whose datasource's namespace matches the selection. The match is inclusive in one direction: selecting namespace X matches (a) entities directly assigned to namespace X, AND (b) entities whose datasource is registered in namespace X — even if the entity itself is assigned to a different namespace. The match is NOT inclusive in the reverse direction: selecting namespace Y does NOT match an entity directly in Y if that entity's datasource is in a different namespace.
>
> **For multi-tenant deployments**: the OR-widening means a tenant-scoped Namespace filter may include cross-tenant tables that happen to live in a datasource registered in the selected tenant's namespace. If you need strict entity-namespace filtering, narrow further by Datasource.

Companion: the OpenAPI spec `description:` field on `namespaceIds` / `deNamespaceIds` (per DOC-GAP-271) should carry the same caveat for API consumers who don't read the dashboard doc.

### Cross-references

- **DOC-GAP-264** (Title filter LSN-020 binding) — same surface, same per-filter description gap, sibling finding. The maintainer's "Filter dimensions reference" sub-section addresses both in one authoring pass.
- **DOC-GAP-271** (`getDataQualityTestsRuns` 10-parameter no-description spec) — adjacent surface (OpenAPI spec). The widening caveat needs to appear on BOTH the dashboard doc page (this finding) AND the spec parameter description (DOC-GAP-271).
- **Rule 6 coherence** — cross-registry sweep ran: concepts.yaml `entities[Namespace]` and feature-flows references — all SAME-POLARITY (no other registry asserts a strict entity-namespace match). No CONTRADICTS, no SUPERSEDES.

### Severity rationale

MEDIUM. The widening is a real input-name-vs-implementation drift that affects operator-visible counts in a load-bearing scenario (multi-tenant tenant-scoped quality reads). The operator-impact is over-counting (a false-positive cross-tenant inclusion) rather than under-counting / data loss, hence MEDIUM not HIGH. The fix is two paragraphs (dashboard.md + spec description) — bounded and cheap.

### Last verified

- 2026-05-25 — WebFetch dashboard page status 200; the page is still silent on the Namespace filter's match semantics; SQL bind `ReactiveDataQualityRunsRepositoryImpl.java:288-293` re-confirmed at substrate commit `ede5d277`.
