---
node_id: "odd-platform openapi tags openapi-tag:alert"
node_kind: openapi-tag
axis: openapi_tags
extracted_at_commit: ede5d277
enriched_at_commit: ede5d277
extractor_version: 0.1.0
prompt_version: file-analyser/0.1.0
enrichment_status: complete
confidence_overall: HIGH
session_id: session-2026-05-08-05
---

# openapi-tag `alert` — semantic understanding

## understanding

The `alert` OpenAPI tag is the platform-spec's grouping label for the five operations whose URL prefix is `/api/alerts*` and whose semantics are alert-as-a-resource (list-many across three visibility scopes, get-totals badge, change-status). It is declared as a bare `name: alert` in the spec's top-level `tags:` block (no `description`, no `externalDocs`), and is referenced verbatim by each of the five operations under `paths:` via `tags: [alert]`. The tag's scope is intentionally narrow — alert-shaped reads/writes addressed by alert id or by the global alerts collection — and explicitly excludes the four data-entity-scoped alert operations (`/api/dataentities/{data_entity_id}/alerts`, `/alerts/counts`, `/alert_config` GET+PUT) and the AlertManager ingestion webhook, which are tagged `dataEntity` and `dataQuality` respectively. This carves the alerts feature into three OpenAPI groupings rather than one: per-alert and global-alert ops live here; per-entity alert ops live with the data-entity surface; ingestion lives with data-quality.

## concepts

- entities: [Alert, AlertList, AlertStatus, AlertStatusFormData, AlertTotals]
- operations: [
    `getAllAlerts` (GET /api/alerts — paged, all visibility),
    `getAssociatedUserAlerts` (GET /api/alerts/my — paged, owner-scoped),
    `getDependentEntitiesAlerts` (GET /api/alerts/dependents — paged, lineage-downstream-of-owned),
    `getAlertTotals` (GET /api/alerts/totals — three counts: total / my_total / dependent_total),
    `changeAlertStatus` (PUT /api/alerts/{alert_id}/status — flip status via AlertStatusFormData)
  ]
- invariants: [
    "Tag is declared with `name: alert` only — no `description` or `externalDocs` fields; the OpenAPI generator therefore produces a Java interface (`AlertApi`) and a TS API client section grouped purely by tag name, with no in-spec description text",
    "All five operations under this tag share a `/api/alerts` URL prefix; conversely, every `/api/alerts*` operation in the spec is tagged `alert` (no leakage)",
    "Tag membership is the SINGLE grouping signal — operations have no `x-controller`, no `x-grouping`, no other vendor extension; the tag is what the OpenAPI generator's `*Api` interface is named after"
  ]
- audiences: [
    "OpenAPI generator (server-side: produces `AlertApi` interface implemented by AlertController; client-side: produces an `AlertApi` TS class consumed by odd-platform-ui)",
    "Human readers of the spec navigating by tag in tools like Swagger UI / ReDoc / Stoplight",
    "Documentation site: the `developer-guides/api-reference/alerts.md` page is the human-readable counterpart, but it groups by FUNCTIONAL purpose (Global / Per-entity / Mutation / Halt-config / Webhook) and includes operations from OTHER tags too — see doc_drift_findings"
  ]

## dependencies_semantic

- requires-feature: [
    "Alerting feature — the tag's existence presupposes the alerting domain in the platform (live doc: `https://docs.opendatadiscovery.org/features/active-platform-features/alerting`, status 200, fetched 2026-05-08)"
  ]
- requires-config: []
- requires-runtime: [
    "OpenAPI 3.0.3 generator toolchain — the tag drives Java-interface and TS-client code generation; the generator's tag-to-class-name convention (`alert` → `AlertApi`) is what produces the controller's parent interface name"
  ]
- couples-to: [
    "components.yaml schemas: `Alert`, `AlertList`, `AlertStatus`, `AlertStatusFormData`, `AlertTotals` — every operation under this tag references at least one of these via `$ref`",
    "components.yaml parameters: `AlertIdParam`, `PageParam`, `SizeParam`",
    "Java AlertController (controller-level node): the controller `implements AlertApi` and re-implements every operation in this tag (verified — AlertController.java:17,20-57)",
    "TS odd-platform-ui alerts API client: generated from the same tag, consumed by alerts.thunks.ts (cross-axis hook, not verified in this sidecar)"
  ]

## tests_coverage_semantic

- covered_behaviours: []
- uncovered_behaviours: [
    "Spec-level lint: a CI gate that asserts every operation under tag `alert` has a non-empty `summary` and `description` — visually confirmed all 5 do (lines 2614-2700 in openapi.yaml), but no automated check exists in this repo",
    "Tag-scope coherence test: a CI assertion that every operation tagged `alert` has URL prefix `/api/alerts` AND vice versa — currently held by convention only",
    "Tag-vs-controller method-count parity: a CI assertion that the count of operations tagged `alert` equals the count of public methods on AlertController (currently 5 == 5; a future drift would not be caught)"
  ]
