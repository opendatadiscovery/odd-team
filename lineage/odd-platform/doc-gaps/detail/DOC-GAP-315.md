---
doc_gap_id: DOC-GAP-315
severity: MEDIUM
category: drift (Category B + Category F — YAML key + Java field name promise "request timeout" but implementation wires `HttpClient.responseTimeout(...)`; live doc page describes correctly as "outbound response timeout" but the YAML key itself preserves the misleading promise)
batch: ZK
generated_at: "2026-05-26T00:00:00Z"
generated_at_commit: 4ec2b20
prompt_version: "doc-gap-finder/0.1.0"
maintainer_curated: false
related_pillar_features:
  - "P-12"           # GenAI Assistant (external AI integration)
related_features:
  - F-027            # GenAI Assistant (genai.* config)
related_doc_gaps:
  - DOC-GAP-007      # GenAI security caveats (prompt-injection + SSRF + DISABLED-anonymous)
  - DOC-GAP-017      # GenAI OpenAPI 400/500 contract gap
  - DOC-GAP-018      # API spec no security: block
related_retrospectives:
  - LSN-002          # silent SDK-default operator-trap canonical
  - LSN-020          # NAME-vs-IMPLEMENTATION drift class
---

## DOC-GAP-315 — `genai.request_timeout` YAML key + Java field `requestTimeout` promise REQUEST-SIDE budget (connect + send), but the implementation wires it into Reactor Netty's `HttpClient.responseTimeout(Duration.ofMinutes(N))` at `WebClientConfiguration.java:23` — the RESPONSE timeout (how long to wait for a reply AFTER sending); operator setting `genai.request_timeout=5` expecting "fail fast if sending the request takes more than 5min" actually gets "wait up to 5min for the external service to reply"; for LLMs (where the wait is almost entirely server-side processing) the practical outcome MOSTLY matches operator intent, BUT a misconfigured downstream proxy hanging at TCP/TLS handshake stage is governed by Reactor Netty defaults (NOT by `genai.request_timeout`); live doc page describes the field correctly as "outbound response timeout" but the YAML/env-visible key + Java field NAMES themselves preserve the misleading promise

**Severity**: MEDIUM
**Category**: drift (Category B + Category F — YAML key name preserves a misleading promise even after the live doc corrects it)

### Surfaced by

- `odd-platform__java__config_properties__config-properties-class__GenAIProperties.md:bugs_limitations_corner_cases.[request-vs-response-timeout-drift]` (MEDIUM per sidecar — "Field-name vs SDK-call drift: the YAML key `genai.request_timeout` and the Java field `requestTimeout` are wired into Reactor Netty's `responseTimeout(...)` at `WebClientConfiguration.java:23`. The name says 'request timeout' (the time spent sending); the SDK call sets the 'response timeout' (the time waiting for a reply). The live doc page corrects the name to 'outbound response timeout' but the operator-facing YAML key still misleads.")
- `odd-platform__java__config_properties__config-properties-class__GenAIProperties.md:docs_link_semantic.doc_drift_findings.[request-timeout-naming-drift]` (MEDIUM per sidecar — "Drift candidate (MEDIUM severity — operator-relevant naming): the YAML key is named `request_timeout` and the Java field `requestTimeout`, but the SDK call at `WebClientConfiguration.java:23` wires it into `HttpClient.responseTimeout(...)`, NOT into a request/connect timeout. The field name promises 'how long the platform spends sending the request'; the implementation actually means 'how long the platform waits for the external service's response after the request is sent'. The live doc page calls it 'outbound response timeout' (correct), but the YAML key + Java field name preserve the misleading promise. Naming-vs-behaviour drift class (Category B + Category F).")
- `odd-platform__java__config_properties__config-properties-class__GenAIProperties.md:stress_findings.name_behavior_pairs.[requestTimeout-vs-responseTimeout]` (DRIFT_NAME_VS_BEHAVIOR, STATIC-INFERRED — "An operator who set genai.request_timeout=5 expecting 'fail fast if the request takes more than 5min to send' actually gets 'wait up to 5min for the external service to reply'. For LLMs (where the wait is almost entirely server-side processing) the practical result is close to the operator's intent, BUT a misconfigured downstream proxy that hangs at the TCP/TLS handshake stage would be governed by Reactor Netty defaults, not by genai.request_timeout.")

### Evidence

