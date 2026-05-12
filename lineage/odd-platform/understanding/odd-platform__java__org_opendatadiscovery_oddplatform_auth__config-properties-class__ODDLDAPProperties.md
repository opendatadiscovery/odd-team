---
node_id: "odd-platform java org.opendatadiscovery.oddplatform.auth config-properties-class:ODDLDAPProperties"
node_kind: config-properties-class
axis: config_prefixes
extracted_at_commit: ede5d277
enriched_at_commit: ede5d277
extractor_version: 0.1.0
prompt_version: file-analyser/0.2.0
enrichment_status: complete
confidence_overall: HIGH
session_id: session-2026-05-12-D-LDAPProps
---

# ODDLDAPProperties (auth.ldap) — semantic understanding

## understanding

`ODDLDAPProperties` is the `@ConfigurationProperties("auth.ldap")` POJO that captures every deployment knob the LDAP authentication mode reads at boot: the LDAP server URL, the optional bind credentials, the user-locator strategy (DN pattern OR user-filter), the optional group-mapping block, and the optional Active Directory branch. The class participates in only ONE wiring path — `LDAPSecurityConfiguration` declares `@EnableConfigurationProperties(ODDLDAPProperties.class)` at `LDAPSecurityConfiguration.java:52` and injects the bean (`LDAPSecurityConfiguration.java:58`) — and is the sole authoritative description of which keys exist under `auth.ldap.*`. Its `@PostConstruct validate()` (lines 40-49) enforces TWO and ONLY TWO invariants at boot: `auth.ldap.url` non-empty, and at least one of {`auth.ldap.dn-pattern`, `auth.ldap.user-filter.filter`} non-empty; every other field — including `password`, `base`, `groups.admin-groups`, and `active-directory.*` — is unvalidated.

## concepts

- entities: ["auth.ldap configuration prefix", "LDAP server URL", "bind credentials (username + password)", "user-locator strategy (dnPattern OR userFilter)", "Group block (searchBase, filter, adminGroups)", "ActiveDirectory branch (enabled, domain)", "Lombok `@Data`-generated getters/setters", "`@PostConstruct validate()` invariant guard"]
- operations: ["bind `auth.ldap.*` YAML keys to a Spring-managed bean at boot", "expose typed getters for the LDAPSecurityConfiguration wiring code to read", "fail-fast at `@PostConstruct` when URL is empty (line 42-44)", "fail-fast at `@PostConstruct` when neither DN pattern nor user-filter is supplied (line 45-48)"]
- invariants: ["the bean is only instantiated when `LDAPSecurityConfiguration` loads (which itself is gated by `@ConditionalOnProperty(auth.type=LDAP)` at LDAPSecurityConfiguration.java:51) — when `auth.type` is anything else, ODDLDAPProperties is never bound and `auth.ldap.*` keys are ignored", "`@PostConstruct validate()` (lines 40-49) is the ONLY enforced invariant set: URL non-empty, at least one of {dnPattern, userFilter.filter} non-empty", "every field is a plain Java reference type (`String`, `UserFilter`, `Group`, `ActiveDirectory`) with NO declarative validation (no `@NotNull`, no `@Pattern`, no `@URL` from `jakarta.validation.constraints`) — the only validation is the imperative `validate()` method", "`password` is a `String` (line 14), not `char[]`, not a sealed credential type — once read into memory it persists for the JVM lifetime", "Lombok `@Data` (line 10) generates public getter and setter for EVERY field including `password` — there is no per-field `@ToString.Exclude`, `@JsonIgnore`, or other masking"]
- audiences: ["operators configuring LDAP authentication via `application.yml` / environment variables / `--auth.ldap.*` JVM args (the keys this class enumerates are the entire public surface)", "Spring Boot's relaxed-binder (consumes the field names and converts kebab-case YAML keys into the camelCase fields)", "`LDAPSecurityConfiguration` (single consumer; reads every getter at bean construction)"]

## dependencies_semantic