- test_files: [] — N/A (specification-level static checks would live in a build script or a CI workflow; the spec itself has no test harness in this repo)
- gaps: |
    The tag is a contract-level concept with no runtime test target. The interesting
    coverage gap is between the spec and the docs: the live page at
    `developer-guides/api-reference/alerts.md` describes 9 endpoints (5 from this
    tag + 4 from `dataEntity` + 1 from a separate ingestion namespace), but the
    OpenAPI tag scopes only 5. There is no automated check that the doc page's
    enumerated endpoint list stays in sync with the spec; if a future operation
    is added to the spec under this tag (or moved out), the doc page would not
    auto-reflect that. This is the single largest drift surface for the tag.

## docs_link_semantic

- declared_docs: [] — N/A (the OpenAPI spec's `tags:` block uses only `name:` for `alert`; there is no `externalDocs` field declared, so the spec carries no maintainer-declared doc URL for this tag)
- inferred_docs:
  - url: "https://docs.opendatadiscovery.org/developer-guides/api-reference/alerts"
    anchor: ""
    rationale: "The spec's tag groups operations under the `/api/alerts` URL prefix; this is the single live API-reference page that documents those operations. SUMMARY.md:96 binds the page at `developer-guides/api-reference/alerts.md`. The page is structured by FUNCTIONAL purpose (Global / Per-entity / Mutation / Halt-config / Webhook), not by OpenAPI tag — so the binding is a SUPERSET of this tag rather than a 1:1 match"
    last_verified_at: "2026-05-08T00:00:00Z"
    last_verified_status: 200
    confidence: MEDIUM
    fetched_excerpts: |
      H1: "Alerts"
      H2 sections: "Global alert listings", "Per-entity alert listings",
      "Alert status mutation", "Per-entity halt-notification configuration",
      "Inbound AlertManager webhook", "See also".
      Endpoint enumeration on the live page (9 endpoints across 3 OpenAPI tags):
        - GET /api/alerts (tag: alert)
        - GET /api/alerts/my (tag: alert)
        - GET /api/alerts/dependents (tag: alert)
        - GET /api/alerts/totals (tag: alert)
        - PUT /api/alerts/{alert_id}/status (tag: alert)
        - GET /api/dataentities/{data_entity_id}/alerts (tag: dataEntity)
        - GET /api/dataentities/{data_entity_id}/alerts/counts (tag: dataEntity)
        - GET /api/dataentities/{data_entity_id}/alert_config (tag: dataEntity)
        - PUT /api/dataentities/{data_entity_id}/alert_config (tag: dataEntity)
        - POST /ingestion/alert/alertmanager (separate ingestion namespace)
      Coverage description: "platform-detected and externally-injected issues
      against catalog entities, including failed jobs, data-quality test
      failures, schema incompatibilities, and distribution anomalies."
      Re-fetch 2026-05-08 (security/performance pass): "My Objects and
      Dependents require the signed-in user to be linked to an Owner;
      without the link, both endpoints respond with empty pages." The page
      describes `getAllAlerts / getAssociatedUserAlerts / getDependentEntitiesAlerts`
      as "Paginated list" endpoints but provides no detail on pagination
      parameters, cursor behaviour, page sizes, or rate limits.
  - url: "https://docs.opendatadiscovery.org/features/active-platform-features/alerting"
    anchor: "" (the page has an "API surface" section but no anchor id was confirmed)
    rationale: "The feature page links explicitly to the api-reference page above and describes the user-facing semantics of every operation in this tag (the All / My Objects / Dependents tabs map onto getAllAlerts / getAssociatedUserAlerts / getDependentEntitiesAlerts; the totals badge maps onto getAlertTotals; the manual status-flip maps onto changeAlertStatus). The feature page is the conceptual home; the api-reference page is the contract home"
    last_verified_at: "2026-05-08T00:00:00Z"
    last_verified_status: 200
    confidence: MEDIUM
    fetched_excerpts: |
      Excerpt from the API surface section:
      "The platform's HTTP surface for alerts — the three list endpoints behind
      the All / My Objects / Dependents tabs, the `getAlertTotals` badge call,
      the per-entity alert listing, the manual status-flip endpoint, and the
      halt-configuration endpoints — is documented at
      [API Reference → Alerts](/developer-guides/api-reference/alerts.md)."
  - url: "https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security"
    anchor: ""
    rationale: "The security section of this sidecar names the four ODD authentication modes (DISABLED / LOGIN_FORM / OAUTH2 / LDAP). This is the canonical live page that enumerates them; cited so the vocabulary matches the docs verbatim"
    last_verified_at: "2026-05-08T00:00:00Z"
    last_verified_status: 200
    confidence: HIGH
    fetched_excerpts: |
      Mode listing (verbatim): "auth.type (DISABLED / LOGIN_FORM / OAUTH2 / LDAP)".
      Ingestion-filter coverage: "IngestionDataEntitiesFilter ... only when
      auth.ingestion.filter.enabled: true" and it "Requires Authorization:
      Bearer <token>; validates the token against the datasource's stored
      token". S2S is not named on this page (it is documented under the
      authentication sub-tree).
