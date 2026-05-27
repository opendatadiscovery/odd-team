# SHB-085 — Management-tab list endpoints are universally ungated reads (any authenticated user enumerates Owners / Datasources / Collectors / Titles / Namespaces)

**Category**: merged
**Severity**: MEDIUM

## Hypothesis

Operators authoring a least-privilege policy expect that a user without `OWNER_CREATE/UPDATE/DELETE` cannot read the Owner directory; without `DATA_SOURCE_*` cannot read the Datasource directory; without `COLLECTOR_*` cannot read the Collector inventory (including masked tokens). The actual posture is read-collaborative across EVERY Management tab: `GET /api/owners`, `GET /api/datasources`, `GET /api/collectors`, `GET /api/titles`, `GET /api/namespaces`, `GET /api/owners/providers`, `GET /api/owner_association_request/activity` all have NO `SECURITY_RULES` entry and fall through to `pathMatchers("/**").authenticated()`. ANY authenticated user (and ANY anonymous caller under `auth.type=DISABLED`) enumerates the full directory of every Management surface.

## Evidence

- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/auth/util/SecurityConstants.java:143-147` — Owner rules cover POST/PUT/DELETE only; no GET rule.
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/auth/util/SecurityConstants.java:116-126` — Datasource rules cover POST/PUT/DELETE/token-PUT only; no GET rule for `/api/datasources`.
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/auth/util/SecurityConstants.java:127-137` — Collector rules cover POST/PUT/DELETE/token-PUT only; no GET rule for `/api/collectors` — `getCollectorList` returns masked-token last-6-chars too.
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/auth/util/SecurityConstants.java:98-108` — Namespace rules cover POST/PUT/DELETE only; no GET rule.
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/controller/TitleController.java:14-24` — `/api/titles` has no SecurityRule and no `@PreAuthorize`; reads the entire role-label directory.
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/controller/OwnerAssociationRequestController.java:47-53` + `SecurityConstants.java:148-162` — `GET /api/owner_association_request/activity` is NOT in SECURITY_RULES → the full forensic audit trail of who-requested-association-with-whom is reachable by any authenticated user.
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/controller/OwnerAssociationRequestController.java:81-85` — `GET /api/owners/providers` enumerates the deployment's auth providers (LOGIN_FORM / OAUTH2_GOOGLE / OAUTH2_GITHUB / LDAP); reachable by any authenticated user; reveals deployment topology to a compromised user.
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/auth/handler/AuthorizationCustomizer.java:29-30` — catch-all `pathMatchers("/**").authenticated()` is the floor; under `auth.type=DISABLED` the SecurityWebFilterChain is bypassed entirely (DisabledAuthSecurityConfiguration.java:13-18 `permitAll()`), making every list endpoint anonymously reachable.

## Notes

- This is positioned as the read-collaborative ADR-CANDIDATE-003 (system-mission.md:267) — likely intentional. The hypothesis IS that the design is intentional; the gap is operator-discoverability: the live `/permissions` doc (WebFetched 2026-05-25) names no `*_READ` permissions and is silent on the unauthenticated-read posture across all Management tabs. The OpenAPI spec for these endpoints declares only `200` and `500` — no `403` — implicitly confirming the design intent, but no explicit policy claim is on record.
- Operator-visible blast radius:
  - **Collector masked tokens**: `mapValue` (TokenMapper.java:15-18) returns `"******{last6}"`. A read-only auditor user without any MANAGEMENT permission sees the last-6-chars of every collector token across the platform — narrows a brute-force search space.
  - **Owner directory**: Owner names typically carry PII (`alice@acme.com`, `Bob Smith`, internal-team handles, pseudonymous-research identifiers). On a public-facing deployment hosting personally-named owners, this is an information-disclosure surface.
  - **Owner-association activity log**: a richer forensic dataset than the live request list — historical "who approved Alice's binding to Owner-X at T" is enumerable by any session.
  - **`/api/owners/providers`**: a compromised low-privilege user fingerprints the deployment's IdP topology, useful for tailoring phishing campaigns.
  - **Titles**: low impact (titles are role-labels), but combined with Policy conditions `dataEntity:owner:title == 'Data Steward'`, an attacker can reverse-engineer the policy vocabulary.
- The intentional-read-collaborative stance is consistent with the platform's "catalog discovery" thesis; the gap is between the implicit ADR and the operator's expectation that withholding `*_CREATE` permission AT LEAST restricts read access to the catalog. The discoverability gap is the hypothesis.
- Cross-link to ADR-CANDIDATE-003, REFACTOR-024, REFACTOR-203.

## Next

1. **PROMOTE** to feature: `F-NNN — Management-tab read-collaborative posture (every Management surface enumerable by any authenticated user; anonymous under DISABLED)` with pillar P-09. The feature anchors the implicit ADR-CANDIDATE-003.
2. **DOC-NNN**: explicit `/permissions` page section "What reads are universally allowed?" + per-tab callout on each Management page.
3. **TEST-GAP-NNN**: parametrised security test asserting every Management `GET` endpoint returns 200 to a freshly-authenticated user with zero permissions; AND returns 200 to anonymous under DISABLED.
4. **Backlog**: consider an `MANAGEMENT_DIRECTORY_READ` permission gating these endpoints — operator-customisable for deployments wanting tighter scope. This is a separate proposal, not a bug fix.

## Links

- cluster_with: [F-019, F-020, F-028, F-031, F-033, F-036, F-041]
- merged_into: F-074
- supersedes: []

## evaluation

- **feature-flow-builder 2026-05-26**: graduated to F-074 (Management-Tab Read-Collaborative Posture, pillar P-08). The cross-Management-surface posture is a structural-class feature anchor; 7 contributing read endpoints + 7 drift facets. Note: thread proposed pillar P-09; I chose P-08 because the seven endpoints are all Management surfaces and the discoverability failure is at the Management/Authorization documentation interface — per Slice E's P-08 anchoring. F-074 cross-links to F-019 / F-020 / F-028 / F-031 / F-036 / F-041 and preserves the implicit-ADR-CANDIDATE-003 framing. Category flipped open → merged.