- requires-feature: ["the auth-mode switch — this class is loaded only when `LDAPSecurityConfiguration` is loaded, which is gated by `@ConditionalOnProperty(auth.type=LDAP)` at `LDAPSecurityConfiguration.java:51`", "Spring Boot's `@ConfigurationProperties` infrastructure + relaxed-binder (kebab-case → camelCase, environment-variable mapping, YAML hierarchical binding)", "Lombok `@Data` annotation processor — the getters/setters consumed by `LDAPSecurityConfiguration.java:66-122` do NOT exist as source code; they are generated at compile time"]
- requires-config: ["auth.ldap.url — REQUIRED, non-empty; `validate()` throws `IllegalStateException(\"LDAP server url is not defined\")` at lines 42-44", "auth.ldap.dn-pattern OR auth.ldap.user-filter.filter — at least ONE non-empty; `validate()` throws `IllegalStateException(\"Both DN pattern and user filter are not defined\")` at lines 45-48", "auth.ldap.username — OPTIONAL `String` (line 13); no validation; `null` means anonymous bind at `LdapContextSource.setUserDn(null)` (`LDAPSecurityConfiguration.java:120`)", "auth.ldap.password — OPTIONAL `String` (line 14); no validation; `null` means anonymous bind", "auth.ldap.base — OPTIONAL `String` (line 16); the directory's base DN", "auth.ldap.user-filter.search-base — OPTIONAL `String` (line 23, nested `UserFilter`)", "auth.ldap.groups.search-base / .filter / .admin-groups — OPTIONAL nested `Group` block (lines 28-32); `adminGroups` is `Set<String>` (line 31)", "auth.ldap.active-directory.enabled — OPTIONAL `boolean` (line 36); default `false` (Java primitive default)", "auth.ldap.active-directory.domain — OPTIONAL `String` (line 37)"]
- requires-runtime: ["Spring's `BeanPostProcessor` machinery to invoke `@PostConstruct` after binding", "Apache Commons Lang3 `StringUtils.isEmpty` (line 6) for the validate() guards", "Lombok's compile-time bytecode generation (no runtime dependency)"]

## tests_coverage_semantic

- covered_behaviours: []
- uncovered_behaviours:
  - "behaviour: `validate()` throws on empty URL (lines 42-44)"
  - "behaviour: `validate()` throws when both dnPattern AND userFilter.filter are empty (lines 45-48)"
  - "behaviour: `validate()` PASSES when dnPattern is set and userFilter is null (lines 45-48 — the `userFilter == null` short-circuit)"
  - "behaviour: `validate()` PASSES when userFilter.filter is set and dnPattern is empty"
  - "behaviour: kebab-case YAML keys (`dn-pattern`, `user-filter.search-base`, `admin-groups`, `active-directory.enabled`) bind to the camelCase fields"
  - "behaviour: `Set<String>` for `adminGroups` (line 31) accepts YAML list syntax and deduplicates entries"
  - "behaviour: `active-directory.enabled: true` without `active-directory.domain` is silently accepted (no validation guards the domain field) and would produce a runtime NPE or empty-domain bind when consumed at `LDAPSecurityConfiguration.java:78`"
  - "behaviour: `password` is bound from `auth.ldap.password` and is readable from any caller that holds a reference to the bean"
  - "behaviour: an `ldap://` vs `ldaps://` URL is accepted without distinction by `validate()`"
- test_files: []
- gaps: |
    Zero test coverage of `ODDLDAPProperties.validate()` and zero binding-correctness coverage.
    Grep for `ODDLDAPProperties` under `odd-platform-api/src/test` returns zero matches (verified
    2026-05-12; `grep -rln 'ODDLDAPProperties' <odd-platform-repo>` returns only the source class
    and `LDAPSecurityConfiguration.java`). A regression that
    (1) inverted the `StringUtils.isEmpty(url)` check so missing URLs PASS boot,
    (2) removed the dnPattern-OR-filter XOR so misconfigured deployments pass boot and 401 at
        first login,
    (3) changed the field name `password` to anything Lombok handles differently
        (e.g. losing the `@Data` generation), or
    (4) silently accepted `active-directory.enabled=true` with a null domain (which it already
        does — see uncovered behaviour above)
    would not be caught by the current suite. There is also no test that the `auth.ldap.*` prefix
    binding tolerates the deployment-common case of `AUTH_LDAP_PASSWORD` (environment-variable
    relaxed binding) — this is core Spring Boot behaviour but is unverified end-to-end for this
    class.

## docs_link_semantic

- declared_docs: []
- inferred_docs:
  - url: "https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authentication/ldap"
    anchor: ""
    rationale: "The canonical user-facing page enumerating every `auth.ldap.*` property; this class is the structural counterpart to that page."
    last_verified_at: "2026-05-12T00:00:00Z"
    last_verified_status: 200
    confidence: LOW
