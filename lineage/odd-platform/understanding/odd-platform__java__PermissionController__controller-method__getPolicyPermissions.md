---
node_id: "odd-platform java PermissionController controller-method:getPolicyPermissions"
node_kind: controller-method
axis: controllers
extracted_at_commit: ede5d277
enriched_at_commit: ede5d277
extractor_version: 0.1.0
prompt_version: file-analyser/0.2.0
enrichment_status: phantom-node
confidence_overall: HIGH
session_id: session-2026-05-20-P
---

# PermissionController#getPolicyPermissions — PHANTOM NODE

## understanding

`getPolicyPermissions` is a **phantom node** — a synthesized substrate candidate that does NOT exist as a method on `PermissionController.java`. The actual controller exposes exactly ONE method (`getResourcePermissions` at `PermissionController.java:20-25`), already enriched in the sibling sidecar `odd-platform__java__PermissionController__controller-method__getResourcePermissions.md`. The phantom-node hypothesis was that ODD Platform exposes a "list-permissions-available-for-policy-authoring" endpoint distinct from the per-resource current-user-permissions endpoint. Primary-source verification confirms NO such endpoint exists at any controller layer: `Permission` (the enum delivered to clients) is statically embedded in `components.yaml:158-235` (75 values) and additionally surfaced as part of the JSON-Schema document returned by the SEPARATE endpoint `GET /api/policies/schema` (`PolicyController.getPolicySchema` at `PolicyController.java:60-63` → `PolicyServiceImpl.getPolicySchema` at `PolicyServiceImpl.java:97-100` → static `POLICY_SCHEMA` field at line 28, loaded once at boot from `policy_schema.json`). The substrate's enumeration walker produced this candidate based on the synthetic-node hypothesis declared in `state/sprint-themes.yaml:210-212` ("Permission catalogue read. RBAC observability."); the hypothesis is unfounded for `PermissionController`. The catalogue-read pattern is REAL — it is just located on `PolicyController.getPolicySchema`, not on `PermissionController`.

## concepts

- entities: [
    "Permission (OpenAPI-generated enum, statically defined in `components.yaml:158-235` — 75 enum values; the canonical client-facing catalogue)",
    "PolicySchema (JSON-Schema document, statically loaded from `policy_schema.json` at boot — embeds the same permission enum partitioned by resource type)",
    "PolicyPermissionDto (Java enum, the server-side authoritative permission catalogue — synced 1-1 with `Permission` via name equality at the `Permission.fromValue(p.name())` seam)"
  ]
- operations: ["catalogue-deliver-via-schema (the only catalogue-read surface — bundled inside the schema response on `GET /api/policies/schema`)"]
- invariants: [
    "There is NO endpoint named `getPolicyPermissions` on `PermissionController`, `PolicyController`, or any other controller (verified by Grep over `<odd-platform-repo>` returning zero matches across all source paths)",
    "The `Permission` enum is statically defined in the OpenAPI spec and code-generated at build time — clients receive the catalogue at compile time, not via a runtime endpoint (`components.yaml:158-235`)",
    "The runtime-derived catalogue surface is `PolicyController.getPolicySchema → /api/policies/schema` which returns the embedded JSON-Schema document including all permission constants partitioned by resource type (`policy_schema.json:1-100+`)"
  ]
- audiences: ["No direct audience — the phantom node has no implementation, no consumers, no endpoint. The legitimate catalogue-read consumers (the React UI's PolicyDetails component) consume `getPolicySchema` instead — `odd-platform-ui/src/components/Management/PolicyList/PolicyDetails/PolicyDetails.tsx:34, 70`"]

## dependencies_semantic

- requires-feature: [] — N/A. Phantom node; no dependencies because no code.
- requires-config: [] — N/A.
- requires-runtime: [] — N/A.
- couples-to: [
    "(none) — the node has no implementation; the substrate's synthetic enumeration produced this candidate without verifying file content. The legitimate sibling `getResourcePermissions` is already enriched as a separate sidecar; the legitimate sibling `getPolicySchema` lives on `PolicyController`, not `PermissionController`."
  ]

## tests_coverage_semantic

- covered_behaviours: [] — N/A.
- uncovered_behaviours: [] — N/A (no behaviour to cover; phantom).
- test_files: [] — N/A.
- gaps: |
    N/A — phantom node. The substrate-quality finding here is that the synthesis walker produced an HTTP-shape that does not exist; this is recorded in the `bugs_limitations_corner_cases` section as a substrate-quality finding for the substrate maintainer's reducer, not as a test gap on the platform.

## docs_link_semantic

