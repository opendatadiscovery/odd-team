---
playbook: unset-parameter-audit
status: active
since: 2026-05-01
applies_to: universal
---

# PROTOCOL unset-parameter-audit

For every SDK / client builder in the code path behind a change, enumerate every builder parameter and classify each one explicitly. SDK defaults that are unsafe in ODD's deployment context must ship as caveats; otherwise an operator's first deployment hits the silent failure.

## trigger

Any change documenting or modifying an SDK-backed integration:

- attachment storage (MinIO, S3)
- SMTP (`JavaMailSender`)
- OAuth2 / OIDC (Keycloak, Okta, Azure AD)
- Slack webhooks
- LDAP
- Redis
- OTLP exporter
- JDBC / R2DBC
- AWS SSM
- any other third-party SDK builder pattern

## inputs

- bean factory `file:line` that constructs the SDK client
- target builder class (e.g., `MinioAsyncClient.builder()`, `WebClient.builder()`, `HttpClient.create()`)
- the target repo's clone (not GitHub web UI — line offsets must match)

## procedure

1. **Open the bean factory file.** Locate the `builder()` call and every chained `.{param}(...)` / `.with{Param}(...)` call following it.

2. **List the builder's full parameter surface** from the SDK README / Javadoc / Python docstring. WebFetch the upstream SDK docs if needed; the Javadoc on Maven Central or the README on GitHub is authoritative.

3. **Classify each builder parameter**:

   - **`configured from {config.key}`** — explicitly wired to an ODD config key. Note the `application.yml` key.
   - **`safely defaulted — {rationale}`** — the SDK default is acceptable in ODD's deployment context. Brief rationale; or no note in the doc if the default is obvious and inherited upstream.
   - **`caveat-defaulted — {limitation}`** — the SDK default is unsafe or surprising in ODD's context. Ship as a known limitation (admonition block, dedicated section, **not** inline prose). If the code can be fixed, also log an upstream issue draft via `/log-issue` (`playbooks/follow-up-on-disk.md`).

4. **Cross-reference the SDK default** for every parameter classified `safely-defaulted` or `caveat-defaulted`. The SDK README is the SoT for "what does this default to when unset". Memory is not.

5. **Compose a `Builder:` line for the `Sources:` footer**:

   ```
   Builder: {file:line} ({param1: configured from {key} | param2: safely defaulted — {reason} | param3: caveat-defaulted — {limitation}})
   ```

## exit

- Every builder parameter has an explicit classification.
- Every `caveat-defaulted` parameter has a corresponding admonition block in the doc change.
- Every fixable caveat has a corresponding upstream issue draft on disk via `/log-issue`.

## on-fail

- If the SDK README is inaccessible or the builder API is unclear, mark the item `blocked` pending SoT — do not assume "probably safe".
- If a `caveat-defaulted` parameter is found but the doc change does not yet cover it, expand the change scope or extend acceptance criteria; do not ship the change without the caveat.

## case-law

- `retrospectives/LSN-002-minio-region-unset.md` — `MinioAsyncClient.builder()` shipped without `.region(...)`; SDK default `us-east-1` made REMOTE S3 silently fail in any other region. Caught by user spot-check, not by the pipeline. This rule's canonical case.
