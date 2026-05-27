# SHB-128 — Every running platform serves the full 194-operation API spec at `/api/v3/api-docs` unauthenticated, including a "ProspectLog" legacy title and a personal contact email

**Category**: merged
**Severity**: MEDIUM

## Hypothesis

Operators deploying ODD Platform receive — as a side effect of the springdoc-openapi default integration — a publicly-served Swagger UI at `{platform-base-url}/api/v3/api-docs`. The full OpenAPI 3.0.3 contract (4212 lines of `openapi.yaml` + 2937 lines of `components.yaml`, declaring 194 operations across 35 tags, with every request/response DTO shape) is discoverable BEFORE any authentication is attempted, in every supported auth mode (DISABLED / LOGIN_FORM / OAUTH2 / LDAP) — `/ingestion/**` is whitelisted entirely, and there is no separate config gate on the Swagger UI's URL. The spec exposes `info.contact.email: ndementev@provectus.com` (a personal email — possible PII), `info.title: ProspectLog data catalog HTTP API contract` (a legacy project name signalling the spec predates the ODD rename, branding-inconsistent with `Open Data Discovery`), and `servers: - url: 'http://localhost' description: stub` (a dev-time placeholder shipped as the public discovery surface for SDK generators).

## Evidence

- `odd-platform-specification/openapi.yaml:1-9` — `info.title: ProspectLog data catalog HTTP API contract`; `info.contact.email: ndementev@provectus.com`; `info.contact.url: https://provectus.com`.
- `odd-platform-specification/openapi.yaml:10-12` — `servers: - url: 'http://localhost' description: stub`. SDK generators consuming the spec target localhost by default.
- `odd-platform-specification/openapi.yaml` — Grep `securitySchemes` returns 0 matches; Grep `security:` returns 0 matches; same for `components.yaml`. The spec is machine-readable for SHAPE but not for AUTH (per openapi-spec sidecar bugs_limitations_corner_cases[0]).
- `https://docs.opendatadiscovery.org/developer-guides/api-reference` (per WebFetch 2026-05-20 status 200 in openapi-spec sidecar) — verbatim: "The full OpenAPI Specification for the ODD API can be accessed at [odd-platform → odd-platform-specification/openapi.yaml]"; AND "The Swagger UI hosted on every running ODD Platform is the place to interactively test the endpoints documented above against your own deployment." The docs DIRECT operators to the Swagger UI URL.
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/utils/SecurityConstants.java:95-96` — `WHITELIST_PATHS` contains `/ingestion/**`. Note: the Swagger UI endpoint `/api/v3/api-docs` is under `/api/**`, not `/ingestion/**`; need to confirm whether it's separately whitelisted OR if its reachability depends on `auth.type=DISABLED`. (springdoc-openapi default behaviour is to serve the spec at the configured path; under OAUTH2/LDAP/LOGIN_FORM, whether the UI auth chain protects `/api/v3/api-docs` is config-dependent.)
- `odd-platform-specification/openapi.yaml:13-48` — 35 tag declarations enumerated; Grep counts: 100 `get:`, 34 `post:`, 34 `put:`, 24 `delete:`, 2 `patch:` = 194 operations total.
- `odd-platform-specification/components.yaml:2799-2808` — `QueryExampleFormData` missing `name` field; `components.yaml:2729-2776` — QueryExample / QueryExampleRef schemas similarly missing `name`. Discoverability surface includes contract-shape gaps that are operator-visible.

## Notes

- **Discoverability is a deliberate part of the operator-facing experience** — the docs explicitly direct operators to Swagger UI; this is a feature, not a bug. The SUB-questions are operator-impact-shaped:
  - Is the Swagger UI auth-gated per deployment mode? Probably reachable under DISABLED (the documented default); reachability under OAUTH2/LDAP/LOGIN_FORM depends on whether `/api/v3/api-docs` (or `/swagger-ui`) is in `SecurityConstants.WHITELIST_PATHS`. Need to verify via Grep `/api/v3/api-docs` in the codebase.
  - Is the spec served REGARDLESS of `auth.type=DISABLED` (always-open API discovery)? If so, the spec is the easiest reconnaissance target before any authentication.
- **The `ProspectLog` legacy title is a BRANDING DEFECT** — the public-facing Swagger UI announces a project name that operators do not recognise. ODD's marketing surfaces (docs site, GitHub README, package names) all say "Open Data Discovery"; the spec served by the running platform says "ProspectLog." This is operator-confusion shaped — an operator who reaches the Swagger UI URL via a Google search may not immediately realise they are looking at the ODD API spec.
- **The `ndementev@provectus.com` contact email is PII exposure on the public surface** — even on a closed deployment with `auth.type=DISABLED`, every caller reaching `{platform-base-url}/api/v3/api-docs` sees this email. The individual may have left Provectus / changed roles / not consented to ongoing contact. The convention in many OpenAPI specs is to use a team alias (`api@example.com`) or a docs URL, not an individual email.
- **The `http://localhost` servers entry is a generator footgun** — SDK code generators (`openapi-generator-cli`, `openapi-typescript`, etc.) use the `servers:` entry as the default base URL. A third-party integration generating an SDK from the published spec produces code that targets `http://localhost` until manually corrected. Per the openapi-spec sidecar this is "operationally, clients pass an explicit base URL; the spec'd `servers:` is ignored in practice" — but it's still a documentation-gap shape.
- The discoverability surface compounds the other shoebox findings:
  - SHB-123 (filter coverage matrix) — Swagger UI reveals the FULL set of 194 endpoints; an attacker reading the spec immediately learns which endpoints are uncovered by which filters. The "security through ambiguity" defence (operators don't realise the endpoints exist) is non-existent.
  - SHB-129 (Slack Events webhook unauthenticated) — Swagger UI lists `/api/slack/events` (if it's in the platform-api spec; need to verify), surfacing the endpoint to anyone before they probe.
- This is `open` — the discoverability mechanism is established, the COMPLETE auth-mode-vs-Swagger-URL matrix is not yet enumerated. The operator-visible symptom (legacy title + personal email + stub servers + per-deployment availability) is all real; the maintainer call is whether to anchor as `F-NNN — Platform OpenAPI Discoverability Surface` or fold into the operator-discoverability-gap doc family.

## Next

1. Verify via Grep `/api/v3/api-docs` + `/swagger-ui` + `springdoc` in `odd-platform-api/src/main/java` — confirm which auth modes protect the Swagger UI URL.
2. Probe-NNN: against a local docker-compose mirror under each auth mode (DISABLED / LOGIN_FORM / OAUTH2 / LDAP), curl `{base}/api/v3/api-docs` unauthenticated; record HTTP status and body presence. Document the 4-cell matrix.
3. Promote to `F-NNN — Platform OpenAPI Discoverability Surface (Swagger UI)` in pillar P-11. Per-deployment availability matrix + contact-email PII surface + ProspectLog branding leak.
4. REFACTOR-NNN: rename `info.title` from `ProspectLog data catalog HTTP API contract` to `Open Data Discovery Platform API`. Cosmetic; rebrand alignment.
5. SEC-NNN: change `info.contact.email` from a personal email to a team alias (`docs@opendatadiscovery.org` or similar) OR replace with `contact.url` only.
6. REFACTOR-NNN: change `servers:` from the `http://localhost` stub to a documented placeholder (`{platform-base-url}/api` per the api-reference page convention).
7. SEC-NNN: add an `auth.swagger.enabled` toggle that gates `/api/v3/api-docs` separately from the rest of the `/api/**` surface, so operators can opt-out of public spec discoverability.

## Links

- cluster_with: [F-029, SHB-123, SHB-129]
- merged_into: F-097
- supersedes: []

## evaluation

- **feature-flow-builder 2026-05-26**: graduate — SHB-128 evidence (6 file:line refs across openapi spec / components / WHITELIST + live docs anchor explicitly directing operators to Swagger UI) anchors a distinct angle from F-029 (which covers the spec CONTENT contract). F-097 anchors the DISCOVERABILITY SURFACE — branding-legacy ProspectLog title + personal contact email `ndementev@provectus.com` + localhost stub server entry + no securitySchemes block + per-auth-mode availability matrix unknown. Minted F-097 at lineage/odd-platform/feature-flows/detail/F-097.yaml (pillar P-11:F-002). Per-auth-mode availability is the load-bearing unknown — probe required.