- doc_drift_findings:
  - "The spec's `alert` tag has no `description` field — the `tags:` declaration is `name: alert` only (openapi.yaml:30). Tools that consume the OpenAPI spec to build documentation (Swagger UI, ReDoc, Stoplight) will display the tag heading with no description block. The live ODD docs page compensates with its own H1 `Alerts` and prose intro, but consumers using the raw spec see an unannotated tag. Recommend adding a `description:` to the tag declaration to carry the per-tag conceptual blurb."
  - "Tag-scope vs doc-page-scope mismatch: the live api-reference/alerts page documents 9 endpoints, but the OpenAPI tag scopes only 5. Operations on `/api/dataentities/{data_entity_id}/alerts*` (4 ops) are tagged `dataEntity` and the AlertManager webhook is in a separate ingestion path. From the OpenAPI spec's standpoint this is INTENTIONAL (URL-shape-driven tagging — tag follows the prefix), but a reader navigating by tag in Swagger UI will see the per-entity alert ops under `dataEntity`, not under `alert`, which contradicts a user mental model where 'all alert-shaped operations' belong together. The doc page silently re-groups; the spec does not. This is a documented (here) intentional asymmetry — surface as a follow-up if the substrate's concept-merger reducer needs to flag it."
  - "The spec carries no `externalDocs` URL on the `alert` tag. A spec consumer cannot navigate from the tag to `https://docs.opendatadiscovery.org/developer-guides/api-reference/alerts` automatically. Recommend adding `externalDocs.url` to make the binding machine-readable."
  - "The spec declares NO top-level `security:` block and NO `components.securitySchemes` (verified — exhaustive grep on openapi.yaml + components.yaml returns zero matches at commit ede5d277). Every one of the five `alert`-tagged operations therefore inherits no spec-level security requirement. Authorization is enforced entirely by Spring Security wiring downstream of the generated `AlertApi` interface — invisible from the spec. A consumer reading the spec to know which auth modes / roles / scopes apply gets nothing. The live api-reference/alerts page mentions owner-scoping requirements for `My Objects` / `Dependents` (empty page if user not linked to an Owner), but the spec encodes none of this."
  - "The live api-reference/alerts page describes `getAllAlerts / getAssociatedUserAlerts / getDependentEntitiesAlerts` as 'Paginated list' endpoints but provides no parameters, page-size guidance, or response-size caveats. The spec encodes pagination only as two `required: true` int32 query params (`page`, `size`) via `PageParam` + `SizeParam` (components.yaml:4213-4229) with no maximum, no default, no cursor. A caller that passes `size=2147483647` is spec-conformant; runtime behaviour is determined by AlertController/repository code, not by the contract."

## implicit_adrs

- "OpenAPI tags in this spec follow URL-prefix scoping — a tag's operations all share a `/api/<plural-noun>` URL prefix. The `alert` tag scopes only `/api/alerts*` operations; alert-shaped operations under `/api/dataentities/{data_entity_id}/alerts*` are tagged with the parent resource's tag (`dataEntity`), not the alert tag. This produces resource-shaped Java interfaces (`AlertApi`, `DataEntityApi`) rather than feature-shaped ones." — evidence: openapi.yaml:30 (`name: alert`) + openapi.yaml:2627-2702 (5 operations all under `/api/alerts*`, all tagged `alert`) + openapi.yaml:1318-1361 (per-entity alert operations tagged `dataEntity`) + openapi.yaml:1527,1547 (alert_config GET+PUT tagged `dataEntity`) — confidence: HIGH
- "Tags are declared as bare `name:` entries — no `description`, no `externalDocs`. The spec's tag-block is a flat namespace registry rather than a documentation surface. Per-tag conceptual blurbs and external doc-links must be added by the human-readable docs site (`developer-guides/api-reference/alerts.md`), NOT by the spec." — evidence: openapi.yaml:13-48 (entire `tags:` block — every entry is `- name: <tagname>` with no further fields) — confidence: HIGH
- "Each operation is tagged with EXACTLY ONE tag (single-element `tags: [<name>]` arrays in every alert operation). The OpenAPI spec permits an operation to carry multiple tags; this codebase does not exercise that capability — every operation belongs to one and only one tag-grouping. This commits the OpenAPI generator to a 1:1 operation-to-`*Api`-interface mapping (no operation appears in two generated interfaces)." — evidence: openapi.yaml:2627-2628, 2645-2646, 2663-2664, 2678-2679, 2701-2702 (every `tags:` array is a single-element list `- alert`) — confidence: HIGH
- "Authorization is wholly out-of-band of the OpenAPI contract. The spec declares no `security:` block, no `securitySchemes`, and no per-operation `security:` overrides. The contract therefore commits the platform to enforcing auth in Spring Security wiring downstream of the generated interface — the spec itself cannot be used by a tool (e.g. an API gateway, a contract-test generator) to derive who-can-call-what." — evidence: openapi.yaml:1-49 (no `security:` block) + openapi.yaml:2612-2702 (no per-op `security:`) + components.yaml grep (no `securitySchemes`) — confidence: HIGH

