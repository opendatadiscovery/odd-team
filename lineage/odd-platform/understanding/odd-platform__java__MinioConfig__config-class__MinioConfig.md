---
node_id: "odd-platform java MinioConfig config-class:MinioConfig"
node_kind: config-class
axis: config_classes
extracted_at_commit: 80637ed
enriched_at_commit: 80637ed
extractor_version: 0.1.0
prompt_version: file-analyser/0.2.0
schema_version: v0.3.0
enrichment_status: complete
confidence_overall: HIGH
session_id: session-2026-05-20-X
---

# MinioConfig — semantic understanding

## understanding

`MinioConfig` is a 26-line Spring `@Configuration` class that produces a single `MinioAsyncClient` bean — the lone HTTP client used by the REMOTE attachment-storage backend to talk to a MinIO / S3-compatible endpoint. It is the canonical LSN-002 surface: the `MinioAsyncClient.builder()` call (MinioConfig.java:21-24) sets only `.endpoint(url)` and `.credentials(accessKey, secretKey)` — `.region(...)` is never called, leaving the SDK's `us-east-1` default in effect and silently restricting AWS S3 operators to that single region. The bean is conditionally registered (`@ConditionalOnProperty(value = "attachment.storage", havingValue = "REMOTE")` — MinioConfig.java:10) so the entire class is skipped when LOCAL storage is in effect (the default). The class participates in the LSN-001 lineage indirectly: it is the gate for REMOTE persistence (the LSN-001 doc-remediation's recommended posture) but contributes nothing toward solving LSN-001's in-code residue (the hard-coded `/tmp/odd/chunks` staging path in `FileUtils.java:24` is shared by both modes and is NOT a MinioConfig concern).

## concepts

- entities: [`MinioAsyncClient` (the bean produced), `attachment.remote.url` (S3-compatible endpoint), `attachment.remote.access-key`, `attachment.remote.secret-key`]
- operations: [
    `register-conditional-on-REMOTE` (MinioConfig.java:10 — `@ConditionalOnProperty(value = "attachment.storage", havingValue = "REMOTE")`; bean only exists when REMOTE mode is active),
    `bind-three-yaml-keys` (MinioConfig.java:12-17 — three `@Value`-injected fields: url / access-key / secret-key; no `:default` fallback on any of them — boot fails with `IllegalArgumentException` if missing under REMOTE mode),
    `build-minio-client` (MinioConfig.java:19-25 — `MinioAsyncClient.builder().endpoint(url).credentials(accessKey, secretKey).build()`)
  ]
- invariants: [
    "the bean is produced ONLY when `attachment.storage=REMOTE`; LOCAL mode (the default, via `matchIfMissing=true` on the LOCAL beans elsewhere) means MinioConfig is never instantiated and no MinioAsyncClient exists in the context — evidence: MinioConfig.java:10",
    "the three `@Value` fields have no default — `attachment.remote.url` / `access-key` / `secret-key` are REQUIRED at boot under REMOTE mode; the bucket name is read independently in `RemoteFileUploadServiceImpl.java:39-40` and validated non-empty by its own `@PostConstruct validate()` — MinioConfig itself does NOT validate the three fields it consumes",
    "the `MinioAsyncClient.builder()` chain is exactly three method calls (`.endpoint`, `.credentials`, `.build`) — `.region(...)` and `.httpClient(...)` are absent; the SDK's default region (`us-east-1`) and default HTTP client (long timeouts, no operator tunable) govern at runtime — evidence: MinioConfig.java:21-24 (LSN-002 canonical anchor)",
    "the bean is constructed eagerly at Spring application startup under REMOTE mode (no `@Lazy`), but the MinioAsyncClient itself connects lazily — no S3 endpoint reachability check, no credential validation, no bucket existence check happens at boot; the first runtime call (a putObject / getObject from `RemoteFileUploadServiceImpl`) is the first opportunity for the configuration to be exercised against the actual backend"
  ]
- audiences: ["operators configuring REMOTE attachment storage against MinIO or AWS S3", "developers adding REMOTE-mode behaviour (e.g. region support, custom timeouts, IAM-role credentials)"]

## dependencies_semantic

- requires-feature: [
    "attachment.storage strategy framework — MinioConfig is one of the two storage-strategy bean factories (the other is the LOCAL filesystem path constructor in `LocalFilePathConstructor.java:13`); both are mutually exclusive at boot via `@ConditionalOnProperty`",
    "REMOTE attachment upload pipeline — `RemoteFileUploadServiceImpl` (the sole consumer of the `MinioAsyncClient` bean, RemoteFileUploadServiceImpl.java:5,43) requires this bean and shares the same `attachment.storage=REMOTE` conditional"
  ]
