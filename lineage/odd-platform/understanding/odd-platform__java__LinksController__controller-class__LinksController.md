---
node_id: "odd-platform java LinksController controller-class:LinksController"
node_kind: controller-class
axis: controllers
extracted_at_commit: feature/ontology-finalize-2026-05-25
enriched_at_commit: feature/ontology-finalize-2026-05-25
extractor_version: 0.1.0
prompt_version: file-analyser/0.5.0
enrichment_status: complete
confidence_overall: HIGH
session_id: session-2026-05-25-ZE-LinksController
---

# LinksController — semantic understanding

## understanding

LinksController serves a single read-only endpoint, `GET /api/links`, that returns
the operator-configured catalogue of "additional links" — a global list of external
URLs (with titles) the operator wants surfaced inside the ODD Platform UI's App
Info menu (the toolbar information icon). It is a thin proxy over the
`AdditionalLinkProperties` Spring `@ConfigurationProperties` record bound at boot
from `odd.links[].{title,url}`; the controller does no persistence, no auth-gate
beyond the default `authenticated()` rule, no validation of URLs, and no ordering
or pagination. The endpoint is distinct from the per-data-entity link surface
at `/api/dataentities/{id}/links` (which lives on a different controller and is
gated by DATA_ENTITY_ATTACHMENT_MANAGE) — the name "links" is reused at two
different scopes.

## concepts

- entities: [AdditionalLink (global, operator-configured, runtime-immutable), Link (title + url DTO)]
- operations: [getLinks (return global catalogue), passthrough-bind (map record-list to API model)]
- invariants: [config is bound once at boot, list contents are static per-process lifetime, no auth-role differentiation, all authenticated users see the same list]
- audiences: [end-user via App Info menu (UI consumer), operator who configures `odd.links` via YAML or env]

## dependencies_semantic

- requires-feature: [Spring Boot `@ConfigurationProperties` binding for `odd.links`; OpenAPI generator (LinksApi interface is generated from `odd-platform-specification/openapi.yaml`)]
- requires-config: [`odd.links[].title`, `odd.links[].url` — optional; absent → empty list; no validation of URL scheme or format]
- requires-runtime: [Spring WebFlux (reactive Mono return), no DB, no cache, no outbound HTTP, no scheduling]

## tests_coverage_semantic

- covered_behaviours: []
- uncovered_behaviours:
  - behaviour: "GET /api/links returns 200 with items=[] when odd.links is unset/null"
    test_class: integration
    criticality: LOW
    note: "Trivial path but the null-vs-empty branch is the operator's default state — worth a smoke test."
  - behaviour: "GET /api/links preserves the YAML / env declaration order across the response"
    test_class: integration
    criticality: MEDIUM
    note: "No explicit sort; operator may expect insertion order — verify Spring binder behaviour. Probe P-128 covers."
  - behaviour: "GET /api/links returns 401 to an unauthenticated request under LOGIN_FORM/OAUTH2/LDAP auth modes; returns 200 with payload under DISABLED"
    test_class: security
    criticality: MEDIUM
    note: "No SecurityRule entry, no WHITELIST entry — relies entirely on the default authenticated() rule. Regression-prone if WHITELIST_PATHS is edited."
  - behaviour: "@ConfigurationProperties binding is boot-time only; changing odd.links at runtime does NOT mutate response without restart"
    test_class: integration
    criticality: LOW
    note: "Operator-surprise risk; no doc-level warning. Probe P-128 covers."
  - behaviour: "Mid-sized link lists (50+ entries) return without truncation and without performance regression"
    test_class: performance
    criticality: LOW
    note: "No list-size cap; trivial in practice but a missing guard."
- test_files: []
- gaps: |
    No unit tests, no integration tests, no security tests for this controller exist
    anywhere in `odd-platform-api/src/test/`. The endpoint is small enough that a
    single integration test class with five WebTestClient calls would cover all
    five uncovered behaviours. The most-leverage gap is the auth-gate behaviour
    (security class): a careless future edit to WHITELIST_PATHS or a refactor of
    AuthorizationCustomizer could silently flip /api/links from authenticated to
    public — no test would catch it.

## docs_link_semantic

