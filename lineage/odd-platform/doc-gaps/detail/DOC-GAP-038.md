- **DOC-GAP-038**: `auth.ingestion.filter.enabled=false` default leaves `POST /ingestion/entities` unauthenticated AND `POST /ingestion/alert/alertmanager` covered by NO filter regardless of toggle — undocumented sibling-endpoint coverage gap
  - **Category**: drift
  - **Surfaced by**:
    - `odd-platform__java__IngestionDataEntitiesFilter__config-key-consumer__auth_ingestion_filter_enabled@L20.md:docs_link_semantic.doc_drift_findings.[0,1,2]` (all three HIGH) + `:bugs_limitations_corner_cases.[0,6]` (HIGH) + `:security.known_security_gaps.[0,3]` (HIGH)
    - `concepts.yaml:entities[Ingestion Filter]`
  - **Evidence**: see existing DOC-GAP-038 body (preserved); 2026-05-11 verifications stand.
  - **Proposed doc action**: Three-part doc action — per-datasource bearer-token sub-section, coverage table, default-behaviour admonition. See full text in batch 2026-05-10B retained.
  - **Cross-references**: DOC-GAP-036, DOC-GAP-003, DOC-GAP-034; LSN-001/LSN-002.
  - **Severity rationale**: HIGH — same shape as LSN-001 (attachment-ephemeral default).

#### Batch 2026-05-19-H STRENGTHENS — SQL primary-source confirmation of webhook-not-filter-matched