## bugs_limitations_corner_cases

- "The `alert` tag has no `description` and no `externalDocs` (openapi.yaml:30). A consumer rendering the spec via Swagger UI / ReDoc / Stoplight sees only the tag name with no per-tag conceptual blurb and no link out to the docs site. The `developer-guides/api-reference/alerts.md` doc page exists and is the canonical human reference, but the binding is editorial-only — not encoded in the spec. Adding `description: |` (one-paragraph blurb) and `externalDocs: { url: 'https://docs.opendatadiscovery.org/developer-guides/api-reference/alerts' }` would make the binding machine-readable." — evidence: openapi.yaml:30 (single-line `- name: alert`) + WebFetch developer-guides/api-reference/alerts page (status 200, 2026-05-08) — severity: LOW
- "Five operations live under tag `alert`; FOUR alert-shaped operations live under tag `dataEntity` (per-entity listings + alert-config GET+PUT). The split is URL-prefix-driven and has internal logic, but it means a developer searching the spec for 'all alert operations by tag' will miss four of the nine endpoints documented as alert-feature endpoints on the live api-reference page. The split is also the reason there is no single `AlertApi` interface that owns every alert operation — `AlertController` carries 5, `DataEntityController` carries 4 (verified — DataEntityController.java:316,324,405,413). A maintainer onboarding to the alerts feature has to know to look in two controllers." — evidence: openapi.yaml:30 + openapi.yaml:2627-2702 (5 ops) + openapi.yaml:1318-1361 (2 ops tagged `dataEntity`) + openapi.yaml:1514-1548 (2 alert_config ops tagged `dataEntity`) + DataEntityController.java:316,324,405,413 (handler methods) — severity: MEDIUM
- "There is no automated parity check between (a) the count of operations tagged `alert` in the spec, (b) the count of public methods on `AlertController.java`, and (c) the count of endpoints enumerated on the `developer-guides/api-reference/alerts.md` doc page. All three currently align (5 spec ops, 5 controller methods, 5 alert-tagged + 4 cross-tagged = 9 documented). A future operation added under `tags: [alert]` without corresponding doc-page enumeration, or vice versa, would not be caught by CI." — evidence: openapi.yaml:30 + AlertController.java:1-58 (5 `@Override` methods) + WebFetch developer-guides/api-reference/alerts (9 endpoints listed) — severity: LOW

## security

