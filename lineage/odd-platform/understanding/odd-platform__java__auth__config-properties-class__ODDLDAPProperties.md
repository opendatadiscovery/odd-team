---
node_id: "odd-platform java org.opendatadiscovery.oddplatform.auth config-properties-class:ODDLDAPProperties"
node_kind: config-properties-class
axis: config_prefixes
extracted_at_commit: 4ec2b20
enriched_at_commit: 4ec2b20
extractor_version: 0.1.0
prompt_version: file-analyser/0.4.0
enrichment_status: complete
confidence_overall: HIGH
session_id: session-2026-05-26-ZK-LDAPProps
---

# ODDLDAPProperties (auth.ldap) — semantic understanding

## understanding

`ODDLDAPProperties` is the `@ConfigurationProperties("auth.ldap")` POJO that
captures every deployment knob the LDAP authentication mode reads at boot:
the LDAP server URL, the optional bind credentials, the user-locator
strategy (DN pattern OR user-filter), the optional group-mapping block, and
the optional Active Directory branch. The class participates in only ONE
wiring path — `LDAPSecurityConfiguration` declares
`@EnableConfigurationProperties(ODDLDAPProperties.class)` at
`LDAPSecurityConfiguration.java:52` and injects the bean (line 58) — and is
the sole authoritative description of which keys exist under `auth.ldap.*`.
Its `@PostConstruct validate()` (lines 40-49) enforces TWO and ONLY TWO
invariants at boot: `auth.ldap.url` non-empty, and at least one of
{`auth.ldap.dn-pattern`, `auth.ldap.user-filter.filter`} non-empty; every
other field — including `password`, `base`, `groups.admin-groups`, and
`active-directory.*` — is unvalidated.

## concepts

- entities: ["auth.ldap configuration prefix", "LDAP server URL", "bind credentials (username + password)", "user-locator strategy (dnPattern OR userFilter)", "Group block (searchBase, filter, adminGroups)", "ActiveDirectory branch (enabled, domain)", "Lombok `@Data`-generated getters/setters", "`@PostConstruct validate()` invariant guard"]
- operations: ["bind `auth.ldap.*` YAML keys to a Spring-managed bean at boot", "expose typed getters for the LDAPSecurityConfiguration wiring code to read", "fail-fast at `@PostConstruct` when URL is empty (lines 42-44)", "fail-fast at `@PostConstruct` when neither DN pattern nor user-filter is supplied (lines 45-48)"]
- invariants: ["the bean is only instantiated when `LDAPSecurityConfiguration` loads (which itself is gated by `@ConditionalOnProperty(auth.type=LDAP)` at LDAPSecurityConfiguration.java:51) — when `auth.type` is anything else, ODDLDAPProperties is never bound and `auth.ldap.*` keys are ignored", "`@PostConstruct validate()` (lines 40-49) is the ONLY enforced invariant set: URL non-empty, at least one of {dnPattern, userFilter.filter} non-empty", "every field is a plain Java reference type (`String`, `UserFilter`, `Group`, `ActiveDirectory`) with NO declarative validation (no `@NotNull`, no `@Pattern`, no `@URL` from `jakarta.validation.constraints`) — the only validation is the imperative `validate()` method", "`password` is a `String` (line 14), not `char[]`, not a sealed credential type — once read into memory it persists for the JVM lifetime", "Lombok `@Data` (line 10) generates public getter and setter for EVERY field including `password` — there is no per-field `@ToString.Exclude`, `@JsonIgnore`, or other masking", "the class is bound only ONCE per boot — `auth.ldap.*` values are immutable for the JVM lifetime; rotating LDAP bind credentials requires a restart"]
- audiences: ["operators configuring LDAP authentication via `application.yml` / environment variables / `--auth.ldap.*` JVM args (the keys this class enumerates are the entire public surface)", "Spring Boot's relaxed-binder (consumes the field names and converts kebab-case YAML keys into the camelCase fields)", "`LDAPSecurityConfiguration` (single consumer; reads every getter at bean construction)"]

## dependencies_semantic

- requires-feature: ["the auth-mode switch — this class is loaded only when `LDAPSecurityConfiguration` is loaded, which is gated by `@ConditionalOnProperty(auth.type=LDAP)` at `LDAPSecurityConfiguration.java:51`", "Spring Boot's `@ConfigurationProperties` infrastructure + relaxed-binder (kebab-case → camelCase, environment-variable mapping, YAML hierarchical binding)", "Lombok `@Data` annotation processor — the getters/setters consumed by `LDAPSecurityConfiguration.java:66-122` do NOT exist as source code; they are generated at compile time", "Spring's lifecycle machinery (`BeanPostProcessor`) for `@PostConstruct` invocation after binding"]
- requires-config: ["auth.ldap.url — REQUIRED, non-empty; `validate()` throws `IllegalStateException(\"LDAP server url is not defined\")` at lines 42-44", "auth.ldap.dn-pattern OR auth.ldap.user-filter.filter — at least ONE non-empty; `validate()` throws `IllegalStateException(\"Both DN pattern and user filter are not defined\")` at lines 45-48", "auth.ldap.username — OPTIONAL `String` (line 13); no validation; `null` means anonymous bind at `LdapContextSource.setUserDn(null)` (`LDAPSecurityConfiguration.java:120`)", "auth.ldap.password — OPTIONAL `String` (line 14); no validation; `null` means anonymous bind", "auth.ldap.base — OPTIONAL `String` (line 16); the directory's base DN", "auth.ldap.user-filter.search-base — OPTIONAL `String` (line 23, nested `UserFilter`)", "auth.ldap.groups.search-base / .filter / .admin-groups — OPTIONAL nested `Group` block (lines 28-32); `adminGroups` is `Set<String>` (line 31)", "auth.ldap.active-directory.enabled — OPTIONAL `boolean` (line 36); default `false` (Java primitive default)", "auth.ldap.active-directory.domain — OPTIONAL `String` (line 37); UNVALIDATED even when enabled=true"]
- requires-runtime: ["Spring's `BeanPostProcessor` machinery to invoke `@PostConstruct` after binding", "Apache Commons Lang3 `StringUtils.isEmpty` (line 6) for the validate() guards", "Lombok's compile-time bytecode generation (no runtime dependency)"]

## tests_coverage_semantic

- covered_behaviours: []
- uncovered_behaviours:
  - behaviour: "`validate()` throws on empty URL (lines 42-44)"
    test_class: unit
    criticality: HIGH
    note: "Boot-fail invariant; trivial to test but currently asserted by zero tests."
  - behaviour: "`validate()` throws when both dnPattern AND userFilter.filter are empty (lines 45-48)"
    test_class: unit
    criticality: HIGH
  - behaviour: "`validate()` PASSES when dnPattern is set and userFilter is null (lines 45-48 — the `userFilter == null` short-circuit)"
    test_class: unit
    criticality: MEDIUM
  - behaviour: "`validate()` PASSES when userFilter.filter is set and dnPattern is empty"
    test_class: unit
    criticality: MEDIUM
  - behaviour: "kebab-case YAML keys (`dn-pattern`, `user-filter.search-base`, `admin-groups`, `active-directory.enabled`) bind to the camelCase fields"
    test_class: integration
    criticality: MEDIUM
  - behaviour: "`Set<String>` for `adminGroups` (line 31) accepts YAML list syntax AND the docs-promised comma-separated single-string syntax — both must converge to the same Set"
    test_class: integration
    criticality: HIGH
    note: "Live docs (WebFetched 2026-05-26, status 200) say `Comma-separated group names`; Spring Boot's relaxed-binder accepts both comma-separated and YAML-list — verify both paths work and produce the same Set."
  - behaviour: "`active-directory.enabled: true` without `active-directory.domain` is silently accepted (no validation guards the domain field) and would produce a runtime NPE or non-AD-bind shape when consumed at `LDAPSecurityConfiguration.java:78`"
    test_class: integration
    criticality: HIGH
    note: "See probe P-185."
  - behaviour: "`password` is bound from `auth.ldap.password` and appears as masked (`******`) in `/actuator/env` but verbatim in any Lombok-toString log emission"
    test_class: security
    criticality: HIGH
    note: "See probe P-186."
  - behaviour: "an `ldap://` vs `ldaps://` URL is accepted without distinction by `validate()`"
    test_class: security
    criticality: HIGH
  - behaviour: "an `auth.ldap.url` with no scheme (`corp-ad.example.com:389`) passes `validate()` and fails at runtime in `LdapContextSource.setUrl(...)`"
    test_class: integration
    criticality: MEDIUM
- test_files: []
- gaps: |
    Zero test coverage of `ODDLDAPProperties.validate()` and zero
    binding-correctness coverage. Greps for `ODDLDAPProperties` under
    `odd-platform-api/src/test` return zero matches (verified 2026-05-26
    via `grep -rln 'ODDLDAPProperties' <odd-platform-repo>` returning only
    `ODDLDAPProperties.java` source + `LDAPSecurityConfiguration.java`
    consumer). A regression that
    (1) inverted the `StringUtils.isEmpty(url)` check so missing URLs PASS boot,
    (2) removed the dnPattern-OR-filter XOR so misconfigured deployments pass
        boot and 401 at first login,
    (3) changed the field name `password` to anything Lombok handles differently
        (e.g. losing the `@Data` generation), or
    (4) silently accepted `active-directory.enabled=true` with a null domain
        (which it already does — see uncovered behaviour above)
    would not be caught by the current suite. There is also no test that the
    `auth.ldap.*` prefix binding tolerates the deployment-common case of
    `AUTH_LDAP_PASSWORD` (environment-variable relaxed binding) — this is
    core Spring Boot behaviour but is unverified end-to-end for this class.
    The worst test-class gap is **security** — every load-bearing claim about
    actuator-env masking, password emission in logs, and substring-match
    admin-group escalation lives unverified in `bugs_limitations_corner_cases`.

## docs_link_semantic