- requires-config: [
    "`attachment.storage` (LOCAL | REMOTE; default LOCAL via `matchIfMissing=true` elsewhere) — gates whether MinioConfig is instantiated at all (MinioConfig.java:10)",
    "`attachment.remote.url` (no default — REQUIRED under REMOTE; YAML stub at application.yml:221 sets `http://localhost:9000` as a dev-stub) — feeds `.endpoint(url)` (MinioConfig.java:12-13, 22)",
    "`attachment.remote.access-key` (no default — REQUIRED; YAML stub at application.yml:222 is empty) — feeds `.credentials(accessKey, ...)` (MinioConfig.java:14-15, 23)",
    "`attachment.remote.secret-key` (no default — REQUIRED; YAML stub at application.yml:223 is empty) — feeds `.credentials(..., secretKey)` (MinioConfig.java:16-17, 23)",
    "`attachment.remote.bucket` (no default — REQUIRED; consumed NOT in MinioConfig but in `RemoteFileUploadServiceImpl.java:39-40` with a `@PostConstruct` non-empty validator at lines 45-50; YAML default at application.yml:224 is `odd`) — NOT read by this class but is the natural pair config-key for the MinioConfig bean's consumer",
    "`attachment.remote.region` — DOES NOT EXIST as a config key anywhere in the codebase (grep -r 'attachment.remote.region' confirms zero matches); the absence IS the LSN-002 surface"
  ]
- requires-runtime: [
    "MinIO Java SDK on classpath (`io.minio.MinioAsyncClient`, MinioConfig.java:3) — the SDK that ODD uses for ALL S3-compatible operations; ADR-CANDIDATE-013 codifies that AWS SDK v2 is NOT used",
    "Reachable S3-compatible HTTP(S) endpoint at `attachment.remote.url` — NOT validated at boot; first putObject / getObject from `RemoteFileUploadServiceImpl` triggers the first connection",
    "Pre-existing bucket at `attachment.remote.bucket` — NOT validated at boot (the existing `@PostConstruct` in `RemoteFileUploadServiceImpl.java:45-50` only checks `StringUtils.isEmpty(bucket)`, not bucket existence; REFACTOR-028 captures the gap)"
  ]

## tests_coverage_semantic

- covered_behaviours: []
- uncovered_behaviours: [
    "REMOTE mode bean wiring under valid configuration — no test asserts that `MinioAsyncClient` is registered when `attachment.storage=REMOTE` is set and the three credentials are present",
    "LOCAL mode bean skip — no test asserts that `MinioConfig` is NOT instantiated when `attachment.storage` is unset or set to LOCAL (the conditional contract)",
    "Missing `attachment.remote.url` under REMOTE mode — `@Value(\"${attachment.remote.url}\")` with no `:default` should fail bean wiring with `IllegalArgumentException: Could not resolve placeholder` at boot; no test asserts the failure mode (REFACTOR-036 captures the broader class)",
    "MinioAsyncClient builder configuration — no test verifies that `.endpoint(url)` and `.credentials(accessKey, secretKey)` are passed; no test asserts the absence of `.region(...)` (the LSN-002 anchor — a regression test would pin the current behaviour until a fix lands)",
    "Region-pin failure mode — no test exercises a non-`us-east-1` AWS S3 bucket to confirm the AuthorizationHeaderMalformed / PermanentRedirect failure (LSN-002 canonical user-impact reproduction)",
    "Non-existent bucket failure mode — no test exercises a misconfigured `attachment.remote.bucket` to confirm that first putObject fails (REFACTOR-028 — the deferred-failure pattern)"
  ]
- test_files: [] — N/A (grep `MinioConfig|MinioAsyncClient` in `<odd-platform>/odd-platform-api/src/test` returned no matches at enrichment time 2026-05-20)
- gaps: |
    Zero test coverage. The LSN-002 regression-test that would have caught the
    `us-east-1` pin at the time of LSN-002 still does not exist; the post-LSN-002
    doc-side remediation closed the operator-facing knowledge gap but no
    regression test pins the current behaviour as a regression invariant. A
    `@SpringBootTest` driving the bean wiring under `attachment.storage=REMOTE`
    + the three credential properties, asserting `MinioAsyncClient` is registered
    AND asserting the builder did NOT call `.region(...)` (introspection via
    reflection or via a mocked builder), would be the minimum regression-pin
    until the code-side fix lands.

## docs_link_semantic