- fetched_excerpts: |
    From `https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authentication/ldap` (WebFetched 2026-05-12, status 200):
    - `auth.ldap.url`: "LDAP server url (required)" — example `ldap://localhost:389`
    - `auth.ldap.username`: "The username (principal) to use when authenticating" — Optional
    - `auth.ldap.password`: "The password (credentials) to use when authenticating" — Optional
    - `auth.ldap.dn-pattern`: "Define DN pattern of user names" — example `uid={0},ou=people,dc=mycompany,dc=com`
    - `auth.ldap.user-filter.search-base`: "base DN ... search performed" — Optional, "defaults to root if not supplied"
    - `auth.ldap.user-filter.filter`: "pattern to be used for the user search" — example `(uid={0})`
    - `auth.ldap.groups.search-base`: "base DN from which the search for group membership" — "By default it will be performed from the root"
    - `auth.ldap.groups.filter`: "pattern ... for the user search. Default value is `(member={0})`" — **NOTE the live-doc claim of a default value**
    - `auth.ldap.groups.admin-groups`: "List of groups, which members will be granted admin permissions" — example `admin`
    - `auth.ldap.active-directory.enabled`: "Must be set to `true`"
    - `auth.ldap.active-directory.domain`: example `example.com`
    - The page provides NO guidance on `ldap://` vs `ldaps://`, NO admin-groups matching semantics (exact vs substring vs case sensitivity), NO credentials-exposure warnings (`/actuator/env`, logs), and NO cross-references to S2S or the security overview.
- doc_drift_findings:
  - "The live LDAP docs claim `auth.ldap.groups.filter` has a 'Default value is `(member={0})`'. The Properties class itself supplies NO default — `Group.filter` is a plain `String` (line 30) that initialises to `null`. The default the docs name is set imperatively in `LDAPSecurityConfiguration.java:109-111` only when `StringUtils.isNotEmpty(properties.getGroups().getFilter())` — meaning when the operator does NOT set `auth.ldap.groups.filter`, the Spring `DefaultLdapAuthoritiesPopulator` falls back to ITS OWN default (`(member={0})` — Spring Security default), NOT a default that the Properties class or the platform enforces. The docs misattribute the default's owner."
  - "The Properties class enforces TWO invariants at `@PostConstruct` (lines 42-48): URL non-empty AND at least one of {dnPattern, userFilter.filter}. The live docs do not name these as boot-fail conditions — they say `url` is 'required' and 'one of those search methods' is required ('otherwise application start will fail'), but the docs page does NOT show the exception messages an operator will see in logs (`LDAP server url is not defined` / `Both DN pattern and user filter are not defined`) or that the failure is an `IllegalStateException` (un-recoverable, no retry, no fallback)."
  - "The live docs document `auth.ldap.active-directory.enabled` and `auth.ldap.active-directory.domain` as paired properties but do NOT warn that `domain` is unvalidated. The Properties class (line 37) declares `domain` as plain `String` with no `@NotNull` and no `validate()` coverage. An operator who sets `enabled: true` and forgets `domain` produces a boot-success deployment that NPEs or constructs `ActiveDirectoryLdapAuthenticationProvider(null, url)` at `LDAPSecurityConfiguration.java:78` on the first login. (Per Spring Security's `ActiveDirectoryLdapAuthenticationProvider`, `domain` MAY be null — the provider falls back to non-AD-domain bind semantics — but this is silent and likely not what the operator intended.)"
  - "The live docs document `auth.ldap.password` without any caveat about sensitive-data exposure. The Properties class (line 14) declares `password` as plain `String` with Lombok `@Data` generating a public getter, NO `@ToString.Exclude`, NO `@JsonIgnore`, NO `@Sanitize`. The platform inherits Spring Boot 3.4.10's default actuator behaviour ONLY — there is no platform-side masking discipline."
  - "Live LDAP docs do not document that `auth.ldap.url` accepts ANY scheme (`ldap://`, `ldaps://`, `ldap+tls://`, or even malformed URLs) because the Properties class only checks `StringUtils.isEmpty` (line 42). An operator who configures `auth.ldap.url: corp-ad.example.com:389` (no scheme) gets a successful `validate()` and then a runtime failure at LDAP connect — surface area for misconfiguration."

## implicit_adrs

- "LDAP deployment configuration is a SINGLE flat `@ConfigurationProperties` POJO with three nested classes for sub-blocks (UserFilter / Group / ActiveDirectory), rather than separate property classes per concern. This is the same shape the parallel `ODDOAuth2Properties` uses for OAuth2 — the four auth modes share a structural convention." — evidence: ODDLDAPProperties.java:11-39 (single class with nested static `@Data` classes) + sibling file ODDOAuth2Properties.java in the same package — intent_anchor: the parallel structure across two `@ConfigurationProperties` POJOs in `org.opendatadiscovery.oddplatform.auth` (LDAP + OAuth2) — confidence: MEDIUM (structural pattern, not commented)

