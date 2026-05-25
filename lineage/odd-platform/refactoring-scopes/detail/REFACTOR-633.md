# REFACTOR-633 — `/api/slack/events` does NOT verify Slack's `X-Slack-Signature` HMAC; any internet host that can reach the platform's port can forge events

**Severity**: HIGH
**Category**: missing-auth + missing-signature-verification
**Pillars affected**: [P-07 Active Platform Features (Discussions), P-09 Security & Access Control]
**Batch**: ZF (2026-05-25)

**Surfaced by**:
- `odd-platform__java__EventApiController__controller-class__EventApiController.md:bugs_limitations_corner_cases.[0]` (HIGH) — "**No Slack request signature verification.** Slack's Events API protocol requires receivers to validate the `X-Slack-Signature` HMAC-SHA256 header (computed over `v0:{X-Slack-Request-Timestamp}:{raw body}` using the app's signing-secret) per `https://api.slack.com/authentication/verifying-requests-from-slack`. The entire codebase contains zero matches for `X-Slack-Signature`, `signing.secret`, `signingSecret`, `verifySignature`, `HMAC.SHA256`, or any related verification primitive — verified by grep across `<odd-platform>`. The controller deserializes the raw body straight from `@RequestBody Mono<String>` (EventApiController.java:22-27) and never reads any header. Any internet host that can reach the endpoint can forge events."
- `odd-platform__java__EventApiController__controller-class__EventApiController.md:security.known_security_gaps.[0]` — same finding cross-referenced under the security block.
- `odd-platform__java__EventApiController__controller-class__EventApiController.md:stress_findings.request_inputs.[5]` — "The ServerWebExchange / request headers (X-Slack-Signature, X-Slack-Request-Timestamp, X-Slack-Retry-Num) are not bound at all — the controller method signature uses ONLY `@RequestBody Mono<String>` and discards every header. The headers Slack sends … are available-but-unused. This is the closest 'available-but-unused' smell — and the canonical fix anchor for adding signature verification."

**Description**: Slack's Events API documents request-signature verification as the receiver's primary defence against forged events. The protocol:

1. Slack computes `signature_baseline = "v0:{X-Slack-Request-Timestamp}:{raw_body}"`.
2. Slack HMACs the baseline with the app's signing-secret (provisioned per-app in the Slack app dashboard).
3. Slack adds the resulting digest as the `X-Slack-Signature: v0=<hex-digest>` header on every event delivery.
4. The receiver re-computes the digest from `(X-Slack-Request-Timestamp, raw_body, signing_secret)` and compares (constant-time).
5. The receiver rejects events whose signature does not match, OR whose `X-Slack-Request-Timestamp` is older than ~5 minutes (replay window).

The platform does NONE of these. The controller method signature is:

```java
@PostMapping("/api/slack/events")
public Mono<ResponseEntity<SlackEventResponse>> handleSlackEvent(@RequestBody Mono<String> rawRequestBody) {
    return rawRequestBody.map(slackEventParser::parse)...
}
```

— no `@RequestHeader` parameter, no `ServerWebExchange` access to headers, no constant-time HMAC comparison, no rejection path. The entire body is deserialized without any authenticity check.

**Operator-visible failure modes**:

1. **Forged event injection** — any internet host able to reach the platform's port can `POST /api/slack/events` with a synthesized event payload (no signing secret needed). The controller's parse step accepts the payload, classifies it, and (for PAYLOAD events with matching thread_ts) enqueues a row into `message_provider_event`. If the attacker can guess a tracked thread_ts (feasible if ODD is connected to a public Slack channel and the attacker can observe channel history), the forged content appears in the Discussions tab of a tracked data entity.

2. **Replay attack** — an attacker who captures a legitimate Slack event delivery (via a network MitM in a misconfigured deployment, or via a leak of historical webhook payloads) can replay it indefinitely. Without timestamp checking, the platform accepts the replayed payload and (per REFACTOR-634) inserts a duplicate row.

3. **Deployment vulnerability to internet-scanning** — port scanners (Shodan, censys.io) routinely identify `/api/slack/events` endpoints by their characteristic url-verification response shape. Once identified, the endpoint is on a target list for forged-event campaigns.

4. **Cross-tenant injection** — under default deployment (`auth.type=DISABLED`), the controller is also reachable from the same network. An attacker on the internal network can inject events without any external internet reachability.