- declared_docs: [] — N/A (no `@docs` annotation on `MinioConfig.java`; the `@docs` programme has not been bootstrapped in this repo at enrichment time)
- inferred_docs:
  - url: "https://docs.opendatadiscovery.org/configuration-and-deployment/odd-platform"
    anchor: "#attachment-storage-configuration"
    rationale: "Operator-facing configuration reference for attachment storage; live page is the authoritative doc-side remediation surface for both LSN-001 (LOCAL ephemeral warning) and LSN-002 (us-east-1 region pin). Confirmed at MinioConfig's primary-source level here."
    last_verified_at: "2026-05-20T00:00:00Z"
    last_verified_status: 200
    confidence: HIGH
    fetched_excerpts: |
      Section heading: "Attachment Storage Configuration" — anchor id `attachment-storage-configuration` resolves.

      "attachment.remote.url — S3-compatible endpoint URL when storage=REMOTE (for example `https://s3.us-east-1.amazonaws.com`)"

      "attachment.remote.access-key — access key for the S3-compatible bucket."

      "attachment.remote.secret-key — secret key for the S3-compatible bucket."

      "attachment.remote.bucket — bucket name used to store attachment objects. The bucket must already exist"

      "AWS S3 region pinned to `us-east-1`. The attachment client is built without an explicit region, so it uses the MinIO Java SDK's default region (`us-east-1`) for request signing. Against AWS S3 this means only buckets in `us-east-1` work"

      "The default `LOCAL` storage mode is ephemeral. Attachments are written to `/tmp/odd/attachments` inside the ODD Platform container filesystem. Any container or pod restart — routine deployment, node drain, crash, Kubernetes eviction — permanently deletes all uploaded files."

      "`attachment.max-file-size` must not exceed `spring.codec.max-in-memory-size`. Both ship with the same `20 MB` default"
- doc_drift_findings:
  - "The live operator page correctly documents the `us-east-1` region pin as a known operator caveat (verified 2026-05-20 status 200). The doc-side LSN-002 remediation is HEALTHY: operators reading the docs are warned. The CODE-side residue remains: MinioConfig.java:21-24 still constructs the builder without `.region(...)`, with no in-code comment cross-referencing LSN-002 and no fail-fast guard. The doc carries the knowledge; the code does not. — confidence: HIGH"
  - "The live operator page lists `attachment.remote.url / access-key / secret-key / bucket` as the REMOTE configuration keys; the file confirms three of them (url / access-key / secret-key) are bound in MinioConfig and the fourth (bucket) is bound separately in `RemoteFileUploadServiceImpl.java:39-40`. No drift on the key names; the doc shape matches code. — confidence: HIGH"
  - "The doc warns 'The bucket must already exist' (operator must pre-create); the code does NOT validate bucket existence at boot — only checks `StringUtils.isEmpty(bucket)` (RemoteFileUploadServiceImpl.java:45-50). REFACTOR-028 (deferred-failure: bucket existence not validated at boot) captures the gap. The doc warning is accurate but operationally weak: operators who forget to pre-create the bucket boot the platform successfully and discover the misconfiguration only at first upload. — confidence: HIGH"

## implicit_adrs

- "Storage backend bean wiring uses Spring `@ConditionalOnProperty` on `attachment.storage` (boot-time, not runtime), with REMOTE-mode beans (MinioConfig, RemoteFileUploadServiceImpl, RemoteFilePathConstructor) registered only when the property equals `REMOTE`. Switching modes requires a Platform restart. The convention is consistent across all four storage-strategy beans." — evidence: MinioConfig.java:10 (`@ConditionalOnProperty(value = \"attachment.storage\", havingValue = \"REMOTE\")`) + RemoteFileUploadServiceImpl.java:36 (same) + RemoteFilePathConstructor.java:10 (same) + LocalFileUploadServiceImpl.java:26 (`havingValue = \"LOCAL\", matchIfMissing = true`) + LocalFilePathConstructor.java:13 (same) — intent_anchor: "`@ConditionalOnProperty(value = \"attachment.storage\", havingValue = \"REMOTE\")` applied consistently across the three REMOTE beans + the mirror `matchIfMissing = true` applied consistently across the two LOCAL beans" — confidence: HIGH (ADR-CANDIDATE-012 in implicit-adrs.md cites this same pattern from the YAML angle)

- "REMOTE attachment storage is implemented exclusively via the MinIO Java SDK (`io.minio.MinioAsyncClient`); the AWS SDK v2 is not used anywhere in the attachment-storage code path. Operators using AWS S3 are deploying through the MinIO SDK's S3-compatibility surface, not through Amazon's first-party SDK." — evidence: MinioConfig.java:3 (`import io.minio.MinioAsyncClient`) + MinioConfig.java:20-25 (`MinioAsyncClient.builder()` is the only client construction) + RemoteFileUploadServiceImpl.java:3-8 (imports only `io.minio.*` types; no `software.amazon.awssdk.*` anywhere in the file) + grep `MinioAsyncClient` in <odd-platform> returns exactly two files (MinioConfig.java + RemoteFileUploadServiceImpl.java) — intent_anchor: "the codebase has one MinIO-SDK builder and zero AWS SDK builders; the integration substrate is uniformly MinIO-SDK by convention" — confidence: HIGH (ADR-CANDIDATE-013 in implicit-adrs.md cites this same decision)

## bugs_limitations_corner_cases