- "Boot-time invariant enforcement is via imperative `@PostConstruct` method, NOT declarative `jakarta.validation.constraints` annotations. The platform deliberately throws `IllegalStateException` (not `ConstraintViolationException`) to indicate this is a deployment-wiring failure, not a request-validation failure." — evidence: ODDLDAPProperties.java:40-49 — intent_anchor: explicit `throw new IllegalStateException("LDAP server url is not defined")` (line 43) and `throw new IllegalStateException("Both DN pattern and user filter are not defined")` (line 47) framing the constraints as `IllegalStateException` (boot-wiring class) rather than `IllegalArgumentException` (caller-input class) — confidence: HIGH

- "Active Directory is supported as a NESTED FLAG (`active-directory.enabled: true`) inside the LDAP block, not as a separate `auth.type=ACTIVE_DIRECTORY` mode. The decision is that AD is a flavour of LDAP, not a peer of LDAP — consistent with Spring Security's own `ActiveDirectoryLdapAuthenticationProvider` API surface, which constructs AD providers as specialisations of LDAP providers." — evidence: ODDLDAPProperties.java:19,35-38 (nested `ActiveDirectory` class inside `ODDLDAPProperties`) + LDAPSecurityConfiguration.java:76-83 (the AD branch is INSIDE the `auth.type=LDAP` chain) — intent_anchor: the nesting itself — confidence: HIGH

- "`adminGroups` is a `Set<String>` (line 31), not a `List<String>`. The choice signals that admin-group membership is a set-membership semantic (order-irrelevant, duplicate-free) rather than an ordered list with potential first-match precedence." — evidence: ODDLDAPProperties.java:31 — intent_anchor: the `Set` type (vs `List` used for other comparable allowlists elsewhere in the codebase) — confidence: MEDIUM (the type is the only signal; no comment explains the choice)

## bugs_limitations_corner_cases

- "`password` is declared as `String` (line 14) with Lombok `@Data` (line 10) generating a public getter, with NO `@ToString.Exclude`, NO `@JsonIgnore`, NO `@Sanitize` annotation, and NO platform-side override of Spring Boot's actuator `keys-to-sanitize` (grep confirmed: zero matches for `keys-to-sanitize` under `<odd-platform-repo>`). Spring Boot 3.4.10 (the platform's pinned version at `odd-platform-api/build.gradle:2`) DOES sanitise the `/actuator/env` endpoint by default (`management.endpoint.env.show-values` defaults to `NEVER`), so the password value APPEARS in `env` as `******` rather than as plaintext — this is a Spring Boot default, NOT a platform-authored protection. Consequence: any CODE PATH that explicitly serialises the `ODDLDAPProperties` bean (a `Bean` dump endpoint, a custom controller, a `@RestControllerAdvice` that dumps configuration, an info-contributor, or a deliberate `log.info(\"properties = {}\", properties)`) will emit the password verbatim, because Lombok's `@Data` generates a `toString()` that includes ALL fields including `password`. There is no defence-in-depth at the Properties class level." — evidence: ODDLDAPProperties.java:10,14 (`@Data` + `private String password`) + `<odd-platform-repo>/odd-platform-api/build.gradle:2` (Spring Boot 3.4.10) + grep `keys-to-sanitize` returns zero hits — severity: HIGH

- "`auth.ldap.url` is validated for non-emptiness only (`StringUtils.isEmpty(url)`, line 42), NOT for scheme. An operator can configure `auth.ldap.url: ldap://corp.example.com:389` (plaintext) and `auth.ldap.url: ldaps://corp.example.com:636` (TLS) interchangeably; the Properties class accepts both without distinction. There is no `@Pattern(\"^ldaps://\")`, no `@URL`, no scheme-rejection logic. The downstream consumer (`LdapContextSource.setUrl(...)`, `LDAPSecurityConfiguration.java:119`) also passes the URL verbatim. Operator-visible-only-via-pcap." — evidence: ODDLDAPProperties.java:12,42-44 + LDAPSecurityConfiguration.java:117-124 + WebFetch LDAP docs 2026-05-12 (no LDAPS guidance) — severity: HIGH

- "`Group.adminGroups` is a `Set<String>` (line 31) and the consumer at `LDAPSecurityConfiguration.java:96` matches each LDAP-returned authority against this set using `containsIgnoreCase(properties.getGroups().getAdminGroups(), a.getAuthority())` — which is a **substring**, case-insensitive match (verified via `OperationUtils.containsIgnoreCase` import at `LDAPSecurityConfiguration.java:48`). The Properties class does not restrict entries to valid DN-friendly substrings, does not document the matching semantics in the field name or in a Javadoc, and does not warn that short tokens (`'ops'`, `'admin'`) will collide with any LDAP group whose name contains that substring. An operator who configures `admin-groups: ['ops']` may inadvertently promote anyone in groups named `devops`, `noops`, `appops`, etc." — evidence: ODDLDAPProperties.java:31 + LDAPSecurityConfiguration.java:48,94-98 — severity: HIGH

