---
id: docs/accuracy/config-options
target_repo: documentation (local: ../documentation) + odd-platform (local) + odd-collectors (local)
scope: Documented configuration options vs. actual application config AND consumer code
estimated_items: 15-30
chunking: Platform config in one session, collectors config in another
depends_on: []
priority: critical
---

## Purpose

Verify that documented configuration options (environment variables, YAML keys, command-line flags) exist, default as described, and **behave as described at the consumer site**. Config that looks correct in `application.yml` can still mislead operators if the consumer code drops a parameter, hardcodes a region, or silently falls back to a default that does not work in the project's deployment context.

The DOC-008 root cause (2026-04-23) is the reference case for why this scanner reads consumer code, not just config files: `attachment.remote.*` keys were documented correctly against `application.yml`, but `MinioConfig.java` never called `.region(...)` on the MinIO builder — meaning every bucket outside `us-east-1` silently fails with `AuthorizationHeaderMalformed`. A YAML-only audit could never have seen that; a consumer-code audit catches it on the first pass.

## Method

Run **both** passes below. A finding can be raised from either pass; a thorough scan runs both and cross-references.

### Pass A — Declaration audit (surface)

1. Fetch configuration/setup documentation from the documentation repo.
2. Extract all documented config keys, env vars, defaults, and described behavior.
3. Cross-reference against:
   - `odd-platform-api/src/main/resources/application.yml` (and `application-*.yml` profiles)
   - Collector `config_examples/` directories
   - Docker compose files in `docker/`
   - Dockerfile `ENV` declarations

### Pass B — Consumer-code audit (depth — MANDATORY)

For every documented key, trace it forward into the running code. This is the pass that catches silent integration caveats.

1. **Find every `@Value("${key}")` / `@ConfigurationProperties` consumer** for the key (Grep `@Value.*{key}` across `odd-platform-api/`; for collectors, the analogous pydantic model / env-read). Record each consumer `file:line`.
2. **Read each consumer.** What does the consumer do with the value? Parse it? Feed it to an SDK builder? Fall back to a hardcoded default if missing?
3. **If the consumer feeds an SDK / client builder** (S3/MinIO, JavaMailSender, OAuth2/OIDC client, Slack webhook, LDAP, Redis, OTLP exporter, JDBC/R2DBC, AWS SSM), open the bean factory and **enumerate every builder parameter**. For each parameter:
   - `configured from {config.key}` — wired from a documented key.
   - `safely defaulted — {rationale + SDK-doc link}` — SDK default is acceptable for ODD's deployments.
   - `caveat-defaulted — {limitation}` — SDK default is unsafe or surprising; this is a finding (document as a known limitation, and log a platform-side fix candidate).
4. **Check profile-specific overrides.** `application-*.yml` files can override defaults; the doc should describe the effective default for the primary profile operators use.
5. **Check error / retry / timeout handlers** for any key that affects them. Undocumented timeout behavior is a caveat, not a footnote.

### Pass C — Reverse audit (coverage)

For every key that exists in `application.yml`, check the docs cover it. Keys not mentioned anywhere in the documentation repo are undocumented-feature findings (severity depends on operator impact — data-loss defaults are critical, ergonomic keys are medium).

## Criteria for a Finding

### Existence and correctness (Pass A)
- Documented config key doesn't exist in application config files
- Documented env var is never read in code (no `@Value`, no `System.getenv`, etc.)
- Documented default value differs from actual default
- Documented config option has been renamed (old name still in docs)
- Documented required fields are actually optional (or vice versa)
- Documented value format (e.g., "comma-separated list") doesn't match parsing logic

### Consumer behavior (Pass B) — the DOC-008 class
- SDK builder leaves a parameter unset that has an unsafe default in ODD's context (e.g., MinIO `.region(...)` → only `us-east-1` works)
- Config key is read but silently ignored in some code paths (dead config)
- Consumer hardcodes a value that the doc claims is configurable
- Error / retry / timeout behavior is not documented even though it materially affects operators (data loss, silent failures, unexpected latency)
- Authentication / TLS / credential defaults that are unsafe in the documented deployment context

### Coverage (Pass C)
- Config key exists in `application.yml` but is not mentioned in the documentation repo. Severity scales with operator impact — a key whose default causes data loss is critical.

## Navigation

Before scanning, read `navigation/domains/{feature}.md` for the relevant area. If the domain file does not list the bean factory / SDK builder for an integration, that is itself a navigation gap — fix it before scanning so the next scan does not have to grep.

## Output

Write to: `findings/docs-accuracy-config-options/YYYY-MM-DD-{target}.md`

Per finding, include:
- Doc page and the configuration claim (or absence)
- `application.yml` or config-file location
- **Consumer-read evidence** (file:line) for every claim — per Pass B, this is required, not optional
- For SDK integrations, include the **unset-parameter table** from Pass B step 3
- Classification: missing | renamed | wrong-default | wrong-format | caveat-defaulted | unsafe-default | undocumented

Findings without consumer-read evidence for integration-backed keys should themselves be flagged by review as incomplete scans.