- "`MinioAsyncClient.builder()` does NOT call `.region(...)` — the SDK's default region (`us-east-1`) governs all signing. Operators running ODD against AWS S3 in any other region (eu-west-1, us-west-2, ap-southeast-1, etc.) see opaque signature/redirect errors (`AuthorizationHeaderMalformed`, `PermanentRedirect`) on the first putObject call. The doc-side warning is in place at `https://docs.opendatadiscovery.org/configuration-and-deployment/odd-platform#attachment-storage-configuration` (verified live 2026-05-20 status 200); the in-code residue is unmitigated — no `attachment.remote.region` config key exists anywhere in the codebase (grep returns zero matches), no `@PostConstruct` validation guards the assumption, no code comment cross-references LSN-002. Self-hosted MinIO is unaffected (MinIO ignores the region header)." — evidence: MinioConfig.java:19-25 (the absent `.region(...)` call) + retrospectives/LSN-002-minio-region-unset.md (canonical retrospective) + grep `attachment.remote.region` in <odd-platform> returns zero matches — severity: HIGH (the canonical LSN-002 anchor; REFACTOR-027 in refactoring-scopes.md captures the same finding from the YAML angle at MEDIUM but the file-level severity reflects the silent-data-failure risk for AWS-deploying operators)

- "Builder asymmetry: `.endpoint(url)` and `.credentials(accessKey, secretKey)` are wired from operator config; `.region(...)` and `.httpClient(...)` are absent — left at SDK defaults. The MinIO SDK default HTTP client uses ~5-minute timeouts with no operator-tunable knob (no `attachment.remote.connect-timeout-millis`, etc.). Operators on slow networks with large `attachment.max-file-size` see unrecoverable socket timeouts. REFACTOR-034 captures the same finding. The `.httpClient(...)` and `.region(...)` parameter absences are TWO sides of the same Gate-5 unset-parameter-audit shape." — evidence: MinioConfig.java:19-25 (the builder chain has exactly three method calls) + grep `attachment.remote.connect-timeout` in <odd-platform> returns zero matches — severity: MEDIUM

- "MinioConfig is wired EAGERLY at boot under REMOTE mode but does NOTHING to validate the operator's REMOTE configuration. The three `@Value` fields fail to bind only if they are blank-and-no-default (the bean wiring throws `IllegalArgumentException: Could not resolve placeholder` per Spring's standard `@Value` semantics); the URL is NOT validated as a reachable endpoint, the credentials are NOT validated against the endpoint, and the bucket name (read by the downstream consumer) is only checked for non-emptiness — never for existence. Boot succeeds; the misconfiguration surfaces at first upload. REFACTOR-028 captures the bucket-existence sub-case." — evidence: MinioConfig.java:9-25 (no `@PostConstruct`, no boot-time S3 call) + RemoteFileUploadServiceImpl.java:45-50 (the only `@PostConstruct` in the REMOTE pipeline checks `StringUtils.isEmpty(bucket)` and nothing else) — severity: HIGH (deferred-failure pattern; operators see 'platform is up' but uploads fail; LSN-001-shape pattern of latent silent failure)

- "S3 credentials (`attachment.remote.access-key`, `attachment.remote.secret-key`) are bound via `@Value` (MinioConfig.java:14-17) and therefore visible to `/actuator/env` under Spring Boot Actuator's default config. Spring Boot 3.4+ defaults `management.endpoint.env.show-values=NEVER` which sanitises matching key-patterns, but the field names themselves (`accessKey`, `secretKey`) and the *presence* of the configuration leak via the actuator path. Operators who whitelist `/actuator/env` for ops tooling or who downgrade `show-values` for debugging will leak the cleartext credentials. REFACTOR-029 captures the broader class." — evidence: MinioConfig.java:14-17 (the two `@Value` injections of access-key + secret-key) + application.yml:226-240 (actuator config exposes `env`, `info`, `prometheus`, `health` by default; `management.endpoint.env.enabled: true`) — severity: HIGH

