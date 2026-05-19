## REFACTOR-237 — Owner-scoping in lineage is anchor-set single-point-of-failure (no JOIN-side defence-in-depth at lineage CTE); SQL-layer confirmation that STRENGTHENS REFACTOR-225

**Severity**: MEDIUM
**Category**: missing-defence-in-depth (authorization)
**Surfaced by**:
- `ReactiveLineageRepositoryImpl.md:bugs_limitations_corner_cases[2]`
- `ReactiveLineageRepositoryImpl.md:security.known_security_gaps[0]`
- `ReactiveLineageRepositoryImpl.md:security.owner_scoping` (the "BYPASSES" finding explicitly named)

**Description**: This finding is the SQL primary-source confirmation of the previously-recorded REFACTOR-225 (anchor-set defence-in-depth gap on the lineage variants of `/my`). The repository-level evidence is more conclusive than the controller-method evidence: the lineage table itself has **no owner column**, so JOIN-side filtering is structurally impossible without a JOIN to data_entity → ownership.

The schema evidence (cross-referenced from primary sources):
1. **`V0_0_2__add_lineage.sql:1-7`** — original lineage table (parent_oddrn, child_oddrn). NO owner column.
2. **`V0_0_17__add_establisher_into_lineage.sql:1-2`** — adds establisher_oddrn. NO owner column.
3. **`V0_0_79__data_deprecation.sql:11-12`** — adds is_deleted boolean. NO owner column.

The CTE evidence (`ReactiveLineageRepositoryImpl.java:163-175`):
- Seed: selects edges touching the root oddrn set in the chosen direction at depth=1.
- Recursive step: JOINs cte on direction-appropriate equality, depth+1, `tDepth < lineageDepth` AND `is_deleted = false`.
- **No owner predicate at either step.**

The two call patterns and their defences:
1. **Lineage canvas read** — `LineageServiceImpl.getLineage` (lines 95-99) passes a single root oddrn with no owner filter. NO owner-scoping at any layer; this is the REFACTOR-203 cross-owner enumeration vector (already named).
2. **Owner-scoped subgraph enumeration** — `DataEntityRelationsServiceImpl.getDependentOddrns` (line 34) resolves the owner via `authIdentityProvider.fetchAssociatedOwner()` (line 26) and passes the owner's entity-oddrn set as the anchor. The CTE expansion then walks edges with NO further owner filter; the anchor-set IS the defence.

The single-point-of-failure on path (2): if `fetchAssociatedOwner()` ever returns an unintended owner id (a regression in the WebFilter chain, a future refactor that introduces fallback owner IDs, a deserialisation bug that silently swaps the principal), the lineage CTE will expand from THAT owner's set without redundant filtering. There is no "this CTE result must JOIN ownership on owner_id = (caller's owner)" backstop.

REFACTOR-225 named the defence-in-depth gap at the controller-method layer. This finding (NEW 2026-05-19) confirms at the SQL primary source: **adding the defence would require schema work** (either a denormalised owner column on lineage, kept in sync via trigger, or a service-layer JOIN to data_entity → ownership on every CTE result row). Neither is a one-line fix; both are structural changes. The architectural anchor-set pattern (ADR-CANDIDATE-015) IS the architecture; the gap is the absence of in-depth defence within that architecture.

**Primary source citations**:
- `ReactiveLineageRepositoryImpl.java:122-176` — the full CTE (no owner predicate)
- `V0_0_2__add_lineage.sql:1-7` — original schema (no owner column)
- `V0_0_17__add_establisher_into_lineage.sql:1-2` — establisher addition (no owner column)
- `V0_0_79__data_deprecation.sql:11-12` — is_deleted addition (no owner column)
- `DataEntityRelationsServiceImpl.java:25-39` — the caller's anchor-set computation (the defence point)
- `DataEntityRelationsServiceImpl.java:26` — the `fetchAssociatedOwner()` call (the single-point-of-failure)
- `LineageServiceImpl.java:87-122` — the lineage canvas path (negative case — no owner scoping anywhere)
- cross-batch: REFACTOR-225 (the controller-method layer finding), REFACTOR-203 (the lineage canvas cross-owner enumeration), ADR-CANDIDATE-015 (the owner-scoped-routes ADR)

**Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-015 (Owner-scoped routes) documents the anchor-set architecture. The defence-in-depth requirement IS NOT articulated in the ADR — the ADR's stance is "owner-scoping at the service via authIdentityProvider; the repository accepts the resolved owner-id list and trusts it." The gap surfaces here as a refactoring within that architecture: either extend the ADR to add a defence-in-depth requirement (and then implement it with the schema/JOIN work) OR document the single-point-of-failure as accepted risk on the live security page.

**Proposed remedy**: Two-path; the maintainer chooses based on the trust calculus:
1. **Add JOIN-side defence-in-depth** (preferred — structural fix): for owner-scoped consumers (`DataEntityRelationsServiceImpl.getDependentOddrns`), pass the `ownerId` into the lineage repository AND filter every CTE result row through a JOIN to data_entity → ownership matching the same `ownerId`. The cost: one extra JOIN per lineage read on the owner-scoped path. The benefit: defence-in-depth — even if the anchor-set computation is compromised, the JOIN strips cross-owner rows at the SQL layer.
2. **DOC-ALIGN-ONLY** (cheaper — accept the gap): update the live `/configuration-and-deployment/enable-security/authorization` page to explicitly call out the anchor-set single-point-of-failure: "The lineage-traversal authorization is computed once at the request boundary via `authIdentityProvider.fetchAssociatedOwner()`; the recursive CTE relies on the anchor set being correctly owner-scoped. Any regression in the WebFilter chain (e.g. a principal misresolution) would propagate to the lineage results without an SQL-layer defence."

Option (1) is strictly preferable for a security-architecture-aware project; option (2) is acceptable for an early-stage project that's still elaborating its authorization model. ODD's current security posture (DISABLED-default per REFACTOR-068) suggests the project is early-stage; the maintainer's triage should consider whether security-architecture investment fits the current roadmap.

**Severity rationale**: MEDIUM — latent vulnerability. The anchor-set is correctly resolved today, so no live exploit. The gap is the missing defence-in-depth: a single bug in the principal-resolution path leaks cross-owner lineage rows. Compounds with REFACTOR-073 (no boot-time security-posture validator — no signal at startup whether the anchor-set defence is correctly wired).

**Suggested backlog grouping**: `Authorization audit batch` — couple with REFACTOR-225 (the controller-method layer naming), REFACTOR-203 (the lineage canvas cross-owner enumeration), REFACTOR-073 (boot-time validator). All four together describe the lineage authorization surface.

---
