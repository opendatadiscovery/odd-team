---
node_id: "odd-platform java org.opendatadiscovery.oddplatform.config.properties config-properties-class:AdditionalLinkProperties"
node_kind: config-properties-class
axis: config-properties
extracted_at_commit: feature/ontology-finalize-2026-05-25
enriched_at_commit: feature/ontology-finalize-2026-05-25
extractor_version: 0.1.0
prompt_version: file-analyser/0.5.0
enrichment_status: complete
confidence_overall: HIGH
session_id: session-2026-05-26-ZK-AdditionalLinkProperties
---

# AdditionalLinkProperties — semantic understanding

## understanding

AdditionalLinkProperties is the Spring Boot `@ConfigurationProperties` record that
binds the operator-configured "additional links" catalogue from `odd.links[].{title,url}`
into the application context. It is a 10-line record-of-records — an outer record holding
a `List<Link>` and an inner `Link(String title, String url)` — with no validation, no
defaults, no normalization, and no behaviour beyond binding. The class is the sole
binding owner of the `odd` Spring namespace but binds only the `links` sub-key; the
other `odd.*` keys (`odd.tenant-id`, `odd.platform-base-url`, `odd.data-entity-stale-period`,
`odd.activity.partition-period`) are consumed independently via `@Value("${...}")` reads
scattered across services. The terminal consumer is `LinksController` (which exposes the
list via `GET /api/links`) and ultimately the UI's `AppInfoMenu` (the toolbar information
icon, rendered on every page) — every operator-supplied URL flows through this record
unmodified into `<a target="_blank">` elements in the operator's users' browsers.

## concepts