- "No IAM-instance-profile / IRSA / `WebIdentityToken` / `DefaultCredentialsProvider` support — credentials are exclusively static keys via Spring `@Value`. Deploying ODD on AWS EKS or ECS where operators would prefer IAM roles over static keys is not supported by this bean. The MinIO SDK's `Provider` interface (`StaticProvider`, `IamAwsProvider`, etc.) is bypassed entirely by the `.credentials(accessKey, secretKey)` call which constructs a `StaticProvider` implicitly." — evidence: MinioConfig.java:23 (`.credentials(accessKey, secretKey)` — the two-argument signature; no `.credentialsProvider(...)` call) — severity: MEDIUM (operator convenience / security best-practice gap; not a data-loss risk but a deployment-flexibility limitation surfaced by ADR-CANDIDATE-013's MinIO-SDK-only stance)

- "The bean does NOT participate in the chunked-upload staging path. `FileUtils.java:24` declares `CHUNK_BASE_PATH = \"/tmp/odd/chunks\"` as a static final constant that applies in BOTH LOCAL and REMOTE modes; MinioConfig produces an S3-talking client but has no concept of where intermediate chunks live before the final assembly. This means: even with REMOTE persistence correctly configured here, in-flight uploads still depend on local `/tmp` for the chunk window (LSN-001 in-code residue; chunk-base-path-hardcoded-tmp-storage-mode-independent invariant in concepts/detail/invariants/). The gap is NOT MinioConfig's bug to fix — but the LSN-001 lineage attaches to this class because operators reading the LSN-001-remediated doc and switching to REMOTE will land on this class as the primary REMOTE wiring point, and may reasonably (but incorrectly) expect REMOTE persistence to cover the chunk window too." — evidence: MinioConfig.java:1-26 (no chunk-related code) + FileUtils.java:24 (hard-coded constant) + LocalFileUploadServiceImpl.java:34 (uses the constant) + RemoteFileUploadServiceImpl.java:55 (uses the constant) — severity: LOW (cross-reference; not a MinioConfig direct gap, but it is the natural cross-link from this class for an operator following LSN-001 remediation)

## security

- auth_mode_relevance: INTERNAL_ONLY — `MinioConfig` is a bean factory, not on the HTTP surface. Auth mode (DISABLED / LOGIN_FORM / OAUTH2 / LDAP) does not apply directly. Indirect: the bean is only registered under `attachment.storage=REMOTE`, so its behaviour shifts based on the operator's storage choice but NOT on the auth mode.
- ingestion_filter_relevance: N/A — not HTTP; bean factory.
- authorization_assertions: [] — N/A (no controller-level annotations possible on a `@Configuration` class; downstream authorisation happens at `SecurityConstants.java:247-276` for `DATA_ENTITY_ATTACHMENT_MANAGE` against the controller endpoints, NOT against this bean).
- owner_scoping: N/A — bean factory; not data-scoped.
- data_exposure: [
    "S3 access-key + secret-key cleartext in the application context as `@Value`-injected fields on the MinioConfig instance — reachable via `/actuator/env` (Spring Boot 3.4+ default sanitisation masks values matching `password|secret|key|token` but the FIELD NAME `accessKey` / `secretKey` and the value PRESENCE leak); reachable via in-process `log.info(\"properties={}\", config)` if any Lombok-`@Data` config class were added (defence-in-depth concern, not currently breached because MinioConfig is a plain class without Lombok) — evidence: MinioConfig.java:14-17 + application.yml:226-240"
  ]
- known_security_gaps: [
    "S3 credentials leak vector via `/actuator/env` — `management.endpoints.web.exposure.include` defaults to `health, prometheus, env, info` (application.yml:231); `management.endpoint.env.enabled: true` (application.yml:237); cleartext credentials are masked by key-name sanitisation in Spring Boot 3.4+ default but the presence + the field shape leak; operators who whitelist `/actuator/env` to ops tooling leak the credentials — evidence: MinioConfig.java:14-17 + application.yml:226-240 — severity: HIGH (REFACTOR-029 from the YAML angle)",
    "No IAM-instance-profile support (no `DefaultCredentialsProvider` / IRSA path) — operators on AWS EKS cannot use IAM roles, MUST use static keys, MUST manage key rotation manually, MUST handle the actuator-leak risk above — evidence: MinioConfig.java:23 (static credentials only) — severity: MEDIUM",
    "No fail-fast at boot — the platform boots 'green' under REMOTE mode with unreachable endpoint, wrong credentials, missing bucket, OR wrong region; first upload reveals the issue, by which point operator confidence is high and the failure surface is the user-facing UI not the deployment pipeline — evidence: MinioConfig.java:9-25 (no `@PostConstruct`) + RemoteFileUploadServiceImpl.java:45-50 (only validates non-empty bucket; doesn't issue a `bucketExists` call) — severity: HIGH (REFACTOR-028 from the deferred-failure angle)"
  ]

## performance

- hot_paths: [] — N/A; bean factory, not on any request path. The bean's `minioClient()` method runs exactly once at application startup under REMOTE mode.
- throughput_characteristics: [
    "single MinioAsyncClient instance per application context — the SDK's async client is thread-safe and shared by all upload/download operations from `RemoteFileUploadServiceImpl`; no per-request client construction, no pooling logic in ODD code (the underlying OkHttp connection pool is the SDK's responsibility) — evidence: MinioConfig.java:19-25 (singleton bean — Spring `@Bean` default scope) + RemoteFileUploadServiceImpl.java:43 (single `final MinioAsyncClient minioClient` field)"
  ]
- resource_allocation: [
    "OkHttp client allocation is the SDK default — connection pool size, idle keepalive, etc. are NOT operator-tunable through MinioConfig (no `.httpClient(...)` call; REFACTOR-034 captures the missing knobs) — evidence: MinioConfig.java:19-25 (no `.httpClient(...)`)",
    "Network connections are lazy — no S3 call at boot; first upload triggers the first connection (SDK behaviour; not visible in MinioConfig itself)"
  ]
- scaling_characteristics: [
    "stateless bean factory; instance scales horizontally with the application (no per-bean state)",
    "MinIO SDK does NOT depend on local filesystem — all REMOTE chunked-upload finalisation buffers the assembled file in heap before calling `putObject` (RemoteFileUploadServiceImpl.java:67-77 captures this from the consumer angle, REFACTOR-058 the chunk-staging side). The MinioConfig bean itself is heap-cheap (one OkHttp client + one MinioAsyncClient ~ low-MB)"
  ]
- known_performance_gaps: [
    "No operator knob for MinIO SDK HTTP timeouts — slow-network operators with large `attachment.max-file-size` (configurable up to spring.codec.max-in-memory-size of 20 MB default) see unrecoverable socket timeouts on the default 5-minute SDK setting — evidence: MinioConfig.java:19-25 (no `.httpClient(...)` call) — severity: MEDIUM (REFACTOR-034)",
    "No connection-pool tuning surface — the MinIO SDK's default OkHttp pool size may be inadequate for high-concurrency upload workloads — evidence: MinioConfig.java:19-25 (no SDK-internal-tuning surface exposed to operators) — severity: LOW"
  ]

## unset_parameter_audit

Per Gate 5 (`playbooks/unset-parameter-audit.md`), every parameter of the `MinioAsyncClient.builder()` SDK call must be classified. Surfacing this section explicitly because LSN-002 was the canonical case that motivated Gate 5's existence.

| Builder method | Status | Evidence + rationale |
|---|---|---|
| `.endpoint(String)` | `configured` from `attachment.remote.url` | MinioConfig.java:22 — operator-required; YAML stub at application.yml:221. |
| `.credentials(String accessKey, String secretKey)` | `configured` from `attachment.remote.access-key` + `attachment.remote.secret-key` | MinioConfig.java:23 — operator-required; YAML stubs at application.yml:222-223 are empty (must be supplied per deployment). Two-arg signature uses `StaticProvider` implicitly; `.credentialsProvider(Provider)` is NOT called — see below. |
| `.region(String)` | `caveat-defaulted` — SDK default `us-east-1` | MinioConfig.java:19-25 — `.region(...)` is NEVER called. The MinIO SDK's default region is `us-east-1`. Against AWS S3, this restricts the platform to `us-east-1` buckets. Self-hosted MinIO ignores the region header so this is silent on MinIO deployments. **CAVEAT IS DOCUMENTED** at `https://docs.opendatadiscovery.org/configuration-and-deployment/odd-platform#attachment-storage-configuration` (verified live 2026-05-20 status 200) — the doc-side remediation is in place. **CAVEAT IS NOT MITIGATED IN CODE** — no `attachment.remote.region` config key exists, no `@PostConstruct` guard, no in-code comment cross-referencing LSN-002. (LSN-002 canonical anchor; REFACTOR-027.) |
| `.httpClient(OkHttpClient)` | `caveat-defaulted` — SDK default ~5-minute timeouts, default OkHttp connection pool | MinioConfig.java:19-25 — `.httpClient(...)` is NEVER called. No `attachment.remote.connect-timeout-millis` / `.read-timeout-millis` / `.write-timeout-millis` config keys exist. Operators on slow networks with large file sizes see socket timeouts; no operator-tunable knob exists. **CAVEAT IS NOT DOCUMENTED** in the live operator page. (REFACTOR-034.) |
| `.credentialsProvider(Provider)` | `caveat-defaulted` — IAM-instance-profile / IRSA / `DefaultCredentialsProvider` unsupported | MinioConfig.java:19-25 — `.credentialsProvider(...)` is NEVER called. The two-arg `.credentials(accessKey, secretKey)` constructs a `StaticProvider` implicitly. AWS EKS / ECS operators wanting IAM-role-based credentials cannot configure this through MinioConfig; only static keys are supported. **CAVEAT IS NOT DOCUMENTED** in the live operator page. |

**Two caveat-defaulted parameters are silently latent in code with no in-code fail-fast / no in-code comment / no `attachment.remote.*` knob:** `.region(...)` (LSN-002 canonical) and `.httpClient(...)` (REFACTOR-034). One additional silent gap: `.credentialsProvider(...)` for IAM-role-based credentials. The Gate-5 procedure prescribes that every caveat-defaulted parameter ships as a doc admonition AND ideally an in-code comment cross-referencing the retrospective; the `.region(...)` row has the doc admonition (LSN-002 remediation is in place) but NOT the in-code comment; the `.httpClient(...)` and `.credentialsProvider(...)` rows have neither.

## sources

- understanding ← MinioConfig.java:1-26 + retrospectives/LSN-002-minio-region-unset.md + retrospectives/LSN-001-attachment-ephemeral-default.md
- concepts.entities ← MinioConfig.java:3,12-17,19-25
- concepts.operations.register-conditional-on-REMOTE ← MinioConfig.java:10
- concepts.operations.bind-three-yaml-keys ← MinioConfig.java:12-17 + application.yml:215-224
- concepts.operations.build-minio-client ← MinioConfig.java:19-25
- concepts.invariants.bean-conditional ← MinioConfig.java:10 + LocalFileUploadServiceImpl.java:26 (`matchIfMissing=true` on LOCAL — REMOTE is opt-in)
- concepts.invariants.no-defaults ← MinioConfig.java:12-17 (three `@Value` fields, no `:default` annotation form) + RemoteFileUploadServiceImpl.java:39-40,45-50 (bucket validation)
- concepts.invariants.builder-shape ← MinioConfig.java:19-25 (LSN-002 canonical anchor)
- concepts.invariants.eager-bean-lazy-connection ← MinioConfig.java:19-25 (no `@PostConstruct`) + RemoteFileUploadServiceImpl.java:45-50 (only the bucket-empty check, no boot-time S3 call)
- dependencies_semantic.requires-feature ← MinioConfig.java:10 + RemoteFileUploadServiceImpl.java:36,43 + RemoteFilePathConstructor.java:10
- dependencies_semantic.requires-config ← MinioConfig.java:10-17 + application.yml:215-224 + RemoteFileUploadServiceImpl.java:39-40 + grep `attachment.remote.region` (zero matches)
- dependencies_semantic.requires-runtime ← MinioConfig.java:3 + ADR-CANDIDATE-013 trace in implicit-adrs.md:369-381 + RemoteFileUploadServiceImpl.java:45-50
- tests_coverage_semantic.test_files ← grep `MinioConfig|MinioAsyncClient` in <odd-platform>/odd-platform-api/src/test (zero matches at 2026-05-20)
- tests_coverage_semantic.uncovered_behaviours ← MinioConfig.java:1-26 (no test file exists) + retrospectives/LSN-002-minio-region-unset.md (the regression-test gap that motivated Gate 5)
- docs_link_semantic.inferred_docs.[0] ← WebFetch https://docs.opendatadiscovery.org/configuration-and-deployment/odd-platform 2026-05-20 status 200, anchor `#attachment-storage-configuration` resolves
- docs_link_semantic.doc_drift_findings ← WebFetch excerpts above + MinioConfig.java:19-25 + RemoteFileUploadServiceImpl.java:45-50
- implicit_adrs.conditional-bean-wiring ← MinioConfig.java:10 + RemoteFileUploadServiceImpl.java:36 + RemoteFilePathConstructor.java:10 + LocalFileUploadServiceImpl.java:26 + LocalFilePathConstructor.java:13 + implicit-adrs.md:353-367 (ADR-CANDIDATE-012)
- implicit_adrs.minio-sdk-not-aws-sdk ← MinioConfig.java:3,20-25 + RemoteFileUploadServiceImpl.java:3-8 + implicit-adrs.md:369-381 (ADR-CANDIDATE-013)
- bugs_limitations_corner_cases.region-unset ← MinioConfig.java:19-25 + retrospectives/LSN-002-minio-region-unset.md + refactoring-scopes.md:232-242 (REFACTOR-027) + grep `attachment.remote.region` zero matches
- bugs_limitations_corner_cases.httpclient-unset ← MinioConfig.java:19-25 + refactoring-scopes.md:1019-1027 (REFACTOR-034) + grep `attachment.remote.connect-timeout` zero matches
- bugs_limitations_corner_cases.no-boot-validation ← MinioConfig.java:9-25 + RemoteFileUploadServiceImpl.java:45-50 + refactoring-scopes.md:244-254 (REFACTOR-028)
- bugs_limitations_corner_cases.actuator-leak ← MinioConfig.java:14-17 + application.yml:226-240 + refactoring-scopes.md:256-265 (REFACTOR-029)
- bugs_limitations_corner_cases.no-iam-provider ← MinioConfig.java:23 (two-arg `.credentials(...)`; no `.credentialsProvider(...)`)
- bugs_limitations_corner_cases.chunk-staging-cross-link ← MinioConfig.java:1-26 + FileUtils.java:24 + LocalFileUploadServiceImpl.java:34 + RemoteFileUploadServiceImpl.java:55 + concepts/detail/invariants/chunk-base-path-hardcoded-tmp-storage-mode-independent-lsn-001-in-code-residue.yaml
- security.data_exposure ← MinioConfig.java:14-17 + application.yml:226-240
- security.known_security_gaps ← MinioConfig.java:14-17,19-25 + application.yml:226-240 + RemoteFileUploadServiceImpl.java:45-50 + refactoring-scopes.md:256-265 (REFACTOR-029) + refactoring-scopes.md:244-254 (REFACTOR-028)
- performance.throughput_characteristics ← MinioConfig.java:19-25 + RemoteFileUploadServiceImpl.java:43
- performance.resource_allocation ← MinioConfig.java:19-25 (no `.httpClient(...)`)
- performance.known_performance_gaps ← MinioConfig.java:19-25 + refactoring-scopes.md:1019-1027 (REFACTOR-034)
- unset_parameter_audit ← MinioConfig.java:19-25 + WebFetch https://docs.opendatadiscovery.org/configuration-and-deployment/odd-platform#attachment-storage-configuration + retrospectives/LSN-002-minio-region-unset.md + playbooks/unset-parameter-audit.md

## confidence_per_field

- understanding: HIGH
- concepts: HIGH
- dependencies_semantic: HIGH
- tests_coverage_semantic: HIGH
- docs_link_semantic: HIGH
- implicit_adrs: HIGH
- bugs_limitations_corner_cases: HIGH
- security: HIGH
- performance: MEDIUM (claims about SDK default timeouts and pool sizes are sourced from the consumer-angle refactoring scopes plus ADR-CANDIDATE-013; not from a primary-source SDK doc verification this session — the upstream SDK doc page returned a redirect to an enterprise-only doc that did not include the JavaDoc reference)
- unset_parameter_audit: HIGH

## pre_emit_coherence_check

Per RULE 6 (LSN-018): this sidecar STRENGTHENS BOTH LSN-001 (attachment-ephemeral-default) AND LSN-002 (minio-region-unset).

**LSN-002 — primary source.** This is the file the retrospective named: `MinioConfig.java`. The retrospective's account ("constructed `MinioAsyncClient.builder()` without calling `.region(...)`") matches the live file at lines 19-25 verbatim — the builder chain is `.endpoint(url).credentials(accessKey, secretKey).build()`, no `.region(...)`. The doc-side remediation is verified healthy at the live page (WebFetch 2026-05-20 status 200, anchor `#attachment-storage-configuration` resolves, the us-east-1 caveat is quoted in the operator documentation). The CODE-side remediation is unimplemented: no `attachment.remote.region` config key exists in the codebase (grep returns zero matches), no in-code comment cross-references LSN-002, no `@PostConstruct` guard enforces the assumption. The Gate-5 unset-parameter audit above captures the exact shape (the `.region(...)` row is `caveat-defaulted` with doc-mitigation-only). The retrospective's value lives entirely in the doc surface; this sidecar pins the gap in the code surface for any future REFACTOR-027 fix.

**LSN-001 — indirect cross-link, not primary source.** LSN-001's primary surface is the `attachment.storage` default (`LOCAL` writes to ephemeral `/tmp/odd/attachments`); MinioConfig is the REMOTE-mode bean factory and is *only registered* under REMOTE — it is the operator's exit from LSN-001's failure mode, not the failure mode itself. The cross-link is captured in `bugs_limitations_corner_cases.chunk-staging-cross-link`: even when an operator follows the LSN-001-remediated doc and switches to REMOTE, the chunk-staging path (FileUtils.java:24 `/tmp/odd/chunks`) is hard-coded and storage-mode-independent — REMOTE persistence covers completed uploads but NOT in-flight chunks. MinioConfig itself does not contribute to or resolve this gap; the cross-link is recorded so that operators landing on this class as the canonical REMOTE-wiring point understand the residue.

**Three new file-anchored findings strengthen the retrospective lineage:**

1. **Asymmetric `@PostConstruct` validation between MinioConfig and RemoteFileUploadServiceImpl** — `RemoteFileUploadServiceImpl.java:45-50` fail-fasts on empty `bucket`, but no equivalent guard exists on `region`, `url`, or the credentials at the MinioConfig level. The validation pattern WAS established for one parameter; extending it to region (the LSN-002 surface) and to bucket-existence (REFACTOR-028) is the natural next step. This file-level finding makes the asymmetry visible.

2. **`.credentialsProvider(...)` is NEVER called** — this is the third silent-default in addition to `.region(...)` and `.httpClient(...)`. Operators wanting IAM-role-based credentials (AWS EKS / ECS / IRSA) cannot use them. Not covered by an existing REFACTOR scope at enrichment time; surfacing here as part of the Gate-5 unset-parameter audit.

3. **The MinioConfig sidecar is the natural home for the LSN-002 in-code remediation** — the chunk-staging gap is FileUtils' problem (REFACTOR-058); the bucket-existence-at-boot gap is RemoteFileUploadServiceImpl's problem (REFACTOR-028); the region-pin gap is MinioConfig's problem (REFACTOR-027). Surfacing all three from this file's vantage point makes the maintainer's REMOTE-storage hardening sprint (REFACTOR-027 + REFACTOR-028 + REFACTOR-029 + REFACTOR-034 + REFACTOR-058) coherent.

**Coherence verdict:** STRENGTHENS LSN-002 (primary source + Gate-5 audit + code-side remediation gap explicit); STRENGTHENS LSN-001 (cross-link to the chunk-staging residue at FileUtils.java:24 that REMOTE persistence does NOT cover). No retrospective is REFUTED. No CONTRADICTS verdict.

## Maintainer notes