- "When `auth.ldap.groups` is NOT configured at all (the `Group groups` field at line 18 is `null`) OR `Group.adminGroups` is an empty/null `Set` (line 31), the consumer at `LDAPSecurityConfiguration.java:91-93` returns a `USER`-only authority for every authenticated LDAP user. The bundled `application.yml:50-65` ships the entire `ldap:` block commented out — meaning the OUT-OF-BOX deployment that an operator copies and uncomments will, if they forget `groups.admin-groups`, have NO path to ADMIN via LDAP. The Properties class does not warn (in field naming, Javadoc, or `validate()`) that admin-groups absence is a load-bearing decision; `validate()` only enforces URL and search-method invariants (lines 42-48)." — evidence: ODDLDAPProperties.java:18,28-32,40-49 + LDAPSecurityConfiguration.java:91-93 + `<odd-platform-repo>/odd-platform-api/src/main/resources/application.yml:50-65` (commented-out block) + WebFetch LDAP docs 2026-05-12 (silent on this) — severity: HIGH

- "`ActiveDirectory.domain` (line 37) is unvalidated. The `validate()` method (lines 40-49) does NOT check `ActiveDirectory.enabled=true` implies `ActiveDirectory.domain` non-empty. The downstream consumer at `LDAPSecurityConfiguration.java:78` constructs `new ActiveDirectoryLdapAuthenticationProvider(properties.getActiveDirectory().getDomain(), properties.getUrl())`. If `domain` is `null`, Spring Security's `ActiveDirectoryLdapAuthenticationProvider` accepts it (falls back to non-domain UPN bind), but this is almost certainly not what the operator intended. Silent misconfiguration." — evidence: ODDLDAPProperties.java:36-37,40-49 + LDAPSecurityConfiguration.java:76-83 — severity: MEDIUM

- "`validate()` (lines 40-49) is `@PostConstruct`-annotated, which means it runs AFTER the Spring binder has populated the fields — but the binder runs only when the containing bean is instantiated, which is gated by `LDAPSecurityConfiguration`'s `@ConditionalOnProperty(auth.type=LDAP)` at `LDAPSecurityConfiguration.java:51`. Consequence: if `auth.type` is NOT `LDAP`, ODDLDAPProperties is never bound and `auth.ldap.*` keys are silently ignored. An operator who pastes the example LDAP config into `application.yml` but forgets `auth.type: LDAP` gets a boot-success deployment using whichever auth mode is active, with the LDAP keys neither used nor flagged. There is no `@ConfigurationProperties` validation contract that fires independently of the consumer's `@ConditionalOnProperty`." — evidence: ODDLDAPProperties.java:9-11,40-49 + LDAPSecurityConfiguration.java:51-52 — severity: LOW (operator-confusion; not a security defect)

