## REFACTOR-541 — `odd-platform-specification/openapi.yaml` has ZERO `securitySchemes` block — the spec is completely silent on the platform's 4 UI auth modes + S2S + Ingestion filter; SDK generators silently produce auth-less clients

**Severity**: MEDIUM
**Category**: missing-spec-coverage + spec-vs-doc-drift + SDK-quality-gap
**Batch**: Z (2026-05-20)
**Pillars affected**: [P-11-platform-api-developer-surface (the spec IS this pillar), P-09-security-access-control (the auth model the spec fails to declare)]

**Surfaced by**:
- `openapi.yaml.md:bugs_limitations_corner_cases.[0]` (MEDIUM) — "**No `securitySchemes` block declared** — the spec is completely silent on the platform's authentication model. Live security docs at `https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security` (per system-mission.md P-09) enumerate 4 UI auth modes (DISABLED/LOGIN_FORM/OAUTH2/LDAP) + S2S API-key + Ingestion filter. None of these are machine-readable from the spec. SDK generators cannot produce typed authentication clients; third-party consumers must reverse-engineer auth from the running service."
- `openapi.yaml.md:security.known_security_gaps.[1]` (MEDIUM) — "**No machine-readable auth → generated SDKs silently omit auth** — third-party SDKs generated from this spec contain NO authentication code (no Bearer token wiring, no session cookie handling, no `X-API-Key` injection). SDK consumers must hand-author auth glue, which is the easiest place for a misconfiguration."

**Statement**: ODD's `odd-platform-specification/openapi.yaml` (4212 lines) + `components.yaml` (2937 lines) declare 194 operations across 35 tags but contain ZERO `components.securitySchemes` block and ZERO operation-level `security:` declarations. Verified by Grep across both files: 0 matches for `securitySchemes`; 0 matches for `security:`.

The live security documentation (`https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security`, per system-mission.md P-09) enumerates SIX distinct authentication mechanisms:
1. `auth.type=DISABLED` (no auth — dev mode)
2. `auth.type=LOGIN_FORM` (session cookie via in-app login form)
3. `auth.type=OAUTH2` (OAuth2 / OIDC — Google / GitHub / Cognito / Okta / Keycloak / Azure)
4. `auth.type=LDAP` (LDAP / Active Directory)
5. `auth.s2s.enabled=true` with `X-API-Key` header (Server-to-Server auth)
6. `auth.ingestion.filter.enabled=true` with collector bearer token (Ingestion filter)

NONE of these are declared in the spec. Consequences:

1. **SDK generators emit auth-less clients.** Tools like `openapi-generator-cli` generate clients without auth-aware code. Third-party consumers must hand-author auth glue (Bearer token wiring, session cookie handling, `X-API-Key` injection) — the easiest place for misconfiguration. A typed SDK that knows "this endpoint requires `X-API-Key`" would fail-closed if the consumer omits the header; today's hand-authored glue fails open (request goes through, server rejects, consumer debugs in production).

2. **Swagger UI doesn't surface auth requirements.** Operators interactively testing endpoints via `{platform-base-url}/api/v3/api-docs` see no "Authorize" button for `X-API-Key`; the Swagger UI assumes the operator authenticates via the UI's session, which is not declared in the spec.

3. **Spec-doc drift creates discovery friction.** Operators reading the spec for SDK generation must ALSO read the live security docs to understand which endpoints need which auth — there's no machine-readable cross-link.

4. **Endpoints that DO require auth and endpoints that DON'T are indistinguishable in the spec.** `POST /api/owners` (requires `OWNER_CREATE` per SecurityConstants) looks identical to `GET /ingestion/entities/{deg_oddrn}` (unauthenticated in every mode per REFACTOR-539) in the OpenAPI surface.

**Primary source citations**:
- `openapi.yaml:1-49` (info + tags + servers — no securitySchemes block declared)
- `components.yaml:1-2937` (no securitySchemes block — Grep verified 0 matches)
- Live security docs page WebFetched 2026-05-20 (status 200) per system-mission P-09 — enumerates 6 auth mechanisms not declared in the spec
- Live api-reference doc WebFetched 2026-05-20 (status 200) — references the spec without surfacing the auth gap
- `SecurityConstants.java:98-355` (the runtime auth wiring lives here, not in the spec — invisible to spec consumers)

**Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-189 NEW batch Z (OpenAPI is the path/method/shape source of truth — explicitly NOT the auth source of truth, by spec omission). ADR-CANDIDATE-001 / 029 / 030 / 031 / 037 (the auth-mode family) declare auth at the RUNTIME layer, not at the spec layer. The architectural opinion (per the openapi-spec sidecar's `implicit_adrs[0]` framing) is that auth is server-side runtime; the GAP is that machine-readable consumers (SDK generators) have no surface to discover this.

**Proposed remedy** (multi-option):

**Option A — Add `securitySchemes` block (MEDIUM effort, HIGH SDK-consumer value)**:
```yaml
components:
  securitySchemes:
    sessionCookie:
      type: apiKey
      in: cookie
      name: SESSION
    s2sApiKey:
      type: apiKey
      in: header
      name: X-API-Key
    ingestionBearerToken:
      type: http
      scheme: bearer
      bearerFormat: Token
    oauth2:
      type: oauth2
      flows:
        authorizationCode:
          authorizationUrl: ${oauth2.authorization-url}
          tokenUrl: ${oauth2.token-url}
          scopes: {...}
```
- Per-operation `security:` declarations on each endpoint reflecting actual runtime gating
- SDK generators emit auth-aware code; Swagger UI shows the Authorize button
- Backwards-compat: existing hand-authored SDK clients continue to work; new clients benefit

**Option B — Live doc cross-link as immediate fix (LOW effort, LOW value)**:
- Update the `developer-guides/api-reference` doc page to surface the auth-coverage table inline
- This is the doc-fix path; does not solve the SDK-generator problem

**Option C — Generate a parallel auth-annotated spec at build time (MEDIUM effort)**:
- Build step that reads `SecurityConstants.java` SECURITY_RULES + the auth.type wiring + emits a `securitySchemes`-augmented version of the spec
- The platform serves both: the unannotated source spec (for spec authoring) and the annotated runtime spec (for SDK consumers)
- Eliminates spec-vs-runtime drift class structurally

Recommend: **Option A (medium-term)** + **Option B (immediate)**. The SDK quality improvement justifies the spec investment; the doc cross-link can ship in a single PR while the spec annotation is authored.

**Severity rationale**: MEDIUM — impacts SDK consumer quality + third-party integration + Swagger UI usability; not a security boundary failure (auth IS enforced at the runtime — see SecurityConstants), just not declared in the spec. The compound with REFACTOR-217 (path-mismatch silent authz bypass) and REFACTOR-539 (3 unauth ingestion endpoints) makes this MEDIUM-near-HIGH because the SDK-consumer experience would catch SOME of those drifts if the spec were authoritative for auth.

**Suggested backlog grouping**: `Spec quality hardening` co-batched with REFACTOR-545 (status-code drift cluster), REFACTOR-217 (path-mismatch), DOC-GAP-099 (4-shape spec-coherence cluster). A single spec-cleanup sprint can close ADR-189's known drift gaps.

---
