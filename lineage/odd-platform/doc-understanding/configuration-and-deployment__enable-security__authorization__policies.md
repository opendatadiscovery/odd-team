---
doc_page: "docs/configuration-and-deployment/enable-security/authorization/policies.md"
page_title: "Policies"
live_url: "https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization/policies"
live_url_verified_status: "200"
live_url_resolved_slug: "configuration-and-deployment/enable-security/authorization/policies"
live_verified_at: "2026-05-29"
analysed_at_commit: "30795b4"
prompt_version: "doc-analyser/0.1.0"
confidence_overall: HIGH
describes:
  concepts:
    - "Policy (Authorization)"
    - "Permission (Authorization)"
    - "Role (Authorization)"
  features: []
  code_nodes:
    - "invariant:authorization-hot-path-getcurrentuserroles-per-request-no-cache"
    - "operation:resolve-current-user-policies-authorization-hot-path"
    - "invariant:title-directory-no-normalisation-silent-policy-leak"
    - "operation:title-directory-auto-create-on-miss-via-getorcreate"
audience: [operator]
doc_claim_vs_code:
  - "Page's Title-caveat mitigation (line 306) recommends the policy condition `{ \"in\": { \"dataEntity:owner:title\": [...] } }`, but `in` is NOT a valid condition operator: the schema defines exactly `all | any | eq | not_eq | match | not_match | is | not_is` and each condition object is `\"additionalProperties\": false` — an `in` key is rejected by JSON Schema. The page's own 'Condition operators' list (lines 67-76) also omits `in`, so the mitigation contradicts the same page. Worse, per ADR-CANDIDATE-053 + REFACTOR-618 the validation failure surfaces as HTTP 500 (opaque 'Internal Server Error'), not a clear 400. An operator following the caveat authors a policy the platform rejects. Evidence: odd-platform-api/src/main/resources/schema/policy_schema.json:276-345 (data_entity condition operators + anyOf), :274 (additionalProperties:false); node operation:resolve-current-user-policies-authorization-hot-path / invariant:policy-jsonvalidator-illegalargumentexception-surfaces-as-500; PolicyServiceImpl.java:64 (validator invoked before persistence)."
  - "Page lists Permission groups for DATA_ENTITY / TERM / MANAGEMENT / QUERY_EXAMPLE (4 resource types) and the Permission concept node confirms the code's `PermissionResourceType` enum exposes exactly those FOUR contextual values — consistent. BUT the live Permissions catalog the page links to (permissions.md) carries FIVE categories (adds a Lookup-table group) per concept entitie:permission-authorization; the policies page itself never names a LOOKUP_TABLE resource type, which is correct (lookup-table permissions ride the DATA_ENTITY resource type). Recorded as a consistency note, not a contradiction: no false resource type is asserted on this page. Evidence: concepts.yaml entitie:permission-authorization."
maintainer_curated: false
---

# Policies — doc understanding

This page is the operator reference for ODD Platform's RBAC **Policy** document: the JSON `statements` shape, the four resource `type`s (`DATA_ENTITY | TERM | MANAGEMENT | QUERY_EXAMPLE`), the eight condition operators (`all/any/eq/not_eq/match/not_match/is/not_is`), the per-resource condition fields, and worked policy examples. It maps directly onto the **Policy (Authorization)** concept (`concepts.yaml` line 1959) — a named JSON document validated server-side against `schema/policy_schema.json` (V201909) at every create+update, inert until bound to a **Role (Authorization)** and granting **Permission (Authorization)** values. The condition-operator and resource-type vocabularies are grounded verbatim in `odd-platform-api/src/main/resources/schema/policy_schema.json` (operators at :276-345; resource-type `const`s at :64/:101/:137/:174).

Two author-added sections carry the operator-critical content. The **Title vocabulary caveat** maps onto `invariant:title-directory-no-normalisation-silent-policy-leak` and `operation:title-directory-auto-create-on-miss-via-getorcreate` — confirmed: `title.name varchar(128)` has no `@Pattern`/`@Size`/case-fold/dedup (`V0_0_3__add_ownership.sql:4`), and `TitleServiceImpl.getOrCreate` inserts the raw string verbatim (`TitleServiceImpl.java:19-22`), so casing variants accumulate as distinct rows and a `:owner:title` condition silently misses non-matching casings (source thread SHB-088; resolves DOC-GAP-289). The **Performance characteristics** section maps onto `invariant:authorization-hot-path-getcurrentuserroles-per-request-no-cache` and `operation:resolve-current-user-policies-authorization-hot-path` — confirmed: `PolicyServiceImpl.getCurrentUserPolicies` (`PolicyServiceImpl.java:102-107`) runs uncached on every authorized request, issuing the 5-table user→role JOIN (`ReactiveUserOwnerMappingRepositoryImpl.java:99-114`) plus the 2-table role→policy JOIN (`ReactivePolicyRepositoryImpl.java:32-35`), matching the page's "two JOIN roundtrips per request, not cached" claim (already tracked as DOC-GAP-197).

The one substantive drift (see `doc_claim_vs_code`) is self-inflicted: the Title-caveat's `{ "in": {...} }` mitigation uses an operator the schema does not accept, so following the page's own remediation produces a policy the platform rejects with an opaque HTTP 500.

## Maintainer notes