- **auth_mode_relevance**: `LOGIN_FORM | OAUTH2 | LDAP` (the three runtime modes that protect the UI/API surface). The five operations under tag `alert` are mounted at `/api/alerts*` — the UI/API surface, not ingestion — so they never run under `S2S` and they only run under `DISABLED` in dev/test (auth bypassed). The spec itself is mode-agnostic: it declares no `security:` block and no `components.securitySchemes` (verified by exhaustive grep on openapi.yaml and components.yaml at commit ede5d277), so the runtime mode is decided entirely by Spring Security wiring downstream of the generated `AlertApi` interface, not by the contract. Canonical mode names verified verbatim against the live `configuration-and-deployment/enable-security` page (WebFetch 2026-05-08, status 200): `auth.type (DISABLED / LOGIN_FORM / OAUTH2 / LDAP)`.
- **ingestion_filter_relevance**: `NO — UI/API surface (alerts read/write)`. The five operations are all under `/api/alerts*`; the `IngestionDataEntitiesFilter` (gated by `auth.ingestion.filter.enabled`) only matches `/ingestion/entities`. None of the alert operations participate in the ingestion-filter flow.
- **authorization_assertions**: `[]` at the spec level. None of the five operations declare a per-operation `security:` block, and no global `security:` block exists. The OpenAPI spec encodes zero authorization requirements for the `alert` tag — every authorization decision is made in Java by Spring Security wiring on the controller / service layer, downstream of the generated `AlertApi` interface. Evidence: openapi.yaml:1-12 (no `security:`) + openapi.yaml:2612-2702 (no per-op `security:` on any of the five operations) + components.yaml grep (no `securitySchemes`).
- **owner_scoping**: `MIXED — owner-scoped at the doc-and-runtime layer, NOT at the spec layer`. Spec-side, the parameter shapes hint at owner-scoping for two operations only by URL convention: `/api/alerts/my` (path implies "current user's alerts") and `/api/alerts/dependents` (path implies "alerts on entities that are downstream of the current user's owned entities"). Neither operation declares an explicit `userId` / `ownerId` parameter, an `Authorization` header, or any other spec-level owner-scoping signal. `getAllAlerts` (`/api/alerts`) takes only `page` + `size` parameters — there is no spec-level filter for owner. `getAlertTotals` (`/api/alerts/totals`) takes no parameters at all yet returns three counts (`total / my_total / dependent_total`) — the per-user split is computed from the authenticated principal at runtime, invisible to the contract. `changeAlertStatus` takes only `alert_id` and `AlertStatusFormData{status}` — no owner check is encoded in the spec. The live api-reference/alerts page (WebFetch 2026-05-08, status 200) explicitly states: "My Objects and Dependents require the signed-in user to be linked to an Owner; without the link, both endpoints respond with empty pages." That requirement is documentation-only — the spec encodes nothing of it.
- **data_exposure**:
  - "`Alert` payload (id, data_entity ref, type, status, status_updated_by, status_updated_at, last_created_at, alert_chunk_list[]) → any authenticated user under LOGIN_FORM | OAUTH2 | LDAP via `getAllAlerts` (no owner filter applied at the spec layer); under DISABLED, exposed to any caller — components.yaml:2301-2331 (Alert schema)"
  - "`AlertList { items: Alert[], page_info }` → same audience as Alert; the response includes the full alert list for the page — components.yaml:2353-2364"
  - "`AlertTotals { total: int64, my_total: int64, dependent_total: int64 }` → leaks the global alert count via `total` to any authenticated user (and to anyone under DISABLED). The `my_total` / `dependent_total` per-user counts are scoped to the authenticated principal — components.yaml:2366-2377"
  - "`Alert.status_updated_by → AssociatedOwner` ref — exposes the identity of the operator who last changed the alert status. Any authenticated user can see who acknowledged/closed an alert via `getAllAlerts` — components.yaml:2313-2314"
  - "`getAssociatedUserAlerts` (`/api/alerts/my`) and `getDependentEntitiesAlerts` (`/api/alerts/dependents`) — owner-scoped at runtime per the live doc; spec-side they expose the same `AlertList` shape with no encoded owner filter"
- **known_security_gaps**:
  - "Spec declares NO `security:` block at top level, NO `components.securitySchemes`, and NO per-operation `security:` overrides on any of the five `alert`-tagged operations. A spec consumer (API gateway, contract test generator, third-party SDK builder) cannot derive auth requirements from the contract — every authorization decision is invisible to the spec." — evidence: openapi.yaml:1-12 (no global `security:`) + openapi.yaml:2612-2702 (no per-op `security:`) + components.yaml grep (no `securitySchemes`) — severity: HIGH
  - "Owner-scoping for `getAssociatedUserAlerts` and `getDependentEntitiesAlerts` is documentation-only — the live api-reference page states `My Objects` / `Dependents` require the signed-in user to be linked to an Owner (empty page otherwise), but the spec carries no scoping parameter, no error response describing the unlinked-user case, and no authentication marker. The contract is silent on the entire owner model." — evidence: openapi.yaml:2630-2664 (operations declare only `page` + `size` params) + WebFetch developer-guides/api-reference/alerts (2026-05-08, status 200, owner-link excerpt quoted under inferred_docs[0]) — severity: MEDIUM
  - "`getAllAlerts` has no spec-level owner filter, no severity filter, no status filter, no entity-type filter. Spec-side any authenticated caller may page through the entire alerts table. Whether the runtime applies an additional filter is not visible from the contract." — evidence: openapi.yaml:2612-2628 (only `page` + `size` parameters) — severity: MEDIUM
  - "`changeAlertStatus` (PUT /api/alerts/{alert_id}/status) has no spec-level authorization marker. A spec consumer cannot tell whether status mutation is restricted to the alert's owner, to a Permission like `MANAGE_ALERT`, or to any authenticated user. Runtime enforcement is opaque to the contract." — evidence: openapi.yaml:2681-2702 (operation declares only `alert_id` path param + `AlertStatusFormData` body) — severity: MEDIUM
  - "No `4xx` response shapes are declared on any of the five operations — only `200`. A spec consumer cannot anticipate `401 Unauthorized`, `403 Forbidden`, `404` (alert id not found), or `400` (invalid status transition) error contracts. Error envelopes are out-of-band." — evidence: openapi.yaml:2620-2702 (every operation declares only `'200'` under `responses:`) — severity: MEDIUM