- Sidecar `odd-platform__java__repository_reactive__repository__ReactiveAlertRepositoryImpl.md:security.ingestion_filter_relevance` confirms verbatim: "`NO — repository is not HTTP. The path-mounted callers split: AlertManagerController (`POST /ingestion/alert/alertmanager`) is NOT gated by IngestionDataEntitiesFilter (the filter only matches `/ingestion/entities` POST). The ingestion processor path (AlertIngestionRequestProcessor) IS reached via `/ingestion/entities` and IS gated.`"
- Sidecar `:security.auth_mode_relevance` adds the `AlertManagerController.java:21` evidence: `@PostMapping(path = "ingestion/alert/alertmanager")` — a path that is NOT `/ingestion/entities` and therefore is NOT covered by the ingestion filter.
- This batch confirms at the **repository/security-aggregate layer** what DOC-GAP-038 captured at the **filter config-key-consumer layer**: the `auth.ingestion.filter.enabled` toggle is a per-path filter binding, and the path-matcher is the asymmetry source. Operators setting the toggle to `true` reasonably assume it protects every `/ingestion/*` endpoint; the path-matcher narrows coverage to one sub-path; the AlertManager webhook is silently outside.
- The doc-side coverage table proposed in DOC-GAP-038 should now include **two columns**: (i) auth.ingestion.filter.enabled = false (today's default) → both `/ingestion/entities` and `/ingestion/alert/alertmanager` are unauthenticated; (ii) auth.ingestion.filter.enabled = true → `/ingestion/entities` is gated by the bearer-token filter, `/ingestion/alert/alertmanager` is STILL unauthenticated. The operator who toggles the flag for production hardening retains a hole on the AlertManager webhook unless they ALSO gate that path at the perimeter.
- Cross-link **DOC-GAP-107** (the new compound AlertManager finding) — DOC-GAP-038 captures the toggle-asymmetry at the filter layer; DOC-GAP-107 captures the broader webhook-coverage + no-dedup + OpenAPI-undocumented gap that the same path-matcher asymmetry enables.

#### Batch 2026-05-19-O STRENGTHENS — FILTER-CLASS-LEVEL primary source confirms path-matching + body-buffering + plaintext-equality + REFACTOR-185 cross-link

- NEW sidecar `odd-platform__java__auth__filter__IngestionDataEntitiesFilter.md` (the FILTER CLASS layer; the earlier `@L20` sidecar covered the ANNOTATION layer) closes a structural triangulation. The filter-class sidecar provides primary-source evidence on FIVE additional dimensions that strengthen DOC-GAP-038's doc-action shape:
  - **PATH MATCHING is the gating mechanism** (per sidecar `invariants.[1]` verbatim): "Path matcher is constructed from a HARD-CODED literal string `\"/ingestion/entities\"` + `HttpMethod.POST` (line 28). The constructor does not accept a path; no `@Value` or property injects one. A new endpoint `POST /ingestion/entities/batch` or `POST /ingestion/entities/v2` would NOT be matched and would bypass the filter silently." This is the structural defect underlying both the AlertManager webhook gap (batch H) AND any future ingestion-endpoint expansion — adding a new path silently degrades the security posture without a compile-time signal.
  - **BODY BUFFERED BEFORE AUTH — DoS surface** (per sidecar `invariants.[4]` verbatim): "Body buffering precedes auth: `super.getBody().collectList()` (line 38) materialises the entire byte stream BEFORE the token check; the body is then `readBody`-parsed to `DataEntityList` to extract `dataSourceOddrn`. An attacker submitting maximum-size 20MB invalid-token requests forces the platform to buffer + parse before rejecting." This is a NEW dimension for DOC-GAP-038's doc-action — the toggle-ON case (intended hardening) still leaves the heap-pressure DoS vector open because the body is parsed before token rejection.
  - **PLAINTEXT-EQUALITY non-constant-time comparison** (per sidecar `invariants.[3]` verbatim): "Token comparison at line 56 is `dto.tokenPojo().getValue().equals(token)` — plaintext `String.equals`, NOT `MessageDigest.isEqual` (not constant-time) and NOT a hash comparison (the token is stored in the `TOKEN` table in plaintext per `RandomStringUtils.randomAlphanumeric(40)` generation)." Strengthens the broader "shared-secret-tokens-stored-plaintext" concept in concepts.yaml AND extends DOC-GAP-038's doc-action to cover the token-storage posture at-rest.
  - **NOTFOUNDEXCEPTION → 5XX (NOT 401)** (per sidecar `invariants.[6]` verbatim): "Only `AccessDeniedException` is caught by `AbstractIngestionFilter.filter` and converted to 401 (line 40). `NotFoundException` (thrown when the payload's dataSourceOddrn is unknown OR the fallback collector lookup is empty) propagates to the default reactive error handler and surfaces as 5xx — a misleading status for a credential resolution failure." Operator-debug surface: a half-configured collector + valid token produces 500 instead of 401; an attacker can distinguish "datasource exists, wrong token" (401) from "datasource does not exist" (5xx) — a minor information-leak.
  - **REFACTOR-185 cross-link** (per sidecar `coherence_check.strengthens` verbatim): "REFACTOR-185 (15-sidecar) — adds the filter-class-level evidence that PATH MATCHING is the gating mechanism; the filter does NOT consult `auth.type`, so when DISABLED bypasses the SecurityWebFilterChain entirely the filter still runs IF registered, but when the filter is NOT registered (default + DISABLED) there is zero check on the ingestion endpoint." The DOC-GAP-082 META (DISABLED-bypasses-RBAC) is now 14-sidecar via this batch-O addition (was 13-sidecar at batch H).
- Doc-side action expansion: the coverage table proposed in DOC-GAP-038 should now ALSO note: (a) the path-matcher is exact-literal (future endpoints under `/ingestion/entities/*` are silently uncovered), (b) the body-buffered-before-auth DoS surface persists under toggle-ON, (c) the at-rest plaintext-token storage means a database-read attack (e.g. read-only SQL injection elsewhere) would yield live ingestion tokens, (d) the 5xx-on-unknown-datasource behaviour is operator-debug-misleading.
- Cross-link **DOC-GAP-082 META** (REFACTOR-185 / DISABLED-bypasses-RBAC) — the filter-class sidecar adds the 14th sidecar to that META and provides the load-bearing "path matching is the gating mechanism" primary-source statement.
- Cross-link **DOC-GAP-087** (sibling ingestion-path coverage gaps) — the filter-class sidecar at `dependencies_semantic.coupling[0]` provides the verbatim path-coverage map: "Path coverage is incomplete by design — only `/ingestion/entities` POST is matched. `/ingestion/datasources` POST is covered by sibling `IngestionDataSourceFilter` (unconditional). `/ingestion/alert/alertmanager` POST (`AlertManagerController.java:21`) has NO filter coverage and NO `@PreAuthorize`. `POST /ingestion/datasources/{id}/dataentities/statistics` and similar nested endpoints on IngestionController have NO ingestion-filter coverage."

#### Batch 2026-05-20-P STRENGTHENS — THIRD ingestion endpoint confirmed at the controller-method tier; the asymmetric two-filter architecture is now sidecar-cited at primary source

- NEW sidecar `odd-platform__java__IngestionController__controller-method__createDataSourceEntity.md` (the controller-method tier for `POST /ingestion/datasources`) provides primary-source confirmation of the THIRD ingestion endpoint's auth model, completing the three-endpoint coverage map:
  - **`POST /ingestion/datasources`** (THIS batch) — `IngestionDataSourceFilter` UNCONDITIONALLY registered (sibling class to `IngestionDataEntitiesFilter`, but with no `@ConditionalOnProperty`); ALWAYS-ON authentication via `Authorization: Bearer <collector-token>`. Per batch-P sidecar `implicit_adrs.[1]` verbatim: "Datasource auth is ALWAYS-ON; data-entity ingestion auth is OFF-BY-DEFAULT — deliberate asymmetry."
  - **`POST /ingestion/entities`** (covered by DOC-GAP-038 originally) — `IngestionDataEntitiesFilter` `@ConditionalOnProperty(value="auth.ingestion.filter.enabled", havingValue="true")`; OFF-BY-DEFAULT.
  - **`POST /ingestion/alert/alertmanager`** (DOC-GAP-003 family; confirmed at batch H and re-confirmed at batch P AlertManagerController.postAlerts sidecar) — NO filter coverage at all; ALWAYS unauthenticated by the platform.
- This batch creates a NEW spinoff DOC-GAP: **DOC-GAP-178** (Ingestion-endpoint auth-model asymmetry — `POST /ingestion/datasources` ALWAYS-ON vs `POST /ingestion/entities` OPT-IN; the asymmetry is structurally encoded in two distinct filter classes but the S2S doc treats them identically). DOC-GAP-178 captures the operator-trap as a HIGH-severity standalone finding; DOC-GAP-038 remains the foundational coverage-gap finding and now anchors on TWO follow-on findings (DOC-GAP-107 + DOC-GAP-178). The trio (DOC-GAP-038 + DOC-GAP-107 + DOC-GAP-178) form a connected cluster covering all three ingestion endpoints' auth model.
- This batch's controller-method sidecar additionally adds **TWO NEW dimensions** that the filter-class layer (batch O) did not surface:
  - **`COLLECTOR_ID_SESSION_KEY` propagation** (NEW DOC-GAP-179) — the always-on filter writes session attribute; the controller reads it. Cluster deployments without sticky sessions break the bridge → HTTP 500 instead of 401. NEW MEDIUM doc-gap on the cluster-deployment surface.
  - **UPSERT-by-ODDRN partial-merge semantics** (NEW DOC-GAP-180) — re-registration only propagates `name` + `description`; namespace-from-payload silently ignored; collector cannot update `connection_url` via this endpoint. NEW MEDIUM doc-gap on the wire-contract surface.
- The META is now complete on the **ingestion-endpoint coverage map**:
  - DOC-GAP-038 — the parent coverage-gap finding (originally focused on `/ingestion/entities` + the AlertManager webhook asymmetry)
  - DOC-GAP-107 (batch H) — the AlertManager-specific webhook compound finding (no-dedup + OpenAPI-undocumented)
  - DOC-GAP-178 (NEW batch P) — the `/ingestion/datasources` always-on filter asymmetry
  - DOC-GAP-179 (NEW batch P) — the WebSession-attribute identity propagation (cluster fragility)
  - DOC-GAP-180 (NEW batch P) — the UPSERT-by-ODDRN partial-merge semantics + namespace inheritance
- Severity stays HIGH at the META level — the cross-endpoint cluster is the platform's largest single-feature security posture (three distinct ingestion endpoints, three distinct auth models, all under-documented). Doc-side action remains a single coverage-table + admonition on the S2S sub-page + cross-references on each individual finding's affected pages.

## Batch X append

#### Batch 2026-05-20-X STRENGTHENS — `permittedPaths` hand-coded whitelist under LOGIN_FORM mode leaves `/ingestion/entities` + `/ingestion/datasources` anonymously reachable regardless of `auth.ingestion.filter.enabled`

The original DOC-GAP-038 was anchored on `IngestionDataEntitiesFilter` (the filter-config-key-consumer sidecar from batch B). The batch-X LoginFormSecurityConfiguration sidecar adds the LOGIN_FORM-mode-specific evidence:

- **`LoginFormSecurityConfiguration.java:49-51`** (per sidecar primary source): verbatim `permittedPaths` array includes `/ingestion/entities` + `/ingestion/datasources` + `/api/slack/events` — these paths are PERMIT-ALL under LOGIN_FORM regardless of `auth.ingestion.filter.enabled` setting.

The auth-mode-tier consequence is structurally identical to the DISABLED-mode pattern that DOC-GAP-082 META captures: under LOGIN_FORM, the SecurityWebFilterChain's `.authorizeExchange(...)` lambda explicitly permit-alls the ingestion paths at the chain-construction tier — BEFORE the `auth.ingestion.filter.enabled` toggle has a chance to apply (since the filter is wired conditionally on `auth.ingestion.filter.enabled=true`, not unconditionally).

**The LOGIN_FORM permittedPaths array vs `SecurityConstants.WHITELIST_PATHS` divergence** (per LoginFormSecurityConfiguration sidecar `implicit_adrs.[hand-rolled-whitelist-divergence]`):
- LOGIN_FORM hand-coded list: `["/actuator/health", "/favicon.ico", "/ingestion/entities", "/ingestion/datasources", "/api/slack/events"]`
- `SecurityConstants.WHITELIST_PATHS` (used by AuthorizationCustomizer under OAUTH2/LDAP): `["/actuator/**", "/favicon.ico", "/ingestion/**", "/img/**", "/api/slack/events"]`

The two lists diverge:
- LOGIN_FORM is NARROWER on `/actuator/**` (only `/actuator/health` is whitelisted, not the prometheus/env/info endpoints)
- LOGIN_FORM is NARROWER on `/ingestion/**` (only `/ingestion/entities` + `/ingestion/datasources` are explicitly whitelisted, not other `/ingestion/*` subpaths)
- LOGIN_FORM is MISSING `/img/**`

For the `/ingestion/*` family specifically: under LOGIN_FORM, ONLY `/ingestion/entities` and `/ingestion/datasources` are permit-all. Other `/ingestion/*` paths (e.g., `/ingestion/alert/alertmanager` per AlertManagerController.java) fall through to `.pathMatchers("/**").authenticated()` — they require authentication under LOGIN_FORM but are then WIDE-OPEN to any form-authenticated ADMIN user (per DOC-GAP-218).

**The auth-mode coverage of the `/ingestion/*` family**:
| Path | DISABLED | LOGIN_FORM | OAUTH2 / LDAP |
|---|---|---|---|
| `/ingestion/entities` | permit-all | **permit-all (NEW batch X)** | whitelisted via SecurityConstants |
| `/ingestion/datasources` | permit-all | **permit-all (NEW batch X)** | whitelisted via SecurityConstants |
| `/ingestion/alert/alertmanager` | permit-all | authenticated-but-any-user-ADMIN | whitelisted via SecurityConstants (no filter) |
| `/ingestion/...` (other paths) | permit-all | authenticated-but-any-user-ADMIN | whitelisted via SecurityConstants |

The structural insight: under THREE of four auth modes, every `/ingestion/*` path is effectively anonymously-reachable OR ADMIN-equivalent. The `auth.ingestion.filter.enabled` toggle only applies to `/ingestion/entities` POST and only when the filter is wired (per IngestionDataEntitiesFilter sidecar) — even when enabled, the toggle doesn't cover the other ingestion paths AND doesn't cover the permit-all paths under LOGIN_FORM (the filter would have to compete with the permittedPaths at the chain-construction tier).

**The compound with DOC-GAP-082 META**: the META's DISABLED-bypass-RBAC pattern is mirrored by LOGIN_FORM in the auth-mode-tier — the ingestion paths inherit the same anonymous-reachability under both DISABLED and LOGIN_FORM. The doc-side fix on DOC-GAP-038 needs to enumerate the auth-mode-tier coverage:

- "**`/ingestion/entities` is permit-all under DISABLED AND LOGIN_FORM**, regardless of `auth.ingestion.filter.enabled`. Under DISABLED, the chain's `.anyExchange().permitAll()` makes ALL paths anonymous. Under LOGIN_FORM, the hand-coded `permittedPaths` array at `LoginFormSecurityConfiguration.java:49-51` explicitly permit-alls `/ingestion/entities`. **Only under OAUTH2 and LDAP** does the ingestion filter actually gate the POST — and only when `auth.ingestion.filter.enabled=true` (the shipped default is `false`)."

**Severity stays HIGH** — the operator-trap shape ("set auth.ingestion.filter.enabled=true to protect /ingestion/entities") only protects the path under OAUTH2/LDAP. Operators on DISABLED or LOGIN_FORM are bypassed regardless. The doc-side fix is bounded (extend the existing coverage table in DOC-GAP-038 with the auth-mode-tier dimension).

**Coherence**: strengthens=1 (DOC-GAP-038 with LOGIN_FORM evidence), supersedes=0, conflicts_surfaced=0.

## Batch Z append

## Batch Z append

#### Batch 2026-05-20-Z STRENGTHENS — cluster promoted from 3 endpoints to 6 endpoints; THREE NEW unauthenticated ingestion endpoints

Batch Z's three IngestionController controller-method sidecars (`getDataEntitiesByDEGOddrn` + `postDataSetStatsList` + `ingestMetrics`) each surface as INDEPENDENT unauthenticated ingestion endpoints, promoting the DOC-GAP-038 cluster from 3 endpoints (entities POST + alertmanager + datasources) to SIX endpoints.

**The compound ingestion-namespace auth-coverage table** (per the three new findings):

| Endpoint | Auth coverage | `auth.ingestion.filter.enabled` effect | DOC-GAP |
|---|---|---|---|
| POST `/ingestion/entities` | Whitelisted via `SecurityConstants` AND gated by `IngestionDataEntitiesFilter` IFF property `true` | Toggle gates this path; `true` → bearer-token required; `false` (default) → unauthenticated | DOC-GAP-038 (original) |
| **GET `/ingestion/entities/{degOddrn}` (NEW batch Z)** | Whitelisted via `SecurityConstants` AND NOT covered by ANY filter | Toggle has NO effect; the path is unauthenticated regardless | **DOC-GAP-238 NEW** |
| **POST `/ingestion/entities/datasets/stats` (NEW batch Z)** | Whitelisted via `SecurityConstants` AND NOT covered by ANY filter | Toggle has NO effect; the path is unauthenticated regardless | **DOC-GAP-239 NEW** |
| POST `/ingestion/datasources` | Whitelisted via `SecurityConstants` AND gated by `IngestionDataSourceFilter` UNCONDITIONALLY | Toggle has NO effect; the filter is always-on | DOC-GAP-178 (batch P) |
| POST `/ingestion/alert/alertmanager` | Whitelisted via `SecurityConstants` AND NOT covered by ANY filter | Toggle has NO effect; the path is unauthenticated regardless | DOC-GAP-003 / DOC-GAP-107 |
| **POST `/ingestion/metrics` (NEW batch Z)** | Whitelisted via `SecurityConstants` AND NOT covered by ANY filter | Toggle has NO effect; the path is unauthenticated regardless | **DOC-GAP-240 NEW** |

**The structural insight: FOUR of six endpoints have NO opt-in toggle even in principle** (alertmanager + getDEG + stats + metrics). The other two endpoints (entities POST + datasources POST) have varying mitigation: entities POST has the `auth.ingestion.filter.enabled` toggle; datasources POST is always-on. Operators believing the platform's S2S surface is "lockable" by setting one toggle are mistaken — only ONE endpoint is gated by the toggle.

**The doc-side coverage-table expansion** (per the three new findings' proposed actions):
- Extend the live `/configuration-and-deployment/enable-security` page's existing ingestion-filter coverage enumeration to name ALL six endpoints + their respective auth coverage shapes.
- Cross-reference from each operator-facing page (data-quality for stats, configuration-and-deployment for metrics, the S2S sub-page for getDEG read) — so operators discovering an endpoint at any page also discover the auth caveat.
- The `/configuration-and-deployment/enable-security` page (WebFetched 2026-05-20 status 200) ALREADY enumerates `/ingestion/entities/datasets/stats` + `/ingestion/alert/alertmanager` + `/ingestion/entities/degs/children` as paths "outside the ingestion filter's coverage" but is MISSING `/ingestion/metrics` and the `GET /ingestion/entities/{degOddrn}` sibling — this batch's findings add those.

**The structural code-side fix** (across all six endpoints): a single PR can broaden `IngestionDataEntitiesFilter`'s path matcher to `/ingestion/**` for ALL HTTP methods (subject to backwards-compatibility with the existing POST tests + the `IngestionDataSourceFilter`'s always-on coverage on `/ingestion/datasources` POST). The PR closes the cluster's coverage gap at the path-matcher level. Alternatively, per-endpoint filters (sibling `IngestionMetricsFilter`, `IngestionReadFilter`) preserve the per-endpoint opt-in semantics.

**The compound with DOC-GAP-082 META (DISABLED-bypasses-RBAC)**: under DISABLED, ALL six endpoints are anonymously reachable. Under OAUTH2/LDAP, the four no-filter endpoints remain anonymously reachable (whitelisted via `SecurityConstants`); the two filter-gated endpoints are conditionally gated. Under LOGIN_FORM (per batch X's `LoginFormSecurityConfiguration` evidence), the `permittedPaths` hand-coded list explicitly permit-alls `/ingestion/entities` + `/ingestion/datasources` — so EVEN MORE endpoints are unauthenticated under LOGIN_FORM than under OAUTH2/LDAP. The auth-mode coverage of the `/ingestion/*` family is highly non-uniform.

**Severity stays HIGH** at the META framing — the cluster is now 6 endpoints with 4 having no opt-in protection. The doc-side fix is bounded but spans multiple pages; the code-side fix is structurally cheap on the filter path-matcher line. Coherence: strengthens DOC-GAP-038 with THREE NEW endpoint instances (DOC-GAP-238 + DOC-GAP-239 + DOC-GAP-240) + the operator-trap framing at higher granularity. No conflicts with existing batch-H/O/P/Q/R/X framing.
