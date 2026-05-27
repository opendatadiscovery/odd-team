# SHB-048 — Lookup-Table permissions are globally-scoped (NO_CONTEXT), inconsistent with Term / Data Entity per-resource scoping — any user with LOOKUP_TABLE_UPDATE can mutate ANY lookup table

**Category**: merged
**Severity**: MEDIUM

## Hypothesis

The Lookup Tables RBAC promise (per the live docs page `features/master-data-management/lookup-tables`) is "9 permissions across three surfaces — table-level / definition-level / data-level — letting operators grant edit-the-data without grant-edit-the-schema." Operators reading this language reasonably infer per-table scoping — that granting `LOOKUP_TABLE_DATA_UPDATE` on the "Customer Tiers" lookup table permits editing rows in THAT table but not in the "Internal Codes" table. The implementation does NOT honour this: all 9 `SecurityRule` entries for the LOOKUP_TABLE_* permissions use the `NO_CONTEXT` AuthorizationManagerType — meaning the `lookup_table_id` in the URL path is NEVER used to scope the permission check to the specific table's owners. A user granted ANY `LOOKUP_TABLE_*` permission via ANY Policy can mutate EVERY lookup table in the platform. This is structurally different from how TERM and DATA_ENTITY permissions work in the same `SecurityConstants.SECURITY_RULES` table — both of which use entity-scoped resolvers (`TERM` and `DATA_ENTITY` AuthorizationManagerType) that bind the permission to the specific resource the URL targets.

## Evidence

- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/security/constants/SecurityConstants.java:114-115, 325-354` — all 9 `LOOKUP_TABLE_*` SecurityRule constructions pass `NO_CONTEXT` as the first argument. Verified by grep against the SECURITY_RULES list.
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/security/constants/SecurityConstants.java:174-193` — TERM permissions use `TERM` resolver — per-resource scope.
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/security/constants/SecurityConstants.java:194-227` — DATA_ENTITY permissions use `DATA_ENTITY` resolver — per-resource scope.
- `documentation/docs/features/master-data-management/lookup-tables` (per ReferenceDataController sidecar `inferred_docs[0]` fetched_excerpts 2026-05-20): "The split lets operators grant edit-the-data without grant-edit-the-schema (a typical pattern for steward-curated reference lists)." The doc-language IMPLIES per-table scoping by analogy to "steward-curated reference lists" — but never names the per-table claim, never disclaims the global-scope claim.
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/controller/ReferenceDataController.java:131-141` + `ReferenceDataServiceImpl.java:126-143` — the `updateLookupTableField` path-parameter `lookupTableId` is discarded; combined with NO_CONTEXT, an authorised caller can PATCH a column belonging to ANY table by spoofing the URL. (F-026 already records this as the "cross-table jump" — but the underlying ROOT CAUSE is NO_CONTEXT scoping, which generalises across all 9 LOOKUP_TABLE_* permissions, not just `updateLookupTableField`.)
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/dto/policy/PolicyPermissionDto.java:80-88` — the 9 `LOOKUP_TABLE_*` permission constants in the `MANAGEMENT` category. No `_READ` permission, no `_SCOPE` permission, no per-table claim shape.

## Notes

- This is an enricher for F-026 (Lookup Tables — partial RBAC, cross-table jump, XSS). F-026 captures the cross-table-jump symptom but treats the NO_CONTEXT design as implicit. This thread NAMES the root design (architecturally distinct from TERM / DATA_ENTITY scoping) and the doc-language drift (per-table promise vs global behaviour).
- The remediation universe:
  - **(a)** Add per-table scoping resolver (`LOOKUP_TABLE` AuthorizationManagerType) that reads `lookup_table_id` from the path and binds the permission to the table's owner(s). Requires modelling lookup-table-to-owner association, which doesn't exist today (lookup tables have a Namespace owner via the parent DataEntity but no direct owner). Most architecturally consistent.
  - **(b)** Add per-namespace scoping resolver (`NAMESPACE` AuthorizationManagerType) — lookup tables are scoped to a namespace at creation; permissions could be scoped to namespaces.
  - **(c)** Document the NO_CONTEXT promise faithfully: "granting any LOOKUP_TABLE_* permission permits mutation of all lookup tables in the platform; for per-table scoping use a Role with policies attached to individual datasets." (If even that is achievable today, which is unclear from the sidecar.)
- The drift is dangerous in multi-team deployments: Team A's data steward needs to update Team A's customer-tier mapping; granting them `LOOKUP_TABLE_DATA_UPDATE` ALSO permits them to mutate Team B's internal-codes lookup. Compliance / data-governance reviewer would object to this; the doc-implied per-resource scope is the standard expectation.
- This is `clustering` because F-026 already exists and the merge target is clear. The enrichment value: NAMING the root design (NO_CONTEXT vs DATA_ENTITY/TERM) is methodology-load-bearing — the ADR-shape decision lives at the SecurityRule registration layer, not at any individual endpoint.
- Cross-cuts pillar P-03 (MDM) and pillar P-09 (RBAC). F-006 (RBAC policy lifecycle) governs Policy mutation but does NOT discuss the per-resource scoping asymmetry across permission classes.

## Next

1. **Promote (enricher into F-026)**: the feature-flow-builder folds this into F-026 as a `drift_class: rbac_scope_asymmetry` block, citing the SecurityConstants line-evidence. The pattern (NO_CONTEXT vs DATA_ENTITY / TERM) becomes a methodology canonical case-law entry once 3 surfaces share it.
2. **Scan**: enumerate every SecurityRule in `SecurityConstants.java`, group by first-argument (NO_CONTEXT / TERM / DATA_ENTITY / etc), and tabulate which permissions are globally-scoped vs entity-scoped. Surface the LIST as a refactoring-scopes finding (REFACTOR-NNN — "RBAC scope asymmetry across SecurityRule resolver types").
3. **DOC-GAP**: the docs page must state "LOOKUP_TABLE_* permissions are global — granting any of them permits mutation across all lookup tables; per-table scoping is not currently supported." File DOC-NNN.
4. **Decide architectural direction**: per-table scoping requires modelling lookup-table-owner; that is a feature-design decision belonging in an ADR. Draft ADR-NNN — "Lookup Table RBAC scope — global vs per-table vs per-namespace." Cross-reference with the existing TERM / DATA_ENTITY scoping design as case-law.

## Links

- cluster_with: [F-026, F-006]
- merged_into: F-026
- supersedes: []

## evaluation

- **feature-flow-builder 2026-05-26**: merged into F-026 (P-03:F-001 Lookup Tables — Reference Data Management) — F-026's primary_drift_class IS `lookup_table_global_no_context_scoped_permissions_no_per_owner_scope` per the existing detail file, directly anchored on this finding. SHB-048 STRENGTHENS that existing facet with (a) the architectural-class framing (NO_CONTEXT vs DATA_ENTITY / TERM scoping in the same SECURITY_RULES table — pattern recognisable across permission classes), (b) the doc-language implication of per-table scoping ("steward-curated reference lists") that the runtime does NOT honour, (c) the multi-team deployment blast radius (Team A's data steward → mutates Team B's lookup tables). Methodology canonical-case-law candidate: NO_CONTEXT vs entity-scoped resolver asymmetry across SecurityRules — noted for the next adversarial-panel review.