## performance

- **hot_paths**:
  - "`getAllAlerts` (GET /api/alerts) — paged list across the global alert population; spec-side declared 'Paginated list' on the live doc but with `page` + `size` as the only knobs, the runtime cost is determined entirely by repository implementation (out of scope for the spec)" — evidence: openapi.yaml:2612-2628
  - "`getAssociatedUserAlerts` (GET /api/alerts/my) — paged list scoped to the current user's owned entities; same pagination shape" — evidence: openapi.yaml:2630-2646
  - "`getDependentEntitiesAlerts` (GET /api/alerts/dependents) — paged list scoped to entities downstream-by-lineage of the current user's owned entities; same pagination shape — likely the heaviest of the three list endpoints because it requires lineage traversal upstream of the alert query" — evidence: openapi.yaml:2648-2664
  - "`getAlertTotals` (GET /api/alerts/totals) — three aggregate counts in a single response; UI-side this is the badge query and is typically called frequently" — evidence: openapi.yaml:2666-2679
- **throughput_characteristics**:
  - "Pagination IS declared on the three list endpoints — both `page` and `size` are `required: true` int32 query params via `$ref: PageParam` + `$ref: SizeParam` (components.yaml:4213-4229). However, neither parameter declares a `minimum`, `maximum`, or `default` — a caller may legally request `page=0, size=2147483647` per the contract; runtime guardrails (if any) are invisible from the spec." — evidence: components.yaml:4213-4229 + openapi.yaml:2618-2619, 2636-2637, 2654-2655
  - "No cursor-based pagination — the contract is offset-based only (`page` + `size`). For the global `/api/alerts` endpoint over a large alert table this is a known anti-pattern (deep-page offsets degrade O(N))." — evidence: components.yaml:4213-4229
  - "`getAlertTotals` is single-shot (no pagination); the response is a fixed-size `AlertTotals { total, my_total, dependent_total }` object regardless of underlying alert volume." — evidence: components.yaml:2366-2377
  - "`changeAlertStatus` is single-item — there is no bulk-status-update endpoint in this tag. A UI flow that needs to acknowledge N alerts must issue N PUTs." — evidence: openapi.yaml:2681-2702 (single `alert_id` path param, no bulk variant elsewhere in the tag)
- **resource_allocation**: `N/A — spec-level concept`. The OpenAPI spec governs request/response shape, not runtime allocation. Response-size hints from the schemas: `AlertList.items[]` carries the full `Alert` graph including `alert_chunk_list: AlertChunk[]` per item, where `AlertChunk` includes a free-text `description` field (components.yaml:2289-2299). A page of 100 alerts each carrying many chunks can produce a large response payload; the spec puts no upper bound on `alert_chunk_list.length` or on `AlertChunk.description.length` — evidence: components.yaml:2289-2331.
- **scaling_characteristics**: `N/A — spec-level concept`. The spec encodes no statefulness, locking, queueing, or rate-limit information. List operations declare offset-based pagination (above); whether the underlying repository can serve large `page` numbers without degrading is a runtime concern. The contract does carry one scaling-relevant hint: every operation tagged `alert` is HTTP/JSON, single-request/single-response (no streaming, no chunked-transfer-explicit, no SSE) — evidence: openapi.yaml:2620-2702 (every response is `application/json`).
- **known_performance_gaps**:
  - "Pagination parameters declare no `maximum` on `size` and no `minimum` on `page` (components.yaml:4213-4229). A spec-conformant caller may request `size=2147483647`; the contract does not warn against it. Recommend adding `schema.maximum: 100` (or whatever the runtime ceiling is) to `SizeParam` to encode the constraint at contract level." — evidence: components.yaml:4213-4229 — severity: MEDIUM
  - "No cursor-based alternative is declared. `getAllAlerts` over a large alert population uses offset-based pagination only; deep pages (e.g. `page=10000, size=100`) are O(offset) on most relational repositories. The spec does not surface this. Recommend adding a cursor-paged variant or documenting the deep-page caveat." — evidence: components.yaml:4213-4229 + openapi.yaml:2612-2628 — severity: LOW
  - "`getAlertTotals` returns `total` (the global alert count) on every call. The UI-side badge typically polls this endpoint — a high-cardinality alert table makes this a hot count query. The spec encodes no `If-None-Match`/`ETag` or `Cache-Control` semantics, no rate limit, no polling interval recommendation. A future maintainer adding a TTL cache layer would do so invisibly to the contract." — evidence: openapi.yaml:2666-2679 — severity: LOW
  - "`changeAlertStatus` is single-item only; bulk acknowledgement is not supported in the contract. A UI flow that needs to ack N alerts issues N PUTs serially or in parallel — both produce N controller invocations and N DB round-trips. Recommend a bulk variant if measurement shows ack-many is a real flow." — evidence: openapi.yaml:2681-2702 — severity: LOW
  - "No rate-limit headers or caveats declared on any of the five operations. A polled endpoint (`getAlertTotals`) and three list endpoints have no spec-level guidance for callers writing automated consumers." — evidence: openapi.yaml:2612-2702 (no `x-ratelimit-*` headers, no `429` responses) — severity: LOW