- declared_docs: []
- inferred_docs:
  - url: "https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authentication/ldap"
    anchor: ""
    rationale: "The canonical user-facing page enumerating every `auth.ldap.*` property; this class is the structural counterpart to that page."
    last_verified_at: "2026-05-26T00:00:00Z"
    last_verified_status: 200
    confidence: LOW
  - url: "https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authentication"
    anchor: ""
    rationale: "Parent page enumerating the four auth.type modes; LDAP is one of four sub-pages."
    last_verified_at: "2026-05-26T00:00:00Z"
    last_verified_status: 200
    confidence: LOW
- fetched_excerpts: |
    From `https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authentication/ldap`
    (WebFetched 2026-05-26, status 200):
    - `auth.ldap.url` / `AUTH_LDAP_URL`: Required; "LDAP server URL (e.g., `ldap://localhost:389`)"
    - `auth.ldap.username` / `AUTH_LDAP_USERNAME`: Optional; "Principal for LDAP authentication"
    - `auth.ldap.password` / `AUTH_LDAP_PASSWORD`: Optional; "Credentials for LDAP authentication"
    - Caveat verbatim: "Username and password are not required. If they are not set, operations will be performed by using an anonymous (unauthenticated) context"
    - `auth.ldap.dn-pattern`: Conditional; "Substitute login for `{0}` placeholder"
    - `auth.ldap.user-filter.search-base`: Optional; default "Root"
    - `auth.ldap.user-filter.filter`: Conditional; "Pattern with `{0}` for login"
    - "One method is mandatory; application startup fails without either" (DN pattern OR user-filter)
    - `auth.ldap.groups.search-base`: Optional; default "Root"
    - `auth.ldap.groups.filter`: Optional; default `(member={0})` — **NOTE the live-doc claim of a default value**
    - `auth.ldap.groups.admin-groups`: Optional; "Comma-separated group names granting admin permissions" — **NOTE the docs say comma-separated string; code declares `Set<String>` (line 31) which Spring Boot's binder accepts BOTH a comma-string AND a YAML list**
    - `auth.ldap.active-directory.enabled`: Conditional; "Must be `true` for AD support"
    - `auth.ldap.active-directory.domain`: Conditional; "Required when AD is enabled" — **NOTE the docs say required-when-AD-enabled; code does NOT enforce this (no cross-field validation in `validate()`)**
    - Notable gaps verbatim from the page's "Notable Gaps in Documentation" section: "No distinction between `ldap://` and `ldaps://`", "Admin-groups matching: Case sensitivity, exact vs. substring matching undefined", "No documentation on behavior when admin-groups are absent", "No security warnings about exposing credentials via `/actuator/env`"
- doc_drift_findings:
  - "The live LDAP docs (WebFetched 2026-05-26) claim `auth.ldap.groups.filter` has a `Default value (member={0})`. The Properties class itself supplies NO default — `Group.filter` is a plain `String` (line 30) that initialises to `null`. The default the docs name is set imperatively in `LDAPSecurityConfiguration.java:109-111` only when `StringUtils.isNotEmpty(properties.getGroups().getFilter())` — meaning when the operator does NOT set `auth.ldap.groups.filter`, the Spring `DefaultLdapAuthoritiesPopulator` falls back to ITS OWN default (`(member={0})` — Spring Security framework default), NOT a default that the Properties class or the platform enforces. The docs misattribute the default's owner."
  - "The Properties class enforces TWO invariants at `@PostConstruct` (lines 42-48): URL non-empty AND at least one of {dnPattern, userFilter.filter}. The live docs (WebFetched 2026-05-26) say `url` is 'Required' and 'One method is mandatory; application startup fails without either', but the docs page does NOT show the exception messages an operator will see in logs (`LDAP server url is not defined` / `Both DN pattern and user filter are not defined`) or that the failure is an `IllegalStateException` (un-recoverable, no retry, no fallback)."
  - "The live docs document `auth.ldap.active-directory.domain` as 'Conditional / Required when AD is enabled' but the Properties class (line 37) declares `domain` as plain `String` with no `@NotNull` and no cross-field `validate()` coverage. An operator who sets `enabled: true` and forgets `domain` produces a boot-success deployment whose AD bind is constructed `new ActiveDirectoryLdapAuthenticationProvider(null, url)` at `LDAPSecurityConfiguration.java:78` — Spring Security's provider accepts `domain=null` (falls back to non-domain UPN bind semantics) so the deployment boots but the AD-bind shape is silently degraded. The docs' 'Required' claim is enforced by NO code."
  - "The live docs document `auth.ldap.password` without any caveat about sensitive-data exposure. The Properties class (line 14) declares `password` as plain `String` with Lombok `@Data` generating a public getter, NO `@ToString.Exclude`, NO `@JsonIgnore`, NO `@Sanitize`. The platform inherits Spring Boot 3.4.10's default `/actuator/env` masking behaviour (`management.endpoint.env.show-values: NEVER` is the framework default), so the `env` endpoint returns `******` — but any Lombok-`toString()`-driven log emission would leak the value verbatim, and the docs' 'Notable Gaps' self-flag confirms 'No security warnings about exposing credentials via /actuator/env'."
  - "Live LDAP docs do not document that `auth.ldap.url` accepts ANY scheme (`ldap://`, `ldaps://`, `ldap+tls://`, or even malformed URLs) because the Properties class only checks `StringUtils.isEmpty` (line 42). An operator who configures `auth.ldap.url: corp-ad.example.com:389` (no scheme) gets a successful `validate()` and then a runtime failure at LDAP connect — surface area for misconfiguration."
  - "The live docs say `admin-groups` is a `Comma-separated group names` (string), but the Properties class declares `adminGroups` as `Set<String>` (line 31). Spring Boot's relaxed-binder accepts BOTH a comma-separated string AND a YAML list — they converge. The doc's 'comma-separated' phrasing is INCOMPLETE — operators using YAML list syntax (`admin-groups: ['Admins', 'DataOps']`) also work; the docs do not name this dual syntax. (Mildly drift; mainly an operator-confusion vector when copying from non-YAML config sources.)"
  - "The live docs' own 'Notable Gaps' section enumerates what is NOT documented: ldap-vs-ldaps protocol guidance, admin-groups case/substring semantics, behaviour when admin-groups absent, actuator/env exposure. This is the doc page self-flagging the very drift findings this sidecar surfaces — but the page makes no commitment to closing them. The platform's code-side has not added warnings either; the gap is double-sided."

## implicit_adrs

- "LDAP deployment configuration is a SINGLE flat `@ConfigurationProperties` POJO with three nested static classes for sub-blocks (UserFilter / Group / ActiveDirectory), rather than separate property classes per concern. This is the same shape the parallel `ODDOAuth2Properties` uses for OAuth2 (`ODDOAuth2Properties.java:11-54` — `@ConfigurationProperties(\"auth.oauth2\")` + nested static `OAuth2Provider`) — the auth modes share a structural convention." — evidence: ODDLDAPProperties.java:11-39 + ODDOAuth2Properties.java:11-54 (sibling file, same package, same shape) — intent_anchor: parallel structure across the two `@ConfigurationProperties` POJOs in `org.opendatadiscovery.oddplatform.auth` — confidence: MEDIUM (structural pattern, not commented)

- "Boot-time invariant enforcement is via imperative `@PostConstruct` method, NOT declarative `jakarta.validation.constraints` annotations. The platform deliberately throws `IllegalStateException` (not `ConstraintViolationException`) to indicate this is a deployment-wiring failure, not a request-validation failure. The same pattern appears in `ODDOAuth2Properties.validate()` (line 16-28) with the same `IllegalStateException` framing." — evidence: ODDLDAPProperties.java:40-49 + ODDOAuth2Properties.java:16-28 (both use imperative `@PostConstruct` + IllegalStateException) — intent_anchor: explicit `throw new IllegalStateException(\"LDAP server url is not defined\")` (line 43) and `throw new IllegalStateException(\"Both DN pattern and user filter are not defined\")` (line 47) framing the constraints as `IllegalStateException` (boot-wiring class) rather than `IllegalArgumentException` (caller-input class) — confidence: HIGH

- "Active Directory is supported as a NESTED FLAG (`active-directory.enabled: true`) inside the LDAP block, not as a separate `auth.type=ACTIVE_DIRECTORY` mode. The decision is that AD is a flavour of LDAP, not a peer of LDAP — consistent with Spring Security's own `ActiveDirectoryLdapAuthenticationProvider` API surface, which constructs AD providers as specialisations of LDAP providers." — evidence: ODDLDAPProperties.java:19,35-38 (nested `ActiveDirectory` class inside `ODDLDAPProperties`) + LDAPSecurityConfiguration.java:76-83 (the AD branch is INSIDE the `auth.type=LDAP` chain) — intent_anchor: the nesting itself — confidence: HIGH

- "`adminGroups` is a `Set<String>` (line 31), not a `List<String>`. The choice signals that admin-group membership is a set-membership semantic (order-irrelevant, duplicate-free) rather than an ordered list with potential first-match precedence. The sibling `ODDOAuth2Properties.OAuth2Provider.adminGroups` (line 48) is also `Set<String>` — the platform applies the same data-shape decision across LDAP and OAuth2." — evidence: ODDLDAPProperties.java:31 + ODDOAuth2Properties.java:48 — intent_anchor: the `Set` type vs `List` chosen consistently across both POJOs — confidence: MEDIUM (the type is the only signal; no comment explains the choice)

## bugs_limitations_corner_cases