- declared_docs: [] — N/A. Source file `PermissionController.java` carries no `@docs` annotation; no method declared.
- inferred_docs: [] — N/A. The phantom node has no doc surface; the sibling `getResourcePermissions` sidecar already enumerates the three relevant live pages (`/authorization`, `/authorization/permissions`, `/authorization/policies`) with WebFetched evidence and drift findings; nothing new to add at this node.
- doc_drift_findings:
  - "The synthetic-node rationale recorded in `state/sprint-themes.yaml:210-212` ('Permission catalogue read. RBAC observability.') describes a behaviour that does not exist as a discrete endpoint. The platform's permission-catalogue surface IS `GET /api/policies/schema` (operationId `getPolicySchema`, `openapi.yaml:3586-3599`) — a JSON-Schema document with embedded enum partitioning, NOT a flat `List<Permission>` returned by a `getPolicyPermissions` operation. Any future doc page describing 'how to discover available permissions for policy authoring' should anchor to `getPolicySchema`, NOT to a phantom `getPolicyPermissions`. The substrate-level synthesis hypothesis is a useful operator question (operators DO need to know how to discover the permission catalogue), but the resolution path runs through `PolicyController`, not `PermissionController`. Severity: LOW (doc-product impact bounded; mainly a substrate-quality finding for the next walker iteration)."

## implicit_adrs

- "The platform's permission catalogue is COMPILE-TIME-STATIC for clients, not RUNTIME-QUERYABLE — the canonical client-facing catalogue surface is the OpenAPI-generated `Permission` enum (statically defined in `components.yaml:158-235`, code-generated for every API client at build time). The runtime surface `GET /api/policies/schema` exists to deliver the JSON-Schema document for client-side policy-form VALIDATION, not for catalogue DISCOVERY (the same enum is reachable both ways; the schema additionally encodes the resource-type-to-permission-subset partitioning). The decision is to deliberately NOT expose a `getPolicyPermissions` endpoint because the catalogue is part of the API contract surface, not the data surface — adding/removing a permission constant is a breaking spec change managed via OpenAPI versioning. This is structurally visible: the `Permission` enum lives in `components.yaml` (the canonical schema document) and is code-generated alongside every other contract type; no runtime endpoint exposes the same data because it would be a duplicate surface susceptible to drift." — evidence: `components.yaml:158-235` (the canonical enum definition) + `openapi.yaml:3586-3599` (the only catalogue-adjacent endpoint, returning the schema) + `PolicyServiceImpl.java:28, 37-45, 97-100` (the static `POLICY_SCHEMA` load-once-at-boot pattern) + `PermissionController.java:14-26` (no catalogue-enumeration method) + UI confirmation that the React app consumes `getPolicySchema` for catalogue-driven UI rendering (`PolicyDetails.tsx:34, 70`) — intent_anchor: "`private static final String POLICY_SCHEMA = loadPolicySchema();`" (`PolicyServiceImpl.java:28` — the load-once-at-boot pattern signals 'this is a static document, not a queried resource') — confidence: HIGH

## bugs_limitations_corner_cases

- "SUBSTRATE-QUALITY FINDING: the synthetic-node walker produced `getPolicyPermissions` as a candidate node-id without verifying that the method exists in the source file. `PermissionController.java:14-26` contains exactly one method (`getResourcePermissions`); the entire file is 27 lines including imports. A pre-emission existence check ('does the named method appear in the source file?') would have caught this. The synthetic-node entry in `state/sprint-themes.yaml:210-212` provides only a `rationale` field ('Permission catalogue read. RBAC observability.') — there is no method-existence assertion. The walker should be amended to either (a) match synthetic-node ids against the file's actual method list before emitting them as enrichment candidates, or (b) annotate synthetic-node entries with a `provenance: synthesis-from-rationale` field so file-analyser invocations know to either return early with an explicit phantom-node sidecar (this approach) or escalate to a substrate-team review. The cost of the miss is small (one phantom sidecar) but the pattern recurring at scale would inflate the enrichment backlog with non-existent nodes. Severity: MEDIUM (substrate quality, not platform quality)." — evidence: `PermissionController.java:1-27` (the entire file, with the single method `getResourcePermissions` at lines 20-25) + `state/sprint-themes.yaml:210-212` (synthetic-node entry rationale) + Grep `getPolicyPermissions` over `<odd-platform-repo>` returns ZERO matches (verified session 2026-05-20) + Grep `policyPermissions` over `<odd-platform-repo>` returns ONLY UI/SQL references unrelated to a controller method (verified session 2026-05-20) — severity: MEDIUM
- "OPERATOR-FACING FINDING (preserved across the phantom finding): a real operator question — 'how do I list all permissions I could grant in a policy I'm authoring?' — has NO direct answer in the live docs. The technical resolution is to issue `GET /api/policies/schema` and parse the embedded enum out of the JSON-Schema document, but no live doc page documents this resolution path. The live `/authorization/permissions` page (WebFetched 2026-05-12 status 200 per the sibling `getResourcePermissions` sidecar `docs_link_semantic.inferred_docs[1]`) enumerates permission categories editorially but does not point operators at `getPolicySchema` as the runtime catalogue source. The phantom-node hypothesis encoded the right operator question; the implementation lives at a different endpoint than the synthesis guessed. Severity: LOW (doc-completeness, downstream of the sibling sidecar's HIGH-severity finding on the `/authorization` page's silent treatment of the read-side surface)." — evidence: `openapi.yaml:3586-3599` (the `getPolicySchema` endpoint, which IS the catalogue surface) + `PolicyServiceImpl.java:28, 37-45` (the static schema-load pattern) + `policy_schema.json:1-100+` (embedded enum partitioning by resource type) + cross-ref `getResourcePermissions` sidecar `docs_link_semantic.doc_drift_findings` — severity: LOW