- "`dnPattern` and `userFilter.filter` are plain `String` fields with NO injection-aware validation. An operator who configures `dn-pattern: uid={0},ou=people,dc=mycompany,dc=com` (the example from the live docs, WebFetched 2026-05-12) has the `{0}` placeholder substituted at runtime with the user-supplied login name. Spring Security's `BindAuthenticator` and `FilterBasedLdapUserSearch` escape LDAP metacharacters (`(`, `)`, `\\`, `*`, NUL) in modern versions, BUT the Properties class does not assert this contract (no `@Pattern`, no Javadoc warning) and does not warn the operator of the implicit dependency on Spring Security's escaping behaviour." — evidence: ODDLDAPProperties.java:15,22-25 + LDAPSecurityConfiguration.java:66-74 + WebFetch LDAP docs 2026-05-12 — severity: LOW (relies on Spring Security's own escaping; surfaced for completeness)

## security

- **auth_mode_relevance**: `LDAP | INTERNAL_ONLY`. This class is not on the HTTP surface — it is the configuration POJO. It loads only when `auth.type=LDAP` is active (via the `LDAPSecurityConfiguration` `@ConditionalOnProperty` at `LDAPSecurityConfiguration.java:51` + `@EnableConfigurationProperties(ODDLDAPProperties.class)` at line 52). The behaviour of every downstream LDAP code path shifts based on what this class binds.
- **ingestion_filter_relevance**: `N/A — not HTTP`. Configuration POJO; does not participate in the ingestion filter chain.
- **authorization_assertions**: `[]`. Configuration POJO does not enforce gates; it provides data the SecurityWebFilterChain uses to enforce gates.
- **owner_scoping**: `N/A — code is not data-scoped`. Configuration POJO.
- **data_exposure**:
  - "`auth.ldap.password` → bound to `ODDLDAPProperties.password` (`String`, line 14) via `@ConfigurationProperties` + Lombok `@Data` getter; accessible to any in-process code holding a reference to the bean. Spring Boot 3.4.10's `/actuator/env` defaults sanitise the value (`management.endpoint.env.show-values: NEVER` is the framework default), so a direct `env` fetch returns `******` — but any platform-authored serialiser (info-contributor, custom controller, `log.info(\"props = {}\", properties)` exploiting the Lombok-generated `toString`) will expose the value verbatim. No platform-side `@ToString.Exclude` or `@JsonIgnore` discipline." — evidence: ODDLDAPProperties.java:10,14 + `<odd-platform-repo>/odd-platform-api/build.gradle:2` (Spring Boot 3.4.10) + `<odd-platform-repo>/odd-platform-api/src/main/resources/application.yml:226-240` (default actuator exposure) + grep `keys-to-sanitize` zero matches in repo
  - "`auth.ldap.username` → same exposure shape as password. Lombok `@Data` generates a public getter and an unmasked `toString()` inclusion." — evidence: ODDLDAPProperties.java:10,13
  - "`auth.ldap.url` → the LDAP server endpoint is operationally sensitive (deployment-topology disclosure) and is bound the same way; no masking." — evidence: ODDLDAPProperties.java:12
- **known_security_gaps**:
  - "No `@ToString.Exclude` or `@JsonIgnore` on `password` (line 14). Lombok `@Data` (line 10) generates `toString()` that includes the password field. Any log statement `log.info(\"properties = {}\", properties)` would emit the cleartext password. Spring Boot 3.4.10's actuator-env sanitisation is the ONLY default protection, and it only covers the `/actuator/env` endpoint — NOT custom serialisation paths." — evidence: ODDLDAPProperties.java:10,14 + `<odd-platform-repo>/odd-platform-api/build.gradle:2` — severity: HIGH
  - "No scheme validation on `url` (line 12). An `ldap://` URL means bind credentials and end-user login credentials travel in cleartext on the wire. The Properties class accepts both `ldap://` and `ldaps://` indistinguishably. The validation method (lines 40-49) only checks non-emptiness." — evidence: ODDLDAPProperties.java:12,42-44 + LDAPSecurityConfiguration.java:117-124 + WebFetch LDAP docs 2026-05-12 (no LDAPS guidance) — severity: HIGH
  - "`adminGroups` is a `Set<String>` (line 31) consumed by `containsIgnoreCase` substring-match at `LDAPSecurityConfiguration.java:96`. The Properties class admits short tokens that collide with unintended LDAP group names via substring containment — admin-escalation surface if the operator uses a short admin-group label like `'ops'`. No format constraint, no length minimum, no warning in field name." — evidence: ODDLDAPProperties.java:31 + LDAPSecurityConfiguration.java:48,94-98 — severity: HIGH
  - "Empty / null `adminGroups` deployment has ZERO LDAP path to ADMIN (`LDAPSecurityConfiguration.java:91-93`). The Properties class neither warns the operator (in field naming, Javadoc, or `validate()`) that this is a load-bearing default, nor does it enforce non-empty admin-groups when the operator clearly wants LDAP to be the only auth path." — evidence: ODDLDAPProperties.java:28-32 + LDAPSecurityConfiguration.java:91-93 — severity: MEDIUM (operability defect — operator may assume LDAP auth gives access to admin endpoints by default)
  - "`ActiveDirectory.enabled=true` is accepted without `ActiveDirectory.domain` being set (line 36-37, no cross-field validation in `validate()`). The downstream consumer constructs `ActiveDirectoryLdapAuthenticationProvider(null, url)` — Spring Security accepts this but the operator's intended AD-bind semantics are silently bypassed." — evidence: ODDLDAPProperties.java:35-38,40-49 + LDAPSecurityConfiguration.java:76-83 — severity: MEDIUM
  - "No `@Validated` annotation on the Properties class (line 11) and no `jakarta.validation.constraints` declarations on any field. The platform deliberately chose imperative validation (`@PostConstruct validate()`) — meaning operators cannot rely on Spring Boot's validation infrastructure to surface multiple errors at once (the first `IllegalStateException` halts boot). An operator with both an empty URL AND missing search-method sees only the URL error and has to retry, see the search-method error, and retry again." — evidence: ODDLDAPProperties.java:9-11,40-49 (no `@Validated` annotation; only `@PostConstruct` imperative check) — severity: LOW (DX defect, not exploit)

## performance

- **hot_paths**: `[]` — configuration POJO; boot-time only.
- **throughput_characteristics**: `[]` — no per-request work.
- **resource_allocation**:
  - "Single bean instance held for the JVM lifetime; field values are immutable in practice (Lombok `@Data` generates setters, but `LDAPSecurityConfiguration` reads getters only — there is no mutation path). Memory footprint is dominated by the strings the operator supplied — typically <1KB total." — evidence: ODDLDAPProperties.java:9-39
- **scaling_characteristics**:
  - "Stateless; instance is shared across all auth requests via the singleton-scoped `LDAPSecurityConfiguration` bean. Horizontal scaling unaffected by this class." — evidence: ODDLDAPProperties.java:9-39 (no shared mutable state visible in this file)
- **known_performance_gaps**: `[]` — no per-request work; performance characteristics live in `LDAPSecurityConfiguration` (`pillars/lineage/odd-platform__java__LDAPSecurityConfiguration__config-key-consumer__auth_type@L51.md` documents the timeout / pooling absences).

## sources

- understanding ← ODDLDAPProperties.java:9-50 + LDAPSecurityConfiguration.java:51-52,58
- concepts.entities ← ODDLDAPProperties.java:9-39
- concepts.operations.[validate-fail-fast on URL] ← ODDLDAPProperties.java:42-44
- concepts.operations.[validate-fail-fast on search-method] ← ODDLDAPProperties.java:45-48
- concepts.invariants.[conditional load] ← LDAPSecurityConfiguration.java:51-52
- concepts.invariants.[validate enforced] ← ODDLDAPProperties.java:40-49
- concepts.invariants.[String password, no masking] ← ODDLDAPProperties.java:10,14
- concepts.invariants.[Lombok @Data generates everything] ← ODDLDAPProperties.java:10
- dependencies_semantic.requires-feature.[conditional auth-mode] ← LDAPSecurityConfiguration.java:51-52
- dependencies_semantic.requires-feature.[ConfigurationProperties binder] ← ODDLDAPProperties.java:9
- dependencies_semantic.requires-feature.[Lombok] ← ODDLDAPProperties.java:5,10,21,27,34
- dependencies_semantic.requires-config.[url required] ← ODDLDAPProperties.java:12,42-44
- dependencies_semantic.requires-config.[dnPattern OR userFilter.filter] ← ODDLDAPProperties.java:15,17,22-25,45-48
- dependencies_semantic.requires-config.[username/password optional] ← ODDLDAPProperties.java:13-14 (no validation guard)
- dependencies_semantic.requires-config.[Group nested optional] ← ODDLDAPProperties.java:18,28-32
- dependencies_semantic.requires-config.[ActiveDirectory nested optional] ← ODDLDAPProperties.java:19,35-38
- dependencies_semantic.requires-runtime.[PostConstruct invocation] ← ODDLDAPProperties.java:3,40
- dependencies_semantic.requires-runtime.[StringUtils.isEmpty] ← ODDLDAPProperties.java:6,42,46
- tests_coverage_semantic.test_files ← grep `ODDLDAPProperties` under `<odd-platform-repo>/odd-platform-api/src/test` returns zero matches (verified 2026-05-12 via `grep -rln 'ODDLDAPProperties' <odd-platform-repo>` — only `ODDLDAPProperties.java` source + `LDAPSecurityConfiguration.java`)
- docs_link_semantic.inferred_docs.[LDAP page] ← WebFetch https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authentication/ldap (2026-05-12, 200)
- docs_link_semantic.doc_drift_findings.[groups.filter default misattribution] ← ODDLDAPProperties.java:30 + LDAPSecurityConfiguration.java:109-111 + WebFetch LDAP docs 2026-05-12
- docs_link_semantic.doc_drift_findings.[validate exception messages not in docs] ← ODDLDAPProperties.java:40-49 + WebFetch LDAP docs 2026-05-12
- docs_link_semantic.doc_drift_findings.[active-directory.domain unvalidated] ← ODDLDAPProperties.java:36-37,40-49 + WebFetch LDAP docs 2026-05-12
- docs_link_semantic.doc_drift_findings.[password unmasked declaration] ← ODDLDAPProperties.java:10,14 + WebFetch LDAP docs 2026-05-12
- docs_link_semantic.doc_drift_findings.[no scheme validation on url] ← ODDLDAPProperties.java:12,42-44 + WebFetch LDAP docs 2026-05-12
- implicit_adrs.[nested classes pattern] ← ODDLDAPProperties.java:11-39 + sibling ODDOAuth2Properties.java (same package, same shape)
- implicit_adrs.[imperative @PostConstruct over jakarta.validation] ← ODDLDAPProperties.java:40-49
- implicit_adrs.[AD as nested flag, not separate auth.type] ← ODDLDAPProperties.java:19,35-38 + LDAPSecurityConfiguration.java:76-83
- implicit_adrs.[Set<String> for adminGroups] ← ODDLDAPProperties.java:31
- bugs_limitations_corner_cases.[password unmasked] ← ODDLDAPProperties.java:10,14 + `<odd-platform-repo>/odd-platform-api/build.gradle:2` + grep `keys-to-sanitize` zero in repo
- bugs_limitations_corner_cases.[no LDAPS enforcement] ← ODDLDAPProperties.java:12,42-44 + LDAPSecurityConfiguration.java:117-124 + WebFetch LDAP docs 2026-05-12
- bugs_limitations_corner_cases.[Set<String> + substring match → collision] ← ODDLDAPProperties.java:31 + LDAPSecurityConfiguration.java:48,94-98
- bugs_limitations_corner_cases.[empty adminGroups → no admins] ← ODDLDAPProperties.java:18,28-32,40-49 + LDAPSecurityConfiguration.java:91-93 + `<odd-platform-repo>/odd-platform-api/src/main/resources/application.yml:50-65`
- bugs_limitations_corner_cases.[AD.domain unvalidated] ← ODDLDAPProperties.java:36-37,40-49 + LDAPSecurityConfiguration.java:76-83
- bugs_limitations_corner_cases.[Properties silently ignored when auth.type ≠ LDAP] ← ODDLDAPProperties.java:9-11,40-49 + LDAPSecurityConfiguration.java:51-52
- bugs_limitations_corner_cases.[dn-pattern/filter injection-aware contract implicit] ← ODDLDAPProperties.java:15,22-25 + LDAPSecurityConfiguration.java:66-74
- security.auth_mode_relevance ← ODDLDAPProperties.java:9 + LDAPSecurityConfiguration.java:51-52
- security.data_exposure.[password] ← ODDLDAPProperties.java:10,14 + `<odd-platform-repo>/odd-platform-api/build.gradle:2` + `<odd-platform-repo>/odd-platform-api/src/main/resources/application.yml:226-240` + grep `keys-to-sanitize` zero
- security.data_exposure.[username] ← ODDLDAPProperties.java:10,13
- security.data_exposure.[url] ← ODDLDAPProperties.java:12
- security.known_security_gaps.[no @ToString.Exclude on password] ← ODDLDAPProperties.java:10,14 + `<odd-platform-repo>/odd-platform-api/build.gradle:2`
- security.known_security_gaps.[no scheme validation] ← ODDLDAPProperties.java:12,42-44 + WebFetch LDAP docs 2026-05-12
- security.known_security_gaps.[adminGroups substring collision] ← ODDLDAPProperties.java:31 + LDAPSecurityConfiguration.java:48,94-98
- security.known_security_gaps.[empty adminGroups → no admins] ← ODDLDAPProperties.java:28-32 + LDAPSecurityConfiguration.java:91-93
- security.known_security_gaps.[AD.domain unvalidated] ← ODDLDAPProperties.java:35-38,40-49 + LDAPSecurityConfiguration.java:76-83
- security.known_security_gaps.[no @Validated, imperative only] ← ODDLDAPProperties.java:9-11,40-49
- performance.resource_allocation ← ODDLDAPProperties.java:9-39
- performance.scaling_characteristics ← ODDLDAPProperties.java:9-39

## confidence_per_field

- understanding: HIGH
- concepts: HIGH
- dependencies_semantic: HIGH
- tests_coverage_semantic: HIGH (zero-coverage is grep-verified across the repo, not inferred)
- docs_link_semantic: MEDIUM (no `@docs` annotation in source; the inferred URL was WebFetched live and confirmed 200; doc-drift findings are HIGH-confidence because the live page's content was directly compared against the Properties-class source code in this session)
- implicit_adrs: MEDIUM (each backed by code structure; only `imperative @PostConstruct over jakarta.validation` is HIGH-confidence because the exception type framing is explicit; the nested-classes pattern is structural-only, no comment)
- bugs_limitations_corner_cases: HIGH (each finding cited to file:line; the `password unmasked` claim is HIGH because Spring Boot 3.4.10's actuator-env defaults were verified via the pinned version + repo grep)
- security: HIGH
- performance: HIGH (configuration POJO; there is no per-request work; the absence is dispositive)

## Maintainer notes