**Primary source citations**:
- `<odd-platform-api>/src/main/java/.../EventApiController.java:22-27` (the controller; no header bindings).
- `<odd-platform-api>/src/main/java/.../SlackEventParser.java:22-23` (the parser; takes raw body only).
- Slack docs at `https://api.slack.com/authentication/verifying-requests-from-slack` (the documented protocol Slack expects receivers to implement).
- `https://docs.opendatadiscovery.org/configuration-and-deployment/odd-platform#enable-data-collaboration` (the platform's docs that publish the callback URL without warning about the gap).

**Existing-ADR-or-implied-prescription**: The newly-promoted **ADR-CANDIDATE-216 NEW** (this batch) acknowledges the WHITELIST stance is by-design (Slack must reach the endpoint), but explicitly enumerates signature verification as a COMPENSATING CONTROL the architecture does not implement. Adding signature verification does NOT supersede ADR-216; it composes with it. The implied prescription is: signature verification is the standard webhook-defence; its absence is the gap, not the ADR.

**Proposed remedy**: Three-part fix:

1. **Add `datacollaboration.slack-signing-secret` property** to `DataCollaborationProperties` (NEW field, validated non-empty at @PostConstruct when `datacollaboration.enabled=true`). Boot-fail-fast follows the ADR-CANDIDATE-018 pattern.

2. **Wire signature verification in the controller**:

```java
@PostMapping("/api/slack/events")
public Mono<ResponseEntity<SlackEventResponse>> handleSlackEvent(
    @RequestBody Mono<String> rawRequestBody,
    @RequestHeader("X-Slack-Signature") String signature,
    @RequestHeader("X-Slack-Request-Timestamp") String timestamp
) {
    return rawRequestBody
        .flatMap(body -> verifySlackSignature(body, signature, timestamp)
            ? Mono.just(body)
            : Mono.error(new BadUserRequestException("Slack signature verification failed")))
        .map(slackEventParser::parse)
        ...;
}

private boolean verifySlackSignature(String body, String signature, String timestamp) {
    if (Math.abs(System.currentTimeMillis() / 1000 - Long.parseLong(timestamp)) > 300) {
        return false;  // replay-window expired (5 min)
    }
    String baseline = "v0:" + timestamp + ":" + body;
    String expected = "v0=" + HmacUtils.hmacSha256Hex(signingSecret, baseline);
    return MessageDigest.isEqual(expected.getBytes(), signature.getBytes());  // constant-time
}
```

3. **Update live docs** (`https://docs.opendatadiscovery.org/configuration-and-deployment/odd-platform#enable-data-collaboration`):
   - Add a "Slack Signing Secret" subsection explaining the secret's purpose, how to obtain it from the Slack app dashboard, and the new property `datacollaboration.slack-signing-secret`.
   - Add a security note acknowledging that without the secret, the endpoint accepts forged events; the secret is REQUIRED for any production deployment.

4. **Add integration tests** asserting:
   - Forged event WITHOUT signature → 400.
   - Forged event with WRONG signature → 400.
   - Genuine event with valid signature → 200.
   - Genuine event with timestamp older than 5 min → 400 (replay-window expired).

**Severity rationale**: HIGH — the endpoint is internet-reachable by design (per ADR-216) and currently has no protection beyond the feature flag. Adding signature verification is a small one-time engineering investment with permanent security benefit. Operators following the docs to wire Slack inadvertently expose an unauthenticated, signature-unverified webhook on their public internet surface — they CANNOT KNOW from the docs alone that the endpoint is vulnerable. This is the canonical case-of-LSN-001 (silent insecure default in shipped config) for the Slack-events surface.

**Suggested backlog grouping**: `Slack-events hardening sprint` — pair with REFACTOR-634 (idempotency) + REFACTOR-643 (rate-limit) + doc update; a single backlog item bundling the four closes the operator-actionable gap.

**Coherence check** (LSN-018):
- STRENGTHENS: ADR-CANDIDATE-216 (the WHITELIST-by-design stance — this is the missing compensating control); REFACTOR-135 / REFACTOR-513 (notification webhook signing gaps — same class-of-bug on outbound side).
- SUPERSEDES: none.
- CONFLICTS: none.

---