- "`password` is declared as `String` (line 14) with Lombok `@Data` (line 10) generating a public getter, with NO `@ToString.Exclude`, NO `@JsonIgnore`, NO `@Sanitize` annotation, and NO platform-side override of Spring Boot's actuator `keys-to-sanitize` (grep confirmed: zero matches for `keys-to-sanitize` under `<odd-platform-repo>`). Spring Boot 3.4.10 (the platform's pinned version at `odd-platform-api/build.gradle:2`) DOES sanitise the `/actuator/env` endpoint by default (`management.endpoint.env.show-values` defaults to `NEVER`), so the password value APPEARS in `env` as `******` rather than as plaintext — this is a Spring Boot default, NOT a platform-authored protection. Consequence: any CODE PATH that explicitly serialises the `ODDLDAPProperties` bean (a `Bean` dump endpoint, a custom controller, a `@RestControllerAdvice` that dumps configuration, an info-contributor, or a deliberate `log.info(\"properties = {}\", properties)`) will emit the password verbatim, because Lombok's `@Data` generates a `toString()` that includes ALL fields including `password`. There is no defence-in-depth at the Properties class level." — evidence: ODDLDAPProperties.java:10,14 (`@Data` + `private String password`) + `<odd-platform-repo>/odd-platform-api/build.gradle:2` (Spring Boot 3.4.10) + grep `keys-to-sanitize` returns zero hits — severity: HIGH

- "`auth.ldap.url` is validated for non-emptiness only (`StringUtils.isEmpty(url)`, line 42), NOT for scheme. An operator can configure `auth.ldap.url: ldap://corp.example.com:389` (plaintext) and `auth.ldap.url: ldaps://corp.example.com:636` (TLS) interchangeably; the Properties class accepts both without distinction. There is no `@Pattern(\"^ldaps://\")`, no `@URL`, no scheme-rejection logic. The downstream consumer (`LdapContextSource.setUrl(...)`, `LDAPSecurityConfiguration.java:119`) also passes the URL verbatim. Operator-visible-only-via-pcap. The live LDAP docs (WebFetched 2026-05-26) self-flag this as a 'Notable Gap' in their own copy." — evidence: ODDLDAPProperties.java:12,42-44 + LDAPSecurityConfiguration.java:117-124 + WebFetch LDAP docs 2026-05-26 (Notable-Gaps section names ldaps absence) — severity: HIGH

- "`Group.adminGroups` is a `Set<String>` (line 31) and the consumer at `LDAPSecurityConfiguration.java:96` matches each LDAP-returned authority against this set using `containsIgnoreCase(properties.getGroups().getAdminGroups(), a.getAuthority())` — which is a **substring**, case-insensitive match (verified via `OperationUtils.containsIgnoreCase` import at `LDAPSecurityConfiguration.java:48`). The Properties class does not restrict entries to valid DN-friendly substrings, does not document the matching semantics in the field name or in a Javadoc, and does not warn that short tokens (`'ops'`, `'admin'`) will collide with any LDAP group whose name contains that substring. An operator who configures `admin-groups: ['ops']` may inadvertently promote anyone in groups named `devops`, `noops`, `appops`, etc. The live LDAP docs (WebFetched 2026-05-26) self-flag this as a 'Notable Gap' — 'Case sensitivity, exact vs. substring matching undefined'." — evidence: ODDLDAPProperties.java:31 + LDAPSecurityConfiguration.java:48,94-98 + WebFetch LDAP docs 2026-05-26 — severity: HIGH

- "When `auth.ldap.groups` is NOT configured at all (the `Group groups` field at line 18 is `null`) OR `Group.adminGroups` is an empty/null `Set` (line 31), the consumer at `LDAPSecurityConfiguration.java:91-93` returns a `USER`-only authority for every authenticated LDAP user. The bundled `application.yml:50-65` ships the entire `ldap:` block commented out — meaning the OUT-OF-BOX deployment that an operator copies and uncomments will, if they forget `groups.admin-groups`, have NO path to ADMIN via LDAP. The Properties class does not warn (in field naming, Javadoc, or `validate()`) that admin-groups absence is a load-bearing decision; `validate()` only enforces URL and search-method invariants (lines 42-48). The live docs (WebFetched 2026-05-26) self-flag 'No documentation on behavior when admin-groups are absent'." — evidence: ODDLDAPProperties.java:18,28-32,40-49 + LDAPSecurityConfiguration.java:91-93 + `<odd-platform-repo>/odd-platform-api/src/main/resources/application.yml:50-65` (commented-out block) + WebFetch LDAP docs 2026-05-26 — severity: HIGH

- "`ActiveDirectory.domain` (line 37) is unvalidated. The `validate()` method (lines 40-49) does NOT check `ActiveDirectory.enabled=true` implies `ActiveDirectory.domain` non-empty. The downstream consumer at `LDAPSecurityConfiguration.java:78` constructs `new ActiveDirectoryLdapAuthenticationProvider(properties.getActiveDirectory().getDomain(), properties.getUrl())`. If `domain` is `null`, Spring Security's `ActiveDirectoryLdapAuthenticationProvider` accepts it (falls back to non-domain UPN bind), but this is almost certainly not what the operator intended. Silent misconfiguration. The live docs (WebFetched 2026-05-26) say `domain` is 'Required when AD is enabled' — enforced by no code." — evidence: ODDLDAPProperties.java:36-37,40-49 + LDAPSecurityConfiguration.java:76-83 + WebFetch LDAP docs 2026-05-26 — severity: MEDIUM

- "`validate()` (lines 40-49) is `@PostConstruct`-annotated, which means it runs AFTER the Spring binder has populated the fields — but the binder runs only when the containing bean is instantiated, which is gated by `LDAPSecurityConfiguration`'s `@ConditionalOnProperty(auth.type=LDAP)` at `LDAPSecurityConfiguration.java:51`. Consequence: if `auth.type` is NOT `LDAP`, ODDLDAPProperties is never bound and `auth.ldap.*` keys are silently ignored. An operator who pastes the example LDAP config into `application.yml` but forgets `auth.type: LDAP` gets a boot-success deployment using whichever auth mode is active, with the LDAP keys neither used nor flagged. There is no `@ConfigurationProperties` validation contract that fires independently of the consumer's `@ConditionalOnProperty`." — evidence: ODDLDAPProperties.java:9-11,40-49 + LDAPSecurityConfiguration.java:51-52 — severity: LOW (operator-confusion; not a security defect)

