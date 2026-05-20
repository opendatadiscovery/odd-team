## REFACTOR-225 — `getMyObjectsWithUpstream` / `getMyObjectsWithDownstream` — owner-scoping is a single-point-of-failure at the anchor set (no JOIN-side defence-in-depth)

**Severity**: MEDIUM
**Category**: missing-defence-in-depth
**Surfaced by**:
- `getMyObjects.md:bugs_limitations_corner_cases[5]`
- `getMyObjects.md:security.known_security_gaps[2]`

**Description**: The lineage variants of `/my` (`getMyObjectsWithUpstream` / `getMyObjectsWithDownstream`) use a DIFFERENT code path from the base `/my`. They call `DataEntityRelationsServiceImpl.getDependentDataEntityOddrns(streamKind)` which: (a) fetches the user's owned data entities (anchor — owner-scoped), (b) traverses the lineage graph one hop (`lineageRepository.getLineageRelations(oddrns, LineageDepth.empty(), streamKind)`), (c) returns the reached oddrns FILTERED to exclude the originally-owned set (`Predicate.not(oddrns::contains)` at line 37). Then `repository.listByOddrns(oddrns, false, false, page, size)` returns those non-owned entities WITHOUT applying any owner filter at the SQL — the assumption is that the input oddrn set is already scoped correctly. **A regression in (a) — e.g. `fetchAssociatedOwner()` returning a wrong owner, or the WebFilter dropping the principal — leaks unscoped lineage neighbours.** The owner-scoping invariant is therefore SINGLE-POINT-OF-FAILURE at `DataEntityRelationsServiceImpl.java:26` for the lineage variants, vs. defended at the JOIN-side WHERE clause for the base `/my` path. Latent today: the code is correct; the gap is the missing defence-in-depth.

**Primary source citations**:
- `DataEntityRelationsServiceImpl.java:25-31` (the lineage anchor; owner-scope at the entry only)
- `DataEntityServiceImpl.java:219-225` (the post-listAssociated chain)
- `ReactiveDataEntityRepositoryImpl.java:listByOddrns` (no `ownership.owner_id` JOIN filter)
- contrast with `ReactiveDataEntityRepositoryImpl.java:526-527` (the base `/my` JOIN-side defence)

**Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-015 (Owner-scoped routes) documents the architecture but doesn't articulate the defence-in-depth requirement. The base `/my` path defends at the JOIN; the lineage variants defend only at the anchor — the asymmetry is undocumented.

**Proposed remedy**: Add a JOIN-side filter to `listByOddrns` when the consumer context is owner-scoped — OR add a service-layer assertion that the input oddrns are owner-scoped. The simpler remedy: pass an `Optional<OwnerId>` through the lineage-expansion path and apply the filter at the SQL. A regression test should: (a) mock `fetchAssociatedOwner()` to return a different owner, (b) assert the lineage variants emit empty Flux (or 403) rather than leaking neighbours.

**Severity rationale**: MEDIUM — latent vulnerability; the code is correct today but a future refactor that introduces a fallback owner-id (or that misorders the WebFilter chain) would surface the gap. The defence-in-depth principle says don't trust a single anchor when the consequence is cross-owner data exposure.

**Suggested backlog grouping**: SEC-NNN authorization-audit sprint. Pair with REFACTOR-217 (the path-mismatch on terms — both are "the rule fires correctly at one place; what defends if it doesn't?" failures).

## STRENGTHENS — Batch M (controller-method PRIMARY-SOURCE pinning for BOTH UPSTREAM + DOWNSTREAM siblings; ADR-CANDIDATE-117 NEW codifies the architecture)

**PRIMARY-SOURCE PINNED at controller-method granularity for both lineage variants.** Batch M brings two new controller-method sidecars (`getMyObjectsWithUpstream.md` + `getMyObjectsWithDownstream.md`) that surface this finding at the canonical primary-source layer — the controller-method bodies (4-line pass-through each) PLUS the architectural anchor at `DataEntityRelationsServiceImpl.java:25-39` (the anchor + derived-set pipeline) PLUS the repository-method PRIMARY-SOURCE at `ReactiveDataEntityRepositoryImpl.listByOddrns` (lines 228-253) where the absence of `OWNERSHIP` JOIN is verified by reading the SQL.

**Three-batch + service-layer triangulation stack**:

| Batch | Layer | Sidecar | Evidence |
|---|---|---|---|
| Batch G | Controller-method (base /my) | `getMyObjects.md` | Original finding — naming the lineage-variant SPOF risk |
| Batch H | Repository-SQL | `ReactiveDataEntityRepositoryImpl.md` + `ReactiveLineageRepositoryImpl.md` | SQL-side confirmation: no owner column on `lineage`; no JOIN at `listByOddrns`; the gap is structural (REFACTOR-237 SQL primary source) |
| Batch K | Service-layer | `AuthIdentityProviderImpl.md` | 15-callsite blast radius of `fetchAssociatedOwner()` — the anchor's load-bearing reach |
| **Batch M** | **Controller-method (lineage variants)** | **`getMyObjectsWithUpstream.md` + `getMyObjectsWithDownstream.md`** | **PRIMARY-SOURCE: both controller-methods + service-layer chain + repository-method confirmed; the architectural ANCHOR + DERIVED + EXCLUDE-ANCHOR + projection pipeline is now end-to-end traced** |

**New batch-M evidence**:

1. **`getMyObjectsWithUpstream.md:bugs_limitations_corner_cases.[0]`** (HIGH): "**REFACTOR-225 PRIMARY-SOURCE confirmation: anchor-set single-point-of-failure with NO JOIN-side defence-in-depth.** The owner-scoping invariant for `/my/upstream` (and its `/my/downstream` sibling) is enforced at **exactly one site**: `DataEntityRelationsServiceImpl.java:26` (`authIdentityProvider.fetchAssociatedOwner()`). A regression at this single call site — e.g. (a) a future refactor adding a fallback owner-id for DISABLED mode, (b) a misordered WebFilter dropping the SecurityContext and `fetchAssociatedOwner` defaulting to a global anchor, (c) a corrupted USER_OWNER_MAPPING row resolving to the wrong owner, (d) a `flatMap`-vs-`map` typo silently passing through to a hardcoded fallback — leaks the lineage neighbourhood of an unintended anchor to the caller. The downstream `listByOddrns` scan at `ReactiveDataEntityRepositoryImpl.java:228-253` has NO owner filter, so a wrong anchor produces a wrong (but well-formed) response with no SQL-layer trip-wire. Contrast: the base `/my` endpoint's repository method `listByOwner` (`ReactiveDataEntityRepositoryImpl.java:515-534`) JOINs against OWNERSHIP with `WHERE OWNERSHIP.OWNER_ID = ?` — a regression at `fetchAssociatedOwner` for that path would at worst leak entities the user genuinely co-owns with the wrong owner; here the leak is the entire upstream lineage of an arbitrary anchor."

2. **`getMyObjectsWithDownstream.md:bugs_limitations_corner_cases.[0]`** (MEDIUM): "**Owner-scoping is single-point-of-failure at `DataEntityRelationsServiceImpl.java:26` (REFACTOR-225 SYMMETRIC SIBLING).** The downstream-lineage variant inherits the full REFACTOR-225 latent vulnerability from `getMyObjectsWithUpstream`: the anchor `authIdentityProvider.fetchAssociatedOwner()` is the SOLE owner-defence. The recursive CTE inside `lineageRepository.getLineageRelations` has no owner JOIN, no owner predicate (per batch-H ReactiveLineageRepositoryImpl sidecar). The final projection via `listByOddrns(oddrns, false, false, page, size)` has no owner JOIN either (ReactiveDataEntityRepositoryImpl.java:228-253 - only DATA_ENTITY.ODDRN.in(oddrns) + soft-delete + hollow filters). A regression in `fetchAssociatedOwner()` ... silently leaks downstream-lineage neighbours of an unintended owner."

3. **Architectural refinement (per ADR-CANDIDATE-117 NEW)**: The anchor + derived-set + exclude-anchor pipeline at `DataEntityRelationsServiceImpl.java:25-39` is NOT a passive trust handoff — it is a positively-designed architectural pattern (ADR-CANDIDATE-117 NEW codifies it). The SPOF gap exists BECAUSE the architecture deliberately routes owner-scoping through the anchor-set computation; lifting the gap requires either (a) adding defence-in-depth at the `listByOddrns` SQL (cost: structural refactor across all consumers of `listByOddrns`); (b) introducing an `Optional<OwnerId>` parameter that owner-scoped callers populate (cost: new repository method or signature change); (c) adding service-layer assertion that the input oddrns map back to the resolved owner (cost: extra query per call). The ADR endorses the design; the REFACTOR is the price the design pays.

**Cross-link to other batch-M findings**:
- **REFACTOR-346 NEW** — in-memory derivation + anchor-set materialisation defeats SQL pagination on `/my/upstream` and `/my/downstream` (compounds REFACTOR-225's blast radius — for admin/CI-bot owners the anchor set is large, the lineage CTE fans out widely, and a regression in `fetchAssociatedOwner` returns a wrong-owner subgraph at high memory + DB cost).
- **REFACTOR-347 NEW** — `listByOddrns` pagination has no ORDER BY → unstable pagination on `/my/upstream` and `/my/downstream` (compounds with REFACTOR-225 because consecutive page reads under a wrong anchor produce overlapping/missing entries — silent data corruption from the consumer's perspective).
- **DOC-GAP-099 PRIMARY-SOURCE STRENGTHENED** (now 4-angle triangulated): batch G (`getMyObjects` sibling) + batch H (`ReactiveLineageRepositoryImpl` SQL primary source) + batch I (`LineageServiceImpl` NEGATIVE-CASE) + batch M (this — controller-method PRIMARY-SOURCE for both UPSTREAM and DOWNSTREAM at openapi.yaml:843-844 + 859-871). The OpenAPI summary inverts the actual semantic; multi-tenant operators reading the spec expect owner-scoped results, get cross-tenant downstream-lineage neighbours.

**Severity refinement**: HIGH-conditional. The HIGH severity applies in the latent-regression case (a future refactor introducing a fallback owner-id under DISABLED mode, or a misordered WebFilter, would convert the gap from "latent" to "active cross-owner exposure"). The MEDIUM severity stands today (the code is currently correct). The 4-angle triangulation makes the architectural commitment unambiguous: the gap is real, the trade-off is accepted by ADR-CANDIDATE-075's accept-the-risk clause and ADR-CANDIDATE-117's anchor + derived-set design. The maintainer's triage resolves: (i) add defence-in-depth (option (a)/(b)/(c) above); or (ii) document the SPOF as accepted-risk on the live security page and add boot-time validator (REFACTOR-073 cross-link) so any future regression in `fetchAssociatedOwner` fails at startup.

**Severity unchanged at the catalog level**: MEDIUM (latent vulnerability; today's code is correct).

---