## security

- **auth_mode_relevance**: `N/A — phantom node`. The actual `PermissionController` method (`getResourcePermissions`) auth posture is documented at the sibling sidecar.
- **ingestion_filter_relevance**: `N/A — phantom node`.
- **authorization_assertions**: [] — N/A.
- **owner_scoping**: `N/A — phantom node, no data-scoping behaviour`.
- **data_exposure**: [] — N/A. The phantom node has no implementation; no data flows.
- **known_security_gaps**:
  - "NEGATIVE FINDING (informational disclosure NOT confirmed at this node): the batch context raised the question 'does this endpoint leak permission availability — knowing which permissions exist tells an attacker what's worth attacking?' The question is moot at this node (phantom) but transparent at the legitimate surfaces: `Permission` is the OpenAPI-generated enum (`components.yaml:158-235`), so every API client — authenticated or not — receives the full enum at codegen time. The static JSON-Schema returned by `GET /api/policies/schema` (which IS authentication-gated per `AuthorizationCustomizer.java:29-30` catch-all `.authenticated()`) embeds the same enum. There is no 'information leak via permission catalogue read' because the catalogue is PUBLIC by design (a published OpenAPI spec, a build-time code-generated client artefact). The platform's information-disclosure posture on RBAC vocabulary is: every permission name is intentionally public; secrecy is on the GRANT (who-has-what), not on the CATALOGUE (what-could-be-granted). This is consistent with industry-standard RBAC patterns. The phantom-node hypothesis's concern is not realised at any surface. Severity: N/A (no gap surfaced; the question is answered NEGATIVELY by primary-source review)." — evidence: `components.yaml:158-235` (public OpenAPI enum) + `openapi.yaml:3586-3599` + `AuthorizationCustomizer.java:29-30` (only authentication required on `getPolicySchema`; no policy gate) — severity: N/A

## performance

- **hot_paths**: [] — N/A. Phantom node; no execution path.
- **throughput_characteristics**: [] — N/A.
- **resource_allocation**: [] — N/A. (Adjacent observation: the legitimate `getPolicySchema` endpoint serves a static in-memory string loaded once at boot — zero DB calls, zero allocations beyond the immutable cached string reference, per `PolicyServiceImpl.java:28, 97-100`. This is mentioned only as cross-batch context; the phantom node has no perf surface.)
- **scaling_characteristics**: [] — N/A.
- **known_performance_gaps**: [] — N/A.

## sources

- understanding ← `PermissionController.java:1-27` (entire file: imports + class header + single method `getResourcePermissions`) + `PolicyController.java:60-63` (`getPolicySchema` method) + `PolicyServiceImpl.java:28, 37-45, 97-100` (static schema load) + Grep `getPolicyPermissions` over `<odd-platform-repo>` returning zero matches (verified session 2026-05-20) + `state/sprint-themes.yaml:210-212` (synthetic-node rationale)
- concepts.entities ← `components.yaml:158-235` (the canonical `Permission` enum) + `policy_schema.json:1-100+` (the embedded schema) + `SecurityConstants.java:14-86` (the Java-side `PolicyPermissionDto` enum imports — proves 1-1 enum sync)
- concepts.operations ← `openapi.yaml:3586-3599` (the only catalogue-read endpoint)
- concepts.invariants ← Grep `getPolicyPermissions` returning zero matches + `components.yaml:158-235` (static enum) + `PolicyServiceImpl.java:28, 97-100` (static schema)
- concepts.audiences ← `permissions.thunks.ts:1-29` (UI's only permission-API consumer is `fetchResourcePermissions` → `getResourcePermissions`) + `PolicyDetails.tsx:34, 70` (UI's policy-form consumer of `getPolicySchema`)
- docs_link_semantic.doc_drift_findings[0] ← `state/sprint-themes.yaml:210-212` (synthetic-node rationale) + `openapi.yaml:3586-3599` (the actual catalogue surface) + cross-ref `getResourcePermissions` sidecar `docs_link_semantic.inferred_docs`
- implicit_adrs[0] ← `components.yaml:158-235` (canonical enum) + `openapi.yaml:3586-3599` + `PolicyServiceImpl.java:28, 37-45, 97-100` + `PermissionController.java:14-26` + `PolicyDetails.tsx:34, 70`
- bugs_limitations_corner_cases[0] ← `PermissionController.java:1-27` (entire file) + `state/sprint-themes.yaml:210-212` (synthetic-node rationale) + Grep verification (session 2026-05-20)
- bugs_limitations_corner_cases[1] ← `openapi.yaml:3586-3599` + `PolicyServiceImpl.java:28, 37-45` + `policy_schema.json:1-100+` + cross-ref `getResourcePermissions` sidecar
- security.known_security_gaps[0] ← `components.yaml:158-235` (public enum) + `openapi.yaml:3586-3599` + `AuthorizationCustomizer.java:29-30` + cross-ref `getResourcePermissions` sidecar `security.known_security_gaps`