- declared_docs: []
- inferred_docs:
  - url: "https://docs.opendatadiscovery.org/configuration-and-deployment/odd-platform"
    anchor: null
    rationale: "Live page documents the `odd.links` configuration property — title + url per entry, App Info menu surface; this is the canonical operator-facing doc for the feature implemented here."
    last_verified_at: "2026-05-25T00:00:00Z"
    last_verified_status: 200
    confidence: LOW
    fetched_excerpts: |
      "Operators can attach a list of arbitrary navigation links — pointers to internal wikis, runbooks, dashboards, or any other page"
      "Each link entry requires a `title` (menu-item label) and `url` (absolute URL opening in a new tab)."
      "The documentation explains that `odd.links` allows administrators to surface custom external links in the App Info menu (accessible via the information icon in the top-right toolbar)."
- doc_drift_findings:
  - "Doc says 'opening in a new tab' — code DOES set target='_blank' (AppInfoMenu.tsx:61) but does NOT set rel='noopener noreferrer'; doc fails to warn operators that arbitrary URLs they configure inherit a reverse-tabnabbing vector — any operator-configured page can call window.opener to redirect the parent tab."
  - "Doc claims 'absolute URL' — code does NOT validate the URL scheme; `javascript:alert(1)` or `data:` URLs would be passed unsanitised to the UI's <a href>. React's <a> attribute generally rejects javascript: at runtime (React 17+) but a `data:text/html` URL would render. Doc silently assumes operators only ever set http(s) URLs."
  - "Doc does not mention that `odd.links` is bound at boot — operators changing the YAML in a running container will not see updated links without restart."
  - "Doc does not mention ordering guarantees — operator may rely on YAML insertion order; the code makes no explicit ordering promise."

## implicit_adrs

- "Operator-configured external links are a STATIC catalogue, not a runtime-mutable feature; the absence of any persistence layer or admin UI is the decision." — evidence: LinksController.java:23 (`private final AdditionalLinkProperties linkProperties`) + AdditionalLinkProperties.java:6 (`@ConfigurationProperties("odd")`) — intent_anchor: "the entire feature is implemented as a record-bound config; no DB table, no admin endpoint, no save method exists" — confidence: HIGH
- "The 'additional links' surface is GLOBAL (visible to every authenticated user), not per-user or per-role; an operator cannot show different links to different roles via this feature." — evidence: LinksController.java:25-36 (no role/owner filtering in the response) + SecurityConstants.java:95-96 (no SecurityRule for /api/links → default authenticated()) — intent_anchor: "single endpoint returns full list regardless of caller identity; the role-aware path is intentionally absent" — confidence: HIGH

## bugs_limitations_corner_cases

- "UI renders operator-configured links with target='_blank' but WITHOUT rel='noopener noreferrer' (AppInfoMenu.tsx:61) — any URL the operator configures can use `window.opener` to navigate the ODD Platform tab to a phishing page (reverse tabnabbing). Since odd.links values are typically trusted internal URLs, the realistic threat is a compromised internal wiki; severity is non-zero but bounded by who controls the configured URLs." — evidence: AppInfoMenu.tsx:60-66 (`<Link key={link.url} to={link.url} target='_blank'>` — no rel attribute) — severity: MEDIUM
- "UI uses `link.url` as React key (AppInfoMenu.tsx:61) — if the operator configures two entries with identical URLs (e.g. same dashboard with two labels), React will emit a duplicate-key warning and may de-duplicate the render in some reconciliation paths." — evidence: AppInfoMenu.tsx:60-66 — severity: LOW
- "Neither the backend nor the UI validates URL scheme — operator can configure `javascript:` or `data:` URLs. React 17+ neutralises `javascript:` in <a href>, but `data:text/html,...` and `vbscript:` are still passed through to the DOM in some browsers. No allowlist of schemes." — evidence: AdditionalLinkProperties.java:8 (`record Link(String title, String url)` — no `@URL` constraint, no `@Pattern`) + LinksController.java:31-33 (passthrough map) — severity: MEDIUM
- "No list-size cap — operator misconfiguration (e.g. accidentally bound a large env-variable list) returns the full list to every browser on every menu hover; UI does not paginate; AppInfoMenu would render N <a> elements for any N." — evidence: LinksController.java:31-33 + AppInfoMenu.tsx:55-69 — severity: LOW
- "@ConfigurationProperties bound at boot — editing YAML or env at runtime does NOT update the response. No `/actuator/refresh` is enabled by default. Operator-visible: stale links remain until container restart with no warning surface." — evidence: AdditionalLinkProperties.java:6-9 + LinksController.java:23 (final field, set at construction) — severity: LOW
- "`getLinks(ServerWebExchange exchange)` accepts a `ServerWebExchange` parameter (line 26) that is never used in the method body — likely an OpenAPI-generated interface signature artefact. Cosmetic, but signals the generator dictates the signature shape." — evidence: LinksController.java:26-36 — severity: LOW
- "The unused `import java.util.Collections;` (line 3) is also dead — the file uses `emptyList()` from the static import on line 17, not `Collections.emptyList()`." — evidence: LinksController.java:3 — severity: LOW
- "Endpoint name 'links' is reused at two semantically distinct scopes: `/api/links` (this controller — global, operator-configured catalogue) and `/api/dataentities/{id}/links` (data-entity-attachment links — per-entity, user-managed via DATA_ENTITY_ATTACHMENT_MANAGE permission). A reader of the URL space alone could conflate them; the OpenAPI tags ('links' vs 'dataEntityAttachment') disambiguate at the spec layer but not at the path layer." — evidence: openapi.yaml:85-98 (this controller) + openapi.yaml:1708-1730 (saveLinks on data-entity-attachment) — severity: LOW