- "`dnPattern` and `userFilter.filter` are plain `String` fields with NO injection-aware validation. An operator who configures `dn-pattern: uid={0},ou=people,dc=mycompany,dc=com` (the example from the live docs, WebFetched 2026-05-26) has the `{0}` placeholder substituted at runtime with the user-supplied login name. Spring Security's `BindAuthenticator` and `FilterBasedLdapUserSearch` escape LDAP metacharacters (`(`, `)`, `\\`, `*`, NUL) in modern versions, BUT the Properties class does not assert this contract (no `@Pattern`, no Javadoc warning) and does not warn the operator of the implicit dependency on Spring Security's escaping behaviour." — evidence: ODDLDAPProperties.java:15,22-25 + LDAPSecurityConfiguration.java:66-74 + WebFetch LDAP docs 2026-05-26 — severity: LOW (relies on Spring Security's own escaping; surfaced for completeness)

## stress_findings

```yaml
stress_findings:
  tunables: []  # No numeric literals > 1 in this file; no @Value with defaults; the only "constants" are the two IllegalStateException message strings (lines 43, 47). No size/timeout/retry knobs are owned by this POJO — those would belong in LDAPSecurityConfiguration (which has none — separate sidecar finding).
  name_behavior_pairs:
    - name: "validate() (@PostConstruct)"
      promise: "Method named `validate()` and `@PostConstruct`-annotated promises post-binding cross-field invariant enforcement; an operator reads `validate()` and expects ALL load-bearing field combinations to be checked."
      implementation: "Enforces ONLY two invariants: (1) url non-empty (line 42-44) and (2) at least one of {dnPattern, userFilter.filter} non-empty (lines 45-48). Does NOT check: active-directory.enabled=true → domain non-empty; url scheme is ldap://-or-ldaps://; admin-groups non-empty when LDAP is the sole auth path; groups.search-base presence when groups.filter is set; username/password pairing (one without the other)."
      drift: DRIFT_NAME_VS_BEHAVIOR
      operator_visible_consequence: "An operator setting `active-directory.enabled=true` without `active-directory.domain` boots successfully and produces a silently-degraded AD bind (null-domain UPN fallback at LDAPSecurityConfiguration.java:78). The `validate()` method by name promises 'I checked your config' — but it actually checks 'I checked exactly 2 of your config knobs'. The set of load-bearing invariants enforced is a STRICT SUBSET of the load-bearing invariants the docs name as 'Required'."
      confidence: STATIC-INFERRED
      evidence: "ODDLDAPProperties.java:40-49 + ODDLDAPProperties.java:35-38 (domain field unvalidated despite enabled) + LDAPSecurityConfiguration.java:76-83 (the silent-degradation site)"
    - name: "ODDLDAPProperties (the class itself, as a `@ConfigurationProperties` POJO bean)"
      promise: "Spring Boot's `@ConfigurationProperties(\"auth.ldap\")` annotation promises the bean will be bound from `auth.ldap.*` keys whenever the platform is started — operators expect their `application.yml` `auth.ldap:` block to drive runtime behaviour by virtue of the annotation alone."
      implementation: "The bean is instantiated ONLY when `LDAPSecurityConfiguration` is loaded — which requires `@ConditionalOnProperty(auth.type=LDAP)` at LDAPSecurityConfiguration.java:51-52 to match. If `auth.type` is DISABLED / LOGIN_FORM / OAUTH2 / unset, the `auth.ldap.*` keys in `application.yml` are silently ignored — the Properties class is NEVER instantiated, validate() NEVER runs, and the keys never produce a single log line."
      drift: MINOR
      operator_visible_consequence: "An operator who pastes the example LDAP config into `application.yml` but forgets to set `auth.type: LDAP` boots successfully under whatever auth mode IS active (frequently the bundled default DISABLED — `application.yml:34`), with the LDAP block silently inert. No warning, no log line, no validation error. This is a CONSEQUENCE of the consumer-side `@ConditionalOnProperty` rather than of the POJO itself, but the promise is broken at the POJO's API surface."
      confidence: STATIC-INFERRED
      evidence: "ODDLDAPProperties.java:9 (@ConfigurationProperties without @EnableConfigurationProperties on the same class) + LDAPSecurityConfiguration.java:51-52 (the gating consumer) + application.yml:34 (DISABLED default)"
  orderings: []  # Configuration POJO has no ORDER BY, no LIMIT, no OFFSET, no Comparator, no aggregation function. Orderings live downstream at the SQL-touching auth flow (none directly emanate from this class).
  auth_gates:
    - location: "ODDLDAPProperties.java:9-11 (the class declaration) + LDAPSecurityConfiguration.java:51 (the conditional)"
      endpoint: "N/A — POJO, not an HTTP endpoint; gates apply via the consumer chain"
      questions:
        - q: "What does this endpoint return for each of DISABLED / LOGIN_FORM / OAUTH2 / LDAP?"
          a: "INTERNAL_ONLY. The class is bound ONLY under LDAP (LDAPSecurityConfiguration.java:51 gates its instantiation). Under DISABLED / LOGIN_FORM / OAUTH2 the class is never instantiated — `auth.ldap.*` keys are inert. Under LDAP, the class drives every behaviour in LDAPSecurityConfiguration: URL → directory connect, credentials → bind shape, dnPattern/filter → user-locator strategy, groups.adminGroups → ADMIN vs USER role assignment."
          confidence: STATIC-INFERRED
          evidence: "LDAPSecurityConfiguration.java:51-52 + ODDLDAPProperties.java:9"
        - q: "What does an unauthenticated caller see?"
          a: "N/A — the class is not HTTP-reachable. The values it binds DO affect what unauthenticated callers see indirectly: an empty `adminGroups` produces a USER-only authority set for every authenticated LDAP user (LDAPSecurityConfiguration.java:91-93), so under LDAP an unauthenticated caller still gets 401, but post-login they have no admin path. The values are reachable via `/actuator/env` (whitelisted at SecurityConstants.java:95-96 `WHITELIST_PATHS = {\"/actuator/**\", ...}` permitAll-ed by AuthorizationCustomizer.java:22-23) — under DISABLED auth mode `/actuator/env` is unauthenticated AND reachable; under LDAP/OAUTH2/LOGIN_FORM it's still permitAll-ed (no auth check on the actuator path)."
          confidence: STATIC-INFERRED
          evidence: "SecurityConstants.java:95-96 + AuthorizationCustomizer.java:22-23 + application.yml:226-240 (env exposure)"
        - q: "What does a wrong-role caller see?"
          a: "N/A — POJO; no role gate on instantiation. The values exposed via `/actuator/env` are NOT role-gated — the actuator path is whitelisted before role evaluation runs."
          confidence: STATIC-INFERRED
          evidence: "AuthorizationCustomizer.java:22-23 (permitAll on WHITELIST_PATHS BEFORE SECURITY_RULES iteration)"
        - q: "Where does the gate live — controller, service, repository, or nowhere?"
          a: "The gate is in the OUTER `@ConditionalOnProperty(auth.type=LDAP)` on `LDAPSecurityConfiguration` (line 51) — instantiation gate, not authorization gate. There is NO gate that restricts WHO can read the bean's values once instantiated; any in-process code holding a Spring `ApplicationContext` reference can `getBean(ODDLDAPProperties.class)` and read the password."
          confidence: STATIC-INFERRED
          evidence: "LDAPSecurityConfiguration.java:51-52 (instantiation gate) + ODDLDAPProperties.java:9-11 (no Spring security on the bean) + Lombok @Data getter (line 10) (public getPassword())"
  resource_boundaries:
    - location: "ODDLDAPProperties.java:9-50 (the entire class — singleton-scoped Spring bean)"
      kind: concurrency
      questions:
        - q: "Can two simultaneous calls produce corrupted state?"
          a: "No mutation path is exercised at runtime — Lombok generates setters but `LDAPSecurityConfiguration` reads getters only. The bean is effectively immutable post-bind. Even if a maintainer added a setter call (e.g. via a hot-reload endpoint), reads/writes on `String` fields are atomic — no torn-write risk. The structural concern is reflective access via `/actuator/env` (READS only)."
          confidence: STATIC-INFERRED
          evidence: "ODDLDAPProperties.java:9-39 (no mutation path in this codebase) + grep `setUrl|setPassword|setUsername` under <odd-platform-repo>/odd-platform-api/src/main/java returns only the Lombok-generated calls in LdapContextSource at LDAPSecurityConfiguration.java:118-122"
        - q: "Is the call replay-safe?"
          a: "Yes — bean construction + `@PostConstruct validate()` are idempotent. Spring instantiates the bean exactly once per refresh; rebinding requires a context refresh, which is not exposed at runtime in this platform."
          confidence: STATIC-INFERRED
          evidence: "ODDLDAPProperties.java:40-49 (validate has no side effects beyond throwing) + Spring's standard @ConfigurationProperties lifecycle"
        - q: "If a cache fronts this, what is the TTL / eviction key / staleness window?"
          a: "No cache. The bean IS the cache — it holds the resolved property values for the JVM lifetime. Config rotation (e.g. rotating the LDAP bind password) requires a platform restart. The bundled actuator surface does NOT include `/actuator/refresh` (spring-cloud-context is not on the classpath — verified by grep)."
          confidence: STATIC-INFERRED
          evidence: "ODDLDAPProperties.java:9-39 (singleton bean) + application.yml:226-240 (no refresh endpoint exposed) + grep `spring-cloud-context|@RefreshScope` under <odd-platform-repo>/odd-platform-api returns zero hits"
  request_inputs:
    - location: "ODDLDAPProperties.java:31 (Group.adminGroups — Set<String>)"
      input_kind: body-field   # nested @ConfigurationProperties field — operator-supplied input at boot
      input_name: "adminGroups (auth.ldap.groups.admin-groups)"
      questions:
        - q: "What does the input NAME promise the caller, in plain user-facing English?"
          a: "Names a SET OF GROUPS whose members are granted admin permissions — operator reads `admin-groups: ['Admins', 'DataOps']` and expects 'users IN the LDAP group named Admins OR DataOps' to be granted admin. The name is plural-with-modifier ('groups') and the doc-page heading is 'Group & Admin Properties' — the promise is membership-based admin assignment."
          confidence: STATIC-INFERRED
          evidence: "ODDLDAPProperties.java:31 + WebFetch LDAP docs 2026-05-26 ('group names granting admin permissions')"
        - q: "When supplied, what does the implementation USE the input for?"
          a: "Bound into `Group.adminGroups` (Set<String>); read by `LDAPSecurityConfiguration.authoritiesMapper` (lines 89-99). At LDAPSecurityConfiguration.java:96, each LDAP-returned `GrantedAuthority.getAuthority()` string is tested against the set via `containsIgnoreCase(adminGroups, authority)` — which delegates to `OperationUtils.containsIgnoreCase` (import line 48) — a CASE-INSENSITIVE SUBSTRING CONTAINMENT test, NOT a set-equality test."
          confidence: STATIC-INFERRED
          evidence: "ODDLDAPProperties.java:31 + LDAPSecurityConfiguration.java:48 (import containsIgnoreCase) + LDAPSecurityConfiguration.java:94-98 (the match site)"
        - q: "Does the implementation's actual scope MATCH the name's promise?"
          a: "TRANSLATES_SILENTLY. The name `admin-groups` promises a discrete set of group names — `containsIgnoreCase` SUBSTRING-matches each authority against EACH set entry. An operator setting `admin-groups: ['ops']` expects users whose authority list contains the literal 'ops' to be admin; the implementation grants admin to users whose authority list contains ANY string containing 'ops' as a substring (case-insensitive) — `devops`, `noops`, `appops`, `oopsgroup`."
          drift: DRIFT_INPUT_NAME_VS_IMPLEMENTATION
          confidence: STATIC-INFERRED
          evidence: "LDAPSecurityConfiguration.java:48,96 (containsIgnoreCase substring contract)"
        - q: "For TRANSLATES_SILENTLY: what does a caller see when their assumption is wrong?"
          a: "(a) Admin escalation by collision: an operator configuring short-token group labels (`ops`, `admin`, `dev`) inadvertently elevates users in any group whose name contains the substring — `devops` group users get ADMIN if `admin-groups: ['ops']`. (b) Cross-data scenario: when LDAP groups are renamed (e.g. `OpsTeam` → `OpsTeamLegacy`) the substring match still hits — there is no migration breakage but also no audit signal. (c) Data-shape transitions: if a directory rename adds a substring (`Admins` → `LegacyAdmins`) the renamed group STILL grants admin via substring. (d) Case folding: `Admins` and `ADMINS` and `admins` are all equivalent — there is no case-sensitive admin-group operators can rely on."
          confidence: STATIC-INFERRED
          evidence: "LDAPSecurityConfiguration.java:48,96 + OperationUtils.containsIgnoreCase (the substring + case-fold contract)"
        - q: "Is there a column/field that DOES match the name and is NOT used? (available-but-unused)"
          a: "Spring Security's `LdapAuthority.getAuthority()` returns the GROUP DN (or `cn` after stripping prefixes) — exact set-equality on the DN is the unambiguous match the name `admin-groups` implies. The implementation chose substring containment instead; the equality path is available (`adminGroups.contains(authority)`) but NOT used."
          confidence: STATIC-INFERRED
          evidence: "LDAPSecurityConfiguration.java:94-98 (the substring choice vs the available Set::contains)"
      routes_to_finding: "bugs_limitations_corner_cases.[adminGroups substring collision] + docs_link_semantic.doc_drift_findings.[admin-groups Notable Gap]"
    - location: "ODDLDAPProperties.java:14 (password — String)"
      input_kind: body-field
      input_name: "password (auth.ldap.password)"
      questions:
        - q: "What does the input NAME promise the caller, in plain user-facing English?"
          a: "A SECRET — the LDAP bind password. Operator expects it handled with credential-grade discipline: masked in observability surfaces, never echoed in logs, scoped to in-process use."
          confidence: STATIC-INFERRED
          evidence: "ODDLDAPProperties.java:14 + WebFetch LDAP docs 2026-05-26 ('Credentials for LDAP authentication')"
        - q: "When supplied, what does the implementation USE the input for?"
          a: "Bound into `String password` (line 14) via `@ConfigurationProperties` + Lombok `@Data`-generated setter; read by `LDAPSecurityConfiguration.ldapContextSource` at line 121 (`ctx.setPassword(properties.getPassword())`). Also: included in Lombok-generated `toString()` (no `@ToString.Exclude` masking — line 10's `@Data` covers all fields)."
          confidence: STATIC-INFERRED
          evidence: "ODDLDAPProperties.java:10,14 + LDAPSecurityConfiguration.java:121"
        - q: "Does the implementation's actual scope MATCH the name's promise?"
          a: "TRANSLATES_SILENTLY. The NAME promises credential-grade handling; the IMPLEMENTATION grants only the framework-default protection (Spring Boot 3.4.10 actuator-env masking, `show-values: NEVER`). There is NO platform-side @ToString.Exclude, NO @JsonIgnore, NO @Sanitize annotation; ANY call site that invokes Lombok-toString-driven serialisation (a log line `log.info(\"props={}\", properties)`, a debug-dump endpoint, a future maintainer's `@RestControllerAdvice` that dumps configuration) emits the password verbatim. The promise is 'secret-grade'; the implementation is 'whatever the framework defaults choose'."
          drift: DRIFT_INPUT_NAME_VS_IMPLEMENTATION
          confidence: STATIC-INFERRED
          evidence: "ODDLDAPProperties.java:10,14 + grep `keys-to-sanitize` zero hits + grep `@ToString.Exclude|@JsonIgnore` on this file zero hits + Spring Boot 3.4.10 actuator-env default"
        - q: "For TRANSLATES_SILENTLY: what does a caller see when their assumption is wrong?"
          a: "(a) Direct: a maintainer writes `log.info(\"ldap config = {}\", ldapProperties)` for debugging — the password is in INFO-level logs (which are routinely shipped to log aggregators). (b) Indirect: a `@RestControllerAdvice` or a custom diagnostic endpoint that serialises the bean to JSON emits the password (no @JsonIgnore guard). (c) Actuator: `/actuator/env` returns `******` (Spring Boot default protects this surface), but the env endpoint is whitelisted (SecurityConstants.java:95-96 + AuthorizationCustomizer.java:22-23) — it returns `******` to ANY caller, authenticated or not. (d) Subtle: a future maintainer adding `keys-to-sanitize` configuration or removing Spring Boot's default protection (or upgrading to a Spring Boot version that changes the default) silently lifts the only protection."
          confidence: STATIC-INFERRED
          evidence: "See P-186 probe — exhaustive runtime confirmation across the 4 auth modes"
        - q: "Is there a column/field that DOES match the name and is NOT used? (available-but-unused)"
          a: "Spring Boot's `@ConfigurationProperties` does support per-field sanitisation via `@org.springframework.boot.actuate.endpoint.SanitizableData`-aware sanitizers; Lombok has `@ToString.Exclude` and Jackson has `@JsonIgnore`. None of these is used on `password` (line 14). The protective annotations ARE available; the platform chose not to apply them."
          confidence: STATIC-INFERRED
          evidence: "ODDLDAPProperties.java:14 (raw field declaration, no protective annotations)"
      routes_to_finding: "bugs_limitations_corner_cases.[password unmasked] + security.known_security_gaps.[no @ToString.Exclude on password] + docs_link_semantic.doc_drift_findings.[password unmasked declaration]"
    - location: "ODDLDAPProperties.java:12 (url — String)"
      input_kind: body-field
      input_name: "url (auth.ldap.url)"
      questions:
        - q: "What does the input NAME promise the caller, in plain user-facing English?"
          a: "A URL — operator expects URL-shaped validation: parsable scheme, host, port; rejection of malformed strings; a hint that the scheme determines transport security (ldap:// vs ldaps://)."
          confidence: STATIC-INFERRED
          evidence: "ODDLDAPProperties.java:12 + WebFetch LDAP docs 2026-05-26 ('LDAP server URL (e.g., ldap://localhost:389)')"
        - q: "When supplied, what does the implementation USE the input for?"
          a: "Bound into `String url`; read by `LDAPSecurityConfiguration.ldapContextSource.setUrl(properties.getUrl())` at line 119. Validation: ONLY `StringUtils.isEmpty(url)` at line 42 — accepts any non-empty string including `not-a-url`, `corp-ad.example.com:389` (no scheme), `ftp://x`, etc."
          confidence: STATIC-INFERRED
          evidence: "ODDLDAPProperties.java:12,42-44 + LDAPSecurityConfiguration.java:117-124"
        - q: "Does the implementation's actual scope MATCH the name's promise?"
          a: "TRANSLATES_SILENTLY. NAME `url` promises URL-validation; IMPLEMENTATION is non-emptiness only. An operator's typo (missing `://`), a copy-paste from a non-LDAP source, or a scheme mismatch (`ldap://` when they meant `ldaps://`) all pass `validate()` and fail at LDAP-connect with a generic JNDI exception."
          drift: DRIFT_INPUT_NAME_VS_IMPLEMENTATION
          confidence: STATIC-INFERRED
          evidence: "ODDLDAPProperties.java:12,42-44 (non-emptiness only) + LDAPSecurityConfiguration.java:117-124 (no scheme guard at consumer either)"
        - q: "For TRANSLATES_SILENTLY: what does a caller see when their assumption is wrong?"
          a: "(a) `ldap://` instead of `ldaps://`: bind credentials AND end-user login credentials travel in cleartext on the wire — operator-visible only via pcap. (b) Missing scheme: passes validate(); fails at LDAP-connect with `MalformedURLException` chained inside a `BeanCreationException` (delayed boot failure with un-obvious root cause). (c) Wrong scheme (`ftp://`): passes validate(); fails similarly with no hint that the property expected ldap:// or ldaps://. (d) HTTPS-shaped URL (`https://corp.example.com`): passes validate(); LDAP connect fails because JNDI's LDAP provider doesn't recognize https."
          confidence: STATIC-INFERRED
          evidence: "ODDLDAPProperties.java:42-44 + WebFetch LDAP docs 2026-05-26 ('Notable Gap': no ldap-vs-ldaps guidance)"
        - q: "Is there a column/field that DOES match the name and is NOT used? (available-but-unused)"
          a: "`jakarta.validation.constraints.@URL` is available (the codebase already declares `jakarta.validation` constraint annotations elsewhere). The validation surface to enforce scheme + parse correctness IS available; the implementation chose `StringUtils.isEmpty` instead."
          confidence: STATIC-INFERRED
          evidence: "ODDLDAPProperties.java:12,42-44 (the choice not to use @URL)"
      routes_to_finding: "bugs_limitations_corner_cases.[no LDAPS enforcement] + security.known_security_gaps.[no scheme validation]"
    - location: "ODDLDAPProperties.java:36-37 (ActiveDirectory — enabled + domain)"
      input_kind: body-field
      input_name: "active-directory.enabled + active-directory.domain (paired)"
      questions:
        - q: "What does the input NAME promise the caller, in plain user-facing English?"
          a: "A paired control: setting `enabled: true` switches authentication to Active Directory mode AND a non-empty `domain` is required (per docs). Operator expects `validate()` to enforce the pairing — that's why both names live in the same nested class."
          confidence: STATIC-INFERRED
          evidence: "ODDLDAPProperties.java:35-38 + WebFetch LDAP docs 2026-05-26 ('domain Required when AD is enabled')"
        - q: "When supplied, what does the implementation USE it for?"
          a: "`enabled` gates the AD branch at LDAPSecurityConfiguration.java:77; if true, `domain` + `url` are passed verbatim into `new ActiveDirectoryLdapAuthenticationProvider(domain, url)` (line 78). `domain` is read with NO null check, NO empty check, NO format check (e.g. `corp.example.com` vs `corp` vs empty)."
          confidence: STATIC-INFERRED
          evidence: "ODDLDAPProperties.java:36-37,40-49 + LDAPSecurityConfiguration.java:76-83"
        - q: "Does the implementation's actual scope MATCH the name's promise?"
          a: "TRANSLATES_SILENTLY. Names promise paired-validation (`enabled` AND `domain`); `validate()` enforces the {url, dnPattern-or-filter} pair but NOT the {enabled, domain} pair. Operator with `enabled: true` + missing `domain` boots successfully — the docs' 'Required' is enforced by zero code."
          drift: DRIFT_INPUT_NAME_VS_IMPLEMENTATION
          confidence: STATIC-INFERRED
          evidence: "ODDLDAPProperties.java:40-49 (no AD pairing check) + LDAPSecurityConfiguration.java:78 (null domain passes through)"
        - q: "For TRANSLATES_SILENTLY: what does a caller see when their assumption is wrong?"
          a: "Spring Security's `ActiveDirectoryLdapAuthenticationProvider(null, url)` accepts the null domain — it falls back to bind-mode without the UPN suffix the operator intended. Effect: every login attempt attempts `<username>@<null-domain>` which Spring rewrites to a bare `<username>` bind; AD rejects it (or worse, succeeds against a different OU than the operator's intended domain scope). The operator-visible failure is 'every AD login returns 401' — with no log line naming the missing `domain` as the root cause. See probe P-185."
          confidence: STATIC-INFERRED
          evidence: "LDAPSecurityConfiguration.java:78 + Spring Security ActiveDirectoryLdapAuthenticationProvider contract"
        - q: "Is there a column/field that DOES match the name and is NOT used? (available-but-unused)"
          a: "The `validate()` method (lines 40-49) is the natural site for the AD cross-field check — the same imperative-validation pattern that enforces {url, dnPattern-or-filter} could enforce {enabled, domain}. The site is available; the platform chose not to add the check."
          confidence: STATIC-INFERRED
          evidence: "ODDLDAPProperties.java:40-49"
      routes_to_finding: "bugs_limitations_corner_cases.[AD.domain unvalidated] + docs_link_semantic.doc_drift_findings.[active-directory.domain unvalidated]"
    - location: "ODDLDAPProperties.java:13 (username — String)"
      input_kind: body-field
      input_name: "username (auth.ldap.username)"
      questions:
        - q: "What does the input NAME promise the caller, in plain user-facing English?"
          a: "The bind principal — operator expects a DN-shaped string (e.g. `cn=admin,dc=example,dc=com`) identifying the LDAP bind identity."
          confidence: STATIC-INFERRED
          evidence: "ODDLDAPProperties.java:13 + WebFetch LDAP docs 2026-05-26 ('Principal for LDAP authentication')"
        - q: "When supplied, what does the implementation USE it for?"
          a: "Bound into `String username`; read at `LdapContextSource.setUserDn(properties.getUsername())` (LDAPSecurityConfiguration.java:120). No validation, no format check, no DN-syntax check."
          confidence: STATIC-INFERRED
          evidence: "ODDLDAPProperties.java:13 + LDAPSecurityConfiguration.java:120"
        - q: "Does the implementation's actual scope MATCH the name's promise?"
          a: "MATCHES — `username` is read and bound to `LdapContextSource.userDn` which is the standard Spring LDAP bind-principal slot. The 'username' label is mildly misleading (LDAP convention is 'bind DN', not 'username') but the implementation does what an operator reading the docs would expect."
          drift: MINOR
          confidence: STATIC-INFERRED
          evidence: "LDAPSecurityConfiguration.java:120 + Spring LDAP LdapContextSource.setUserDn contract"
        - q: "For TRANSLATES_SILENTLY: what does a caller see when their assumption is wrong?"
          a: "N/A — MATCHES (with a minor label imprecision: 'username' vs 'bind DN'). An operator who supplies a bare `admin` username (not a DN) when the directory expects DN-form binds will receive a generic bind-failure at first login — but this is Spring LDAP's contract, not a platform-introduced silent translation."
          confidence: STATIC-INFERRED
          evidence: "LDAPSecurityConfiguration.java:120"
        - q: "Is there a column/field that DOES match the name and is NOT used? (available-but-unused)"
          a: "NONE — `userDn` IS the LDAP-bind concept; the field name `username` is a friendly alias for it."
          confidence: STATIC-INFERRED
          evidence: "LDAPSecurityConfiguration.java:120"
      routes_to_finding: "(no finding — MATCHES with minor label drift)"
  probes_emitted:
    - probe_id: P-186
      question: "Does `/actuator/env` mask `auth.ldap.password` across all 4 auth modes (DISABLED / LOGIN_FORM / OAUTH2 / LDAP), AND does a Lombok-toString log emission leak the password verbatim? Pin the dual surface (env-protected, log-unprotected)."
      probe_path: "lineage/odd-platform/probes/P-186.yaml"
    - probe_id: P-184
      question: "With `auth.ldap.groups.admin-groups: ['ops']` (3-char short token), does an LDAP user in group `cn=devops,...` receive ADMIN authority? Pin the substring-collision admin-escalation hypothesis."
      probe_path: "lineage/odd-platform/probes/P-184.yaml"
    - probe_id: P-185
      question: "With `auth.ldap.active-directory.enabled: true` and `auth.ldap.active-directory.domain` unset, does the platform boot successfully AND what AD-bind shape does the first login produce? Pin the silent-degradation hypothesis."
      probe_path: "lineage/odd-platform/probes/P-185.yaml"
  stress_summary:
    triggers_total: 9   # 2 name_behavior_pairs + 0 orderings + 4 auth-gate questions × 1 site + 3 resource_boundary questions × 1 site + 5 request_inputs
    questions_total: 28  # 2 nb-pair narratives + 4 auth_gates + 3 resource_boundaries + 5 inputs × ~5 questions
    answers_static_inferred: 25
    answers_probe_needed: 3   # P-186 actuator/log dual leak, P-184 substring-collision admin escalation, P-185 AD null-domain silent degradation
    answers_reference: 0
    drift_flags: 5  # validate() under-checks, @ConfigurationProperties+ConditionalOnProperty inert-silent, adminGroups substring, password unmasked, url scheme, AD pairing
```

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
  - "No scheme validation on `url` (line 12). An `ldap://` URL means bind credentials and end-user login credentials travel in cleartext on the wire. The Properties class accepts both `ldap://` and `ldaps://` indistinguishably. The validation method (lines 40-49) only checks non-emptiness. The live docs (WebFetched 2026-05-26) self-flag this as a Notable Gap." — evidence: ODDLDAPProperties.java:12,42-44 + LDAPSecurityConfiguration.java:117-124 + WebFetch LDAP docs 2026-05-26 — severity: HIGH
  - "`adminGroups` is a `Set<String>` (line 31) consumed by `containsIgnoreCase` substring-match at `LDAPSecurityConfiguration.java:96`. The Properties class admits short tokens that collide with unintended LDAP group names via substring containment — admin-escalation surface if the operator uses a short admin-group label like `'ops'`. No format constraint, no length minimum, no warning in field name. Live docs (WebFetched 2026-05-26) self-flag 'Admin-groups matching: Case sensitivity, exact vs. substring matching undefined'." — evidence: ODDLDAPProperties.java:31 + LDAPSecurityConfiguration.java:48,94-98 + WebFetch LDAP docs 2026-05-26 — severity: HIGH
  - "Empty / null `adminGroups` deployment has ZERO LDAP path to ADMIN (`LDAPSecurityConfiguration.java:91-93`). The Properties class neither warns the operator (in field naming, Javadoc, or `validate()`) that this is a load-bearing default, nor does it enforce non-empty admin-groups when the operator clearly wants LDAP to be the only auth path. Live docs (WebFetched 2026-05-26) self-flag 'No documentation on behavior when admin-groups are absent'." — evidence: ODDLDAPProperties.java:28-32 + LDAPSecurityConfiguration.java:91-93 + WebFetch LDAP docs 2026-05-26 — severity: MEDIUM
  - "`ActiveDirectory.enabled=true` is accepted without `ActiveDirectory.domain` being set (line 36-37, no cross-field validation in `validate()`). The downstream consumer constructs `ActiveDirectoryLdapAuthenticationProvider(null, url)` — Spring Security accepts this but the operator's intended AD-bind semantics are silently bypassed. Live docs say `domain` is 'Required when AD is enabled' — enforced by zero code." — evidence: ODDLDAPProperties.java:35-38,40-49 + LDAPSecurityConfiguration.java:76-83 + WebFetch LDAP docs 2026-05-26 — severity: MEDIUM
  - "No `@Validated` annotation on the Properties class (line 11) and no `jakarta.validation.constraints` declarations on any field. The platform deliberately chose imperative validation (`@PostConstruct validate()`) — meaning operators cannot rely on Spring Boot's validation infrastructure to surface multiple errors at once (the first `IllegalStateException` halts boot). An operator with both an empty URL AND missing search-method sees only the URL error and has to retry, see the search-method error, and retry again." — evidence: ODDLDAPProperties.java:9-11,40-49 (no `@Validated` annotation; only `@PostConstruct` imperative check) — severity: LOW (DX defect, not exploit)

## performance

- **hot_paths**: `[]` — configuration POJO; boot-time only. Field reads at runtime (via `properties.getXxx()`) are direct Lombok-generated getter calls — single field-load instructions; not a hot path.
- **throughput_characteristics**: `[]` — no per-request work.
- **resource_allocation**:
  - "Single bean instance held for the JVM lifetime; field values are immutable in practice (Lombok `@Data` generates setters, but `LDAPSecurityConfiguration` reads getters only — there is no mutation path). Memory footprint is dominated by the strings the operator supplied — typically <1KB total." — evidence: ODDLDAPProperties.java:9-39
- **scaling_characteristics**:
  - "Stateless; instance is shared across all auth requests via the singleton-scoped `LDAPSecurityConfiguration` bean. Horizontal scaling unaffected by this class. Config rotation (e.g. rotating the LDAP bind password) requires a platform restart — no `@RefreshScope`, no `/actuator/refresh` endpoint (spring-cloud-context not on classpath, verified by grep)." — evidence: ODDLDAPProperties.java:9-39 (no shared mutable state visible in this file) + grep `spring-cloud-context|@RefreshScope` returns zero hits
- **known_performance_gaps**: `[]` — no per-request work; performance characteristics (timeout absences, no connection pooling) live in the consumer `LDAPSecurityConfiguration` sidecar (`lineage/odd-platform/understanding/odd-platform__java__LDAPSecurityConfiguration__config-key-consumer__auth_type@L51.md`).

## upstream_callers

ODDLDAPProperties is a Spring `@ConfigurationProperties` POJO — it is NEVER
called by application code in the request-handling sense. Its bean is wired
by Spring's binder + `@PostConstruct` machinery, then field-read by a single
consumer (LDAPSecurityConfiguration) at bean-construction time.

- entry_point: "boot:@EnableConfigurationProperties(ODDLDAPProperties.class)"
  caller_node: "odd-platform java LDAPSecurityConfiguration config-class:LDAPSecurityConfiguration"
  multiplicity_per_trigger: 1   # bean instantiated exactly once per boot when auth.type=LDAP matches
  evidence: "LDAPSecurityConfiguration.java:52 (`@EnableConfigurationProperties(ODDLDAPProperties.class)`) + LDAPSecurityConfiguration.java:51 (the @ConditionalOnProperty gate that decides whether the bean is ever created) + LDAPSecurityConfiguration.java:58 (constructor injection)"
  observation_class: boot-eval

- entry_point: "boot:@PostConstruct(ODDLDAPProperties.validate)"
  caller_node: "spring-bean-post-processor (Spring framework infrastructure)"
  multiplicity_per_trigger: 1   # validate() fires once per bean lifecycle after binding
  evidence: "ODDLDAPProperties.java:40-49 (the @PostConstruct method); Spring's BeanPostProcessor calls this after the configuration binder fills the fields"
  observation_class: boot-eval

- entry_point: "rest:GET /actuator/env (Spring Boot Actuator)"
  caller_node: "spring-boot-actuator (org.springframework.boot.actuate.env.EnvironmentEndpoint)"
  multiplicity_per_trigger: 1   # one bean inspection per env fetch
  unresolved: false
  evidence: "application.yml:226-240 (env endpoint enabled by default + included in exposure list) + SecurityConstants.java:95-96 (`WHITELIST_PATHS` includes `/actuator/**`) + AuthorizationCustomizer.java:22-23 (permitAll on whitelist). Spring Boot 3.4.10's EnvironmentEndpoint reads `@ConfigurationProperties` bean values via the configured PropertySources at fetch time; values are masked by default (`management.endpoint.env.show-values: NEVER`)."
  observation_class: rest-call

- entry_point: "rest:GET /actuator/configprops (NOT exposed)"
  caller_node: "spring-boot-actuator (org.springframework.boot.actuate.context.properties.ConfigurationPropertiesReportEndpoint)"
  multiplicity_per_trigger: 0   # endpoint NOT in `management.endpoints.web.exposure.include` per application.yml:226-231
  unresolved: false
  evidence: "application.yml:231 (`include: health, prometheus, env, info` — configprops absent). The endpoint exists in the Spring Boot Actuator jar but is not web-exposed in this platform's default configuration; thus this caller path is INERT in shipped deployments. If an operator adds `configprops` to the exposure list, this becomes an active surface that would dump every @ConfigurationProperties bean (including ODDLDAPProperties) — subject to the same masking discipline as env."
  observation_class: rest-call

- (Verified by Grep across `<odd-platform-repo>/odd-platform-api/src/main/java` for `ODDLDAPProperties` returning ONLY the source class + LDAPSecurityConfiguration.java; no other application-layer code references the bean.)

## downstream_side_effects

When active (auth.type=LDAP), the bean this class produces drives the
following observable platform behaviours via its single consumer
LDAPSecurityConfiguration. Each side effect's terminal observable surface
lives in the consumer's sidecar; this section records the CAUSAL chain
from the field-bind to the operator-visible consequence.

- side_effect_class: external-call
  description: "auth.ldap.url drives LdapContextSource → OUTBOUND TCP to the directory server (ldap:// = port 389 cleartext, ldaps:// = port 636 TLS by convention). Every authenticated login produces 1-3 LDAP RPCs to this URL (bind + optional user-search + group-search)."
  evidence: "ODDLDAPProperties.java:12 + LDAPSecurityConfiguration.java:117-124"
  cardinality_per_call: "1-3 LDAP RPCs per login (bind + optional user-filter search + optional group-membership search)"
  reachable_from_entry_points: ["ui_route:/login (POST form-login)", "rest:POST /api/* (any authenticated request triggers session-validation; the LDAP bind happens at login only)"]

- side_effect_class: db-write
  description: "Indirectly: under LDAP, a first-login produces a `user_owner_mapping` row resolution at `ReactiveUserOwnerMappingRepositoryImpl.getConditions:121-125` keyed by `(username, provider=null)`. The provider=null half is downstream of `AuthIdentityProviderImpl.getCurrentUser():32` (the else branch — LDAP-authenticated users are NOT OAuth2 tokens, so they fall through to `UserDto(username, null)`). The bind shape is set by THIS POJO's username/password values (driving who 'owns' the bind itself, not the principal)."
  evidence: "ODDLDAPProperties.java:13-14 (username/password supplied) + AuthIdentityProviderImpl.java:24-35,49-53 (cross-sidecar: the principal-resolution chain) + LDAPSecurityConfiguration.java (no provider tag on SecurityContext)"
  cardinality_per_call: "0 per call from this POJO (the POJO does not write); the cross-mode provider-null bleed is an indirect side-effect at the principal-resolution layer"
  reachable_from_entry_points: ["ui_route:/login", "any authenticated rest-call (writes happen at controller layer)"]

- side_effect_class: header-set
  description: "`auth.ldap.groups.admin-groups` (line 31) decides the ADMIN-vs-USER authority on the Spring SecurityContext via the substring-match at LDAPSecurityConfiguration.java:94-98. The decided authority is set on the SecurityContext at authentication-time; downstream WHERE-clauses keyed on `current_user_role` (none in this codebase — the AuthorizationCustomizer iterates SECURITY_RULES) consume this authority."
  evidence: "ODDLDAPProperties.java:31 + LDAPSecurityConfiguration.java:89-99 + GrantedAuthorityExtractor.java:12-17"
  cardinality_per_call: "1 authority set per successful login"
  reachable_from_entry_points: ["ui_route:/login", "any authenticated rest-call"]

- side_effect_class: log-emit
  description: "POTENTIAL: ANY in-process code calling `log.info(\"props = {}\", ldapProperties)` emits the password verbatim via Lombok-generated toString (line 10). Currently NO such log line exists in the codebase — verified by grep `log.*properties|log.*ldapProperties` on LDAPSecurityConfiguration.java returning zero matches. The side-effect is LATENT — a future maintainer is the trigger."
  evidence: "ODDLDAPProperties.java:10,14 (no @ToString.Exclude) + grep for current log lines (zero hits today)"
  cardinality_per_call: "0 today; latent on the Lombok-toString surface"
  reachable_from_entry_points: ["future maintainer adding a debug log statement"]

- side_effect_class: external-call
  description: "`active-directory.enabled=true` + `active-directory.domain` cause the consumer at LDAPSecurityConfiguration.java:76-83 to construct an `ActiveDirectoryLdapAuthenticationProvider(domain, url)` INSTEAD of a `BindAuthenticator`/`LdapAuthenticationProvider` chain. The outbound RPC shape changes: AD uses UPN binds (`<user>@<domain>`) instead of DN binds. With domain=null (unvalidated), the UPN degrades to a bare `<user>` bind — silent shape-change."
  evidence: "ODDLDAPProperties.java:35-38 + LDAPSecurityConfiguration.java:76-83"
  cardinality_per_call: "1 AD bind RPC per login (when AD branch is active)"
  reachable_from_entry_points: ["ui_route:/login (POST form-login)"]

## sources

- understanding ← ODDLDAPProperties.java:9-50 + LDAPSecurityConfiguration.java:51-52,58
- concepts.entities ← ODDLDAPProperties.java:9-39
- concepts.operations.[validate-fail-fast on URL] ← ODDLDAPProperties.java:42-44
- concepts.operations.[validate-fail-fast on search-method] ← ODDLDAPProperties.java:45-48
- concepts.invariants.[conditional load] ← LDAPSecurityConfiguration.java:51-52
- concepts.invariants.[validate enforced] ← ODDLDAPProperties.java:40-49
- concepts.invariants.[String password, no masking] ← ODDLDAPProperties.java:10,14
- concepts.invariants.[Lombok @Data generates everything] ← ODDLDAPProperties.java:10
- concepts.invariants.[bean immutable post-bind] ← ODDLDAPProperties.java:9-39 + grep `setUrl|setPassword` on consumer returning only LdapContextSource lines 118-122
- dependencies_semantic.requires-feature.[conditional auth-mode] ← LDAPSecurityConfiguration.java:51-52
- dependencies_semantic.requires-feature.[ConfigurationProperties binder] ← ODDLDAPProperties.java:9
- dependencies_semantic.requires-feature.[Lombok] ← ODDLDAPProperties.java:5,10,21,27,34
- dependencies_semantic.requires-feature.[Spring lifecycle / @PostConstruct] ← ODDLDAPProperties.java:3,40
- dependencies_semantic.requires-config.[url required] ← ODDLDAPProperties.java:12,42-44
- dependencies_semantic.requires-config.[dnPattern OR userFilter.filter] ← ODDLDAPProperties.java:15,17,22-25,45-48
- dependencies_semantic.requires-config.[username/password optional] ← ODDLDAPProperties.java:13-14 (no validation guard)
- dependencies_semantic.requires-config.[Group nested optional] ← ODDLDAPProperties.java:18,28-32
- dependencies_semantic.requires-config.[ActiveDirectory nested optional] ← ODDLDAPProperties.java:19,35-38
- dependencies_semantic.requires-config.[AD.domain unvalidated] ← ODDLDAPProperties.java:37 (no constraint) + ODDLDAPProperties.java:40-49 (validate omits pair-check) + LDAPSecurityConfiguration.java:78 (passes through verbatim)
- dependencies_semantic.requires-runtime.[PostConstruct invocation] ← ODDLDAPProperties.java:3,40
- dependencies_semantic.requires-runtime.[StringUtils.isEmpty] ← ODDLDAPProperties.java:6,42,46
- tests_coverage_semantic.test_files ← grep `ODDLDAPProperties` under `<odd-platform-repo>/odd-platform-api/src/test` returns zero matches (verified 2026-05-26 via `grep -rln 'ODDLDAPProperties' <odd-platform-repo>` — only `ODDLDAPProperties.java` source + `LDAPSecurityConfiguration.java`)
- docs_link_semantic.inferred_docs.[LDAP page] ← WebFetch https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authentication/ldap (2026-05-26, 200)
- docs_link_semantic.doc_drift_findings.[groups.filter default misattribution] ← ODDLDAPProperties.java:30 + LDAPSecurityConfiguration.java:109-111 + WebFetch LDAP docs 2026-05-26
- docs_link_semantic.doc_drift_findings.[validate exception messages not in docs] ← ODDLDAPProperties.java:40-49 + WebFetch LDAP docs 2026-05-26
- docs_link_semantic.doc_drift_findings.[active-directory.domain unvalidated] ← ODDLDAPProperties.java:36-37,40-49 + WebFetch LDAP docs 2026-05-26
- docs_link_semantic.doc_drift_findings.[password unmasked declaration] ← ODDLDAPProperties.java:10,14 + WebFetch LDAP docs 2026-05-26
- docs_link_semantic.doc_drift_findings.[no scheme validation on url] ← ODDLDAPProperties.java:12,42-44 + WebFetch LDAP docs 2026-05-26
- docs_link_semantic.doc_drift_findings.[admin-groups comma vs yaml-list] ← ODDLDAPProperties.java:31 + WebFetch LDAP docs 2026-05-26
- docs_link_semantic.doc_drift_findings.[docs Notable Gaps double-sided] ← WebFetch LDAP docs 2026-05-26 (page's own Notable Gaps enumeration)
- implicit_adrs.[nested classes pattern] ← ODDLDAPProperties.java:11-39 + ODDOAuth2Properties.java:11-54 (sibling)
- implicit_adrs.[imperative @PostConstruct over jakarta.validation] ← ODDLDAPProperties.java:40-49 + ODDOAuth2Properties.java:16-28
- implicit_adrs.[AD as nested flag, not separate auth.type] ← ODDLDAPProperties.java:19,35-38 + LDAPSecurityConfiguration.java:76-83
- implicit_adrs.[Set<String> for adminGroups] ← ODDLDAPProperties.java:31 + ODDOAuth2Properties.java:48
- bugs_limitations_corner_cases.[password unmasked] ← ODDLDAPProperties.java:10,14 + `<odd-platform-repo>/odd-platform-api/build.gradle:2` + grep `keys-to-sanitize` zero in repo
- bugs_limitations_corner_cases.[no LDAPS enforcement] ← ODDLDAPProperties.java:12,42-44 + LDAPSecurityConfiguration.java:117-124 + WebFetch LDAP docs 2026-05-26
- bugs_limitations_corner_cases.[Set<String> + substring match → collision] ← ODDLDAPProperties.java:31 + LDAPSecurityConfiguration.java:48,94-98
- bugs_limitations_corner_cases.[empty adminGroups → no admins] ← ODDLDAPProperties.java:18,28-32,40-49 + LDAPSecurityConfiguration.java:91-93 + `<odd-platform-repo>/odd-platform-api/src/main/resources/application.yml:50-65`
- bugs_limitations_corner_cases.[AD.domain unvalidated] ← ODDLDAPProperties.java:36-37,40-49 + LDAPSecurityConfiguration.java:76-83 + WebFetch LDAP docs 2026-05-26
- bugs_limitations_corner_cases.[Properties silently ignored when auth.type ≠ LDAP] ← ODDLDAPProperties.java:9-11,40-49 + LDAPSecurityConfiguration.java:51-52
- bugs_limitations_corner_cases.[dn-pattern/filter injection-aware contract implicit] ← ODDLDAPProperties.java:15,22-25 + LDAPSecurityConfiguration.java:66-74
- stress_findings.name_behavior_pairs.[validate under-checks] ← ODDLDAPProperties.java:40-49 + ODDLDAPProperties.java:35-38 + LDAPSecurityConfiguration.java:78
- stress_findings.name_behavior_pairs.[POJO inert when auth.type≠LDAP] ← ODDLDAPProperties.java:9 + LDAPSecurityConfiguration.java:51-52 + application.yml:34
- stress_findings.auth_gates.[POJO conditional + actuator-env whitelist] ← LDAPSecurityConfiguration.java:51-52 + SecurityConstants.java:95-96 + AuthorizationCustomizer.java:22-23 + application.yml:226-240
- stress_findings.resource_boundaries.[singleton + immutable post-bind] ← ODDLDAPProperties.java:9-39 + grep `@RefreshScope` zero hits
- stress_findings.request_inputs.[adminGroups substring drift] ← ODDLDAPProperties.java:31 + LDAPSecurityConfiguration.java:48,94-98
- stress_findings.request_inputs.[password Lombok-toString drift] ← ODDLDAPProperties.java:10,14
- stress_findings.request_inputs.[url scheme drift] ← ODDLDAPProperties.java:12,42-44
- stress_findings.request_inputs.[AD pairing drift] ← ODDLDAPProperties.java:35-38,40-49 + LDAPSecurityConfiguration.java:76-83
- stress_findings.request_inputs.[username matches] ← ODDLDAPProperties.java:13 + LDAPSecurityConfiguration.java:120
- stress_findings.probes_emitted.[P-186 password actuator/log dual] ← lineage/odd-platform/probes/P-186.yaml
- stress_findings.probes_emitted.[P-184 substring-collision admin escalation] ← lineage/odd-platform/probes/P-184.yaml
- stress_findings.probes_emitted.[P-185 AD null-domain silent degradation] ← lineage/odd-platform/probes/P-185.yaml
- security.auth_mode_relevance ← ODDLDAPProperties.java:9 + LDAPSecurityConfiguration.java:51-52
- security.data_exposure.[password] ← ODDLDAPProperties.java:10,14 + `<odd-platform-repo>/odd-platform-api/build.gradle:2` + `<odd-platform-repo>/odd-platform-api/src/main/resources/application.yml:226-240` + grep `keys-to-sanitize` zero
- security.data_exposure.[username] ← ODDLDAPProperties.java:10,13
- security.data_exposure.[url] ← ODDLDAPProperties.java:12
- security.known_security_gaps.[no @ToString.Exclude on password] ← ODDLDAPProperties.java:10,14 + `<odd-platform-repo>/odd-platform-api/build.gradle:2`
- security.known_security_gaps.[no scheme validation] ← ODDLDAPProperties.java:12,42-44 + WebFetch LDAP docs 2026-05-26
- security.known_security_gaps.[adminGroups substring collision] ← ODDLDAPProperties.java:31 + LDAPSecurityConfiguration.java:48,94-98
- security.known_security_gaps.[empty adminGroups → no admins] ← ODDLDAPProperties.java:28-32 + LDAPSecurityConfiguration.java:91-93
- security.known_security_gaps.[AD.domain unvalidated] ← ODDLDAPProperties.java:35-38,40-49 + LDAPSecurityConfiguration.java:76-83
- security.known_security_gaps.[no @Validated, imperative only] ← ODDLDAPProperties.java:9-11,40-49
- performance.resource_allocation ← ODDLDAPProperties.java:9-39
- performance.scaling_characteristics ← ODDLDAPProperties.java:9-39
- upstream_callers.[boot:@EnableConfigurationProperties] ← LDAPSecurityConfiguration.java:51-52,58
- upstream_callers.[boot:@PostConstruct] ← ODDLDAPProperties.java:40-49
- upstream_callers.[rest:GET /actuator/env] ← application.yml:226-240 + SecurityConstants.java:95-96 + AuthorizationCustomizer.java:22-23
- upstream_callers.[rest:GET /actuator/configprops INERT] ← application.yml:226-231 (configprops absent)
- downstream_side_effects.[LDAP TCP egress] ← ODDLDAPProperties.java:12 + LDAPSecurityConfiguration.java:117-124
- downstream_side_effects.[provider=null bleed indirect] ← ODDLDAPProperties.java:13-14 + AuthIdentityProviderImpl.java:24-35,49-53 (cross-sidecar)
- downstream_side_effects.[authority header set] ← ODDLDAPProperties.java:31 + LDAPSecurityConfiguration.java:89-99 + GrantedAuthorityExtractor.java:12-17
- downstream_side_effects.[latent toString log leak] ← ODDLDAPProperties.java:10,14
- downstream_side_effects.[AD UPN-bind shape change] ← ODDLDAPProperties.java:35-38 + LDAPSecurityConfiguration.java:76-83

## confidence_per_field

- understanding: HIGH
- concepts: HIGH
- dependencies_semantic: HIGH
- tests_coverage_semantic: HIGH (zero-coverage is grep-verified across the repo, not inferred; test_class annotations are first-class per file-analyser/0.3.0)
- docs_link_semantic: MEDIUM (no `@docs` annotation in source; the inferred URL was WebFetched live and confirmed 200 on 2026-05-26; doc-drift findings are HIGH-confidence because the live page's content was directly compared against the Properties-class source code in this session — the docs page now self-flags its own Notable Gaps which corroborates several drift items)
- implicit_adrs: MEDIUM (each backed by code structure or sibling-pattern; only `imperative @PostConstruct over jakarta.validation` is HIGH-confidence because the exception-type framing is explicit; the nested-classes and Set<String> patterns are structural-only, no comment)
- bugs_limitations_corner_cases: HIGH (each finding cited to file:line; the `password unmasked` claim is HIGH because Spring Boot 3.4.10's actuator-env defaults were verified via the pinned version + repo grep; the live-docs Notable-Gaps cross-reference confirms the doc surface agrees with the drift)
- security: HIGH
- performance: HIGH (configuration POJO; there is no per-request work; the absence is dispositive)
- stress_findings: MEDIUM (5 of 9 triggers / 25 of 28 questions resolve STATIC-INFERRED; 3 questions require runtime confirmation via P-186 / P-184 / P-185 — the actuator-env masking claim, the substring-collision admin-escalation claim, and the AD null-domain silent-degradation claim. Lowered from HIGH because three load-bearing operator-observable claims live in PROBE-NEEDED state.)
- upstream_callers: HIGH (verified by Grep — only LDAPSecurityConfiguration references the bean in application code; the actuator/env caller is documented Spring Boot 3.4.10 behaviour; the actuator/configprops INERT path is verified by application.yml exposure-include enumeration)
- downstream_side_effects: HIGH (each side-effect is traced through the consumer with file:line evidence; the `latent toString log leak` is honestly recorded as `cardinality_per_call: 0 today` to distinguish current behaviour from latent risk)

## Maintainer notes