## confidence_per_field

- understanding: HIGH (entire 27-line file verified end-to-end; Grep over the full repo verifies the absence of `getPolicyPermissions`; the legitimate surfaces are identified at primary-source line citations)
- concepts: HIGH (enum location, schema-load pattern, and 1-1 enum sync verified)
- dependencies_semantic: N/A (phantom node has no dependencies)
- tests_coverage_semantic: N/A (phantom node has no behaviour to cover)
- docs_link_semantic: MEDIUM (the doc-drift finding is anchored to the synthetic-node rationale and the actual catalogue endpoint; no live doc page WebFetched at this session because the sibling `getResourcePermissions` sidecar already covered the three relevant pages)
- implicit_adrs: HIGH (the compile-time-static catalogue decision is structurally visible at the cited lines; the load-once-at-boot pattern is the intent_anchor)
- bugs_limitations_corner_cases: HIGH for the substrate-quality finding (file content fully verified); MEDIUM for the operator-facing doc-gap finding (cross-references sibling sidecar's higher-severity finding)
- security: N/A for phantom-specific fields; HIGH for the negative-finding (informational-disclosure NOT confirmed — primary-source verified)
- performance: N/A (phantom node has no execution path)

## cross_references

- Sibling sidecar (the REAL method on this controller): `lineage/odd-platform/understanding/odd-platform__java__PermissionController__controller-method__getResourcePermissions.md` — fully enriched at session 2026-05-12-E with HIGH overall confidence. The substrate's batch-P enrichment is REDUNDANT relative to that sidecar.
- The legitimate catalogue-read surface lives on `PolicyController.getPolicySchema`; if a future batch enriches that node, this sidecar should be referenced as a cross-coherence pointer.
- The F-006 (P-09:F-001 RBAC) feature does NOT include this phantom node in its `contributing_nodes` list (`lineage/odd-platform/feature-flows/detail/F-006.yaml:144-156`) — the feature's authorization-read coverage flows through `ManagementPermissionExtractor` and `AbstractContextualPermissionExtractor` (both consumed by the legitimate `getResourcePermissions` and `getNonContextualPermissionsForCurrentUser` paths).

## coherence_findings

- **STRENGTHENS** `getResourcePermissions` sidecar `implicit_adrs[3]` (read-side endpoint deliberately left out of `SECURITY_RULES`): the absence of `getPolicyPermissions` further confirms the platform's read-side posture — only the CALLER'S resolved permissions are queryable, never a global catalogue of "what could be granted" beyond what is already public in the OpenAPI spec. The phantom-node investigation adds a NEGATIVE confirmation of the design.
- **STRENGTHENS** `getResourcePermissions` sidecar `docs_link_semantic.doc_drift_findings[0]` (the entire read-side permission discovery model is undocumented): the phantom-node finding strengthens the operator question "how do I discover available permissions?" — the resolution path (`/api/policies/schema`) is undocumented for catalogue-discovery use; the same doc-gap surface applies to BOTH the per-user read AND the schema-based catalogue read.
- **NO SUPERSEDES** — no prior sidecar made a claim about a `getPolicyPermissions` method; this sidecar is the first to surface the phantom and resolve it.
- **NO CONFLICTS_SURFACED** — every finding here is consistent with the sibling sidecar and with F-006.
- **NEW: substrate-quality finding** — the synthetic-node-walker pattern should be amended to assert method existence before emitting enrichment candidates. This is a substrate-process finding; the substrate maintainer should consider an existence-check gate in the next walker iteration.

## Maintainer notes
