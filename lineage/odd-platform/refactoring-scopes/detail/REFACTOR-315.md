## REFACTOR-315 — Cross-namespace term pollution / no per-tenant scoping — neither TermServiceImpl nor ReactiveTermRepositoryImpl references `odd.tenant-id` or any namespace-tenant boundary; descriptions in team-A's namespace silently auto-link to team-B's terms

**Severity**: MEDIUM
**Category**: missing-validation (cross-tenant scoping absence)
**Pillars affected**: [P-06-data-glossary, P-09-security-access-control]
**Batch**: K (2026-05-19)

**Surfaced by**:
- `odd-platform__java__service__service__TermServiceImpl.md:bugs_limitations_corner_cases.[3]` (MEDIUM) — "Cross-namespace term pollution / no per-tenant scoping. Neither `TermServiceImpl` nor `ReactiveTermRepositoryImpl` references `odd.tenant-id` or any tenant scoping. `getByNameAndNamespace(List<TermBaseInfoDto>)` (`ReactiveTermRepositoryImpl.java:162-179`) joins `term` and `namespace` with NO tenant filter. In any deployment where multiple teams share a single platform instance, a description in team-A's namespace that references `[[team-B-ns:term]]` will silently auto-link to team-B's term. There is no concept-level isolation between namespaces in this code path."

**Description**: The Glossary Term auto-link side-channel (per ADR-CANDIDATE-110 — unhandled-mention staging with auto-resolution) parses `[[ns:term]]` from any description and looks up the matching `(namespace, name)` pair across ALL namespaces. There is no namespace-allowlist per caller, no tenant boundary, no team-scoping. The maintainer's intent (ADR-CANDIDATE-107 — term natural key case-insensitive ACROSS the catalog) is uniform global identity — Term is a CATALOG-WIDE concept, not a per-team one. The consequence: any operator authoring a description can reference any namespace's term by spelling its `(ns, name)` pair correctly.

**Failure mode**: An operator on team-A writes a description on team-A's data entity: "This dataset implements [[finance:Customer]]" expecting the Customer term to be team-A's. The "finance" namespace is owned by team-B; team-A's namespace is "marketing". The auto-link resolution finds team-B's `(finance, Customer)` term and creates an `is_description_link=TRUE` row from team-A's data entity to team-B's term. The reverse relationship — "who references team-B's Customer term" — now includes team-A's data entity, surprising team-B and creating a cross-team coupling that no one explicitly authored.

**Primary source citations**:
- `ReactiveTermRepositoryImpl.java:162-179` (`getByNameAndNamespace(List)` — no tenant filter; OR-chained predicate across all namespaces)
- `TermServiceImpl.java:350-359` (the batch-call site)
- `system-mission.md:371-383` ("Multi-Tenant Metrics Storage (`odd.tenant-id`)" canonicalisation candidate — confirms `odd.tenant-id` is a metrics-storage isolation knob, NOT a data-isolation knob)

**Existing-ADR-or-implied-prescription**: The platform's read-collaborative posture (per `system-mission.md:267`) IS the architectural intent for cross-team data access — every authenticated user can enumerate the entire catalog. The ADR-implied prescription is that namespaces are an ORGANISING dimension, not a TENANCY dimension. The IMPLIED prescription for operators wanting tenant isolation is to deploy separate platform instances; the absence of intra-platform tenancy is a deliberate posture, not a defect.

However, the cross-namespace AUTO-LINK behaviour is a SPECIFIC manifestation that goes beyond read-collaborative: it CREATES persistent links across namespace boundaries without operator intent. Operators expecting "namespaces are loose organisation, but I won't accidentally cross-link" discover otherwise.

**Proposed remedy**: Three options. (a) **Operator-doc fix**: update the live `data-glossary/business-glossary` page to explicitly state that `[[ns:term]]` mentions resolve catalog-wide; operators wanting team-isolation must use unique namespace names that the other teams won't accidentally type. Doc-aligns the actual behaviour. (b) **Service-fix**: add a `namespace_visibility` flag on the Namespace entity — operators can mark a namespace "private" and exclude it from cross-namespace auto-link resolution. Smaller blast-radius than tenant isolation; preserves the per-namespace organisation pattern. (c) **Per-tenant scoping**: introduce `odd.tenant-id` semantics into the Term repository — namespaces are scoped to tenants; auto-link resolution honours tenant boundaries. This is the largest structural change; aligns with the "Multi-Tenant" canonicalisation candidate in system-mission.

**Severity rationale**: MEDIUM — read-collaborative posture acknowledged, but the auto-link side-channel produces persistent links that no one explicitly authored; the gap is the absence of operator-visible namespace-boundary signalling.

**Suggested backlog grouping**: `Data Glossary hardening sprint` + companion DOC-NNN on the live Business Glossary page

---