- **Code primary source — the SDK call**: `odd-platform-api/src/main/java/.../WebClientConfiguration.java:23` (per sidecar primary source): `.responseTimeout(Duration.ofMinutes(genAIProperties.getRequestTimeout()))`. The SDK call is `.responseTimeout(...)` on Reactor Netty's `HttpClient` builder — the wait-for-reply-after-send timeout. The argument is sourced from `genAIProperties.getRequestTimeout()` — the field whose NAME promises a different semantic.
- **Reactor Netty's distinction**: per the library's documented `HttpClient` API, `responseTimeout(Duration)` and `responseTimeout(Function<...>)` set the timeout for receiving the response after the request is sent. Reactor Netty offers SEPARATE knobs for `connectTimeout` (the TCP connect phase) and the implicit send-phase budget — neither of those is set by the platform.
- **The Java field declaration**: `GenAIProperties.java:11` (per sidecar primary source): `private int requestTimeout;` — Lombok `@Data`-generated getter. The field has no Javadoc, no `@Min(1)`, no defaulting; the name `requestTimeout` IS the operator-visible label.
- **The YAML key**: `application.yml:20` (the example) — `genai.request_timeout` (snake_case, Spring relaxed-binding to `requestTimeout`). The application.yml's comment block names the key but does NOT clarify that it's the response timeout.
- **Live doc primary source — the doc CORRECTS the drift but the YAML key NAME preserves it**: per sidecar `docs_link_semantic.fetched_excerpts` (WebFetched 2026-05-26 status 200, anchor `genai-configuration` confirmed): `genai.request_timeout` — outbound response timeout, **in minutes**. The doc page describes the field accurately as "outbound response timeout". But the YAML/env-visible key NAME (`genai.request_timeout` / `GENAI_REQUEST_TIMEOUT`) does NOT change to match. An operator who scans the YAML reference + reads the key name `request_timeout` infers REQUEST-SIDE semantics; the description box's "response timeout" framing is the only correction, and it's a level below the YAML-key anchor in operator-scanning hierarchy.
- **The operator-impact (real-world LLM context)**: for LLM call patterns (where the wait is almost entirely server-side processing — the request is small JSON, the response can take seconds-to-minutes depending on prompt complexity), the practical effect of `request_timeout=N` aligns with operator intent. The drift surfaces in TWO edge cases:
  1. **Slow TCP/TLS handshake at the external service**: if `genai.url` points to a downstream proxy that hangs at the handshake stage (DNS lookup, TLS negotiation), the platform waits on Reactor Netty's DEFAULT connect timeout (typically ~30s, not operator-tunable here). The `genai.request_timeout` does NOT kick in until the response wait begins. An operator setting `request_timeout=10` expecting a 10-second total budget gets up to ~30s of handshake + 10s of response wait = ~40s total.
  2. **Large request payload (rare for LLM JSON, but possible for batched prompts)**: if the request payload takes > N minutes to upload, the platform waits on Reactor Netty's implicit send-phase budget (no explicit cap; bounded only by `HttpClient.requestTimeout` if set — it ISN'T). The `genai.request_timeout` doesn't apply.