## sources

- understanding ← openapi.yaml:30 (tag declaration) + openapi.yaml:2612-2702 (5 operations, each with `tags: - alert`) + openapi.yaml:1321-1361, 1514-1548 (4 dataEntity-tagged alert-shaped operations excluded from this tag) + AlertController.java:17 (`implements AlertApi`)
- concepts.entities ← components.yaml:2289-2378 (Alert, AlertChunk, AlertType, AlertStatus, AlertStatusFormData, AlertList, AlertTotals schemas) + openapi.yaml:2626, 2644, 2662, 2677, 2693, 2700 ($ref binding from operations to schemas)
- concepts.operations ← openapi.yaml:2616, 2634, 2652, 2670, 2685 (one operationId per operation)
- concepts.invariants[0] ← openapi.yaml:30 (tag declaration is `name: alert` only, no further fields)
- concepts.invariants[1] ← openapi.yaml:2612, 2630, 2648, 2666, 2681 (paths) + Bash grep `tag` confirmation that no other paths under `/api/alerts*` exist outside the 5 listed
- concepts.invariants[2] ← openapi.yaml:2627-2628, 2645-2646, 2663-2664, 2678-2679, 2701-2702 (single-element `tags:` arrays — verified; no `x-` extensions on tag block)
- concepts.audiences ← AlertController.java:4 (`import ... AlertApi`) + WebFetch developer-guides/api-reference/alerts (status 200, 2026-05-08)
- dependencies_semantic.requires-feature ← WebFetch features/active-platform-features/alerting (status 200, 2026-05-08, fetched_excerpt under inferred_docs[1])
- dependencies_semantic.requires-runtime ← AlertController.java:4 (`org.opendatadiscovery.oddplatform.api.contract.api.AlertApi` is generator-produced) + openapi.yaml:1 (`openapi: 3.0.3`)
- dependencies_semantic.couples-to.[components schemas] ← components.yaml:2289-2378 + openapi.yaml ref usages
- dependencies_semantic.couples-to.[components parameters] ← openapi.yaml:2618-2619, 2636-2637, 2654-2655, 2687 (`$ref` to `AlertIdParam`/`PageParam`/`SizeParam`)
- dependencies_semantic.couples-to.[AlertController] ← AlertController.java:17, 20-57 (`implements AlertApi` + 5 `@Override` methods)
- tests_coverage_semantic.test_files ← N/A (no spec-level test harness exists in this repo at commit ede5d277 — verified by absence in CI workflow files; not exhaustive but consistent with the project layout)
- docs_link_semantic.inferred_docs[0] ← WebFetch `https://docs.opendatadiscovery.org/developer-guides/api-reference/alerts` (status 200, 2026-05-08; re-fetched 2026-05-08 for owner-scoping + pagination excerpts) + SUMMARY.md:96 binding
- docs_link_semantic.inferred_docs[1] ← WebFetch `https://docs.opendatadiscovery.org/features/active-platform-features/alerting` (status 200, 2026-05-08)
- docs_link_semantic.inferred_docs[2] ← WebFetch `https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security` (status 200, 2026-05-08, mode-listing excerpt)
- docs_link_semantic.doc_drift_findings[0] ← openapi.yaml:30 (no `description:` or `externalDocs:` fields on the tag declaration)
- docs_link_semantic.doc_drift_findings[1] ← openapi.yaml:30 + openapi.yaml:1318-1361, 1514-1548 (operations tagged `dataEntity`) + WebFetch api-reference/alerts page (9 endpoints) + DataEntityController.java:316,324,405,413
- docs_link_semantic.doc_drift_findings[2] ← openapi.yaml:30 (no `externalDocs` field)
- docs_link_semantic.doc_drift_findings[3] ← openapi.yaml:1-12 + openapi.yaml:2612-2702 + components.yaml grep (no `securitySchemes`) + WebFetch api-reference/alerts (owner-link excerpt)
- docs_link_semantic.doc_drift_findings[4] ← openapi.yaml:2612-2664 + components.yaml:4213-4229 + WebFetch api-reference/alerts (no pagination details on live page)
- implicit_adrs[0] ← openapi.yaml:30 + openapi.yaml:2612-2702 + openapi.yaml:1318-1361, 1514-1548
- implicit_adrs[1] ← openapi.yaml:13-48 (every entry in the `tags:` block is `- name: <name>` with no other fields)
- implicit_adrs[2] ← openapi.yaml:2627-2628, 2645-2646, 2663-2664, 2678-2679, 2701-2702 (every `tags:` array on alert operations is single-element)
- implicit_adrs[3] ← openapi.yaml:1-12 + openapi.yaml:2612-2702 + components.yaml grep (no `securitySchemes`)
- bugs_limitations_corner_cases[0] ← openapi.yaml:30 + WebFetch api-reference/alerts (200, 2026-05-08)
- bugs_limitations_corner_cases[1] ← openapi.yaml:30, 1318-1361, 1514-1548, 2612-2702 + DataEntityController.java:316,324,405,413
- bugs_limitations_corner_cases[2] ← openapi.yaml:30 + AlertController.java:1-58 + WebFetch api-reference/alerts (200, 2026-05-08, 9 endpoints listed)
- security.auth_mode_relevance ← openapi.yaml:1-12 (no global `security:`) + openapi.yaml:2612-2702 (no per-op `security:`) + components.yaml grep (no `securitySchemes`) + WebFetch enable-security (mode names verbatim)
- security.ingestion_filter_relevance ← openapi.yaml:2612-2702 (paths under `/api/alerts*`, not `/ingestion/entities`)
- security.authorization_assertions ← openapi.yaml:1-12 + openapi.yaml:2612-2702 + components.yaml grep
- security.owner_scoping ← openapi.yaml:2612-2702 (parameter shapes per operation) + components.yaml:2347-2351 (AlertStatusFormData), 4213-4229 (PageParam, SizeParam) + WebFetch api-reference/alerts ("My Objects and Dependents require ... linked to an Owner; without the link ... empty pages")
- security.data_exposure ← components.yaml:2289-2378 (Alert/AlertChunk/AlertList/AlertTotals schemas) + openapi.yaml:2620-2702 (response bindings)
- security.known_security_gaps[0] ← openapi.yaml:1-12 + openapi.yaml:2612-2702 + components.yaml grep
- security.known_security_gaps[1] ← openapi.yaml:2630-2664 + WebFetch api-reference/alerts (owner-link excerpt)
- security.known_security_gaps[2] ← openapi.yaml:2612-2628
- security.known_security_gaps[3] ← openapi.yaml:2681-2702
- security.known_security_gaps[4] ← openapi.yaml:2620-2702 (only `'200'` declared on every operation)
- performance.hot_paths[0-3] ← openapi.yaml:2612-2679 (4 GET operations) + WebFetch api-reference/alerts ("Paginated list" descriptor)
- performance.throughput_characteristics ← components.yaml:4213-4229 (PageParam/SizeParam shapes — int32, no min/max/default) + openapi.yaml:2618-2619, 2636-2637, 2654-2655 ($ref usages) + openapi.yaml:2666-2679 (totals — single-shot) + openapi.yaml:2681-2702 (status — single-item)
- performance.resource_allocation ← components.yaml:2289-2331 (Alert + AlertChunk schemas; unbounded `alert_chunk_list[]` and unbounded `description` string)
- performance.scaling_characteristics ← openapi.yaml:2620-2702 (every response is `application/json`, no streaming)
- performance.known_performance_gaps[0] ← components.yaml:4213-4229
- performance.known_performance_gaps[1] ← components.yaml:4213-4229 + openapi.yaml:2612-2628
- performance.known_performance_gaps[2] ← openapi.yaml:2666-2679
- performance.known_performance_gaps[3] ← openapi.yaml:2681-2702
- performance.known_performance_gaps[4] ← openapi.yaml:2612-2702

## confidence_per_field

- understanding: HIGH
- concepts: HIGH
- dependencies_semantic: HIGH
- tests_coverage_semantic: HIGH (the absence-of-test claim is structural — there is no spec-test harness anywhere; the gap is identified by inspection, not inferred)
- docs_link_semantic: MEDIUM (binding is editorial — the spec's tag carries no `externalDocs`; the three inferred URLs are WebFetched 200, but the tag→doc binding is the enricher's judgment, not maintainer-declared)
- implicit_adrs: HIGH (every claim is structural — visible in the spec at the cited line ranges)
- bugs_limitations_corner_cases: HIGH (every claim is verified by direct inspection of the spec + cross-checked against AlertController.java + DataEntityController.java + WebFetch results)
- security: HIGH (every claim is spec-static — verified by direct grep of openapi.yaml + components.yaml at commit ede5d277; auth-mode vocabulary verified verbatim against the live enable-security page; owner-scoping cross-checked against the live api-reference/alerts page)
- performance: HIGH (every claim is spec-static — pagination parameter shapes, response schema bounds, single-vs-bulk endpoint count are all visible in the spec at the cited line ranges; runtime-cost claims are explicitly N/A and surfaced as such)

## Maintainer notes