- entities: [AdditionalLinkProperties (the Spring binding contract), Link (inner record — title + url tuple), the `odd.links` config namespace, the `odd` Spring prefix it occupies]
- operations: [bind-at-boot (Spring populates the record once during application context refresh), expose-as-bean (consumed by LinksController as a constructor-injected dependency)]
- invariants: [boot-time-immutable (record + final fields), no validation (no JSR-303 annotations on title or url), no defaults (null when `odd.links` is absent), no max size, declaration order preserved by Spring's relaxed binder per indexed property syntax]
- audiences: [operator who configures `odd.links` in `application.yml` / env / k8s ConfigMap; downstream Java consumer (LinksController); indirectly every authenticated end-user via AppInfoMenu]

## dependencies_semantic

- requires-feature: [Spring Boot `@ConfigurationProperties` relaxed binding for Java records; Spring's indexed-property syntax (`odd.links[0].title`, `odd.links[1].url`, ...) and kebab-case → camelCase translation rules; `AdditionalLinkConfiguration.java` to activate the record via `@EnableConfigurationProperties`]
- requires-config: [None at this layer — the record itself has no defaults. The `odd.links` key is OPTIONAL; absent → `links` field is null (resolved to empty list at the controller, not here). No fail-fast if mis-typed; no fail-fast if a `Link` entry omits `title` or `url`.]
- requires-runtime: [Spring Boot context initialization phase only — the record participates in `BindResult` resolution during `Environment` post-processing; not invoked after boot]

## tests_coverage_semantic

- covered_behaviours: []
- uncovered_behaviours:
  - behaviour: "Record binds correctly when `odd.links` is supplied via YAML (indexed list syntax) — title and url propagate in declaration order"
    test_class: integration
    criticality: LOW
    note: "Covered transitively by Probe P-128 via the controller endpoint, but no test asserts binding at the record layer in isolation."
  - behaviour: "Record binds correctly when `odd.links` is supplied via environment variables (`ODD_LINKS_0_TITLE`, `ODD_LINKS_0_URL`, ...) — kebab-case + indexed-property env-var translation works as Spring documents"
    test_class: integration
    criticality: MEDIUM
    note: "Spring's env-var binding rules are nontrivial (uppercase + underscores + indexed brackets translate to `_<INDEX>_`); a regression test against the env-only path would catch a future Spring Boot upgrade that changed binder behaviour."
  - behaviour: "Record handles partial entries gracefully — `odd.links[0].title` set but `odd.links[0].url` unset"
    test_class: integration
    criticality: MEDIUM
    note: "No `@NotBlank` on either field; current behaviour is to bind `url=null`. Operator's mistake produces a silently-broken UI menu item (clickable label rendering as <a href=null>)."
  - behaviour: "Record rejects (or accepts) URL-shaped operator input — `javascript:alert(1)`, `data:text/html,...`, `file:///etc/passwd`, relative paths, completely malformed strings"
    test_class: security
    criticality: HIGH
    note: "No `@URL`, no `@Pattern`, no scheme allowlist. The record passes anything-stringy through. The decision to validate (or not to) lives nowhere — neither in code, an ADR, a comment, nor the doc page. Probe P-177 covers."
  - behaviour: "Record handles operator-supplied collisions with the `odd.*` namespace — what happens if a future Spring Boot binder sees a new property like `odd.notlinks` or `odd.tenantId` declared inside `odd:` block?"
    test_class: integration
    criticality: LOW
    note: "Currently AdditionalLinkProperties only declares the `links` field, so unknown sibling keys are silently ignored. If `@ConfigurationProperties(ignoreUnknownFields = false)` were ever enabled, the existing `application.yml` declarations of `odd.tenant-id` etc. (which are NOT bound here, consumed via @Value) would FAIL boot. Latent foot-gun."
- test_files: []
- gaps: |
    No test files reference AdditionalLinkProperties directly. Spring Boot's
    @ConfigurationProperties binding is implicitly exercised by `@SpringBootTest`
    classes elsewhere, but no test pins this contract. The highest-leverage gap is
    the SECURITY-class behaviour: operator-supplied URL strings flow through this
    record unmodified into the UI's `<a href>` — every assumption about "the
    operator only configures sane http(s) URLs" is enforced exactly nowhere. A
    single security-class integration test (Probe P-177) that asserts URL-scheme
    rejection for a documented allowlist would convert the entire "trust the
    operator" defence into "trust + verify".

## docs_link_semantic

- declared_docs: []
- inferred_docs:
  - url: "https://docs.opendatadiscovery.org/configuration-and-deployment/odd-platform"
    anchor: null
    rationale: "Live page documents the `odd.links` configuration property in the operator-facing configuration reference for ODD Platform. This is the canonical home for the `odd.*` namespace operator-tunables."
    last_verified_at: "2026-05-26T00:00:00Z"
    last_verified_status: 200
    confidence: LOW
    fetched_excerpts: |
      "Operators can attach a list of arbitrary navigation links — pointers to internal wikis, runbooks, dashboards, or any other page teams should reach from inside ODD Platform."
      "Each link renders as a menu item showing its title and opens the configured URL in a new tab when clicked."
      "odd.links — List of objects with required fields title (string) and url (string). Defaults to empty list."
      "links 'are exposed to the UI through the authenticated GET /api/links endpoint'"
      "'do not embed credentials, session tokens, or one-time secrets in link URLs'"
- doc_drift_findings:
  - "Doc says title and url are 'required fields' — the record class has NO @NotBlank, @NotNull, @NotEmpty, or any JSR-303 constraint on either field; the binder accepts a missing title or missing url with no error, producing a broken UI entry (`<a href=null>`-style)."
  - "Doc says 'Defaults to empty list' — at the RECORD layer the default is actually `null`, not empty list. The empty-list response shape is constructed by LinksController's `CollectionUtils.isEmpty` check; if a future refactor inlines or removes the controller's null-guard, the documented default no longer holds."
  - "Doc page describes the config without warning that the binding is BOOT-TIME ONLY — editing `odd.links` in a running container produces no observable change until restart. The documentation page is silent on the restart requirement."
  - "Doc page does not specify ORDERING guarantees. Spring's relaxed binder preserves indexed-property order, and the controller preserves it through `stream().toList()`, but neither code nor docs explicitly assert this contract."
  - "Doc page does not list URL scheme restrictions. An operator reading the docs would reasonably assume http(s) URLs; the record accepts `javascript:`, `data:`, `file:`, `vbscript:` with no rejection. The doc's only adjacent warning is 'do not embed credentials' — a different concern."
  - "The doc's claim that the endpoint is 'authenticated' is correct under LOGIN_FORM/OAUTH2/LDAP but misleading under DISABLED mode (where ALL endpoints are public); the docs page does not call out the DISABLED-mode caveat for this specific surface."

## implicit_adrs

- "Operator-configurable additional links are a STATIC configuration surface, not a runtime-mutable feature; the use of `@ConfigurationProperties` (vs a JPA entity or admin endpoint) IS the decision." — evidence: AdditionalLinkProperties.java:6 (`@ConfigurationProperties("odd")`) + AdditionalLinkConfiguration.java:8 (`@EnableConfigurationProperties`) — intent_anchor: "the entire feature is implemented as a record-bound config — no entity class, no repository, no controller mutator; the choice of @ConfigurationProperties over a CRUD persistence layer is itself an architectural statement about the audience (operator, not end-user)" — confidence: HIGH
- "Links are modelled as an IMMUTABLE record-of-records — the type system itself encodes the boot-time-immutable, no-mutation contract; downstream consumers cannot accidentally mutate the catalogue." — evidence: AdditionalLinkProperties.java:7 (outer `record`) + AdditionalLinkProperties.java:8 (inner `record Link`) — intent_anchor: "Java records are final and immutable by language design; choosing record over POJO is a deliberate signal that this configuration is read-only for the lifetime of the JVM" — confidence: HIGH

## bugs_limitations_corner_cases

- "Record has NO validation annotations on either field — `title` and `url` can be null, empty string, or any malformed string; binder accepts the entry silently. Operator misconfiguration produces a broken UI entry (button with empty label or null href) instead of a fail-fast at boot." — evidence: AdditionalLinkProperties.java:8 (`record Link(String title, String url)` — no @NotBlank, @NotNull, @URL, @Pattern, @Size) — severity: MEDIUM
- "`@ConfigurationProperties("odd")` claims the entire `odd` Spring prefix but the record only binds the `links` sub-field. The other `odd.*` keys (`odd.tenant-id`, `odd.platform-base-url`, `odd.data-entity-stale-period`, `odd.activity.partition-period`) are consumed via `@Value` reads elsewhere (e.g. SlackMessageGeneratorConfiguration.java:15, ExternalMetricReader.java:53, DataEntityStaleDetector.java:10). This is a legitimate Spring pattern but a fragile one: if anyone ever adds `(ignoreUnknownFields = false)` to this annotation — a common hardening change — the application will FAIL TO BOOT because the binder sees `tenant-id`, `platform-base-url`, etc. as 'unknown' sibling keys under the `odd` prefix." — evidence: AdditionalLinkProperties.java:6 + SlackMessageGeneratorConfiguration.java:15 + ExternalMetricReader.java:53 + DataEntityStaleDetector.java:10 — severity: MEDIUM
- "Class name `AdditionalLinkProperties` advertises 'additional links' but the bound property key is the unqualified `odd.links` — not `odd.additional-links`, not `odd.additional.links`. An operator searching the codebase by config key (`grep additional`) finds the class; an operator searching by config key (`grep odd.links`) finds it too. But an operator skimming `application.yml` and seeing `odd.links:` may reasonably assume there is also a separate `odd.additional-links:` for some other purpose. The 'additional' qualifier is JAVA-INTERNAL ONLY." — evidence: AdditionalLinkProperties.java:6-7 (`@ConfigurationProperties("odd")` + `record AdditionalLinkProperties(List<Link> links)`) + application.yml:208-211 (the `odd:` block contains `tenant-id`, `data-entity-stale-period`, `activity.partition-period` — `links` is NOT in the default YAML at all) — severity: LOW
- "`odd.links` is NOT in the default `application.yml` even as a commented-out template — operators discovering the feature have no anchor in the shipped config file. The `odd:` block (application.yml:208-214) lists `platform-base-url` (commented), `tenant-id`, `data-entity-stale-period`, and `activity.partition-period` — but `links` is silently omitted." — evidence: application.yml:208-214 — severity: LOW
- "No `@ConstructorBinding` annotation despite being a record — works under Spring Boot 3.x because constructor binding is now the default for records, but the lack of explicit annotation means a future migration to a non-record type (e.g. a Lombok @Data class) would silently flip to setter-based binding, which has different default behaviour around immutability and partial population." — evidence: AdditionalLinkProperties.java:7 (no @ConstructorBinding) — severity: LOW
- "The record's null-vs-empty distinction at the binding layer means downstream consumers MUST handle null. LinksController does this (CollectionUtils.isEmpty); but any future consumer (a metrics extractor that wants to count configured links, an audit log that wants to log them) must repeat the null-guard. The record could safely default the field to `List.of()` in a compact constructor and remove this entire class of downstream null-handling." — evidence: AdditionalLinkProperties.java:7-9 (no compact constructor with `links = links == null ? List.of() : links;`) + LinksController.java:27 (the null-guard the record could have absorbed) — severity: LOW
- "No `@Validated` on the class — even if JSR-303 annotations were added to Link's fields, they would not fire without `@Validated` at the class level. Adding constraints alone is insufficient; the activation annotation must also be present." — evidence: AdditionalLinkProperties.java:6 (no @Validated) — severity: LOW (preventive — relevant when fixing the gap)

## stress_findings

```yaml
stress_findings:
  tunables: []
  name_behavior_pairs:
    - name: "AdditionalLinkProperties (class name)"
      promise: "The class name 'AdditionalLinkProperties' implies the bound property key is `additional-link.*` or `additional.links` — a clear, namespaced 'additional links' feature."
      implementation: "The actual @ConfigurationProperties prefix is `odd`, and the bound property is the unqualified `odd.links`. The 'Additional' qualifier exists ONLY in the Java class name; the YAML/env-visible key is just `odd.links`."
      drift: MINOR
      operator_visible_consequence: "An operator searching by class name (`AdditionalLinkProperties`) and an operator searching by config key (`odd.links`) reach the same code but with different mental models. An operator skimming `application.yml` and seeing `odd.links:` may not realise it corresponds to the 'additional links toolbar' feature — the naming is internally inconsistent."
      confidence: STATIC-INFERRED
      evidence: "AdditionalLinkProperties.java:6-7 (the prefix is `odd`, the field is `links`)"
    - name: "AdditionalLinkConfiguration (class name)"
      promise: "Wires up the AdditionalLinkProperties bean — a one-line activator for the `odd.links` binding."
      implementation: "Exactly that — a 10-line @Configuration class with @EnableConfigurationProperties. No surprise."
      drift: NONE
      operator_visible_consequence: "N/A"
      confidence: STATIC-INFERRED
      evidence: "AdditionalLinkConfiguration.java:1-11"
  orderings: []
  auth_gates: []
  resource_boundaries:
    - location: "AdditionalLinkProperties.java:6-9"
      kind: concurrency
      questions:
        - q: "Can two simultaneous calls produce corrupted state?"
          a: "No — Java records are immutable; the outer record's `links` reference is final; the inner Link records are immutable. No concurrent mutation possible. The Spring binder writes the record once at boot; thereafter the object is effectively frozen."
          confidence: STATIC-INFERRED
          evidence: "AdditionalLinkProperties.java:7-9 (record + nested record, all final by language)"
        - q: "Is the call replay-safe?"
          a: "Yes — the record has no behavior; consumption is pure read. Calling `linkProperties.links()` N times within a single process lifetime returns the SAME list reference (Spring constructs once and caches in the application context)."
          confidence: STATIC-INFERRED
          evidence: "AdditionalLinkProperties.java:7 + AdditionalLinkConfiguration.java:8 (Spring-managed singleton scope)"
        - q: "If a cache fronts this, what is the TTL / eviction key / staleness window?"
          a: "N/A at the record layer — there is no cache annotation. The 'staleness window' that DOES apply is the BOOT-TIME-BIND immutability: the record reflects the YAML / env at boot time only; runtime YAML edits are invisible until restart. P-128 covers the operator-observable consequence at the endpoint level."
          confidence: STATIC-INFERRED
          evidence: "AdditionalLinkProperties.java:6 (@ConfigurationProperties — Spring binds once during context refresh) + AdditionalLinkConfiguration.java:8 (no @RefreshScope)"
  request_inputs:
    - location: "AdditionalLinkProperties.java:7 (the outer record's `links` field — the ONLY input the record takes from operator config)"
      input_kind: body-field
      input_name: "links (List<Link>)"
      questions:
        - q: "What does the input NAME promise the caller, in plain user-facing English?"
          a: "'A list of links.' The operator-facing promise is that each list entry is a link — an addressable URL with a human-readable title. No promise about URL scheme, no promise about uniqueness, no promise about max count, no promise about validation."
          confidence: STATIC-INFERRED
          evidence: "AdditionalLinkProperties.java:7"
        - q: "When supplied, what does the implementation USE the input for?"
          a: "Bound at boot via Spring's @ConfigurationProperties relaxed binder from `odd.links[*].{title,url}`. Stored as a final field on the singleton bean. Consumed by LinksController.getLinks (LinksController.java:31-33), which maps each Link to an OpenAPI-generated Link DTO and returns them in a LinkList via Mono. Terminal UI consumer: AppInfoMenu.tsx:60-66 renders each link as `<Link to={link.url} target='_blank'>` with `<Typography>{link.title}</Typography>` inside."
          confidence: STATIC-INFERRED
          evidence: "AdditionalLinkProperties.java:7 → LinksController.java:31-33 → AppInfoMenu.tsx:60-66"
        - q: "Does the implementation's actual scope MATCH the name's promise?"
          a: "MATCHES — `links` is a list of `Link`, each is `(title, url)`, and the implementation uses them as exactly that. No translation, no remapping. The drift in this feature is NOT input-name-vs-implementation; it is class-name-vs-prefix (AdditionalLink* class binding to `odd` namespace) and validation-absence (URL string is not validated against any schema), both flagged separately in name_behavior_pairs and bugs_limitations_corner_cases."
          drift: NONE
          confidence: STATIC-INFERRED
          evidence: "AdditionalLinkProperties.java:7-9 + LinksController.java:31-33 + AppInfoMenu.tsx:60-66"
        - q: "For TRANSLATES_SILENTLY: what does a caller see when their assumption is wrong?"
          a: "N/A — no input-vs-implementation drift at the record layer. The operator-visible failures (broken UI for null fields, tabnabbing, javascript-URL acceptance) trace to the ABSENCE of validation on the inner Link record's `title` and `url` fields, not to a name-vs-meaning mismatch on the outer `links` field."
          confidence: STATIC-INFERRED
          evidence: "AdditionalLinkProperties.java:7-9"
        - q: "Is there a column / field / variable that DOES match the input's name and is NOT being used?"
          a: "NONE — the record exposes only `links` and the consumers use only `links`. The only 'available-but-unused' adjacent observation is at a meta-level: the record's CLASS NAME contains 'Additional' but the bound prefix is just `odd`, so the keyword 'additional' is unrepresented in the operator-visible config namespace."
          confidence: STATIC-INFERRED
          evidence: "AdditionalLinkProperties.java:6 + application.yml:208-214"
      routes_to_finding: "bugs_limitations_corner_cases.[2] (class-name-vs-config-key drift) — no DRIFT_INPUT_NAME_VS_IMPLEMENTATION at the record layer itself"
    - location: "AdditionalLinkProperties.java:8 (the inner Link record's `url` field)"
      input_kind: body-field
      input_name: "url (String)"
      questions:
        - q: "What does the input NAME promise the caller, in plain user-facing English?"
          a: "'A URL.' In standard usage that means an addressable web resource — typically http(s), occasionally other schemes. An operator reading the docs page (which describes 'navigation links to internal wikis, runbooks, dashboards') would reasonably assume http or https only."
          confidence: STATIC-INFERRED
          evidence: "AdditionalLinkProperties.java:8"
        - q: "When supplied, what does the implementation USE the input for?"
          a: "Bound as a raw String — no parsing, no normalization, no validation. Stored in the inner record's `url` accessor. Passed through to the controller's response DTO (LinksController.java:32 — `new Link().url(link.url())`). Ultimately rendered into the DOM as `<Link to={link.url} target='_blank'>` (AppInfoMenu.tsx:61), which becomes a real `<a href>` attribute in the rendered HTML."
          confidence: STATIC-INFERRED
          evidence: "AdditionalLinkProperties.java:8 + LinksController.java:32 + AppInfoMenu.tsx:60-66"
        - q: "Does the implementation's actual scope MATCH the name's promise?"
          a: "TRANSLATES_SILENTLY — the name 'url' promises a URL (schema-conformant http(s) by reasonable interpretation); the implementation accepts ANY String including `javascript:alert(1)`, `data:text/html,<script>...</script>`, `file:///etc/passwd`, `vbscript:`, malformed strings, empty strings, and null. The string flows unmodified through to the browser's `<a href>` attribute. The 'silent' aspect: no operator-facing surface (documentation, JSR-303 validation error, application log) warns about scheme restrictions or invalid URLs."
          drift: DRIFT_INPUT_NAME_VS_IMPLEMENTATION
          confidence: STATIC-INFERRED
          evidence: "AdditionalLinkProperties.java:8 (no @URL, no @Pattern, no scheme check) + LinksController.java:32 (passthrough) + AppInfoMenu.tsx:61 (rendered as <Link to={link.url}>)"
        - q: "For TRANSLATES_SILENTLY: what does a caller see when their assumption is wrong?"
          a: "(1) `javascript:` URL — React's react-router-dom <Link> wraps href; modern React (17+) strips `javascript:` from `<a href>` at render time, BUT the click handler attempting to navigate to it can still fail silently or throw a console error. (2) `data:text/html,<script>alert(document.cookie)</script>` — under target='_blank' opens a new tab rendering the operator-supplied HTML in the same origin as the link CONTEXT (sandboxed by browser, but still surprising). (3) Empty string `url=''` — renders as `<a href=''>` which is treated as the current document (clicking reloads the ODD page). (4) `null` — produces `<a>` with no href (non-clickable; visual but inert). (5) Operator typing `wiki.internal` instead of `https://wiki.internal` — browser interprets as relative path under the current ODD platform host, hitting `/wiki.internal` which 404s. None of these is fail-fast at config-load time; all surface as a user opening the menu and clicking a link that does nothing — or worse."
          confidence: STATIC-INFERRED
          evidence: "AdditionalLinkProperties.java:8 + AppInfoMenu.tsx:61 + react-router-dom Link behaviour"
        - q: "Is there a column / field / variable that DOES match the input's name and is NOT being used?"
          a: "NONE — there is no nearby alternative field. The smell is the OPPOSITE: the field that SHOULD be validated against a URL schema constraint is the SAME field being used. The fix anchor is to add `@URL @NotBlank @Pattern(regexp=\"^(https?|mailto):.*\")` here (plus `@Validated` on the outer class) — not to switch to a different field."
          confidence: STATIC-INFERRED
          evidence: "AdditionalLinkProperties.java:8 (the field that needs a constraint, doesn't have one)"
      routes_to_finding: "bugs_limitations_corner_cases.[0] (no validation annotations) + docs_link_semantic.doc_drift_findings.[4] (doc silent on URL scheme restrictions) + probes_emitted P-177"
    - location: "AdditionalLinkProperties.java:8 (the inner Link record's `title` field)"
      input_kind: body-field
      input_name: "title (String)"
      questions:
        - q: "What does the input NAME promise the caller, in plain user-facing English?"
          a: "'A human-readable label.' By reasonable interpretation: a short text string suitable for display as the visible text of a menu item."
          confidence: STATIC-INFERRED
          evidence: "AdditionalLinkProperties.java:8"
        - q: "When supplied, what does the implementation USE the input for?"
          a: "Bound as raw String. Passed through to the response DTO (LinksController.java:32 — `new Link().title(link.title())`). Rendered in the UI as `<Typography variant='h4'>{link.title}</Typography>` inside an `<a>` element (AppInfoMenu.tsx:63). React's JSX escapes the value automatically, so traditional HTML-injection XSS through `title` is BLOCKED by React's default escaping behaviour."
          confidence: STATIC-INFERRED
          evidence: "AdditionalLinkProperties.java:8 + LinksController.java:32 + AppInfoMenu.tsx:63"
        - q: "Does the implementation's actual scope MATCH the name's promise?"
          a: "MATCHES — the value is treated as display text, and React's JSX-escaping makes this safe by default. Risk surfaces (still LOW): (a) operator-supplied unicode that breaks line-wrapping in the menu rendering, (b) extremely long titles that overflow the `<Typography>` container, (c) zero-width-character titles that produce an invisible-but-clickable menu item, (d) empty string `title=''` rendering as an apparently-blank entry. None of these is a security issue — they are UX foot-guns."
          drift: NONE
          confidence: STATIC-INFERRED
          evidence: "AdditionalLinkProperties.java:8 + AppInfoMenu.tsx:63 + React JSX default escaping"
        - q: "For TRANSLATES_SILENTLY: what does a caller see when their assumption is wrong?"
          a: "N/A — no DRIFT for title. The UX issues listed above are bugs_limitations_corner_cases items, not name-vs-meaning drift."
          confidence: STATIC-INFERRED
          evidence: "AdditionalLinkProperties.java:8"
        - q: "Is there a column / field / variable that DOES match the input's name and is NOT being used?"
          a: "NONE."
          confidence: STATIC-INFERRED
          evidence: "AdditionalLinkProperties.java:8"
      routes_to_finding: "bugs_limitations_corner_cases.[0] (no validation — includes no @NotBlank on title; an operator can declare `odd.links[0].title=` and ship an invisible menu entry)"
  probes_emitted:
    - probe_id: P-177
      question: "Verify that operator-supplied URLs of the form `javascript:`, `data:`, `file:`, `vbscript:`, empty string, and relative paths flow unmodified through the record → controller → API response chain, and the rendered UI's `<a href>` attribute. Pins the URL-scheme-acceptance hypothesis at the BACKEND layer (the record's contract); the UI-side rendering verification is split into a Playwright probe per P-128's realism_caveats roadmap."
      probe_path: "lineage/odd-platform/probes/P-177.yaml"
  stress_summary:
    triggers_total: 5
    questions_total: 18
    answers_static_inferred: 18
    answers_probe_needed: 0
    answers_reference: 0
    drift_flags: 2
```

## security

- auth_mode_relevance: [INTERNAL_ONLY — the record is a Spring bean, not on the HTTP surface; auth modes apply to the consumer (LinksController) not to the binding itself. However, the record's CONTENT — operator-supplied URLs — is exposed by the consumer to every authenticated user (LOGIN_FORM/OAUTH2/LDAP) or to every caller (DISABLED).]
- ingestion_filter_relevance: "N/A — not on any HTTP path; bind happens during Spring context refresh"
- authorization_assertions: []
- owner_scoping: "N/A — config record, not data-scoped. Important corollary: the record's CONTENT becomes data that LinksController serves WITHOUT owner-scoping, but the absence of owner-scoping is a LinksController concern, not a properties-record concern."
- data_exposure:
  - "The record's STATE (the list of operator-configured links) is exposed by LinksController to every authenticated user (LOGIN_FORM/OAUTH2/LDAP) or every caller (DISABLED). If the operator configures internal URLs, those URLs become readable to every user who can authenticate. The properties record itself does not enforce confidentiality — that is the consumer's responsibility, and the consumer (LinksController) does not enforce it either (no @PreAuthorize, no role filter)."
  - "The record's STATE is also exposed via Spring's `/actuator/env` endpoint when actuator is enabled (application.yml:230 — `management.endpoints.web.exposure.include: health, prometheus, env, info`). Under default config, `/actuator/env` is gated by management security (typically same port, same authentication chain), so an authenticated caller can read the entire `odd.links` configuration including any internal URLs. Operators who expose actuator endpoints to broader audiences (e.g. a separate management port, an internal monitoring network) inadvertently expose this configuration."
- known_security_gaps:
  - "No URL-scheme validation at the binding layer — operator can configure `javascript:`, `data:`, `file:`, `vbscript:` and the binder accepts them. The eventual UI rendering depends on React + react-router-dom to neutralise dangerous schemes; this is defence-in-depth pushed entirely to the UI layer, with no backend-side validation as a safety net." — evidence: AdditionalLinkProperties.java:8 (no @URL, no @Pattern) — severity: MEDIUM
  - "No @Validated on the class — even adding JSR-303 constraints to Link's fields would not activate them without the class-level activator. This is a subtle gotcha for any future hardening PR." — evidence: AdditionalLinkProperties.java:6 (no @Validated) — severity: LOW
  - "No @NotBlank on title — operator can configure an entry with `url` but no `title`, producing an invisible-but-clickable menu item. This is a phishing-vector enabler: a malicious operator (or an operator whose YAML was modified by a less-trusted role) can plant an unlabelled link." — evidence: AdditionalLinkProperties.java:8 (no @NotBlank on title) — severity: LOW (operator-trust model)
  - "`@ConfigurationProperties("odd")` claims a shared namespace — the entire `odd.*` prefix — without `ignoreUnknownFields = false`. If a future Spring Boot upgrade or a deliberate hardening change toggled strict-mode binding on, the application would fail to boot (because `odd.tenant-id`, `odd.platform-base-url`, etc. are NOT declared as fields on this record but ARE present in `application.yml`)." — evidence: AdditionalLinkProperties.java:6 + application.yml:208-214 + cross-namespace @Value reads — severity: LOW (latent foot-gun, not currently exploited)

## performance

- hot_paths:
  - "Record construction happens ONCE at application boot — not a hot path. Subsequent reads (`linkProperties.links()`) are constant-time field access on an immutable record." — evidence: AdditionalLinkProperties.java:6-9 (record contract — final fields, singleton-scoped bean)
- throughput_characteristics:
  - "N/A — record has no behaviour; throughput characteristics live at the consumer (LinksController) and downstream (UI rendering)"
- resource_allocation:
  - "Total memory cost = sizeof(outer record) + sizeof(List<Link>) + N * sizeof(Link). For N ≤ 50 (typical operator setup) this is sub-kilobyte. For pathological N (5000+) the record allocates O(N) at boot and the list is retained for process lifetime — still trivially small in absolute terms." — evidence: AdditionalLinkProperties.java:7-9
  - "The list reference is shared (NOT copied) between the singleton record instance and every LinksController call. The controller's `.stream().map(...).toList()` allocates a new ArrayList per request — that copy is the per-request cost, not the record's." — evidence: LinksController.java:31-33
- scaling_characteristics:
  - "Stateless, singleton-scoped, immutable — scales trivially across instances; every instance binds the same config at its own boot time." — evidence: AdditionalLinkProperties.java:7 (record) + AdditionalLinkConfiguration.java:8 (singleton bean)
- known_performance_gaps:
  - "No max-size cap on the list — operator pathological config (e.g. accidentally bound a large env-variable list, or a misconfigured ConfigMap with thousands of entries) is accepted silently. The cost surfaces NOT at the record (boot-time, O(N) memory) but at every consumer call (LinksController's per-request stream→toList copy is O(N); the UI's render loop is O(N) per menu open)." — evidence: AdditionalLinkProperties.java:7 (no @Size constraint on the list) + LinksController.java:31-33 — severity: LOW

## upstream_callers

- entry_point: "boot:@Configuration(AdditionalLinkConfiguration) — Spring application context refresh"
  caller_node: "odd-platform java config:AdditionalLinkConfiguration"
  multiplicity_per_trigger: 1
  evidence: "AdditionalLinkConfiguration.java:7-10 (@Configuration class + @EnableConfigurationProperties(AdditionalLinkProperties.class)) — Spring instantiates the record exactly once during context refresh; reads `odd.links[*].{title,url}` from the Environment"
  observation_class: boot-eval

- entry_point: "rest:GET /api/links (terminal — every consumer of the record's state reaches it via this controller)"
  caller_node: "odd-platform java LinksController controller-class:LinksController"
  multiplicity_per_trigger: 1
  evidence: "LinksController.java:23 (`private final AdditionalLinkProperties linkProperties` — constructor-injected via Lombok @RequiredArgsConstructor) + LinksController.java:27,31 (linkProperties.links() called twice per request)"
  observation_class: rest-call

## downstream_side_effects

- side_effect_class: log-emit
  description: "None at the record layer. Spring's default binding does NOT log the bound values (avoiding accidental disclosure of sensitive config). The values DO surface in `/actuator/env` when enabled (see security.data_exposure)."
  evidence: "AdditionalLinkProperties.java:1-10 (no log statements, no toString override beyond record's auto-generated toString which is invoked only if a consumer logs it)"
  cardinality_per_call: 0
  reachable_from_entry_points: []

- side_effect_class: external-call
  description: "None directly. The record's content is operator-supplied URLs that BECOME external endpoints when an end-user clicks the rendered link — but the record itself makes no outbound HTTP call."
  evidence: "AdditionalLinkProperties.java:1-10"
  cardinality_per_call: 0
  reachable_from_entry_points: []

## sources

- understanding ← AdditionalLinkProperties.java:1-10 + AdditionalLinkConfiguration.java:1-11 + LinksController.java:1-37 + AppInfoMenu.tsx:18,55-69
- concepts.entities ← AdditionalLinkProperties.java:6-9
- concepts.operations ← AdditionalLinkProperties.java:6 + AdditionalLinkConfiguration.java:8
- concepts.invariants ← AdditionalLinkProperties.java:7-9 (record immutability) + AdditionalLinkProperties.java:8 (no validation annotations)
- dependencies_semantic.requires-feature ← AdditionalLinkProperties.java:6 (@ConfigurationProperties) + AdditionalLinkConfiguration.java:8 (@EnableConfigurationProperties)
- dependencies_semantic.requires-config ← AdditionalLinkProperties.java:7-9 (no defaults declared)
- tests_coverage_semantic.test_files ← Grep result against odd-platform-api/src/test (no matches for AdditionalLinkProperties)
- docs_link_semantic.inferred_docs ← WebFetch https://docs.opendatadiscovery.org/configuration-and-deployment/odd-platform (status 200, 2026-05-26)
- docs_link_semantic.doc_drift_findings.[0] ← AdditionalLinkProperties.java:8 (no @NotBlank)
- docs_link_semantic.doc_drift_findings.[1] ← AdditionalLinkProperties.java:7 + LinksController.java:27 (the null-guard lives in the controller, not the record)
- docs_link_semantic.doc_drift_findings.[2] ← AdditionalLinkProperties.java:6 (@ConfigurationProperties → boot-time bind)
- docs_link_semantic.doc_drift_findings.[3] ← AdditionalLinkProperties.java:7 (no explicit sort) + LinksController.java:31-33 (stream/toList preserves order)
- docs_link_semantic.doc_drift_findings.[4] ← AdditionalLinkProperties.java:8 (no URL scheme constraint)
- docs_link_semantic.doc_drift_findings.[5] ← AuthorizationCustomizer.java:29-30 (DISABLED mode caveat — referenced from LinksController sidecar)
- implicit_adrs.[0] ← AdditionalLinkProperties.java:6 + AdditionalLinkConfiguration.java:8
- implicit_adrs.[1] ← AdditionalLinkProperties.java:7-8 (record-of-records)
- bugs_limitations_corner_cases.[0] ← AdditionalLinkProperties.java:8
- bugs_limitations_corner_cases.[1] ← AdditionalLinkProperties.java:6 + SlackMessageGeneratorConfiguration.java:15 + ExternalMetricReader.java:53 + DataEntityStaleDetector.java:10
- bugs_limitations_corner_cases.[2] ← AdditionalLinkProperties.java:6-7 + application.yml:208-214
- bugs_limitations_corner_cases.[3] ← application.yml:208-214
- bugs_limitations_corner_cases.[4] ← AdditionalLinkProperties.java:7
- bugs_limitations_corner_cases.[5] ← AdditionalLinkProperties.java:7-9 + LinksController.java:27
- bugs_limitations_corner_cases.[6] ← AdditionalLinkProperties.java:6
- security.auth_mode_relevance ← AdditionalLinkProperties.java:6 (binding, not HTTP)
- security.data_exposure ← LinksController.java:31-33 + application.yml:230 (actuator env exposure)
- security.known_security_gaps.[0] ← AdditionalLinkProperties.java:8
- security.known_security_gaps.[1] ← AdditionalLinkProperties.java:6
- security.known_security_gaps.[2] ← AdditionalLinkProperties.java:8
- security.known_security_gaps.[3] ← AdditionalLinkProperties.java:6 + application.yml:208-214 + cross-namespace @Value reads
- performance.hot_paths ← AdditionalLinkProperties.java:6-9
- performance.resource_allocation ← AdditionalLinkProperties.java:7-9 + LinksController.java:31-33
- performance.scaling_characteristics ← AdditionalLinkProperties.java:7 + AdditionalLinkConfiguration.java:8
- performance.known_performance_gaps ← AdditionalLinkProperties.java:7 + LinksController.java:31-33
- upstream_callers.[0] ← AdditionalLinkConfiguration.java:7-10
- upstream_callers.[1] ← LinksController.java:23,27,31
- downstream_side_effects ← AdditionalLinkProperties.java:1-10 (no side effects at the record layer)

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