## stress_findings

```yaml
stress_findings:
  tunables: []
  name_behavior_pairs:
    - name: "getLinks (endpoint: GET /api/links)"
      promise: "Return 'the links'. Ambiguous between (a) global operator-configured links and (b) per-entity links given the parallel /api/dataentities/{id}/links path."
      implementation: "Returns the operator-configured global list bound from `odd.links` via @ConfigurationProperties. The path `/api/links` (no parameters) makes scope-disambiguation possible from the URL; the OpenAPI summary 'Additional links' clarifies further."
      drift: MINOR
      operator_visible_consequence: "An API consumer reading the route table without the OpenAPI summary could assume `/api/links` returns all links across the platform; the response is in fact only the operator-configured catalogue. The OpenAPI tag 'links' is also generic and reused for the global-catalogue scope only."
      confidence: STATIC-INFERRED
      evidence: "LinksController.java:25-36 + openapi.yaml:85-98"
  orderings:
    - location: "LinksController.java:31-33"
      questions:
        - q: "What is the actual ORDER BY at the lowest layer?"
          a: "There is no ORDER BY or sort. The code is `linkProperties.links().stream().map(...).toList()` — preserves whatever order `AdditionalLinkProperties.links()` returns. Spring Boot's @ConfigurationProperties binder for `List<Record>` preserves YAML / env-indexed declaration order; this is documented Spring behaviour but not asserted by any test in this repo."
          confidence: STATIC-INFERRED
          evidence: "LinksController.java:31-33"
        - q: "What is the tie-breaker when sort-key values are equal?"
          a: "N/A — no sort key; insertion order is the only order."
          confidence: STATIC-INFERRED
          evidence: "LinksController.java:31-33"
        - q: "Which subset is returned when result-set > page size?"
          a: "N/A — endpoint has no pagination, no LIMIT. All entries are returned in one response. Hypothesis on the operator-visible failure at large N is captured in P-128."
          confidence: PROBE-NEEDED
          evidence: "P-128"
        - q: "Does any upstream layer re-sort or filter the result?"
          a: "AppInfoMenu.tsx:60-66 renders in array iteration order without re-sorting. No additional filter or transform."
          confidence: STATIC-INFERRED
          evidence: "AppInfoMenu.tsx:55-69"
  auth_gates:
    - location: "LinksController.java:25-26 + SecurityConstants.java:95-98 + AuthorizationCustomizer.java:29-30"
      endpoint: "GET /api/links"
      questions:
        - q: "What does this endpoint return for each of DISABLED / LOGIN_FORM / OAUTH2 / LDAP?"
          a: "DISABLED → 200 with the configured link list (no auth wall). LOGIN_FORM / OAUTH2 / LDAP → 401 if unauthenticated; 200 for any authenticated session regardless of roles or owners. Verified by tracing: /api/links is NOT in WHITELIST_PATHS (SecurityConstants.java:95-96) and has NO SecurityRule (so it falls through to the default `pathMatchers(\"/**\").authenticated()` at AuthorizationCustomizer.java:29-30). Probe P-128 asserts the LOGIN_FORM behaviour empirically."
          confidence: STATIC-INFERRED
          evidence: "SecurityConstants.java:95-96 (WHITELIST) + AuthorizationCustomizer.java:29-30 (default rule)"
        - q: "What does an unauthenticated caller see?"
          a: "Under LOGIN_FORM/OAUTH2/LDAP: 401 (or a redirect to the login form for LOGIN_FORM). Under DISABLED: 200 with the link list."
          confidence: STATIC-INFERRED
          evidence: "AuthorizationCustomizer.java:29-30"
        - q: "What does a wrong-role caller see?"
          a: "Same as a correctly-roled caller — 200 with the full link list. No per-role gating; no per-owner scoping; no role differentiation. A user provisioned with zero roles and zero owners still reads the full list."
          confidence: STATIC-INFERRED
          evidence: "LinksController.java:25-36 (no permission check) + SecurityConstants.java (no SecurityRule for /api/links)"
        - q: "Where does the gate live — controller, service, repository, or nowhere?"
          a: "Nowhere specifically — the gate is the framework-default `authenticated()` rule at AuthorizationCustomizer.java:29-30, which applies when no more-specific WHITELIST or SecurityRule matches. The controller does not have a @PreAuthorize annotation; no programmatic permission check is performed."
          confidence: STATIC-INFERRED
          evidence: "AuthorizationCustomizer.java:29-30 + LinksController.java:25-36"
  resource_boundaries:
    - location: "AdditionalLinkProperties.java:6-9 + LinksController.java:23"
      kind: concurrency
      questions:
        - q: "Can two simultaneous calls produce corrupted state?"
          a: "No — the controller is stateless; AdditionalLinkProperties is an immutable record-of-records bound at boot; the stream/map operation creates a fresh List<Link> on each call. No shared mutable state."
          confidence: STATIC-INFERRED
          evidence: "AdditionalLinkProperties.java:7-9 (record + record) + LinksController.java:23 (final field) + LinksController.java:31-33 (per-call stream)"
        - q: "Is the call replay-safe?"
          a: "Yes — pure read; same input (same boot-time config) returns the same response on every call within the process lifetime."
          confidence: STATIC-INFERRED
          evidence: "LinksController.java:25-36"
        - q: "If a cache fronts this, what is the TTL / eviction key / staleness window?"
          a: "No cache annotation. UI side: TanStack Query (`useAppLinks`) uses default behaviour — staleTime defaults to 0 (refetch on every mount). The backend has no caching; every call hits the in-memory record list (cheap, no I/O). The bigger 'staleness' is the BOOT-TIME-BIND issue: the config itself is stale relative to live YAML/env changes — see Probe P-128."
          confidence: STATIC-INFERRED
          evidence: "LinksController.java (no @Cacheable) + appInfo.ts:11-17 (default useQuery config)"
  request_inputs:
    - location: "LinksController.java:26"
      input_kind: query-param
      input_name: "exchange (ServerWebExchange)"
      questions:
        - q: "What does the input NAME promise the caller, in plain user-facing English?"
          a: "<generic — no specific entity promised; the parameter is a framework-injected request context, not a user-facing input>"
          confidence: STATIC-INFERRED
          evidence: "LinksController.java:26"
        - q: "When supplied, what does the implementation USE the input for?"
          a: "Nothing. The `exchange` parameter is accepted on the method signature (required by the OpenAPI-generated LinksApi interface) but never referenced in the method body — no header reads, no query-string reads, no body."
          confidence: STATIC-INFERRED
          evidence: "LinksController.java:25-36 (the parameter `exchange` does not appear after the declaration)"
        - q: "Does the implementation's actual scope MATCH the name's promise?"
          a: "MATCHES — the name promises nothing user-facing (it's a framework parameter); the implementation correctly does nothing with it."
          drift: NONE
          confidence: STATIC-INFERRED
          evidence: "LinksController.java:25-36"
        - q: "For TRANSLATES_SILENTLY: what does a caller see when their assumption is wrong?"
          a: "N/A — no drift."
          confidence: STATIC-INFERRED
          evidence: "LinksController.java:25-36"
        - q: "Is there a column / field / variable that DOES match the input's name and is NOT being used?"
          a: "NONE — the endpoint has no other inputs to compare against."
          confidence: STATIC-INFERRED
          evidence: "LinksController.java:25-36"
      routes_to_finding: "bugs_limitations_corner_cases.[6] (cosmetic — unused ServerWebExchange parameter)"
  probes_emitted:
    - probe_id: P-128
      question: "Verify ordering preservation, boot-time binding immutability, auth gate (no SecurityRule → default authenticated), and null/empty handling."
      probe_path: "lineage/odd-platform/probes/P-128.yaml"
  stress_summary:
    triggers_total: 4
    questions_total: 17
    answers_static_inferred: 16
    answers_probe_needed: 1
    answers_reference: 0
    drift_flags: 1
```

## security

- auth_mode_relevance: [LOGIN_FORM, OAUTH2, LDAP, DISABLED (relevant — DISABLED makes the endpoint public; the operator should be aware that an "additional links" surface CAN carry internal URLs that probably should not be world-readable)]
- ingestion_filter_relevance: "N/A — UI/API surface, not an ingestion path"
- authorization_assertions: []
- owner_scoping: "N/A — code is not data-scoped; the global link catalogue is the same for every caller."
- data_exposure:
  - "Full configured link list (title + url for each entry) → any authenticated user under LOGIN_FORM/OAUTH2/LDAP modes; any caller under DISABLED mode. If the operator configures internal-network URLs (wikis, runbooks, Grafana), those URLs become readable by every authenticated user — including users who normally have read-only or zero-owner role profiles."
- known_security_gaps:
  - "controller has no @PreAuthorize; relies on the default `pathMatchers(\"/**\").authenticated()` rule via AuthorizationCustomizer; this is not a per-role gate — every authenticated user reads the full catalogue regardless of role/permission/owner-scope" — evidence: LinksController.java:25-36 + AuthorizationCustomizer.java:29-30 — severity: LOW (this may be intentional — additional links are global by design — but it is undocumented at the doc-page level)
  - "URL scheme not validated at the backend; operator-supplied `javascript:` or `data:` URLs are passed unsanitised to the UI" — evidence: AdditionalLinkProperties.java:8 (no `@URL` / `@Pattern` constraint) + LinksController.java:31-33 (passthrough) — severity: MEDIUM (operator-trust model; non-zero if operator config can be edited by a less-trusted role)
  - "UI does not set rel='noopener noreferrer' on target='_blank' link rendering — reverse tabnabbing vector from any operator-configured URL" — evidence: AppInfoMenu.tsx:60-66 — severity: MEDIUM
  - "Under DISABLED mode the endpoint is public — an unauthenticated probe to /api/links discloses operator-internal URLs to the public internet if the deployment is internet-facing" — evidence: AuthorizationCustomizer.java:29-30 (default authenticated only applies when DISABLED is OFF; DISABLED mode short-circuits auth entirely) — severity: LOW (DISABLED is dev-only per the documentation page; the gap is operator-discipline not code-defect)

## performance

- hot_paths:
  - "GET /api/links is called on every UI mount of the app toolbar (which is on every page) via useAppLinks → linksApi.getLinks. The request is cheap (in-memory list copy) but the call frequency is high." — evidence: AppInfoMenu.tsx:18 + appInfo.ts:11-17
- throughput_characteristics:
  - "Single-call read, reactive Mono signature, non-blocking — no DB round-trip, no outbound HTTP" — evidence: LinksController.java:26-35
- resource_allocation:
  - "Allocates a new ArrayList of size N on every request via the stream→toList chain; for N ≤ 50 (typical operator setup) this is sub-millisecond and not measurable" — evidence: LinksController.java:31-33
- scaling_characteristics:
  - "Stateless controller — horizontally scalable; no shared state between instances" — evidence: LinksController.java:22-23
  - "No pagination — list size grows O(N) with operator-configured entry count; UI also has no pagination; pathological config (1000+ entries) degrades menu render" — evidence: LinksController.java:31-33 + AppInfoMenu.tsx:55-69
- known_performance_gaps:
  - "TanStack Query staleTime not set on useAppLinks — every component remount triggers a refetch even though the underlying list is boot-time immutable. The fetch is cheap so impact is negligible, but conceptually a `staleTime: Infinity` would be correct" — evidence: appInfo.ts:11-17 — severity: LOW

## upstream_callers

- entry_point: "ui_route:* (every page that renders AppToolbar)"
  caller_node: "ts react-component:AppInfoMenu.tsx"
  multiplicity_per_trigger: 1
  evidence: "AppInfoMenu.tsx:18 (`const { data: links } = useAppLinks();`) → appInfo.ts:14 (`queryFn: () => linksApi.getLinks()`); React Query default staleTime=0 means each mount of AppToolbar fires one request"
  observation_class: ui-call

- entry_point: "rest:GET /api/links"
  caller_node: "<external API consumer — any HTTP client>"
  multiplicity_per_trigger: 1
  evidence: "openapi.yaml:85-98 — operationId getLinks, public OpenAPI contract; any external client (curl, integration test, third-party UI) can call it directly"
  observation_class: rest-call

## downstream_side_effects

- side_effect_class: page-render
  description: "Returns LinkList payload (items[].{title,url}) to the caller; in the UI case, AppInfoMenu renders one <a target='_blank'> per entry"
  evidence: "LinksController.java:31-35 + AppInfoMenu.tsx:60-66"
  cardinality_per_call: 1
  reachable_from_entry_points:
    - "ui_route:* (every page that renders AppToolbar)"
    - "rest:GET /api/links"

## sources

- understanding ← LinksController.java:1-37 + AdditionalLinkProperties.java:1-10 + openapi.yaml:85-98
- concepts.entities.AdditionalLink ← AdditionalLinkProperties.java:6-9
- concepts.operations.getLinks ← LinksController.java:25-36
- concepts.invariants.boot-time-static ← AdditionalLinkProperties.java:6 (@ConfigurationProperties) + LinksController.java:23 (final field)
- dependencies_semantic.requires-feature ← AdditionalLinkConfiguration.java:7-10 (@EnableConfigurationProperties)
- dependencies_semantic.requires-config ← AdditionalLinkProperties.java:7-9 (record fields)
- tests_coverage_semantic.test_files ← (Grep result: no test files matched LinksController in odd-platform-api/src/test)
- docs_link_semantic.inferred_docs ← WebFetch https://docs.opendatadiscovery.org/configuration-and-deployment/odd-platform (status 200, 2026-05-25)
- docs_link_semantic.doc_drift_findings.[0] ← AppInfoMenu.tsx:60-66 (target='_blank' without rel)
- docs_link_semantic.doc_drift_findings.[1] ← AdditionalLinkProperties.java:8 (no @URL constraint)
- docs_link_semantic.doc_drift_findings.[2] ← AdditionalLinkProperties.java:6 (@ConfigurationProperties → boot-time bind)
- docs_link_semantic.doc_drift_findings.[3] ← LinksController.java:31-33 (stream/toList preserves order, no explicit sort)
- implicit_adrs.[0] ← LinksController.java:23 + AdditionalLinkProperties.java:6
- implicit_adrs.[1] ← LinksController.java:25-36 + SecurityConstants.java:95-96
- bugs_limitations_corner_cases.[0] ← AppInfoMenu.tsx:60-66
- bugs_limitations_corner_cases.[1] ← AppInfoMenu.tsx:60-66
- bugs_limitations_corner_cases.[2] ← AdditionalLinkProperties.java:8 + LinksController.java:31-33
- bugs_limitations_corner_cases.[3] ← LinksController.java:31-33 + AppInfoMenu.tsx:55-69
- bugs_limitations_corner_cases.[4] ← AdditionalLinkProperties.java:6-9 + LinksController.java:23
- bugs_limitations_corner_cases.[5] ← LinksController.java:26-36
- bugs_limitations_corner_cases.[6] ← LinksController.java:3
- bugs_limitations_corner_cases.[7] ← openapi.yaml:85-98 + openapi.yaml:1708-1730
- security.auth_mode_relevance ← AuthorizationCustomizer.java:29-30 + SecurityConstants.java:95-96
- security.authorization_assertions ← (none — file-local empty by design)
- security.data_exposure ← LinksController.java:31-33
- security.known_security_gaps.[0] ← LinksController.java:25-36 + AuthorizationCustomizer.java:29-30
- security.known_security_gaps.[1] ← AdditionalLinkProperties.java:8 + LinksController.java:31-33
- security.known_security_gaps.[2] ← AppInfoMenu.tsx:60-66
- security.known_security_gaps.[3] ← AuthorizationCustomizer.java:29-30
- performance.hot_paths ← AppInfoMenu.tsx:18 + appInfo.ts:11-17
- performance.scaling_characteristics ← LinksController.java:22-23 + LinksController.java:31-33
- performance.known_performance_gaps ← appInfo.ts:11-17
- upstream_callers.[0] ← AppInfoMenu.tsx:18 + appInfo.ts:11-17
- upstream_callers.[1] ← openapi.yaml:85-98
- downstream_side_effects.[0] ← LinksController.java:31-35 + AppInfoMenu.tsx:60-66

## confidence_per_field

- understanding: HIGH
- concepts: HIGH
- dependencies_semantic: HIGH
- tests_coverage_semantic: HIGH
- docs_link_semantic: HIGH
- implicit_adrs: HIGH
- bugs_limitations_corner_cases: HIGH
- security: HIGH
- performance: HIGH
- upstream_callers: HIGH
- downstream_side_effects: HIGH
- stress_findings: HIGH

## Maintainer notes