- **The drift class — Category B + Category F combined**: Category B (live doc actively wrong on the field name's intuitive semantic — the YAML key NAME contradicts the SDK call NAME) + Category F (DRIFT_INPUT_NAME_VS_IMPLEMENTATION — the field name promises one semantic, the implementation gives another). The live doc page's "outbound response timeout" framing is the corrective text, but the YAML key itself is the operator's first read.
- **The available-but-unused mechanism**: Reactor Netty exposes `connectTimeout` and `requestTimeout` knobs (DIFFERENT from `responseTimeout`); the platform exposes NEITHER as an operator-tunable. An operator who wants a true REQUEST-side budget (the field name's intuitive promise) has NO way to set it. The available-but-unused knobs are `HttpClient.option(ChannelOption.CONNECT_TIMEOUT_MILLIS, ...)` and `HttpClient.requestTimeout(...)` — both are absent from `WebClientConfiguration.java:22-29`.
- **Cross-reference to LSN-002 family**: LSN-002 is the "silent SDK-default" operator-trap canonical (MinIO region unset by SDK builder). THIS finding is the adjacent case: a config knob whose NAME suggests a budget that controls a different SDK parameter. The same operator-mental-model class.

### Proposed doc action

**TWO-PART action — doc-side anchor-level clarification + code-side rename (advisory).**

1. **Doc-side PRIMARY — extend `documentation/docs/configuration-and-deployment/odd-platform.md` at the GenAI Configuration section**:

   Replace the current verbatim copy:
   > `genai.request_timeout` — outbound response timeout, **in minutes**. ...

   With an expanded version that surfaces the drift explicitly:
   > `genai.request_timeout` (alias `GENAI_REQUEST_TIMEOUT`) — **the outbound RESPONSE timeout, in minutes**. This controls how long the platform waits for the external AI service to REPLY after the request is sent (Reactor Netty's `HttpClient.responseTimeout(Duration.ofMinutes(N))`).
   >
   > **Naming caveat — what this is NOT**: despite the key's name, this is NOT a request-side timeout (it does not bound DNS lookup, TLS handshake, TCP-connect, or send-phase duration). Those phases use Reactor Netty's defaults (typically ~30s for connect, no explicit send cap). Total operator-experienced latency = (default ~30s connect/handshake) + N minutes response wait.
   >
   > **Sensible defaults for common LLM patterns**:
   > - Fast LLM (< 10s typical response): `genai.request_timeout: 1` (1 min ceiling)
   > - Standard LLM (10-60s typical): `genai.request_timeout: 5`
   > - Long-form generation: `genai.request_timeout: 10-15`
   >
   > **Defaults**: the Java field default is `0` (primitive `int`) which means immediate timeout — operators MUST set this explicitly (see warning admonition above).

2. **Code-side OPTIONAL (file `/log-issue odd-platform`)** — three ordered options:

   - **Minimum (alias)**: add a relaxed-binding alias `genai.response_timeout` → `requestTimeout` (Spring `@ConfigurationProperties` allows multiple key paths via relaxed binding; document both names; deprecate `request_timeout` in OpenAPI / Javadoc with a `@deprecated` annotation. Backward-compatible.

   - **Medium (rename)**: rename the field to `responseTimeout` (Java) + `genai.response_timeout` (YAML) — breaking change in the next major release. Add a fallback binding for `genai.request_timeout` that emits a startup WARN. Aligns the operator-facing key with the SDK call.

   - **Full (add the missing knobs)**: add `genai.connect_timeout` (binding to `HttpClient.option(CONNECT_TIMEOUT_MILLIS, ...)`) + `genai.send_timeout` (binding to a custom send-phase budget). Surfaces the REQUEST-side budget operators expect. Bigger change; bigger value.

   **Recommended path**: doc-side fix lands first; code-side Minimum alias is a small `@ConfigurationProperties` extension; the rename + missing knobs are next-major-release candidates.

### Cross-references

- **DOC-GAP-007** (GenAI security caveats — sibling GenAI doc-gap; prompt-injection + SSRF + DISABLED-anonymous reachability) — combined with THIS finding the GenAI configuration coverage is more complete.
- **DOC-GAP-017** (GenAI OpenAPI 400/500 contract gap) — sibling; the absent error contract compounds the operator-confusion when `requestTimeout=0` produces immediate timeout (the operator-visible error message is "Gen AI request take longer that 0 min" — a confusing render of the misconfigured value back at the operator).
- **F-027** (GenAI Assistant feature flow) — THIS finding extends F-027's configuration documentation.
- **LSN-002** (silent SDK-default operator-trap canonical) — direct family match: a config knob whose NAME suggests one SDK semantic and implementation provides another.
- **LSN-020** (NAME-vs-IMPLEMENTATION drift class) — direct class match: the parameter NAME (`requestTimeout`) is a transparent promise; the SDK call (`responseTimeout`) is the implementation.

### Severity rationale

MEDIUM. The drift is real and operator-relevant but bounded by the typical LLM-call pattern. Severity classification:

1. **The practical outcome MOSTLY matches operator intent for LLM use cases**: the LLM response wait IS the dominant latency component; an operator setting `request_timeout=5` mostly gets the bound they wanted for the response-wait phase. The drift surfaces only in TCP/TLS handshake-hang edge cases.
2. **The drift IS structurally visible**: any operator scanning the YAML key list sees `request_timeout` and infers REQUEST-SIDE semantics; the doc page's "outbound response timeout" framing is corrective but is a level below the YAML key anchor in operator-scanning hierarchy.
3. **The available-but-unused knobs (connect_timeout, send_timeout) are real Reactor Netty surface**: an operator with a misconfigured downstream proxy has NO way to bound the TCP-connect or send phases via platform config. The platform's surface is incomplete relative to Reactor Netty's actual capability.
4. **The fix is bounded**: doc-side correction is one section rewrite; code-side alias is a few lines of `@ConfigurationProperties` extension; full rename is next-major-release.
5. **The compounding factor — primitive `int` default of 0**: per the GenAIProperties sidecar `bugs_limitations_corner_cases.[zero-timeout-silent-accept]` (also captured in DOC-GAP-007's broader cluster), `requestTimeout` defaults to `0` (Java primitive) when the YAML key is unset. `Duration.ofMinutes(0)` is a legal zero Duration; Reactor Netty's `responseTimeout(Duration.ZERO)` triggers immediate timeout; the operator-visible error is "Gen AI request take longer that 0 min" — confusing render of the misconfigured value. This compounds with the drift: operators who didn't realise they had to set the timeout AND don't understand the field name's semantic encounter a doubly-misleading failure mode.

Severity is NOT HIGH because: (a) the practical outcome MOSTLY matches operator intent for LLM patterns; (b) no data is lost or corrupted; (c) the workaround (set the field explicitly to a sensible value) is operator-discoverable. Severity is NOT LOW because: (a) the YAML key name itself is operator-misleading; (b) the missing Reactor Netty knobs are real operational gaps; (c) the field-name vs SDK-call divergence is the LSN-002 class.

### Last verified

- 2026-05-26 — GenAIProperties config-properties-class sidecar PRIMARY SOURCE at substrate commit `4ec2b20`; live WebFetch `https://docs.opendatadiscovery.org/configuration-and-deployment/odd-platform` status **200** (anchor `genai-configuration` present; verbatim "outbound response timeout, in minutes" copy confirmed in the sidecar `inferred_docs[0]` fetched 2026-05-26).
- Code primary source: `WebClientConfiguration.java:23` (`.responseTimeout(Duration.ofMinutes(genAIProperties.getRequestTimeout()))`) — verified via the sidecar's primary-source citation chain.
